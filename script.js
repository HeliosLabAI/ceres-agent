const state = {
  view: "home",
  settingsPage: "general",
  leftSidebarCollapsed: false
};

let showToast; // Will be set as alias to showNotification

const SETTINGS_STORAGE_KEY = 'ceresReplicaSettings';

const defaultSettings = {
  general: {
    openDestination: 'file-explorer',
    terminalShell: 'PowerShell',
    language: 'Auto Detect',
    detailLevel: 'Coding',
    popoutHotkey: '',
    requireShiftEnter: false,
    followUpBehavior: 'queue',
    codeReview: 'inline',
    turnCompletionNotifications: 'Only when unfocused',
    permissionNotifications: true,
    questionNotifications: true
  },
  appearance: {
    themeMode: 'system',
    lightTheme: 'Aa Ceres',
    darkTheme: 'Aa Ceres',
    accent: '#339cff',
    lightBackground: '#ffffff',
    lightForeground: '#2a2a2a',
    darkBackground: '#181818',
    darkForeground: '#ffffff',
    uiFont: '"Segoe UI", system-ui, sans-serif',
    codeFont: 'Consolas, "SFMono-Regular", monospace',
    translucentSidebar: true,
    contrast: 45
  },
  configuration: {
    customConfig: 'user',
    approvalPolicy: 'on-request',
    sandbox: 'read-only',
    dependenciesEnabled: true
  },
  personalization: {
    personality: 'Friendly',
    customInstructions: '',
    userInstructionsFile: '',
    memoriesEnabled: false,
    skipToolChats: false
  },
  mcp: {
    servers: []
  },
  git: {
    branchPrefix: 'ceres/',
    mergeMethod: 'merge',
    showPrIcons: false,
    alwaysForcePush: false,
    draftPrs: true,
    commitInstructions: '',
    prInstructions: ''
  },
  environments: {
    projects: [{ name: 'Current workspace', path: window.location?.pathname || '' }]
  },
  worktrees: {
    autoDelete: true,
    autoDeleteLimit: 15
  }
};

const themePresets = {
  light: {
    'Aa Ceres': { background: '#ffffff', foreground: '#2a2a2a' },
    'Warm Paper': { background: '#f6efe5', foreground: '#3d3129' },
    'Cool Slate': { background: '#edf3f8', foreground: '#1f2d3d' }
  },
  dark: {
    'Aa Ceres': { background: '#181818', foreground: '#ffffff' },
    Carbon: { background: '#111315', foreground: '#f3f4f6' },
    'Night Ink': { background: '#111827', foreground: '#e5eefc' }
  }
};

const dropdownState = {
  openSetting: null
};

function mergeSettings(base, stored) {
  const output = Array.isArray(base) ? [...base] : { ...base };
  Object.entries(stored || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      output[key] = value;
      return;
    }
    if (value && typeof value === 'object' && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      output[key] = mergeSettings(base[key], value);
      return;
    }
    output[key] = value;
  });
  return output;
}

function loadAppSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || 'null');
    return mergeSettings(defaultSettings, saved || {});
  } catch (error) {
    console.error('Failed to load settings:', error);
    return mergeSettings(defaultSettings, {});
  }
}

const appSettings = loadAppSettings();

// File Explorer State
const fileExplorerState = {
  directoryHandle: null,
  fileTree: null,
  expandedFolders: new Set(),
  activeFile: null,
  openTabs: new Map(), // filepath -> file content
  tabsOrder: [],
  files: new Map() // filepath -> { name, content, type, size }
};

// Chat History State
const chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');

// Multi-Agent State
const multiAgentState = {
  enabled: false,
  agents: [
    { id: 1, model: 'llama3.2', prefix: '', active: true },
    { id: 2, model: 'llama3.2', prefix: '', active: true },
    { id: 3, model: 'llama3.2', prefix: '', active: true }
  ],
  config: {
    agent1: { model: 'llama3.2', prefix: '' },
    agent2: { model: 'llama3.2', prefix: '' },
    agent3: { model: 'llama3.2', prefix: '' }
  },
  instances: []
};

// Pending image attachments array
let pendingImageAttachments = [];

// Load available Ollama models into multi-agent dropdowns
async function loadMultiAgentModels() {
  try {
    const models = await getOllamaModels();
    const selectIds = ['multiAgentModel1', 'multiAgentModel2', 'multiAgentModel3'];
    
    selectIds.forEach((id, index) => {
      const select = document.getElementById(id);
      if (!select) return;
      
      // Clear current options
      select.innerHTML = '';
      
      if (models.length === 0) {
        select.innerHTML = '<option value="">No models available</option>';
        return;
      }
      
      // Add models
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = model.name;
        select.appendChild(option);
      });
      
      // Set saved selection or default
      const saved = localStorage.getItem('multiAgentConfig');
      let savedModel;
      if (saved) {
        const config = JSON.parse(saved);
        savedModel = config[`agent${index + 1}`]?.model;
      }
      select.value = savedModel || models[index]?.name || models[0]?.name;
    });
    
    showNotification(`Loaded ${models.length} Ollama models`);
  } catch (error) {
    console.error('Failed to load Ollama models:', error);
    showNotification('Failed to load models - check Ollama connection');
  }
}

// Load saved multi-agent config
function loadMultiAgentConfig() {
  const saved = localStorage.getItem('multiAgentConfig');
  if (saved) {
    const config = JSON.parse(saved);
    multiAgentState.agents[0].model = config.agent1?.model || '';
    multiAgentState.agents[0].prefix = config.agent1?.prefix || '';
    multiAgentState.agents[1].model = config.agent2?.model || '';
    multiAgentState.agents[1].prefix = config.agent2?.prefix || '';
    multiAgentState.agents[2].model = config.agent3?.model || '';
    multiAgentState.agents[2].prefix = config.agent3?.prefix || '';
  }
  // Load models into dropdowns
  loadMultiAgentModels();
}

// Save multi-agent config
function saveMultiAgentConfig() {
  const config = {
    agent1: { model: document.getElementById('multiAgentModel1')?.value, prefix: document.getElementById('agent1Prefix')?.value },
    agent2: { model: document.getElementById('multiAgentModel2')?.value, prefix: document.getElementById('agent2Prefix')?.value },
    agent3: { model: document.getElementById('multiAgentModel3')?.value, prefix: document.getElementById('agent3Prefix')?.value }
  };
  localStorage.setItem('multiAgentConfig', JSON.stringify(config));
  loadMultiAgentConfig();
  showNotification('Multi-Agent configuration saved!');
}

// Reset multi-agent config
function resetMultiAgentConfig() {
  document.getElementById('multiAgentModel1').value = 'llama3.2';
  document.getElementById('agent1Prefix').value = '';
  document.getElementById('multiAgentModel2').value = 'codellama';
  document.getElementById('agent2Prefix').value = '';
  document.getElementById('multiAgentModel3').value = 'mistral';
  document.getElementById('agent3Prefix').value = '';
  saveMultiAgentConfig();
}

// Toggle multi-agent mode
function toggleMultiAgentMode() {
  multiAgentState.enabled = !multiAgentState.enabled;
  const btn = document.getElementById('multiAgentBtn');
  if (btn) {
    btn.classList.toggle('active', multiAgentState.enabled);
    btn.style.color = multiAgentState.enabled ? '#22c55e' : '';
  }
  showNotification(multiAgentState.enabled ? 'Multi-Agent Mode ON - 3 agents will run in parallel' : 'Multi-Agent Mode OFF');
}

// Message Queue System
const messageQueue = [];
let isProcessing = false;
let currentRequest = null; // For aborting

function addToQueue(message) {
  messageQueue.push(message);
  if (!isProcessing) {
    processQueue();
  }
}

async function processQueue() {
  if (messageQueue.length === 0) {
    isProcessing = false;
    enableInput();
    return;
  }
  
  isProcessing = true;
  disableInput();
  
  const message = messageQueue.shift();
  await sendMessageToOllama(message);
  
  // Process next message
  processQueue();
}

function disableInput() {
  const textarea = document.getElementById('main-textarea');
  const sendBtn = document.getElementById('sendBtn');
  if (textarea) {
    textarea.disabled = true;
    textarea.placeholder = 'Waiting for response...';
  }
  if (sendBtn) {
    sendBtn.classList.add('sending');
    sendBtn.style.cursor = 'not-allowed';
  }
}

function enableInput() {
  const textarea = document.getElementById('main-textarea');
  const sendBtn = document.getElementById('sendBtn');
  console.log('enableInput called - textarea:', textarea, 'sendBtn:', sendBtn);
  if (textarea) {
    textarea.disabled = false;
    textarea.placeholder = 'Ask Ceres anything...';
    textarea.focus();
  }
  if (sendBtn) {
    sendBtn.classList.remove('sending');
    sendBtn.style.cursor = 'pointer';
    sendBtn.style.pointerEvents = 'auto';
    sendBtn.disabled = false;
    console.log('Send button enabled, classes:', sendBtn.className);
  }
}

// Notification/Toast system
function showNotification(message, type = 'info', duration = 3000) {
  // Alias for backwards compatibility
  showToast = showNotification;
  // Create container if it doesn't exist
  let container = document.querySelector('.notification-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  // Icon based on type
  const icons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ'
  };
  
  notification.innerHTML = `
    <span style="font-size: 18px;">${icons[type] || icons.info}</span>
    <span style="flex: 1; font-size: 14px; color: var(--text);">${message}</span>
  `;
  
  container.appendChild(notification);
  
  // Remove after duration
  setTimeout(() => {
    notification.classList.add('hiding');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, duration);
}

// Terminal command approval dialog
let currentTerminalOutput = {};

function setupTerminalCommandDialog() {
  // Commands now show inline in chat, not as modal dialog
  // The approval is handled via handleCommandApproval function in renderAgentStructuredContent
  
  // Listen for real-time terminal output
  if (window.electronAPI && window.electronAPI.onTerminalOutput) {
    window.electronAPI.onTerminalOutput(({ type, data, command }) => {
      // Store output for this command
      if (!currentTerminalOutput[command]) {
        currentTerminalOutput[command] = { stdout: '', stderr: '' };
      }
      currentTerminalOutput[command][type] += data;
      
      // Update the terminal display in real-time
      updateTerminalOutputDisplay(command, type, data);
    });
  }
}

function updateTerminalOutputDisplay(command, type, data) {
  // Find the terminal command element for this command
  const terminalElements = document.querySelectorAll('[data-terminal-command]');
  terminalElements.forEach(el => {
    if (el.dataset.terminalCommand === command) {
      const outputEl = el.querySelector('.terminal-output');
      if (outputEl) {
        const line = document.createElement('div');
        line.style.cssText = type === 'stderr' 
          ? 'color: #dc2626; font-family: monospace; font-size: 12px; white-space: pre-wrap;'
          : 'color: #374151; font-family: monospace; font-size: 12px; white-space: pre-wrap;';
        line.textContent = data;
        outputEl.appendChild(line);
        outputEl.scrollTop = outputEl.scrollHeight;
      }
    }
  });
}

let currentCommandApproval = null;

function saveChatHistory() {
  localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
}

function getVisibleChatHistory() {
  return chatHistory.filter(chat => !chat.archived);
}

function getArchivedChatHistory() {
  return chatHistory.filter(chat => chat.archived);
}

function addChatToHistory(message, response) {
  const chat = {
    id: Date.now(),
    title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
    message: message,
    response: response,
    timestamp: new Date().toISOString()
  };
  chatHistory.unshift(chat);
  saveChatHistory();
  updateChatList();
  updateSearchResults();
}

function updateChatList() {
  const chatList = document.getElementById('chatList');
  if (!chatList) return;
  const visibleChats = getVisibleChatHistory();
  
  if (visibleChats.length === 0) {
    chatList.innerHTML = '<div class="section-empty">No chats yet. Start a conversation!</div>';
    return;
  }
  
  chatList.innerHTML = visibleChats.slice(0, 10).map(chat => {
    const time = new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <button class="chat-row" data-chat-id="${chat.id}">
        <span class="row-title">${escapeHtml(chat.title)}</span>
        <span class="row-meta">${time}</span>
      </button>
    `;
  }).join('');
}

function filterSearchResults(query) {
  const searchResults = document.getElementById('searchResults');
  if (!searchResults) return;
  
  const visibleChats = getVisibleChatHistory();
  
  // Filter chats based on query
  const filteredChats = query 
    ? visibleChats.filter(chat => 
        (chat.message && chat.message.toLowerCase().includes(query)) ||
        (chat.response && chat.response.toLowerCase().includes(query))
      )
    : visibleChats;
  
  if (filteredChats.length === 0) {
    searchResults.innerHTML = `
      <div class="search-subhead">Chat History</div>
      <div class="search-empty">No matching chats found</div>
    `;
    return;
  }
  
  searchResults.innerHTML = '<div class="search-subhead">Chat History</div>' + 
    filteredChats.map((chat, index) => {
      const time = new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const preview = chat.message ? chat.message.substring(0, 50) + (chat.message.length > 50 ? '...' : '') : 'No message';
      return `
        <button class="search-result" data-chat-id="${chat.id}">
          <span class="search-result-left">
            <svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span class="search-result-title">${escapeHtml(preview)}</span>
          </span>
          <span class="search-shortcut">${time}</span>
        </button>
      `;
    }).join('');
  
  // Add click handlers to filtered results
  searchResults.querySelectorAll('.search-result').forEach(btn => {
    btn.addEventListener('click', () => {
      const chatId = btn.dataset.chatId;
      loadChat(chatId);
      hidePopups();
    });
  });
}

function updateSearchResults() {
  const searchResults = document.getElementById('searchResults');
  if (!searchResults) return;
  const visibleChats = getVisibleChatHistory();
  
  if (visibleChats.length === 0) {
    searchResults.innerHTML = `
      <div class="search-subhead">Chat History</div>
      <div class="search-empty">No chat history yet. Start a new chat!</div>
    `;
    return;
  }
  
  searchResults.innerHTML = '<div class="search-subhead">Chat History</div>' + 
    visibleChats.map((chat, index) => {
      const time = new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <button class="search-result" data-chat-id="${chat.id}">
          <span class="search-result-left">
            <svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            ${escapeHtml(chat.title)}
          </span>
          <span class="kbd">Ctrl+${index + 1}</span>
        </button>
      `;
    }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show image attachment pills in prompt box (supports multiple)
function showImageAttachmentPills() {
  const pillsContainer = document.getElementById('attachmentPills');
  if (!pillsContainer) return;
  
  // Clear and rebuild all pills
  pillsContainer.innerHTML = '';
  
  pendingImageAttachments.forEach((attachment, index) => {
    // Create pill element - matching screenshot style
    const pill = document.createElement('div');
    pill.className = 'attachment-pill';
    pill.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 20px; font-size: 13px; color: #374151; max-width: 180px; flex-shrink: 0;';
    
    // Truncate filename if too long (show more chars like screenshot)
    const displayName = attachment.name.length > 15 ? attachment.name.substring(0, 12) + '...' : attachment.name;
    
    pill.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; color: #6b7280;">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">${escapeHtml(displayName)}</span>
      <button onclick="removeImageAttachment(${index})" style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; padding: 0; border: none; background: none; cursor: pointer; color: #9ca3af; flex-shrink: 0; margin-left: 2px;" title="Remove">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    
    pillsContainer.appendChild(pill);
  });
  
  pillsContainer.style.display = 'flex';
  pillsContainer.style.flexWrap = 'nowrap';
  pillsContainer.style.overflowX = 'auto';
  pillsContainer.style.gap = '8px';
  
  // Adjust prompt box size based on number of attachments
  adjustPromptBoxSize();
}

// Remove single image attachment by index
function removeImageAttachment(index) {
  pendingImageAttachments.splice(index, 1);
  showImageAttachmentPills();
  
  // Hide container if no attachments left
  if (pendingImageAttachments.length === 0) {
    const pillsContainer = document.getElementById('attachmentPills');
    if (pillsContainer) {
      pillsContainer.style.display = 'none';
    }
    adjustPromptBoxSize();
  }
}

// Remove all image attachments
function removeAllImageAttachments() {
  pendingImageAttachments = [];
  const pillsContainer = document.getElementById('attachmentPills');
  if (pillsContainer) {
    pillsContainer.innerHTML = '';
    pillsContainer.style.display = 'none';
  }
  adjustPromptBoxSize();
}

// Adjust prompt box size based on attachment count
function adjustPromptBoxSize() {
  const composerCard = document.querySelector('.composer-card');
  const textarea = document.getElementById('main-textarea');
  const pillsContainer = document.getElementById('attachmentPills');
  if (!composerCard || !textarea) return;
  
  const count = pendingImageAttachments.length;
  
  // Show/hide pills container based on count
  if (pillsContainer) {
    if (count === 0) {
      pillsContainer.style.display = 'none';
    } else {
      pillsContainer.style.display = 'flex';
    }
  }
}

// Start a new chat - clear current chat and show welcome screen
function startNewChat() {
  // Clear chat container
  const chatContainer = document.getElementById('chatContainer');
  if (chatContainer) {
    chatContainer.innerHTML = '';
    chatContainer.style.display = 'none';
  }
  
  // Show welcome screen
  const welcomeScreen = document.getElementById('welcomeScreen');
  if (welcomeScreen) {
    welcomeScreen.style.display = 'flex';
  }
  
  // Clear textarea
  const textarea = document.getElementById('main-textarea');
  if (textarea) {
    textarea.value = '';
  }
  
  // Clear any pending attachments
  removeAllImageAttachments();
  
  // Reset agent state if needed
  if (window.aiAgent && window.aiAgent.isRunning) {
    window.aiAgent.cancel();
  }
  
  showNotification('New chat started');
}

// Toggle send button loading state
function setSendButtonLoading(isLoading) {
  const sendIcon = document.getElementById('sendIcon');
  const loadingIcon = document.getElementById('loadingIcon');
  const sendBtn = document.getElementById('sendBtn');
  
  if (!sendIcon || !loadingIcon) return;
  
  if (isLoading) {
    sendIcon.style.display = 'none';
    loadingIcon.style.display = 'block';
    if (sendBtn) {
      sendBtn.style.background = '#111827';
      sendBtn.style.color = 'white';
    }
  } else {
    sendIcon.style.display = 'block';
    loadingIcon.style.display = 'none';
    if (sendBtn) {
      sendBtn.style.background = '';
      sendBtn.style.color = '';
    }
  }
}

// Update Recent Folders UI
function updateRecentFoldersUI() {
  const recentFoldersList = document.getElementById('recentFoldersList');
  if (!recentFoldersList) return;
  
  const recentFolders = JSON.parse(localStorage.getItem('recentFolders') || '[]');
  
  if (recentFolders.length === 0) {
    recentFoldersList.innerHTML = '<div class="section-empty">No recent folders</div>';
    return;
  }
  
  recentFoldersList.innerHTML = recentFolders.slice(0, 5).map(folder => `
    <div class="chat-row" onclick="openRecentFolder('${escapeHtml(folder.path)}')" style="cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; hover: background: rgba(0,0,0,0.04);">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span class="file-name" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px;">${escapeHtml(folder.name)}</span>
    </div>
  `).join('');
}

// Update Operation Folder UI
function updateOperationFolderUI(folderPath) {
  const operationFolder = document.getElementById('operationFolder');
  if (!operationFolder || !folderPath) return;
  
  const folderName = folderPath.split(/[\\/]/).pop() || folderPath;
  operationFolder.innerHTML = `
    <div class="chat-row" style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; background: rgba(59, 130, 246, 0.1);">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" color="#3b82f6"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span class="file-name" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: #3b82f6; font-weight: 500;">${escapeHtml(folderName)}</span>
    </div>
    <div style="font-size: 11px; color: #6b7280; padding: 4px 8px; word-break: break-all;">${escapeHtml(folderPath)}</div>
  `;
}

// Add folder to recent folders
function addToRecentFolders(folderPath) {
  if (!folderPath) return;
  
  const folderName = folderPath.split(/[\\/]/).pop() || folderPath;
  let recentFolders = JSON.parse(localStorage.getItem('recentFolders') || '[]');
  
  // Remove if already exists
  recentFolders = recentFolders.filter(f => f.path !== folderPath);
  
  // Add to front
  recentFolders.unshift({ path: folderPath, name: folderName, timestamp: Date.now() });
  
  // Keep only 10 most recent
  recentFolders = recentFolders.slice(0, 10);
  
  localStorage.setItem('recentFolders', JSON.stringify(recentFolders));
  updateRecentFoldersUI();
}

// Open a recent folder
async function openRecentFolder(folderPath) {
  // This would need to re-open the folder - for now just show notification
  showNotification(`Opening ${folderPath}...`);
  // In a real implementation, you'd restore the folder handle or re-open it
}

// Load a chat from history
function loadChat(chatId) {
  console.log('Loading chat:', chatId);
  console.log('Chat history:', chatHistory);
  
  const chat = chatHistory.find(c => String(c.id) === String(chatId));
  if (!chat) {
    console.error('Chat not found:', chatId);
    return;
  }
  
  console.log('Found chat:', chat);
  
  // Show the chat container
  const chatContainer = document.getElementById('chatContainer');
  if (chatContainer) {
    chatContainer.style.display = 'block';
  }
  
  // Hide welcome screen
  const welcomeScreen = document.getElementById('welcomeScreen');
  if (welcomeScreen) {
    welcomeScreen.style.display = 'none';
  }
  
  // Clear current chat
  const chatContainerDiv = document.getElementById('chatContainer');
  if (chatContainerDiv) {
    chatContainerDiv.innerHTML = '';
  }
  
  // Add user message
  if (chat.message) {
    addMessageToChat('user', chat.message);
  }
  
  // Add assistant response
  if (chat.response) {
    addMessageToChat('assistant', chat.response);
  }
  
  showNotification('Chat loaded from history');
}

function syncLineNumbers() {
  const codeTextarea = document.getElementById('codeTextarea');
  const lineNumbers = document.getElementById('lineNumbers');
  
  if (codeTextarea && lineNumbers) {
    lineNumbers.scrollTop = codeTextarea.scrollTop;
  }
}

function saveCurrentFile() {
  if (!fileExplorerState.activeTab) return;
  
  const codeTextarea = document.getElementById('codeTextarea');
  if (!codeTextarea) return;
  
  const file = fileExplorerState.files.get(fileExplorerState.activeTab);
  if (file) {
    file.content = codeTextarea.value;
    file.size = new Blob([file.content]).size;
    updateFileInfo(file);
    
    // Show save feedback
    const saveBtn = document.getElementById('saveFileBtn');
    if (saveBtn) {
      const original = saveBtn.innerHTML;
      saveBtn.innerHTML = `<svg class="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
      setTimeout(() => saveBtn.innerHTML = original, 1000);
    }
  }
}

// Ollama integration
const OLLAMA_BASE_URL = 'http://localhost:11434';
let currentModel = null;
let currentMode = 'agent'; // 'ask' or 'agent'

async function getOllamaModels() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) throw new Error('Failed to fetch models');
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Ollama connection error:', error);
    return [];
  }
}

function formatSize(bytes) {
  if (!bytes) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

async function loadOllamaModelsToDropdown() {
  const models = await getOllamaModels();
  const dropdown = document.getElementById('model-dropdown-prompt');
  const selectedModelSpan = document.querySelector('.selected-model-prompt');
  
  if (dropdown) {
    if (models.length === 0) {
      dropdown.innerHTML = '<div class="dropdown-header">Select Model</div><div class="dropdown-items"><div class="dropdown-item">No models - Start Ollama</div></div>';
    } else {
      // Set first model as default
      if (!currentModel) {
        currentModel = models[0].name;
        enableInput(); // Enable textarea when model is loaded
      }
      
      if (selectedModelSpan) {
        selectedModelSpan.textContent = currentModel;
      }
      
      dropdown.innerHTML = `
        <div class="dropdown-header">Select Model</div>
        <div class="dropdown-items">
          ${models.map(model => `
            <div class="dropdown-item ${model.name === currentModel ? 'selected' : ''}" data-model="${model.name}">
              ${model.name}
            </div>
          `).join('')}
        </div>
      `;
      
      // Initialize sidebar folders on load
      updateRecentFoldersUI();
      const savedFolder = fileExplorerState.folderPath;
      if (savedFolder) {
        updateOperationFolderUI(savedFolder);
        updateTerminalPrompt(savedFolder);
      }
      
      // Add search input event listener
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const query = e.target.value.toLowerCase();
          filterSearchResults(query);
        });
        // Focus search input when modal opens
        document.getElementById('searchModal').addEventListener('click', (e) => {
          if (e.target === e.currentTarget) {
            hidePopups();
          } else {
            searchInput.focus();
          }
        });
      }
      
      // Add click handlers
      dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          const modelName = item.dataset.model;
          if (modelName) {
            currentModel = modelName;
            if (selectedModelSpan) {
              selectedModelSpan.textContent = modelName;
            }
            dropdown.classList.remove('active');
            enableInput(); // Enable textarea when model is selected
            
            // Update agent config with selected model
            if (window.aiAgent) {
              window.aiAgent.setConfig({ model: modelName });
            }
            
            console.log('Selected model:', currentModel);
          }
        });
      });
    }
  }
}

// Auto-resize textarea
function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

// Initialize resizable sidebar
function initResizableSidebar() {
  const sidebar = document.getElementById('leftSidebar');
  const resizer = document.createElement('div');
  resizer.className = 'sidebar-resizer';
  resizer.style.cssText = `
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    z-index: 100;
    background: transparent;
  `;
  
  sidebar.style.position = 'relative';
  sidebar.appendChild(resizer);
  
  let isResizing = false;
  let startX, startWidth;
  
  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = startWidth + e.clientX - startX;
    if (newWidth > 180 && newWidth < 400) {
      sidebar.style.width = newWidth + 'px';
    }
  });
  
  document.addEventListener('mouseup', () => {
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

// Prompt model dropdown toggle
function togglePromptModelDropdown() {
  const dropdown = document.getElementById('model-dropdown-prompt');
  if (dropdown) {
    dropdown.classList.toggle('active');
  }
}

// Mode dropdown toggle
function toggleModeDropdown() {
  const dropdown = document.getElementById('mode-dropdown-prompt');
  if (dropdown) {
    dropdown.classList.toggle('active');
  }
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  const modelContainer = document.querySelector('.model-selector-prompt');
  const modelDropdown = document.getElementById('model-dropdown-prompt');
  if (modelContainer && modelDropdown && !modelContainer.contains(e.target)) {
    modelDropdown.classList.remove('active');
  }
  
  const modeContainer = document.querySelector('.mode-selector-prompt');
  const modeDropdown = document.getElementById('mode-dropdown-prompt');
  if (modeContainer && modeDropdown && !modeContainer.contains(e.target)) {
    modeDropdown.classList.remove('active');
  }
});

// Model selection
document.addEventListener('click', (e) => {
  const item = e.target.closest('.model-dropdown-prompt .dropdown-item');
  if (item) {
    const modelName = item.querySelector('span')?.textContent || item.textContent;
    const selectedModelSpan = document.querySelector('.selected-model-prompt');
    if (selectedModelSpan) {
      selectedModelSpan.textContent = modelName;
    }
    // Update selected state
    item.closest('.dropdown-items')?.querySelectorAll('.dropdown-item').forEach(i => {
      i.classList.remove('selected');
      const check = i.querySelector('.check');
      if (check) check.remove();
    });
    item.classList.add('selected');
    // Add checkmark if not present
    if (!item.querySelector('.check')) {
      item.innerHTML = `<span>${modelName}</span><svg class="icon-svg check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
    }
    document.getElementById('model-dropdown-prompt')?.classList.remove('active');
  }
});

// Mode selection
document.addEventListener('click', (e) => {
  const item = e.target.closest('.mode-dropdown-prompt .dropdown-item');
  if (item) {
    const modeName = item.querySelector('span')?.textContent || item.textContent;
    const selectedModeSpan = document.querySelector('.selected-mode-prompt');
    if (selectedModeSpan) {
      selectedModeSpan.textContent = modeName;
    }
    
    // Track current mode
    if (modeName.toLowerCase().includes('agent')) {
      currentMode = 'agent';
    } else {
      currentMode = 'ask';
    }
    
    // Update checkmark
    document.querySelectorAll('.mode-dropdown-prompt .dropdown-item').forEach(i => {
      i.innerHTML = `<span>${i.querySelector('span')?.textContent || i.textContent}</span>`;
    });
    
    if (!item.querySelector('.check')) {
      item.innerHTML = `<span>${modeName}</span><svg class="icon-svg check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
    }
    document.getElementById('mode-dropdown-prompt')?.classList.remove('active');
  }
});

// Chat history click handler
document.addEventListener('click', (e) => {
  const chatRow = e.target.closest('.chat-row, .search-result');
  if (chatRow) {
    const chatId = chatRow.dataset.chatId;
    console.log('Chat clicked:', chatId);
    if (chatId) {
      loadChat(chatId);
    }
  }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  try {
  console.log('DOMContentLoaded fired');
  
  // Load Ollama models
  loadOllamaModelsToDropdown();
  
  // Enable textarea on load
  enableInput();
  
  // Setup terminal command approval dialog
  setupTerminalCommandDialog();
  
  // Load multi-agent configuration
  loadMultiAgentConfig();
  
  // Setup terminal input
  setupTerminalInput();
  
  // Auto-resize textareas
  const resizeTextareas = document.querySelectorAll('.composer-card textarea');
  console.log('Found resizeTextareas:', resizeTextareas.length);
  resizeTextareas.forEach(textarea => {
    textarea.addEventListener('input', () => {
      autoResizeTextarea(textarea);
    });
  });
  
  // Sidebar toggle from title bar icon
  const titleBarIcon = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('leftSidebar');
  if (titleBarIcon && sidebar) {
    titleBarIcon.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('collapsed');
      if (isCollapsed) {
        // Clear inline width so CSS can set it to 0
        sidebar.style.width = '';
      } else {
        // When expanding, set to default width if no inline width exists
        if (!sidebar.style.width || sidebar.style.width === '0px') {
          sidebar.style.width = 'var(--sidebar-width)';
        }
      }
    });
  }
  
  // Window control buttons
  const minimizeBtn = document.querySelector('.minimize-btn');
  const maximizeBtn = document.querySelector('.maximize-btn');
  const closeBtn = document.querySelector('.close-btn');
  
  if (minimizeBtn && window.electronAPI) {
    minimizeBtn.addEventListener('click', () => {
      window.electronAPI.minimizeWindow();
    });
  }
  
  if (maximizeBtn && window.electronAPI) {
    maximizeBtn.addEventListener('click', () => {
      window.electronAPI.maximizeWindow();
    });
  }
  
  if (closeBtn && window.electronAPI) {
    closeBtn.addEventListener('click', () => {
      window.electronAPI.closeWindow();
    });
  }
  
  // Chat send functionality
  const textareas = document.querySelectorAll('.composer-card textarea');
  const submitBtns = document.querySelectorAll('.icon-button.submit');
  console.log('Chat send setup - textareas:', textareas.length, 'submitBtns:', submitBtns.length);
  
  textareas.forEach((textarea, index) => {
    console.log('Setting up textarea', index, textarea);
    const submitBtn = submitBtns[index];
    
    // Enable/disable submit button based on content
    textarea.addEventListener('input', () => {
      if (submitBtn) {
        if (textarea.value.trim()) {
          submitBtn.classList.add('active');
        } else {
          submitBtn.classList.remove('active');
        }
      }
    });
    
    // Send on Enter (without Shift)
    textarea.addEventListener('keydown', (e) => {
      console.log('Keydown:', e.key);
      if (e.key === 'Enter') {
        console.log('Enter pressed');
        const hasMultipleLines = textarea.value.includes('\n');
        // Safely check appSettings
        const requireShiftEnter = (typeof appSettings !== 'undefined' && appSettings.general && appSettings.general.requireShiftEnter) || false;
        const requiresShift = requireShiftEnter && hasMultipleLines;
        const shouldSend = requiresShift ? e.shiftKey : !e.shiftKey;
        console.log('shouldSend:', shouldSend, 'requiresShift:', requiresShift, 'hasMultipleLines:', hasMultipleLines, 'appSettings:', typeof appSettings);

        if (shouldSend) {
          e.preventDefault();
          console.log('Calling sendMessage');
          sendMessage(textarea, submitBtn);
        }
      }
    });
  });
  
  // Submit button click
  submitBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      console.log('Submit button clicked, index:', index);
      const textarea = textareas[index];
      console.log('Textarea for button:', textarea);
      sendMessage(textarea, btn);
    });
  });
  
  // DIRECT event listeners for main elements (backup)
  const mainTextarea = document.getElementById('main-textarea');
  const mainSendBtn = document.getElementById('sendBtn');
  console.log('Direct setup - mainTextarea:', mainTextarea, 'mainSendBtn:', mainSendBtn);
  
  if (mainTextarea) {
    mainTextarea.addEventListener('keydown', (e) => {
      console.log('Direct textarea keydown:', e.key);
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        console.log('Direct: Sending message');
        sendMessage(mainTextarea, mainSendBtn);
      }
    });
  }
  
  if (mainSendBtn) {
    console.log('Adding click listener to sendBtn, current disabled:', mainSendBtn.disabled, 'classes:', mainSendBtn.className);
    mainSendBtn.addEventListener('click', (e) => {
      console.log('Direct send button clicked!', e);
      e.preventDefault();
      e.stopPropagation();
      try {
        sendMessage(mainTextarea, mainSendBtn);
      } catch (err) {
        console.error('Error in sendMessage:', err);
      }
    });
    // Also force enable the button
    mainSendBtn.disabled = false;
    mainSendBtn.style.pointerEvents = 'auto';
    mainSendBtn.classList.remove('sending');
    console.log('Click listener added to sendBtn, button enabled');
  } else {
    console.error('ERROR: sendBtn not found!');
  }
  
  // Initialize chat history
  updateChatList();
  // File attachment handler
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Read file content
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target.result;
        
        if (file.type.startsWith('image/')) {
          // For images: add to attachments array and show pill
          const attachment = {
            id: Date.now() + Math.random(),
            name: file.name,
            type: file.type,
            data: content
          };
          pendingImageAttachments.push(attachment);
          showImageAttachmentPills();
          
          showNotification(`Image "${file.name}" attached (${pendingImageAttachments.length} total). Type your message and send.`);
        } else {
          // For text files: show filename and store content
          addMessageToChat('user', `[Attached: ${file.name}]`);
          
          // Store file content for next message
          window.pendingFileAttachment = {
            name: file.name,
            type: file.type,
            content: content
          };
          
          showNotification(`File "${file.name}" attached. Type your message and send.`);
        }
      };
      
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file); // For images, use base64
      } else {
        reader.readAsText(file); // For text files
      }
      
      // Reset input
      fileInput.value = '';
    });
  }
  } catch (err) {
    console.error('Error in DOMContentLoaded:', err);
  }
});

// Global click handler for send button (onclick attribute)
function handleSendClick() {
  console.log('handleSendClick called');
  const textarea = document.getElementById('main-textarea');
  const sendBtn = document.getElementById('sendBtn');
  console.log('handleSendClick - textarea:', textarea, 'sendBtn:', sendBtn);
  if (textarea && sendBtn) {
    sendMessage(textarea, sendBtn);
  } else {
    console.error('handleSendClick: textarea or sendBtn not found');
  }
}

// Send message function - Routes to chat or agent based on mode
async function sendMessage(textarea, submitBtn) {
  console.log('sendMessage called', textarea, submitBtn);
  if (!textarea) {
    console.log('No textarea, returning');
    return;
  }

  let message = textarea.value.trim();
  console.log('Message:', message);
  if (!message) {
    console.log('Empty message, returning');
    return;
  }

  let finalMessage = message;

  // Check for pending image attachments
  let images = [];
  if (pendingImageAttachments.length > 0) {
    // Add all images context to message
    const imageNames = pendingImageAttachments.map(img => img.name).join(', ');
    finalMessage = `[Images attached: ${imageNames}]\n\n${finalMessage}`;
    // Extract base64 image data for Ollama
    images = pendingImageAttachments.map(img => img.data);
    // Clear all attachments after sending
    pendingImageAttachments = [];
    removeAllImageAttachments();
  }

  // Check for pending file attachment
  if (window.pendingFileAttachment) {
    // Add file context to message
    finalMessage = `[File attached: ${window.pendingFileAttachment.name}]\n\nContent:\n${window.pendingFileAttachment.content.substring(0, 50000)}\n\n${finalMessage}`;
    // Clear the attachment after sending
    window.pendingFileAttachment = null;
  }
  
  // Clear the textarea
  textarea.value = '';
  
  // Check which mode is active
  const modeBtn = document.querySelector('.mode-chip.active');
  const currentMode = modeBtn?.dataset?.mode || 'ask';
  console.log('Current mode:', currentMode, 'modeBtn:', modeBtn);
  
  try {
    if (currentMode === 'agent') {
      // Run through Agent system
      console.log('Running agent message...');
      await runAgentMessage(finalMessage, images);
    } else {
      // Send to Ollama directly
      console.log('Sending to Ollama...');
      await sendMessageToOllama(finalMessage, images);
    }
    console.log('Message sent successfully');
  } catch (err) {
    console.error('Error sending message:', err);
  }
}

// Track AI modified files for Accept/Reject
let pendingAIChanges = [];

// Global timer state for agent runs
let agentTimerInterval = null;


// Run message through Agent system
async function runAgentMessage(message, images = []) {
  // Cancel any previous agent run (but keep terminal commands running)
  if (window.aiAgent && window.aiAgent.isRunning) {
    window.aiAgent.cancel();
    // Stop any existing timer
    if (agentTimerInterval) {
      clearInterval(agentTimerInterval);
      agentTimerInterval = null;
    }
    // Add a separator message showing previous work was stopped
    addMessageToChat('system', 'Previous work stopped. Starting new task...');
  }
  
  // Show user message with images
  addMessageToChat('user', message, images);
  
  // Add image context if present
  if (images && images.length > 0) {
    const imageCount = images.length;
    addMessageToChat('system', `${imageCount} image${imageCount > 1 ? 's' : ''} attached for analysis`);
  }
  
  // Reset agent session for new run
  resetAgentSession();
  pendingAIChanges = [];
  
  // Show Accept/Reject controls at top
  showChangeControls();
  
  // Show loading state on send button
  setSendButtonLoading(true);
  
  // Setup agent to output to chat
  window.agentChatOutput = [];
  let thinkingMessageId = null;
  let operationsMessageId = null;
  let terminalCommandMessageId = null;
  let lastTerminalCommand = null;
  
  // Working timer (uses global agentTimerInterval)
  let timerMessageId = null;
  let startTime = Date.now();
  
  function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }
  
  function startWorkingTimer() {
    if (agentTimerInterval) clearInterval(agentTimerInterval);
    startTime = Date.now();
    
    const timerContent = {
      type: 'timer',
      getText: () => {
        const elapsed = Date.now() - startTime;
        return `Working for ${formatDuration(elapsed)}`;
      }
    };
    
    // Create timer message
    timerMessageId = addMessageToChat('system', timerContent.getText());
    
    // Update timer every second
    agentTimerInterval = setInterval(() => {
      if (timerMessageId) {
        updateMessageInChat(timerMessageId, timerContent.getText());
      }
    }, 1000);
    
    return timerMessageId;
  }
  
  function stopWorkingTimer() {
    if (agentTimerInterval) {
      clearInterval(agentTimerInterval);
      agentTimerInterval = null;
    }
    if (timerMessageId) {
      // Update one final time with completed status
      const elapsed = Date.now() - startTime;
      updateMessageInChat(timerMessageId, `Completed in ${formatDuration(elapsed)}`);
      timerMessageId = null;
    }
  }
  
  // Override agent UI functions to use chat
  const originalUpdateUI = window.updateAgentUI;
  window.updateAgentUI = (action, details) => {
    // Handle thinking - static text, no animation
    if (action === 'thinking') {
      const baseText = details.message || 'Working';
      const statusColor = details.color || '#6b7280';
      const step = details.step || 1;
      
      // Start timer on first thinking event
      if (!timerMessageId) {
        startWorkingTimer();
      }
      
      // Create or update thinking message with status type for shader animation
      const thinkingContent = {
        type: 'status',
        text: baseText,
        color: statusColor,
        step: step,
        dots: '...'
      };
      
      if (thinkingMessageId) {
        // Update existing message
        updateMessageInChat(thinkingMessageId, thinkingContent);
      } else {
        // Create new message
        thinkingMessageId = addMessageToChat('agent', thinkingContent);
      }
      
      return;
    }
    
    // Remove thinking message when we get a real result
    if (thinkingMessageId && (action === 'tool_success' || action === 'reasoning' || action === 'planning' || action === 'complete')) {
      // Remove thinking message
      const msgEl = document.getElementById(`msg-${thinkingMessageId}`);
      if (msgEl) msgEl.remove();
      messageMap.delete(thinkingMessageId);
      thinkingMessageId = null;
    }
    
    // Show feedback icons and stop timer when chat is complete
    if (action === 'complete') {
      // Stop the working timer
      stopWorkingTimer();
      
      // Stop loading state on send button
      setSendButtonLoading(false);
      
      // Make all agent message feedback icons visible
      document.querySelectorAll('.chat-message.agent .message-feedback, .chat-message.assistant .message-feedback').forEach(el => {
        el.style.opacity = '1';
      });
    }
    
    // Handle file change events
    if (action === 'file_change') {
      try {
        pendingAIChanges = details.aiModifiedFiles || [];
        updateChangeControls();
        // Show file diff in chat
        const diffEntry = createFileDiffEntry(details);
        if (diffEntry && diffEntry.html) {
          addMessageToChat('agent', diffEntry);
        }
      } catch (err) {
        console.error("Error showing file change:", err);
      }
      return;
    }
    
    // Handle writing events - show shader animation
    if (action === 'writing') {
      const writingContent = {
        type: 'writing',
        file: details.file,
        additions: details.additions,
        deletions: details.deletions,
        status: details.status
      };
      addMessageToChat('agent', writingContent);
      return;
    }
    
    // Handle terminal command events - single message that updates
    if (action === 'terminal_command') {
      const commandData = {
        type: 'terminal_command',
        command: details.command,
        reason: details.reason,
        cwd: details.cwd,
        status: details.status,
        result: details.result
      };
      
          // Track terminal command in operations (for expandable list)
      if (details.status === 'completed' && details.command && !agentSessionState.operations.find(op => op.type === 'terminal' && op.command === details.command)) {
        agentSessionState.operations.push({
          type: 'terminal',
          command: details.command
        });
        agentSessionState.fileCount++;
        // Update operations display if visible
        if (operationsMessageId) {
          const entry = createAgentLogEntry('operations', {});
          if (entry) updateMessageInChat(operationsMessageId, entry);
        }
      }
      
      // If this is a new command (different from last), create new message
      if (details.command !== lastTerminalCommand) {
        terminalCommandMessageId = addMessageToChat('agent', commandData);
        lastTerminalCommand = details.command;
      } else {
        // Update existing terminal command message
        if (terminalCommandMessageId) {
          updateMessageInChat(terminalCommandMessageId, commandData);
        }
      }
      return;
    }
    
    const entry = createAgentLogEntry(action, details);
    if (entry) {
      // For operations type, update in place instead of adding new
      if (entry.type === 'operations') {
        if (operationsMessageId) {
          // Update existing operations message
          updateMessageInChat(operationsMessageId, entry);
        } else {
          // Create new operations message
          operationsMessageId = addMessageToChat('agent', entry);
        }
      } else {
        // Reset operations tracking for non-operation messages
        operationsMessageId = null;
        addMessageToChat('agent', entry);
      }
    }
  };
  
  // Run agent
  if (window.aiAgent) {
    await window.aiAgent.run(message);
    // Keep all messages visible - do not auto disappear
  } else {
    addMessageToChat('agent', 'Agent not initialized. Please refresh.');
  }
  
  // Restore original function
  window.updateAgentUI = originalUpdateUI;
}

// Auto disappear all agent messages with fade out
function disappearAllAgentMessages() {
  const agentMessages = document.querySelectorAll('.chat-message.agent');
  agentMessages.forEach((msg, index) => {
    setTimeout(() => {
      msg.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      msg.style.opacity = '0';
      msg.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        msg.remove();
      }, 500);
    }, index * 100);
  });
  // Hide change controls
  hideChangeControls();
}

// Show Accept/Reject controls - Now attached to prompt box only
function showChangeControls() {
  // Hide old top controls if they exist
  const oldControls = document.getElementById('aiChangeControls');
  if (oldControls) {
    oldControls.style.display = 'none';
  }
  
  // The new file changes bar is already in HTML above prompt box
  // Just make sure it's visible if there are pending changes
  if (pendingAIChanges.length > 0) {
    const totalAdditions = pendingAIChanges.reduce((sum, c) => sum + (c.additions || 0), 0);
    const totalDeletions = pendingAIChanges.reduce((sum, c) => sum + (c.deletions || 0), 0);
    showFileChangesBar(pendingAIChanges.length, totalAdditions, totalDeletions);
  }
}

// Update change controls count
function updateChangeControls() {
  const count = document.getElementById('aiChangeCount');
  if (count) {
    const total = pendingAIChanges.length;
    
    // Calculate total added/removed lines
    let totalAdded = 0;
    let totalRemoved = 0;
    pendingAIChanges.forEach(file => {
      const lineCount = file.content ? file.content.split('\n').length : 0;
      if (file.type === 'created') {
        totalAdded += lineCount;
      } else {
        totalAdded += Math.floor(lineCount * 0.7);
        totalRemoved += Math.floor(lineCount * 0.3);
      }
    });
    
    // Format: "3 files changed +249 -535" like in screenshot
    if (total > 0) {
      const fileText = total === 1 ? 'file' : 'files';
      count.innerHTML = `${total} ${fileText} changed <span style="color: #22c55e;">+${totalAdded}</span> <span style="color: #dc2626;">-${totalRemoved}</span>`;
    } else {
      count.textContent = 'No changes';
    }
  }
  updateFileList();
}

// Update the file list display with paths and +/- counts
function updateFileList() {
  const fileList = document.getElementById('aiFileList');
  const arrow = document.getElementById('aiFileArrow');
  if (!fileList) return;
  
  if (pendingAIChanges.length === 0) {
    fileList.innerHTML = '<div style="padding: 16px; text-align: center; color: #888; font-size: 13px;">No files changed yet</div>';
    fileList.style.maxHeight = '200px';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
    return;
  }
  
  // Auto-expand when files are added
  fileList.style.maxHeight = '200px';
  fileList.style.opacity = '1';
  if (arrow) arrow.style.transform = 'rotate(0deg)';
  
  let html = '';
  pendingAIChanges.forEach((file, index) => {
    const path = file.path || '';
    const lineCount = file.content ? file.content.split('\n').length : 0;
    const added = file.type === 'created' ? lineCount : Math.floor(lineCount * 0.7);
    const removed = file.type === 'created' ? 0 : Math.floor(lineCount * 0.3);
    
    html += `
      <div style="padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; font-family: 'SF Mono', Monaco, monospace; font-size: 12px; background: #fff;">
        <span style="color: #2a2a2a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${escapeHtml(path)}</span>
        <span style="margin-left: 12px; white-space: nowrap; font-size: 11px;">
          <span style="color: #22c55e; font-weight: 500;">+${added}</span>
          <span style="color: #dc2626; font-weight: 500; margin-left: 4px;">-${removed}</span>
        </span>
      </div>
    `;
  });
  
  fileList.innerHTML = html;
}

// Toggle file list expand/collapse
function toggleFileList() {
  const fileList = document.getElementById('aiFileList');
  const arrow = document.getElementById('aiFileArrow');
  if (fileList && arrow) {
    const isExpanded = fileList.style.maxHeight !== '0px' && fileList.style.maxHeight !== '';
    if (isExpanded) {
      fileList.style.maxHeight = '0px';
      fileList.style.opacity = '0';
      arrow.style.transform = 'rotate(-90deg)';
    } else {
      fileList.style.maxHeight = '200px';
      fileList.style.opacity = '1';
      arrow.style.transform = 'rotate(0deg)';
    }
  }
}

// Hide change controls
function hideChangeControls() {
  const controls = document.getElementById('aiChangeControls');
  if (controls) {
    controls.style.display = 'none';
  }
}

// Create file diff entry for chat
function createFileDiffEntry(details) {
  const { path, type, content, additions = 0, deletions = 0, originalContent = '' } = details;
  
  // Ensure content is a string
  const safeContent = typeof content === 'string' ? content : '';
  const lines = safeContent ? safeContent.split('\n').length : 0;
  const diffIndicator = type === 'created' ? `+${lines}` : (additions || deletions ? `+${additions} -${deletions}` : `edited`);
  
  // Show actual diff - compare original vs new for edited files
  let displayLines = [];
  let lineNumLabels = [];
  let diffMarkers = [];
  
  if (type === 'edited' && originalContent) {
    // Simple line-by-line diff
    const originalLines = originalContent.split('\n');
    const newLines = safeContent.split('\n');
    const maxLines = Math.max(originalLines.length, newLines.length);
    
    for (let i = 0; i < maxLines && i < 10; i++) {
      const origLine = originalLines[i] || '';
      const newLine = newLines[i] || '';
      
      if (origLine !== newLine) {
        if (origLine && !newLines.includes(origLine)) {
          // Removed line
          diffMarkers.push('red');
          displayLines.push(escapeHtml(origLine));
          lineNumLabels.push(`${i + 1}`);
        } else if (newLine) {
          // Added/changed line
          diffMarkers.push('green');
          displayLines.push(escapeHtml(newLine));
          lineNumLabels.push(`${i + 1}`);
        }
      }
    }
    
    // If no changes detected, show first few lines
    if (displayLines.length === 0) {
      displayLines = newLines.slice(0, 3).map(line => escapeHtml(line));
      lineNumLabels = ['1', '2', '3'].slice(0, displayLines.length);
      diffMarkers = new Array(displayLines.length).fill('neutral');
    }
  } else {
    // For new files, show first few lines
    const newLines = safeContent.split('\n');
    displayLines = newLines.slice(0, 3).map(line => escapeHtml(line));
    lineNumLabels = displayLines.map((_, i) => `${i + 1}`);
    diffMarkers = new Array(displayLines.length).fill('green');
  }
  
  const hasMore = safeContent && safeContent.split('\n').length > 3;
  
  const lineNumbers = lineNumLabels.map((num, i) => `<span style="color: #999;">${num}</span>`).join('\n');
  const codeContent = displayLines.map((line, i) => {
    const bgColor = diffMarkers[i] === 'green' ? 'rgba(34, 197, 94, 0.1)' : 
                    diffMarkers[i] === 'red' ? 'rgba(220, 38, 38, 0.1)' : 'transparent';
    return `<span style="background: ${bgColor}; display: block;">${line}</span>`;
  }).join('\n');
  
  // Track this change
  setTimeout(() => {
    addPendingChange({ path, type, additions, deletions });
  }, 0);

  // Get file extension and type label
  const fileExt = path.split('.').pop().toLowerCase();
  const fileTypeLabels = {
    'html': 'HTML Document',
    'htm': 'HTML Document',
    'css': 'CSS Stylesheet',
    'js': 'JavaScript',
    'json': 'JSON File',
    'md': 'Markdown Document',
    'txt': 'Text Document',
    'py': 'Python Script',
    'java': 'Java Source',
    'cpp': 'C++ Source',
    'c': 'C Source',
    'ts': 'TypeScript',
    'jsx': 'React Component',
    'tsx': 'React Component',
    'vue': 'Vue Component',
    'php': 'PHP Script',
    'sql': 'SQL Query',
    'xml': 'XML Document',
    'yaml': 'YAML File',
    'yml': 'YAML File'
  };
  const fileTypeLabel = fileTypeLabels[fileExt] || `${fileExt.toUpperCase()} File`;
  
  // Light black/gray styling for diff view with Accept/Reject buttons
  return {
    type: 'file_diff',
    html: `
      <div style="margin: 8px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="background: #f9fafb; padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: #6b7280;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="font-family: 'SF Mono', Monaco, monospace; color: #111827; font-weight: 500;">${escapeHtml(path.split('/').pop())}</span>
              <span style="color: #6b7280; font-size: 11px;">${fileTypeLabel} • ${diffIndicator}</span>
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="diff-open-btn" data-path="${path}" title="Open in browser preview" style="padding: 6px 14px; border: 1px solid #e5e7eb; background: white; color: #374151; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: all 0.2s;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #22c55e;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              Open
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #9ca3af; margin-left: 2px;"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <button class="diff-reject-btn" data-path="${path}" title="Reject changes" style="padding: 6px 12px; border: 1px solid #e5e7eb; background: white; color: #6b7280; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 4px; transition: all 0.2s;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <button class="diff-accept-btn" data-path="${path}" data-content="${encodeURIComponent(safeContent)}" title="Accept changes" style="padding: 6px 14px; border: 1px solid #3b82f6; background: #3b82f6; color: white; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Accept
            </button>
          </div>
        </div>
        <div style="display: flex; font-family: 'SF Mono', Monaco, monospace; font-size: 11px; line-height: 1.5; max-height: 120px; overflow-y: auto;">
          <div style="background: #f5f5f5; padding: 8px 12px; text-align: right; border-right: 1px solid #ddd; min-width: 30px; color: #888;">
            ${lineNumbers}
          </div>
          <div style="padding: 8px 12px; flex: 1; white-space: pre; color: #2a2a2a; background: #fafafa;">
            ${codeContent}${hasMore ? '\n<span style="color: #999;">... ' + (safeContent.split('\n').length - 3) + ' more lines</span>' : ''}
          </div>
        </div>
      </div>
    `
  };
}

// Revert single file
async function revertFile(path) {
  if (window.aiAgent) {
    const file = window.aiAgent.aiModifiedFiles.find(f => f.path === path);
    if (file) {
      if (file.type === 'created') {
        // Delete created file
        try {
          const dirHandle = await window.aiAgent.getDirectoryHandle(path.substring(0, path.lastIndexOf('/')) || '');
          if (dirHandle && dirHandle.removeEntry) {
            await dirHandle.removeEntry(path.split('/').pop());
          }
        } catch (e) {
          console.error('Failed to delete file:', e);
        }
      } else if (file.originalContent) {
        // Revert to original
        await window.aiAgent.writeFile({ path, content: file.originalContent, isAI: false });
      }
      window.aiAgent.aiModifiedFiles = window.aiAgent.aiModifiedFiles.filter(f => f.path !== path);
      pendingAIChanges = pendingAIChanges.filter(f => f.path !== path);
      updateChangeControls();
      refreshFileExplorer();
    }
  }
}

// Agent state for tracking operations
let agentSessionState = {
  operations: [],
  fileCount: 0,
  messageId: null
};

// Reset agent session
function resetAgentSession() {
  agentSessionState = {
    operations: [],
    fileCount: 0,
    messageId: null
  };
}

// Create agent log entry - Cursor-style with collapsible sections
function createAgentLogEntry(action, details) {
  if (!details) return null;
  
  switch(action) {
    case 'thinking':
      return { type: 'thinking', text: details.message };
      
    case 'reasoning':
      // Show reasoning as simple text instead of collapsible
      return { type: 'thinking', text: details.message };
    
    case 'planning':
      let planContent = '';
      if (details.plan?.length) {
        planContent = details.plan.map((s, i) => `${i + 1}. ${s}`).join('\n');
      }
      return { 
        type: 'collapsible', 
        title: 'Planning next moves',
        content: planContent,
        open: true
      };
    
    case 'complete':
      return { type: 'complete', message: details.message };
      
    case 'error':
      return { type: 'error', message: details.message };
    
    // Tool results - add to operations list
    case 'tool_success':
    case 'readFile':
    case 'readFiles':
    case 'writeFile':
    case 'writeFiles':
    case 'createFile':
    case 'applyPatch':
    case 'listFiles':
    case 'searchFiles':
    case 'grepSearch':
    case 'getFileTree':
    case 'getSymbols':
      const op = formatToolOperation(action, details);
      if (op) {
        // Handle batch operations that return arrays
        if (Array.isArray(op)) {
          op.forEach(item => {
            agentSessionState.operations.push(item);
            agentSessionState.fileCount++;
          });
        } else {
          agentSessionState.operations.push(op);
          agentSessionState.fileCount++;
        }
        return { 
          type: 'operations', 
          count: agentSessionState.fileCount,
          items: agentSessionState.operations 
        };
      }
      return null;
      
    default:
      return null;
  }
}

// Format individual tool operation
function formatToolOperation(action, details) {
  const result = details.result || details;
  
  if (action === 'readFile' || (action === 'tool_success' && details.name === 'readFile')) {
    console.log('DEBUG readFile:', { action, details, result });
    const readRange = result?.readRange;
    let lineInfo;
    if (readRange) {
      lineInfo = `L${readRange.start}-${readRange.end}`;
    } else {
      const totalLines = result?.totalLines || result?.lines || 0;
      lineInfo = `L${totalLines}`;
    }
    const op = { type: 'read', path: result?.path, lines: lineInfo };
    console.log('DEBUG readFile returning:', op);
    return op;
  }

  // Handle readFiles (batch) - return multiple read operations
  if (action === 'readFiles' || (action === 'tool_success' && details.name === 'readFiles')) {
    console.log('DEBUG readFiles batch:', { action, details, result });
    if (result?.results && Array.isArray(result.results)) {
      // Return array of read operations
      return result.results.map(r => {
        const lineInfo = r.totalLines || r.lines ? `L${r.totalLines || r.lines}` : '';
        return { type: 'read', path: r.path, lines: lineInfo };
      });
    }
    return null;
  }
  
  if (action === 'writeFile' || (action === 'tool_success' && details.name === 'writeFile')) {
    return { type: 'write', path: result?.path, content: result?.content };
  }

  // Handle writeFiles (batch)
  if (action === 'writeFiles' || (action === 'tool_success' && details.name === 'writeFiles')) {
    if (result?.results && Array.isArray(result.results)) {
      return result.results.map(r => ({
        type: 'write', path: r.path, content: r.content
      }));
    }
    return null;
  }

  if (action === 'createFile' || (action === 'tool_success' && details.name === 'createFile')) {
    return { type: 'create', path: result?.path, content: result?.content };
  }
  if (action === 'editFile' || (action === 'tool_success' && details.name === 'editFile')) {
    return { 
      type: 'edit', 
      path: result?.path,
      description: result?.description,
      oldText: result?.oldText,
      newText: result?.newText,
      lineRange: result?.lineRange
    };
  }
  if (action === 'applyPatch' || (action === 'tool_success' && details.name === 'applyPatch')) {
    const lineRange = result?.lineRange || result?.modifiedRange;
    return { 
      type: 'edit', 
      path: result?.path,
      diff: `+${result?.linesAdded || 0}/-${result?.linesRemoved || 0}`,
      diffAdded: result?.linesAdded || 0,
      diffRemoved: result?.linesRemoved || 0,
      lineRange: lineRange
    };
  }
  if (action === 'searchFiles' || (action === 'tool_success' && details.name === 'searchFiles')) {
    return { 
      type: 'grep', 
      query: result?.query,
      count: result?.totalMatches || 0
    };
  }
  if (action === 'grepSearch' || (action === 'tool_success' && details.name === 'grepSearch')) {
    return { 
      type: 'grep', 
      query: result?.pattern,
      count: result?.totalMatches || 0
    };
  }
  if (action === 'listFiles' || action === 'getFileTree' || 
      (action === 'tool_success' && (details.name === 'listFiles' || details.name === 'getFileTree'))) {
    const count = result?.entries?.length || result?.tree?.length || 0;
    return { type: 'explore', count };
  }
  if (action === 'getSymbols' || (action === 'tool_success' && details.name === 'getSymbols')) {
    return { type: 'symbols', path: result?.path };
  }
  if (action === 'terminal_command' || (action === 'tool_success' && details.name === 'executeTerminal')) {
    return { type: 'terminal', command: result?.command || details.command };
  }
  if (action === 'deleteFile' || (action === 'tool_success' && details.name === 'deleteFile')) {
    return { type: 'delete', path: result?.path };
  }
  if (action === 'moveFile' || (action === 'tool_success' && details.name === 'moveFile')) {
    return { type: 'move', from: result?.from, to: result?.to };
  }
  if (action === 'copyFile' || (action === 'tool_success' && details.name === 'copyFile')) {
    return { type: 'copy', from: result?.from, to: result?.to };
  }
  if (action === 'getFileInfo' || (action === 'tool_success' && details.name === 'getFileInfo')) {
    return { type: 'info', path: result?.path };
  }
  if (action === 'findReferences' || (action === 'tool_success' && details.name === 'findReferences')) {
    return { type: 'references', symbol: result?.symbol, count: result?.count || 0 };
  }
  if (action === 'validateSyntax' || (action === 'tool_success' && details.name === 'validateSyntax')) {
    return { type: 'validate', path: result?.path, valid: result?.valid };
  }
  return null;
}

// Get appropriate SVG icon for status
function getSpinnerForStatus(status) {
  const icons = {
    'analyzing': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/></svg>',
    'processing': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    'reasoning': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    'executing': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    'verifying': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
    'completing': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
  };
  return icons[status] || '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
}

// Actually send to Ollama with streaming
async function sendMessageToOllama(message, images = []) {
  console.log('sendMessageToOllama called with message:', message.substring(0, 50) + '...');
  
  // Check if multi-agent mode is enabled
  if (multiAgentState.enabled) {
    console.log('Multi-agent enabled, routing to runMultiAgent');
    return runMultiAgent(message, images);
  }
  
  // Show user message in chat with images
  console.log('Adding user message to chat...');
  addMessageToChat('user', message, images);
  
  // Create empty AI message for streaming
  const aiMessageId = addMessageToChat('assistant', '');
  
  let fullResponse = '';
  
  try {
    // Check if model is selected
    if (!currentModel) {
      console.error('No model selected!');
      addMessageToChat('assistant', 'Error: No model selected. Please select a model from the dropdown.');
      return;
    }
    
    // Build request body
    const requestBody = {
      model: currentModel,
      prompt: message,
      stream: true
    };
    
    // Add images if present
    if (images && images.length > 0) {
      requestBody.images = images;
    }
    
    // Call Ollama API with streaming enabled
    console.log('Calling Ollama API with model:', currentModel);
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    console.log('Ollama API response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Get reader for streaming
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    // Read stream chunks
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Decode chunk
      const chunk = decoder.decode(value, { stream: true });
      
      // Parse JSON lines (Ollama sends NDJSON - newline delimited JSON)
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) {
            fullResponse += data.response;
            // Update message in real-time with formatting
            const formattedResponse = formatStreamingContent(fullResponse);
            updateMessageInChat(aiMessageId, formattedResponse);
          }
          // Check if done
          if (data.done) {
            break;
          }
        } catch (e) {
          // Skip invalid JSON lines
          continue;
        }
      }
    }
    
    // Save to history when complete
    addChatToHistory(message, fullResponse);
    
  } catch (error) {
    console.error('Ollama API error:', error);
    const errorMsg = 'Error: Could not connect to Ollama. Make sure Ollama is running on localhost:11434';
    // Add error as new message instead of updating
    addMessageToChat('assistant', errorMsg);
  }
}

// Multi-Agent parallel execution with full AIAgent instances
async function runMultiAgent(message) {
  // Show user message once
  addMessageToChat('user', message);
  
  // COMING SOON - Multi-agent mode is temporarily disabled
  addMessageToChat('assistant', `
    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; text-align: center;">
      <div style="color: #92400e; font-weight: 600; font-size: 16px; margin-bottom: 8px;">
        🚧 Multi-Agent Mode Coming Soon
      </div>
      <p style="color: #a16207; font-size: 14px; margin: 0;">
        This feature is under development. Running with single agent mode instead.
      </p>
    </div>
  `);
  
  // Disable multi-agent and run single agent
  multiAgentState.enabled = false;
  return sendMessageToOllama(message);
  
  /*
  // Sync models from dropdowns
  const model1 = document.getElementById('multiAgentModel1')?.value || multiAgentState.agents[0].model;
  const model2 = document.getElementById('multiAgentModel2')?.value || multiAgentState.agents[1].model;
  const model3 = document.getElementById('multiAgentModel3')?.value || multiAgentState.agents[2].model;
  
  const prefix1 = document.getElementById('agent1Prefix')?.value || '';
  const prefix2 = document.getElementById('agent2Prefix')?.value || '';
  const prefix3 = document.getElementById('agent3Prefix')?.value || '';
  
  console.log('Multi-Agent Models:', { model1, model2, model3 });
  
  // Create 3 AIAgent instances with different models
  const agents = [];
  const agentConfigs = [
    { id: 1, model: model1, prefix: prefix1, color: '#22c55e' },
    { id: 2, model: model2, prefix: prefix2, color: '#3b82f6' },
    { id: 3, model: model3, prefix: prefix3, color: '#a855f7' }
  ];
  
  // Add 3 clickable agent tabs at top - neutral style
  const activeAgents = agentConfigs.filter(a => a.model);
  const agentTabs = activeAgents.map(a => {
    const displayName = a.model;
    return `
    <div id="agent-tab-${a.id}" onclick="showAgentOutput(${a.id})" style="flex: 1; min-width: 160px; display: flex; align-items: center; gap: 6px; padding: 10px 16px; border: 2px solid #e5e7eb; border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s;">
      <span style="font-size: 13px; font-weight: 600; color: #374151;">${displayName}</span>
      <span style="font-size: 11px; color: #9ca3af;">· Agent ${a.id}</span>
      <span id="agent-status-${a.id}" style="margin-left: auto; font-size: 11px; color: #22c55e;">●</span>
    </div>
  `}).join('');
  
  const timestamp = Date.now();
  const containerId = `multi-agent-${timestamp}`;
  
  addMessageToChat('assistant', `
    <div id="${containerId}">
      <div class="multi-agent-tabs" style="display: flex; gap: 12px; margin-bottom: 16px;">
        ${agentTabs}
      </div>
      <div id="multi-agent-output-area" style="padding: 16px 0; min-height: 200px;">
        <div id="agent-content-1" style="display: block;">
          <div style="font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">Agent 1 Output</div>
          <div style="color: #64748b; font-size: 13px;">Agent 1 working...</div>
        </div>
        <div id="agent-content-2" style="display: none;">
          <div style="font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">Agent 2 Output</div>
          <div style="color: #64748b; font-size: 13px;">Agent 2 working...</div>
        </div>
        <div id="agent-content-3" style="display: none;">
          <div style="font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">Agent 3 Output</div>
          <div style="color: #64748b; font-size: 13px;">Agent 3 working...</div>
        </div>
      </div>
    </div>
  `);
  
  // Get working directory from main agent
  const workingDir = window.aiAgent?.workingDirectory;
  const workingDirPath = window.aiAgent?.toolExecutor?.workingDirectoryPath;
  
  // Shared collaborative context for all agents
  const sharedContext = {
    taskPlan: null,
    completedTasks: [],
    filesCreated: [],
    filesModified: [],
    agentProgress: {}
  };
  
  // First agent creates the plan, others execute parts
  const taskDistribution = [
    { role: 'planner', description: 'Create task breakdown and overall architecture' },
    { role: 'implementer', description: 'Implement core functionality and main files' },
    { role: 'refiner', description: 'Add polish, error handling, and optimizations' }
  ];
  
  agentConfigs.forEach((config, index) => {
    if (!config.model) return;
    
    // Create new AIAgent instance
    const agent = new AIAgent();
    
    // Configure with selected model
    agent.setConfig({ model: config.model });
    
    // Set same working directory as main agent
    if (workingDir) {
      agent.setWorkingDirectory(workingDir);
      if (workingDirPath) {
        agent.toolExecutor.workingDirectoryPath = workingDirPath;
      }
    }
    
    // Add to list
    agents.push({ ...config, instance: agent, role: taskDistribution[index]?.role || 'helper' });
    
    // Capture agentId in closure
    const agentId = config.id;
    const agentRole = taskDistribution[index]?.role || 'helper';
    const agentTask = taskDistribution[index]?.description || 'Assist with implementation';
    
    // Store reference to agent's original emitToUI
    const agentEmitToUI = agent.emitToUI.bind(agent);
    
    // Override emitToUI to update agent's own content area
    agent.emitToUI = (type, data) => {
      const contentDiv = document.getElementById(`agent-content-${agentId}`);
      if (!contentDiv) {
        console.log(`Agent ${agentId}: contentDiv not found`);
        return;
      }
      
      // Track file operations in shared context
      if (type === 'tool_success' && data.name === 'createFile' && data.result?.path) {
        sharedContext.filesCreated.push({ path: data.result.path, agent: agentId });
      }
      if (type === 'tool_success' && (data.name === 'writeFile' || data.name === 'editFile') && data.result?.path) {
        sharedContext.filesModified.push({ path: data.result.path, agent: agentId });
      }
      
      // Find or create content body (preserve header)
      let contentBody = contentDiv.querySelector('.agent-content-body');
      if (!contentBody) {
        contentBody = document.createElement('div');
        contentBody.className = 'agent-content-body';
        contentDiv.appendChild(contentBody);
        
        // Add role description at start
        contentBody.innerHTML = `<div style="color: #6b7280; font-size: 12px; margin-bottom: 8px; padding: 4px 8px; background: #f3f4f6; border-radius: 4px;"><strong>Role:</strong> ${agentRole} - ${agentTask}</div>`;
      }
      
      if (type === 'thinking') {
        contentBody.innerHTML += `<div style="color: #374151; font-size: 14px; line-height: 1.6; margin-top: 8px;">${data.message || 'Thinking...'}</div>`;
      } else if (type === 'tool_executing') {
        contentBody.innerHTML += `<div style="color: #6b7280; font-size: 12px; margin-top: 8px; padding: 8px; background: #f3f4f6; border-radius: 4px;">→ ${data.name}</div>`;
      } else if (type === 'tool_success') {
        const result = data.result || {};
        let detailsHtml = '';
        
        // Show detailed info based on tool type
        if (data.name === 'readFile' || data.name === 'readFiles') {
          const path = result.path || (result.results ? result.results.map(r => r.path).join(', ') : 'unknown');
          const lines = result.totalLines || result.lines || (result.content ? result.content.split('\n').length : 0);
          detailsHtml = `<div style="color: #22c55e; font-size: 12px; margin-top: 4px;">✓ Read ${path} (${lines} lines)</div>`;
        } else if (data.name === 'listFiles' || data.name === 'getFileTree') {
          const count = result.entries?.length || result.tree?.length || 0;
          detailsHtml = `<div style="color: #22c55e; font-size: 12px; margin-top: 4px;">✓ Listed ${count} files</div>`;
        } else if (data.name === 'searchFiles' || data.name === 'grepSearch') {
          const count = result.totalMatches || 0;
          const query = result.query || result.pattern || 'search';
          let searchResultsHtml = `<div style="color: #22c55e; font-size: 12px; margin-top: 4px; margin-bottom: 8px;">✓ Found ${count} matches for "${query}"</div>`;
          
          // Show detailed search results like VS Code
          if (result.results && result.results.length > 0) {
            searchResultsHtml += '<div style="margin-left: 12px; border-left: 2px solid var(--stroke); padding-left: 12px;">';
            result.results.slice(0, 10).forEach(fileResult => {
              const filePath = fileResult.path;
              const matches = fileResult.matches || [];
              
              searchResultsHtml += `
                <div style="margin-bottom: 8px;">
                  <div style="color: var(--text-soft); font-size: 11px; font-family: var(--code-font); margin-bottom: 2px;">
                    📄 ${escapeHtml(filePath)}
                  </div>
                  ${matches.slice(0, 5).map(match => `
                    <div style="display: flex; align-items: flex-start; gap: 8px; font-family: var(--code-font); font-size: 11px; line-height: 1.4;">
                      <span style="color: var(--muted); min-width: 28px; text-align: right;">${match.line}:</span>
                      <span style="color: var(--text); white-space: pre; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(match.text || match.preview || '').substring(0, 80)}</span>
                    </div>
                  `).join('')}
                  ${matches.length > 5 ? `<div style="color: var(--muted-soft); font-size: 10px; margin-left: 36px;">...and ${matches.length - 5} more</div>` : ''}
                </div>
              `;
            });
            if (result.results.length > 10) {
              searchResultsHtml += `<div style="color: var(--muted-soft); font-size: 11px; margin-top: 4px;">...and ${result.results.length - 10} more files</div>`;
            }
            searchResultsHtml += '</div>';
          }
          detailsHtml = searchResultsHtml;
        } else if (data.name === 'writeFile' || data.name === 'createFile') {
          detailsHtml = `<div style="color: #22c55e; font-size: 12px; margin-top: 4px;">✓ ${data.name} (${result.path})</div>`;
        } else {
          const fileInfo = result.path ? ` (${result.path})` : '';
          detailsHtml = `<div style="color: #22c55e; font-size: 12px; margin-top: 4px;">✓ ${data.name}${fileInfo}</div>`;
        }
        
        contentBody.innerHTML += detailsHtml;
      } else if (type === 'complete') {
        contentBody.innerHTML += `<div style="color: #374151; font-size: 14px; line-height: 1.6; margin-top: 12px; padding-top: 12px; border-top: 2px solid #22c55e;"><strong>Completed:</strong> ${formatStreamingContent(data.message)}</div>`;
      }
      
      // Still call original for terminal commands and other global UI
      agentEmitToUI(type, data);
    };
  });
  
  // Global function to switch agent tabs - defined outside at bottom of file
  
  // Run all agents in parallel with collaborative role-based prompts
  const promises = agents.map(async (agentInfo) => {
    try {
      // Build role-specific prompt
      let rolePrompt = '';
      if (agentInfo.role === 'planner') {
        rolePrompt = `You are the PLANNER agent (Agent ${agentInfo.id}). Your task is to create a detailed task breakdown and architecture plan for this project. DO NOT implement - just plan. Create a PLAN.md file with the complete task breakdown so other agents can execute.\n\nUser request: ${message}`;
      } else if (agentInfo.role === 'implementer') {
        rolePrompt = `You are the IMPLEMENTER agent (Agent ${agentInfo.id}). Your task is to implement the CORE functionality and main files based on the user request. Focus on the main working solution. Check if PLAN.md exists and follow it, but don't wait - start implementing the core features.\n\nUser request: ${message}`;
      } else if (agentInfo.role === 'refiner') {
        rolePrompt = `You are the REFINER agent (Agent ${agentInfo.id}). Your task is to add polish, error handling, edge cases, and optimizations. Check what other agents created and improve it. Add documentation, fix bugs, and make the solution production-ready.\n\nUser request: ${message}`;
      } else {
        rolePrompt = agentInfo.prefix ? `[${agentInfo.prefix}] ${message}` : message;
      }
      
      // Run the agent with role-specific prompt
      await agentInfo.instance.run(rolePrompt);
      
      return { agentId: agentInfo.id, success: true };
    } catch (error) {
      console.error(`Agent ${agentInfo.id} error:`, error);
      const contentDiv = document.getElementById(`agent-content-${agentInfo.id}`);
      if (contentDiv) {
        const body = contentDiv.querySelector('.agent-content-body') || contentDiv;
        body.innerHTML += `<div style="color: #dc2626; margin-top: 8px;">Error: ${error.message}</div>`;
      }
      return { agentId: agentInfo.id, success: false, error: error.message };
    }
  });
  
  // Wait for all agents to complete
  const results = await Promise.all(promises);
  multiAgentState.results = results;
  
  // Show completion notification
  const successCount = results.filter(r => r.success).length;
  showNotification(`${successCount}/${results.length} agents completed successfully`);
  */
}

// Global function to switch agent tabs
function showAgentOutput(agentId) {
  console.log('Switching to agent', agentId);
  // Hide all content
  for (let i = 1; i <= 3; i++) {
    const content = document.getElementById(`agent-content-${i}`);
    if (content) content.style.display = 'none';
    const tab = document.getElementById(`agent-tab-${i}`);
    if (tab) {
      tab.style.background = 'white';
      tab.style.opacity = '0.7';
    }
  }
  // Show selected
  const selected = document.getElementById(`agent-content-${agentId}`);
  if (selected) selected.style.display = 'block';
  const selectedTab = document.getElementById(`agent-tab-${agentId}`);
  if (selectedTab) {
    selectedTab.style.background = '#f0fdf4';
    selectedTab.style.opacity = '1';
  }
}

// Update agent output UI for multi-agent mode
function updateAgentOutput(agentId, data) {
  const outputDiv = document.getElementById(`agent-content-${agentId}`);
  if (!outputDiv) return;
  
  switch (data.type) {
    case 'thinking':
      outputDiv.innerHTML = `<div class="agent-thinking">${data.content || 'Thinking...'}</div>`;
      break;
    case 'tool_start':
      outputDiv.innerHTML += `<div style="color: #64748b; font-size: 12px; margin: 4px 0;">→ ${data.action} ${data.path || ''}</div>`;
      break;
    case 'tool_success':
      outputDiv.innerHTML += `<div style="color: #22c55e; font-size: 12px; margin: 4px 0;">✓ ${data.action} completed</div>`;
      break;
    case 'tool_error':
      outputDiv.innerHTML += `<div style="color: #dc2626; font-size: 12px; margin: 4px 0;">✗ ${data.action} failed: ${data.error}</div>`;
      break;
    default:
      if (data.content) {
        outputDiv.innerHTML += `<div>${formatStreamingContent(data.content)}</div>`;
      }
  }
  
  // Auto-scroll
  outputDiv.scrollTop = outputDiv.scrollHeight;
}

// Simple markdown formatter
function formatMarkdown(text, isStreaming = false) {
  // Handle thinking sections (various formats)
  text = text.replace(/<(thinking|think)>([\s\S]*?)<\/(thinking|think)>/gi, (match, tag1, thinkingContent, tag2) => {
    return createThinkingSection(thinkingContent.trim(), isStreaming);
  });
  
  // Color file paths in blue (e.g. src/app/page.tsx or package.json)
  text = text.replace(/(\/|\.\/|\.\.\/|\w+\/)([\w-]+\/)*[\w-]+\.[a-zA-Z0-9]+/gi, (match) => {
    return `<span style="color: #0ea5e9; font-family: monospace;">${match}</span>`;
  });
  
  // Also color bare filenames like package.json, README.md (word boundaries, no path)
  text = text.replace(/(^|\s)([\w-]+\.(json|md|txt|config|lock|yml|yaml|js|ts|jsx|tsx|css|html|py|java|go|rs|php))\b/gi, (match, prefix, filename) => {
    return `${prefix}<span style="color: #0ea5e9; font-family: monospace;">${filename}</span>`;
  });
  
  // Code blocks with language detection and better styling
  text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || '';
    const trimmedCode = code.trim();
    return `<pre style="background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 6px; padding: 16px; margin: 8px 0; overflow-x: auto; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; line-height: 1.5;"><code style="background: transparent; padding: 0; border: none;" class="language-${language}">${escapeHtml(trimmedCode)}</code></pre>`;
  });
  
  // Inline code with better styling
  text = text.replace(/`([^`]+)`/g, '<code style="background: #f6f8fa; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.9em; color: #24292f; border: 1px solid #e1e4e8;">$1</code>');
  // Headers
  text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  // Bold
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.*?)_/g, '<em>$1</em>');
  // Tables
  text = text.replace(/\|(.+)\|/g, (match, content) => {
    const cells = content.split('|').map(c => c.trim()).filter(c => c);
    if (cells.length === 0) return match;
    return '<td>' + cells.join('</td><td>') + '</td>';
  });
  // Wrap table rows
  text = text.replace(/(<td>.*<\/td>)\n/g, '<tr>$1</tr>\n');
  text = text.replace(/(<tr>.*<\/tr>\n)+/g, '<table>$&</table>');
  // Remove table separator lines
  text = text.replace(/<tr><td>-+<\/td>(<td>-+<\/td>)*<\/tr>\n/g, '');
  // Lists
  text = text.replace(/^- (.*$)/gm, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>\n)+/g, '<ul>$&</ul>');
  // Line breaks
  text = text.replace(/\n/g, '<br>');
  return text;
}

function createThinkingSection(content, isExpanded = true) {
  const expandedClass = isExpanded ? 'expanded' : '';
  return `<div class="thinking-section ${expandedClass}">
    <div class="thinking-header" onclick="this.parentElement.classList.toggle('expanded')">
      <svg class="thinking-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
      <span class="thinking-label">Thinking</span>
      <svg class="thinking-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
    <div class="thinking-content">
      <div class="thinking-content-inner">${content}</div>
    </div>
  </div>`;
}

// Format streaming content with proper formatting
function formatStreamingContent(content) {
  // Just format the content, no thinking wrapper for streaming
  return formatMarkdown(content, true);
}

// Chat display functions
let messageIdCounter = 0;
const messageMap = new Map();

function addMessageToChat(role, content, images = []) {
  const id = ++messageIdCounter;
  messageMap.set(id, { role, content, images });
  
  // Get chat container
  const chatContainer = document.getElementById('chatContainer');
  const welcomeScreen = document.getElementById('welcomeScreen');
  
  if (chatContainer) {
    // Hide welcome screen and show chat
    if (welcomeScreen) {
      welcomeScreen.style.display = 'none';
    }
    chatContainer.style.display = 'block';
    
    const messageEl = document.createElement('div');
    messageEl.id = `msg-${id}`;
    messageEl.className = `chat-message ${role}`;
    
    // Style based on role
    let styles;
    if (role === 'user') {
      styles = 'background: #f3f4f6; padding: 8px 14px; border-radius: 12px; margin-bottom: 16px; margin-left: auto; width: fit-content; max-width: 70%; text-align: left;';
    } else if (role === 'agent') {
      // Cursor-style: transparent, no border, clean
      styles = 'background: transparent; padding: 4px 0; border-radius: 0; margin-bottom: 2px; margin-right: auto; max-width: 95%; border: none; font-size: 13px; color: #666;';
    } else {
      styles = 'background: transparent; padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; margin-right: auto; max-width: 85%; border: none;';
    }
    messageEl.style.cssText = styles;
    messageEl.classList.add('fade-in'); // Add animation class
    
    // Build images HTML if present
    let imagesHtml = '';
    if (images && images.length > 0) {
      imagesHtml = images.map(img => `
        <img src="${img}" style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-bottom: 8px; display: block;" />
      `).join('');
    }
    
    // Format content
    let formattedContent;
    if (role === 'user') {
      formattedContent = escapeHtml(content).replace(/\n/g, '<br>');
    } else if (role === 'agent' && typeof content === 'object') {
      // Agent structured format - render Cursor-style
      formattedContent = renderAgentStructuredContent(content, id);
    } else {
      // AI/Agent content - format markdown
      formattedContent = formatMarkdown(content);
    }
    
    // Text color based on role
    const textColor = role === 'user' ? '#374151' : (role === 'agent' ? '#888888' : '#334155');
    
    messageEl.innerHTML = `<div class="message-content" style="font-size: 14px; color: ${textColor}; line-height: 1.6; word-wrap: break-word;">${imagesHtml}${formattedContent}</div>`;
    chatContainer.appendChild(messageEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
  
  return id;
}

// Handle command approval (Run/Skip buttons) - using event delegation
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.cmd-run-btn, .cmd-skip-btn');
  if (!btn) return;
  
  const cmdId = btn.dataset.cmdId;
  const command = decodeURIComponent(btn.dataset.cmd || '');
  const approved = btn.classList.contains('cmd-run-btn');
  
  // Update UI to show approved/rejected state
  const cmdEl = document.getElementById(cmdId);
  if (cmdEl) {
    const buttonsDiv = cmdEl.querySelector('div:last-child');
    if (buttonsDiv) {
      if (approved) {
        buttonsDiv.innerHTML = `<span style="color: #22c55e; font-size: 13px;">✓ Approved - Running...</span>`;
      } else {
        buttonsDiv.innerHTML = `<span style="color: #9ca3af; font-size: 13px;">✗ Skipped</span>`;
      }
    }
  }
  
  // Send approval response to main process
  if (window.electronAPI && window.electronAPI.respondCommandApproval) {
    window.electronAPI.respondCommandApproval({ command, approved });
  }
});

// Legacy function for backwards compatibility
function handleCommandApproval(cmdId, command, approved) {
  // This is now handled by event delegation above
}

// Typing animation utility - 20 tokens/s = 50ms per char
const TYPING_SPEED_MS = 50; // ~20 chars/second
const activeTypingAnimations = new Map();

function startTypingAnimation(elementId, fullText, speed = TYPING_SPEED_MS) {
  // Cancel any existing animation for this element
  if (activeTypingAnimations.has(elementId)) {
    clearInterval(activeTypingAnimations.get(elementId));
  }
  
  const element = document.getElementById(elementId);
  if (!element) return;
  
  let index = 0;
  const chunkSize = 3; // Show 3 chars at a time for smoother feel
  
  const interval = setInterval(() => {
    if (index >= fullText.length) {
      clearInterval(interval);
      activeTypingAnimations.delete(elementId);
      element.innerHTML = fullText;
      return;
    }
    
    const chunk = fullText.slice(0, index + chunkSize);
    element.innerHTML = chunk;
    index += chunkSize;
  }, speed);
  
  activeTypingAnimations.set(elementId, interval);
  return interval;
}

// Render structured agent content (Cursor-style with typing animation)
function renderAgentStructuredContent(content, msgId) {
  if (!content || typeof content !== 'object') return '';
  
  // Generate unique IDs for typing animation
  const typingId = `typing-${msgId}-${Math.random().toString(36).substr(2, 9)}`;
  
  switch(content.type) {
    case 'thinking':
      // Thinking text - show directly (inline scripts don't execute)
      return `<div style="color: #2a2a2a; font-size: 15px; margin: 4px 0; line-height: 1.5;">${escapeHtml(content.text || '')}</div>`;
    
    case 'animated':
      // Exploring... with smooth flowing gradient wave
      return `<div style="font-size: 15px; font-weight: 400; margin: 4px 0; font-family: system-ui, -apple-system, sans-serif; background: linear-gradient(90deg, #999 0%, #333 20%, #000 40%, #333 60%, #999 80%, #999 100%); background-size: 300% 100%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; animation: shaderFlow 3s ease-in-out infinite;">${escapeHtml(content.baseText || 'Working')}${content.dots || ''}</div>`;
    
    case 'status': {
      // Status with color-based shader animation (diving, exploring, sailing, monitoring)
      const statusText = content.text || 'working';
      const statusColor = content.color || '#6b7280';
      const step = content.step || 1;
      
      // Create gradient based on status color
      const gradientColors = {
        '#3b82f6': 'linear-gradient(90deg, #60a5fa 0%, #3b82f6 20%, #1d4ed8 40%, #2563eb 60%, #60a5fa 80%, #60a5fa 100%)', // Blue - diving (deep water)
        '#22c55e': 'linear-gradient(90deg, #86efac 0%, #22c55e 20%, #16a34a 40%, #15803d 60%, #86efac 80%, #86efac 100%)', // Green - exploring (forest)
        '#8b5cf6': 'linear-gradient(90deg, #c4b5fd 0%, #8b5cf6 20%, #7c3aed 40%, #6d28d9 60%, #c4b5fd 80%, #c4b5fd 100%)', // Purple - sailing (smooth)
        '#f59e0b': 'linear-gradient(90deg, #fcd34d 0%, #f59e0b 20%, #d97706 40%, #b45309 60%, #fcd34d 80%, #fcd34d 100%)', // Amber - monitoring (watchful)
        '#6b7280': 'linear-gradient(90deg, #9ca3af 0%, #6b7280 20%, #4b5563 40%, #374151 60%, #9ca3af 80%, #9ca3af 100%)'  // Gray - working
      };
      
      const gradient = gradientColors[statusColor] || gradientColors['#6b7280'];
      
      return `<div style="font-size: 15px; font-weight: 400; margin: 4px 0; font-family: system-ui, -apple-system, sans-serif; background: ${gradient}; background-size: 300% 100%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; animation: shaderFlow 3s ease-in-out infinite;">${escapeHtml(statusText)}${content.dots || ''}</div>`;
    }
    
    case 'collapsible':
      // Collapsible section
      return renderCollapsibleSection(content.title, content.content, content.open, msgId);
    
    case 'operations':
      return renderOperationsSection(content.items || [], content.count, msgId);
    
    case 'complete': {
      // Complete message - collapsible summary by default
      const msg = content.message || '';
      const firstLine = msg.split('\n')[0].substring(0, 80);
      const hasMore = msg.length > firstLine.length;
      const summary = hasMore ? firstLine + '...' : firstLine;
      
      return `
        <div style="margin: 4px 0;">
          <div onclick="
            const full = this.nextElementSibling;
            const isOpening = full.style.display === 'none';
            full.style.display = isOpening ? 'block' : 'none';
            this.querySelector('.arrow').style.transform = isOpening ? 'rotate(90deg)' : 'rotate(0deg)';
            this.querySelector('.preview').style.display = isOpening ? 'none' : 'inline';
            if (isOpening) {
              setTimeout(() => {
                const chatContainer = document.getElementById('chatContainer') || document.querySelector('.chat-messages');
                if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
              }, 50);
            }"
               style="cursor: pointer; display: flex; align-items: center; gap: 4px; color: #22c55e; font-size: 13px; font-family: system-ui, -apple-system, sans-serif; line-height: 1.4;">
            <span class="arrow" style="display: inline-block; transition: transform 0.2s; font-size: 10px;">▶</span>
            <span style="font-weight: 500;">✓ Task Complete</span>
            <span class="preview" style="color: #6b7280; margin-left: 8px; font-size: 12px;">${escapeHtml(summary)}</span>
          </div>
          <div style="display: none; margin: 4px 0 4px 16px; padding: 8px 12px; background: #f9fafb; border-radius: 4px; border-left: 2px solid #e5e7eb; font-size: 14px; color: #374151;">
            ${formatMarkdown(msg)}
          </div>
        </div>
      `;
    }
    
    case 'error':
      return `<div style="color: #dc2626; padding: 8px 0; font-size: 15px;">❌ ${escapeHtml(content.message || 'Error')}</div>`;
    
    case 'file_diff':
      return content.html || '';
    
    case 'writing': {
      // Writing animation with orange/amber shader for file creation
      const fileName = content.file || 'file';
      const additions = content.additions || 0;
      const deletions = content.deletions || 0;
      const diffText = additions || deletions ? ` +${additions} -${deletions}` : '';
      
      // Orange/amber gradient for writing (like file creation)
      const gradient = 'linear-gradient(90deg, #fdba74 0%, #f97316 20%, #ea580c 40%, #c2410c 60%, #fdba74 80%, #fdba74 100%)';
      
      return `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
        <span style="font-size: 15px; font-weight: 400; font-family: system-ui, -apple-system, sans-serif; background: ${gradient}; background-size: 300% 100%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; animation: shaderFlow 3s ease-in-out infinite;">Writing</span>
        <span style="font-size: 13px; color: #6b7280;">${escapeHtml(fileName)}${diffText ? `<span style="color: #22c55e; margin-left: 4px;">+${additions}</span><span style="color: #dc2626; margin-left: 4px;">-${deletions}</span>` : ''}</span>
      </div>`;
    }
    
    case 'terminal_command': {
      // Render terminal command - inline approval UI like screenshot
      const isSuccess = content.status === 'completed' && content.result?.success;
      const cmdId = `term-${msgId}-${Math.random().toString(36).substr(2, 9)}`;
      
      // For pending approval - show inline approval card with Run/Skip buttons (white theme)
      if (content.status === 'pending_approval') {
        return `
          <div id="${cmdId}" style="margin: 8px 0; border: 1px solid #3b82f6; border-radius: 8px; background: #ffffff; overflow: hidden; font-family: 'Segoe UI', system-ui, sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="padding: 12px 16px; background: #f8fafc;">
              <div style="color: #64748b; font-size: 11px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">Command</div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: #94a3b8; font-family: monospace; font-size: 14px;">○</span>
                <span style="font-family: monospace; font-size: 14px; color: #334155;">${escapeHtml(content.command || '')}</span>
              </div>
              ${content.reason ? `<div style="color: #64748b; font-size: 12px; margin-top: 8px; padding-left: 20px;">${escapeHtml(content.reason)}</div>` : ''}
            </div>
            <div style="padding: 12px 16px; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
              <button class="cmd-skip-btn" data-cmd-id="${cmdId}" data-cmd="${encodeURIComponent(content.command || '')}" 
                      style="background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; padding: 6px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500;">
                Skip
              </button>
              <button class="cmd-run-btn" data-cmd-id="${cmdId}" data-cmd="${encodeURIComponent(content.command || '')}" 
                      style="background: #0ea5e9; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: 500;">
                Run <span style="font-size: 11px; opacity: 0.8;">Alt+↵</span>
              </button>
            </div>
          </div>
        `;
      }
      
      // For completed commands, show summary line that expands
      if (content.status === 'completed' && content.result) {
        const hasError = !content.result.success || content.result.error;
        const summaryColor = hasError ? '#dc2626' : (isSuccess ? '#22c55e' : '#6b7280');
        const summaryText = hasError ? '✗ Failed' : '✓ Success';
        
        return `<div style="margin: 4px 0;">
          <div onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.querySelector('.arrow').style.transform = this.nextElementSibling.style.display === 'none' ? 'rotate(0deg)' : 'rotate(90deg)';" 
               style="cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 4px 0; color: #6b7280; font-size: 14px;">
            <span class="arrow" style="display: inline-block; transition: transform 0.2s; font-size: 10px; color: #9ca3af;">▶</span>
            <span style="font-family: monospace; color: #374151;">$ ${escapeHtml(content.command || '')}</span>
            <span style="margin-left: auto; color: ${summaryColor}; font-size: 13px;">${summaryText}</span>
          </div>
          <div style="display: none; margin: 8px 0 8px 16px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fafafa; overflow: hidden;">
            ${content.result.stdout ? `<pre style="margin: 0; padding: 12px; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; color: #374151; white-space: pre-wrap; word-wrap: break-word; line-height: 1.5; max-height: 300px; overflow-y: auto;">${escapeHtml(content.result.stdout)}</pre>` : ''}
            ${content.result.stderr ? `<pre style="margin: 0; padding: 12px; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; color: #dc2626; white-space: pre-wrap; word-wrap: break-word; background: #fef2f2;">${escapeHtml(content.result.stderr)}</pre>` : ''}
            ${content.result.error && !content.result.stderr ? `<div style="padding: 12px; color: #dc2626; font-size: 13px;">${escapeHtml(content.result.error)}</div>` : ''}
          </div>
        </div>`;
      }
      
      // For executing - show inline style with live output
      const statusIcon = isSuccess ? '✓' : (content.status === 'executing' ? '⟳' : '✗');
      const statusColor = isSuccess ? '#22c55e' : (content.status === 'executing' ? '#3b82f6' : '#dc2626');
      const statusText = isSuccess ? 'Success' : (content.status === 'executing' ? 'Running' : 'Failed');
      
      let html = `<div data-terminal-command="${escapeHtml(content.command || '')}" style="margin: 8px 0; border: 1px solid ${content.status === 'executing' ? '#e5e7eb' : (isSuccess ? '#22c55e' : '#dc2626')}; border-radius: 8px; background: #f5f5f5; overflow: hidden; font-family: 'Segoe UI', system-ui, sans-serif;">`;
      
      // Header with command and status
      html += `<div style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: ${content.result || content.status === 'executing' ? '1px solid #e5e7eb' : 'none'};">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
          <span style="color: #666; font-family: monospace; font-size: 13px; font-weight: 600;">$</span>
          <span style="font-family: monospace; font-size: 13px; color: #2a2a2a;">${escapeHtml(content.command || '')}</span>
        </div>
        <span style="color: ${statusColor}; font-size: 13px; font-weight: 500;">${statusIcon} ${statusText}</span>
      </div>`;
      
      // Live output for executing commands
      if (content.status === 'executing') {
        html += `<div class="terminal-output" style="padding: 12px 16px; background: #1a1a1a; max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 12px; color: #e0e0e0;"></div>`;
      }
      
      html += '</div>';
      return html;
    }
    
    default:
      return formatMarkdown(JSON.stringify(content));
  }
}

// Render collapsible section (like "Thought briefly") with smooth animation
function renderCollapsibleSection(title, content, open, id, useTyping = false) {
  const contentId = `collapsible-${id}-${Math.random().toString(36).substr(2, 9)}`;
  const arrow = open ? '▼' : '▶';
  const maxHeight = open ? '1000px' : '0';
  const opacity = open ? '1' : '0';
  const padding = open ? '8px 0 8px 16px' : '0 0 0 16px';
  
  const safeContent = content ? escapeHtml(content).replace(/\n/g, '<br>') : '';
  
  // Light black colors for expandable sections
  return `
    <div style="margin: 4px 0;">
      <div onclick="toggleCollapsibleSmooth('${contentId}', this)" 
           style="cursor: pointer; color: #555; font-size: 14px; user-select: none; display: flex; align-items: center; gap: 4px; transition: color 0.2s;">
        <span class="collapsible-arrow" style="transition: transform 0.2s;">${arrow}</span>
        <span style="font-weight: 500;">${escapeHtml(title)}</span>
      </div>
      <div id="${contentId}" style="overflow: hidden; transition: max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease; max-height: ${maxHeight}; opacity: ${opacity}; padding: ${padding}; color: #666; font-size: 15px; line-height: 1.5;">
        ${safeContent}
      </div>
    </div>
  `;
}

// Render operations section - collapsible showing individual files like screenshot
function renderOperationsSection(operations, count, id, useTyping = false) {
  console.log('DEBUG renderOperationsSection:', { operations, count, fileReads: operations.filter(op => op.type === 'read') });
  if (!operations.length) return '';
  
  // Count different types of operations
  const fileCreates = operations.filter(op => op.type === 'create');
  const fileEdits = operations.filter(op => op.type === 'edit');
  const fileReads = operations.filter(op => op.type === 'read');
  const fileDeletes = operations.filter(op => op.type === 'delete');
  const fileMoves = operations.filter(op => op.type === 'move');
  const fileCopies = operations.filter(op => op.type === 'copy');
  const fileInfos = operations.filter(op => op.type === 'info');
  const fileReferences = operations.filter(op => op.type === 'references');
  const fileValidates = operations.filter(op => op.type === 'validate');
  const terminalCmds = operations.filter(op => op.type === 'terminal');
  const grepOps = operations.filter(op => op.type === 'grep');
  console.log('DEBUG fileReads count:', fileReads.length, fileReads);

  // Build summary text like "Created 11 files, edited 2 files, deleted 1 file, ran 3 commands"
  let summaryParts = [];
  if (fileCreates.length > 0) summaryParts.push(`Created ${fileCreates.length} file${fileCreates.length > 1 ? 's' : ''}`);
  if (fileEdits.length > 0) summaryParts.push(`edited ${fileEdits.length} file${fileEdits.length > 1 ? 's' : ''}`);
  if (fileDeletes.length > 0) summaryParts.push(`deleted ${fileDeletes.length} file${fileDeletes.length > 1 ? 's' : ''}`);
  if (fileMoves.length > 0) summaryParts.push(`moved ${fileMoves.length} file${fileMoves.length > 1 ? 's' : ''}`);
  if (fileCopies.length > 0) summaryParts.push(`copied ${fileCopies.length} file${fileCopies.length > 1 ? 's' : ''}`);
  if (fileReads.length > 0) summaryParts.push(`read ${fileReads.length} file${fileReads.length > 1 ? 's' : ''}`);
  if (fileInfos.length > 0) summaryParts.push(`checked ${fileInfos.length} file${fileInfos.length > 1 ? 's' : ''}`);
  if (fileReferences.length > 0) summaryParts.push(`found ${fileReferences.length} reference${fileReferences.length > 1 ? 's' : ''}`);
  if (fileValidates.length > 0) summaryParts.push(`validated ${fileValidates.length} file${fileValidates.length > 1 ? 's' : ''}`);
  if (grepOps.length > 0) summaryParts.push(`searched ${grepOps.length} time${grepOps.length > 1 ? 's' : ''}`);
  if (terminalCmds.length > 0) summaryParts.push(`ran ${terminalCmds.length} command${terminalCmds.length > 1 ? 's' : ''}`);
  
  const summaryText = summaryParts.join(', ') || `Ran ${operations.length} operation${operations.length > 1 ? 's' : ''}`;
  const opsId = `ops-${id}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Build individual file list with change counts
  let fileListHtml = '';
  
  // Created files
  fileCreates.forEach(op => {
    const lines = op.content ? op.content.split('\n').length : 0;
    const lineRange = lines > 0 ? ` L1-${lines}` : '';
    fileListHtml += `
      <div style="padding: 1px 0; display: flex; align-items: center; gap: 4px; line-height: 1.3;">
        <span style="color: #22c55e; font-size: 11px;">Created</span>
        <span style="color: #0ea5e9; font-family: monospace; font-size: 12px;">${escapeHtml(op.path)}${lineRange}</span>
        <span style="color: #22c55e; font-size: 11px; margin-left: auto;">+${lines}/-0</span>
      </div>`;
  });
  
  // Edited files
  fileEdits.forEach(op => {
    const added = op.diffAdded || 1;
    const removed = op.diffRemoved || 1;
    const lineRange = op.lineRange ? ` L${op.lineRange.start}-${op.lineRange.end}` : '';
    fileListHtml += `
      <div style="padding: 1px 0; display: flex; align-items: center; gap: 4px; line-height: 1.3;">
        <span style="color: #f59e0b; font-size: 11px;">Edited</span>
        <span style="color: #0ea5e9; font-family: monospace; font-size: 12px;">${escapeHtml(op.path)}${lineRange}</span>
        <span style="color: #22c55e; font-size: 11px; margin-left: auto;">+${added}</span>
        <span style="color: #ef4444; font-size: 11px;">-${removed}</span>
      </div>`;
  });
  
  // Deleted files
  fileDeletes.forEach(op => {
    fileListHtml += `
      <div style="padding: 1px 0; display: flex; align-items: center; gap: 4px; line-height: 1.3;">
        <span style="color: #ef4444; font-size: 11px;">Deleted</span>
        <span style="color: #0ea5e9; font-family: monospace; font-size: 12px;">${escapeHtml(op.path)}</span>
      </div>`;
  });
  
  // Read files
  fileReads.forEach(op => {
    const lineInfo = op.lines || '';
    fileListHtml += `
      <div style="padding: 1px 0; display: flex; align-items: center; gap: 4px; line-height: 1.3;">
        <span style="color: #64748b; font-size: 11px;">Read</span>
        <span style="color: #0ea5e9; font-family: monospace; font-size: 12px;">${escapeHtml(op.path)}</span>
        ${lineInfo ? `<span style="color: #64748b; font-size: 11px; margin-left: auto;">${lineInfo}</span>` : ''}
      </div>`;
  });
  
  // Moved files
  fileMoves.forEach(op => {
    fileListHtml += `
      <div style="padding: 1px 0; display: flex; align-items: center; gap: 4px; line-height: 1.3;">
        <span style="color: #f59e0b; font-size: 11px;">Moved</span>
        <span style="color: #0ea5e9; font-family: monospace; font-size: 12px;">${escapeHtml(op.from)}</span>
        <span style="color: #64748b; font-size: 11px;">→</span>
        <span style="color: #0ea5e9; font-family: monospace; font-size: 12px;">${escapeHtml(op.to)}</span>
      </div>`;
  });
  
  // Copied files
  fileCopies.forEach(op => {
    fileListHtml += `
      <div style="padding: 1px 0; display: flex; align-items: center; gap: 4px; line-height: 1.3;">
        <span style="color: #22c55e; font-size: 11px;">Copied</span>
        <span style="color: #0ea5e9; font-family: monospace; font-size: 12px;">${escapeHtml(op.from)}</span>
        <span style="color: #64748b; font-size: 11px;">→</span>
        <span style="color: #0ea5e9; font-family: monospace; font-size: 12px;">${escapeHtml(op.to)}</span>
      </div>`;
  });
  
  // File info
  fileInfos.forEach(op => {
    fileListHtml += `
      <div style="padding: 1px 0; display: flex; align-items: center; gap: 4px; line-height: 1.3;">
        <span style="color: #64748b; font-size: 11px;">Info</span>
        <span style="color: #0ea5e9; font-family: monospace; font-size: 12px;">${escapeHtml(op.path)}</span>
      </div>`;
  });
  
  // References
  fileReferences.forEach(op => {
    fileListHtml += `
      <div style="padding: 1px 0; display: flex; align-items: center; gap: 4px; line-height: 1.3;">
        <span style="color: #8b5cf6; font-size: 11px;">References</span>
        <span style="color: #0ea5e9; font-family: monospace; font-size: 12px;">${escapeHtml(op.symbol)}</span>
        <span style="color: #64748b; font-size: 11px; margin-left: auto;">${op.count} found</span>
      </div>`;
  });
  
  // Validated files
  fileValidates.forEach(op => {
    const validColor = op.valid ? '#22c55e' : '#ef4444';
    const validText = op.valid ? 'Valid' : 'Invalid';
    fileListHtml += `
      <div style="padding: 1px 0; display: flex; align-items: center; gap: 4px; line-height: 1.3;">
        <span style="color: ${validColor}; font-size: 11px;">${validText}</span>
        <span style="color: #0ea5e9; font-family: monospace; font-size: 12px;">${escapeHtml(op.path)}</span>
      </div>`;
  });
  
  // Terminal commands
  terminalCmds.forEach(op => {
    fileListHtml += `
      <div style="padding: 1px 0; display: flex; align-items: center; gap: 4px; line-height: 1.3;">
        <span style="color: #6b7280; font-size: 11px;">Ran</span>
        <span style="color: #374151; font-family: monospace; font-size: 12px;">${escapeHtml(op.command || 'command')}</span>
      </div>`;
  });

  // Grep search results already declared above
  grepOps.forEach(op => {
    fileListHtml += `
      <div style="padding: 1px 0; display: flex; align-items: center; gap: 4px; line-height: 1.3;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <span style="color: #374151; font-family: monospace; font-size: 12px;">Searched "${escapeHtml(op.query || '')}" (${op.count || 0} matches)</span>
      </div>`;
  });

  // Collapsible section like screenshot
  return `
    <div style="margin: 2px 0;">
      <div onclick="
        const list = this.nextElementSibling;
        const isOpening = list.style.display === 'none';
        list.style.display = isOpening ? 'block' : 'none';
        this.querySelector('.arrow').style.transform = isOpening ? 'rotate(90deg)' : 'rotate(0deg)';
        if (isOpening) {
          setTimeout(() => {
            const chatContainer = document.getElementById('chatContainer') || document.querySelector('.chat-messages');
            if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
          }, 50);
        }"
           style="cursor: pointer; display: flex; align-items: center; gap: 3px; color: #9ca3af; font-size: 12px; font-family: system-ui, -apple-system, sans-serif; line-height: 1.3;">
        <span class="arrow" style="display: inline-block; transition: transform 0.2s; font-size: 8px;">▶</span>
        <span>${escapeHtml(summaryText)}</span>
      </div>
      <div style="display: none; margin: 2px 0 2px 10px; padding: 2px 6px; background: #f9fafb; border-radius: 3px; border-left: 2px solid #e5e7eb; font-size: 11px;">
        ${fileListHtml}
      </div>
    </div>
  `;
}

// Render file content block (Cursor-style compact - only 3 lines)
function renderFileBlock(path, content, isNew, msgId) {
  const lines = content.split('\n');
  const lineCount = lines.length;
  const diffIndicator = isNew ? `+${lineCount}/-0` : 'edited';
  const blockId = `file-${msgId}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Limit to first 3 lines for compact display (like Cursor)
  const displayLines = lines.slice(0, 3);
  const hasMore = lines.length > 3;
  
  const lineNumbers = displayLines.map((_, i) => `<span style="color: #999; user-select: none;">${i + 1}</span>`).join('\n');
  const codeContent = displayLines.map(line => escapeHtml(line)).join('\n');
  
  // Normal dark colors for better visibility
  return `
    <div id="${blockId}" class="file-block" style="margin: 4px 0 8px 0; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; max-width: 500px;">
      <div onclick="toggleFileBlock('${blockId}')" style="cursor: pointer; background: #f0f0f0; padding: 6px 12px; font-size: 13px; color: #555; border-bottom: 1px solid #ddd; display: flex; align-items: center; gap: 6px; transition: background 0.2s;">
        <span class="file-arrow" style="transition: transform 0.2s; font-size: 12px; color: #888;">▼</span>
        <span style="font-family: 'Monaco', 'Menlo', monospace; color: #3a3a3a;">${escapeHtml(path)}</span>
        <span style="color: ${isNew ? '#28a745' : '#f0ad4e'}; font-size: 12px;">${diffIndicator}</span>
      </div>
      <div class="file-content" style="display: flex; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 13px; line-height: 1.4; overflow-x: auto;">
        <div style="background: #f5f5f5; padding: 8px 8px 8px 12px; text-align: right; border-right: 1px solid #ddd; min-width: 30px; color: #888;">
          ${lineNumbers}
        </div>
        <div style="padding: 8px 12px; flex: 1; white-space: pre; color: #2a2a2a;">
          ${codeContent}${hasMore ? '\n<span style="color: #999;">... ' + (lines.length - 3) + ' more lines</span>' : ''}
        </div>
      </div>
    </div>
  `;
}

// Toggle file block with smooth animation
function toggleFileBlock(blockId) {
  const block = document.getElementById(blockId);
  if (!block) return;
  
  const content = block.querySelector('.file-content');
  const arrow = block.querySelector('.file-arrow');
  
  if (content && arrow) {
    const isOpen = content.style.display !== 'none';
    if (isOpen) {
      content.style.maxHeight = content.scrollHeight + 'px';
      setTimeout(() => {
        content.style.maxHeight = '0';
        content.style.opacity = '0';
      }, 10);
      setTimeout(() => {
        content.style.display = 'none';
      }, 300);
      arrow.style.transform = 'rotate(-90deg)';
    } else {
      content.style.display = 'flex';
      content.style.maxHeight = '0';
      content.style.opacity = '0';
      setTimeout(() => {
        content.style.maxHeight = '500px';
        content.style.opacity = '1';
      }, 10);
      arrow.style.transform = 'rotate(0deg)';
    }
  }
}

// Toggle operations section with smooth animation
function toggleOperationsSection(contentId, headerEl) {
  const content = document.getElementById(contentId);
  const arrow = headerEl.querySelector('.ops-arrow');
  if (content && arrow) {
    const isOpen = content.style.maxHeight !== '0px' && content.style.maxHeight !== '';
    if (isOpen) {
      // Collapse
      content.style.maxHeight = content.scrollHeight + 'px';
      content.style.opacity = '1';
      setTimeout(() => {
        content.style.maxHeight = '0';
        content.style.opacity = '0';
      }, 10);
      arrow.style.transform = 'rotate(-90deg)';
    } else {
      // Expand
      content.style.maxHeight = '1000px';
      content.style.opacity = '1';
      arrow.style.transform = 'rotate(0deg)';
    }
  }
}

// Auto-collapse operations when agent is done
function collapseOperations() {
  // Collapse file operations
  const opsContent = document.querySelectorAll('[id^="ops-content-"]');
  opsContent.forEach(el => {
    el.style.maxHeight = el.scrollHeight + 'px';
    el.style.opacity = '1';
    setTimeout(() => {
      el.style.maxHeight = '0';
      el.style.opacity = '0';
    }, 100);
  });
  
  // Collapse all collapsible sections (Thought briefly, Planning)
  const collapsibleContent = document.querySelectorAll('[id^="collapsible-"]');
  collapsibleContent.forEach(el => {
    const header = el.previousElementSibling;
    const arrow = header?.querySelector('.collapsible-arrow');
    if (arrow) arrow.style.transform = 'rotate(-90deg)';
    el.style.maxHeight = '0';
    el.style.opacity = '0';
    el.style.padding = '0 0 0 16px';
  });
}

// Auto-expand operations when agent starts
function expandOperations() {
  // Expand file operations
  const opsContent = document.querySelectorAll('[id^="ops-content-"]');
  opsContent.forEach(el => {
    el.style.maxHeight = '2000px';
    el.style.opacity = '1';
  });
  
  // Expand all collapsible sections
  const collapsibleContent = document.querySelectorAll('[id^="collapsible-"]');
  collapsibleContent.forEach(el => {
    const header = el.previousElementSibling;
    const arrow = header?.querySelector('.collapsible-arrow');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
    el.style.maxHeight = '1000px';
    el.style.opacity = '1';
    el.style.padding = '8px 0 8px 16px';
  });
}

// Toggle collapsible section (legacy)
function toggleCollapsible(contentId, headerEl) {
  const content = document.getElementById(contentId);
  const arrow = headerEl.querySelector('.collapsible-arrow');
  if (content && arrow) {
    const isOpen = content.style.display === 'block';
    content.style.display = isOpen ? 'none' : 'block';
    arrow.textContent = isOpen ? '▶' : '▼';
  }
}

// Toggle collapsible section with smooth animation
function toggleCollapsibleSmooth(contentId, headerEl) {
  const content = document.getElementById(contentId);
  const arrow = headerEl.querySelector('.collapsible-arrow');
  if (content && arrow) {
    const isOpen = content.style.maxHeight !== '0px' && content.style.maxHeight !== '';
    if (isOpen) {
      // Collapse
      content.style.maxHeight = content.scrollHeight + 'px';
      content.style.opacity = '1';
      setTimeout(() => {
        content.style.maxHeight = '0';
        content.style.opacity = '0';
        content.style.padding = '0 0 0 16px';
      }, 10);
      arrow.style.transform = 'rotate(-90deg)';
    } else {
      // Expand
      content.style.maxHeight = '1000px';
      content.style.opacity = '1';
      content.style.padding = '8px 0 8px 16px';
      arrow.style.transform = 'rotate(0deg)';
    }
  }
}

function updateMessageInChat(id, newContent) {
  const msg = messageMap.get(id);
  if (msg) {
    msg.content = newContent;
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      const contentDiv = el.querySelector('div');
      if (contentDiv) {
        // Handle object content (animated, operations, etc.)
        if (typeof newContent === 'object' && newContent !== null) {
          contentDiv.innerHTML = renderAgentStructuredContent(newContent, id);
        } else {
          contentDiv.innerHTML = newContent;
        }
      }
    }
  }
}

function resetChatView() {
  // Clear chat container
  const chatContainer = document.getElementById('chatContainer');
  if (chatContainer) {
    chatContainer.innerHTML = '';
    chatContainer.style.display = 'none';
  }
  
  // Show welcome screen
  const welcomeScreen = document.getElementById('welcomeScreen');
  if (welcomeScreen) {
    welcomeScreen.style.display = 'flex';
  }
  
  // Clear message map
  messageMap.clear();
  messageIdCounter = 0;
}
const chevronDownIcon = `<svg class="icon-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

const settingsIcons = {
  gear: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
  search: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
  file: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  multiAgent: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
};

const settingsSections = [
  { id: "appearance", label: "Appearance", icon: "search" },
  { id: "personalization", label: "Personalization", icon: "gear" },
  { id: "multiagent", label: "Multi-Agent", icon: "multiAgent" }
];

function settingRow(name, description, control) {
  return `
    <div class="setting-row">
      <div>
        <div class="setting-name">${name}</div>
        ${description ? `<div class="setting-description">${description}</div>` : ""}
      </div>
      ${control}
    </div>
  `;
}

function saveAppSettings() {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
}

function getSettingValue(path) {
  return path.split('.').reduce((value, key) => value?.[key], appSettings);
}

function setSettingValue(path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => current[key], appSettings);
  target[lastKey] = value;
  saveAppSettings();
}

function applyThemePresetSelection(mode, presetName) {
  const preset = themePresets[mode]?.[presetName];
  if (!preset) return;
  if (mode === 'light') {
    appSettings.appearance.lightBackground = preset.background;
    appSettings.appearance.lightForeground = preset.foreground;
  } else {
    appSettings.appearance.darkBackground = preset.background;
    appSettings.appearance.darkForeground = preset.foreground;
  }
  saveAppSettings();
}

function renderSelectControl(path, value, options) {
  const selected = options.find(option => option.value === value) || options[0];
  const isOpen = dropdownState.openSetting === path;
  return `
    <div class="setting-dropdown ${isOpen ? 'open' : ''}" data-setting-type="dropdown" data-setting-key="${path}">
      <button type="button" class="setting-control setting-select-control setting-dropdown-trigger" aria-expanded="${isOpen}">
        <span>${escapeHtml(selected?.label || value)}</span>
        ${chevronDownIcon}
      </button>
      <div class="setting-dropdown-menu">
        ${options.map(option => `
          <button type="button" class="setting-dropdown-option ${option.value === value ? 'selected' : ''}" data-setting-option="${escapeHtml(option.value)}">
            <span>${escapeHtml(option.label)}</span>
            ${option.value === value ? '<span class="setting-dropdown-check">✓</span>' : ''}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderSwitchControl(path, enabled) {
  return `<button type="button" class="switch ${enabled ? 'on' : ''}" data-setting-key="${path}" data-setting-type="switch" aria-pressed="${enabled}"></button>`;
}

function renderSegmentControl(path, value, options) {
  return `
    <div class="pill-toggle" data-setting-key="${path}" data-setting-type="segment">
      ${options.map(option => `<button type="button" class="${option.value === value ? 'selected' : ''}" data-setting-option="${option.value}">${escapeHtml(option.label)}</button>`).join('')}
    </div>
  `;
}

function renderInputControl(path, value, placeholder = '', type = 'text', extra = '') {
  return `<input class="setting-input" type="${type}" value="${escapeHtml(String(value ?? ''))}" placeholder="${escapeHtml(placeholder)}" data-setting-key="${path}" ${extra}>`;
}

function renderColorControl(path, value) {
  return `
    <label class="setting-control setting-color-control">
      <input class="setting-color-input" type="color" value="${escapeHtml(value)}" data-setting-key="${path}">
      <span>${escapeHtml(value.toUpperCase())}</span>
    </label>
  `;
}

function renderRangeControl(path, value, min, max) {
  return `
    <div class="setting-range">
      <input class="setting-range-input" type="range" min="${min}" max="${max}" value="${value}" data-setting-key="${path}">
      <span class="setting-range-value">${escapeHtml(String(value))}</span>
    </div>
  `;
}

function renderActionButton(action, label, danger = false, value = '') {
  return `<button type="button" class="${danger ? 'danger-button' : 'text-button'}" data-settings-action="${action}" data-settings-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}

function renderThemePreviewCard(label, mode, colors) {
  const activeMode = getResolvedThemeMode();
  const isActive = activeMode === mode;
  return `
    <div class="theme-preview-card ${isActive ? 'active' : ''}" data-preview-mode="${mode}">
      <div class="theme-preview-header">
        <span>${escapeHtml(label)}</span>
        <span class="theme-preview-badge">${isActive ? 'Active' : 'Available'}</span>
      </div>
      <div class="theme-preview-frame" style="--preview-bg:${escapeHtml(colors.background)};--preview-fg:${escapeHtml(colors.foreground)};--preview-accent:${escapeHtml(appSettings.appearance.accent)};">
        <div class="theme-preview-sidebar"></div>
        <div class="theme-preview-main">
          <div class="theme-preview-line strong"></div>
          <div class="theme-preview-line"></div>
          <div class="theme-preview-pills">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="theme-preview-code">const accent = "${escapeHtml(appSettings.appearance.accent)}"</div>
        </div>
      </div>
    </div>
  `;
}

function syncThemePresetLabels() {
  const lightPreset = Object.entries(themePresets.light).find(([, preset]) =>
    preset.background.toLowerCase() === appSettings.appearance.lightBackground.toLowerCase() &&
    preset.foreground.toLowerCase() === appSettings.appearance.lightForeground.toLowerCase()
  );
  const darkPreset = Object.entries(themePresets.dark).find(([, preset]) =>
    preset.background.toLowerCase() === appSettings.appearance.darkBackground.toLowerCase() &&
    preset.foreground.toLowerCase() === appSettings.appearance.darkForeground.toLowerCase()
  );

  appSettings.appearance.lightTheme = lightPreset ? lightPreset[0] : 'Custom';
  appSettings.appearance.darkTheme = darkPreset ? darkPreset[0] : 'Custom';
}

function renderSettingsMarkup() {
  syncThemePresetLabels();
  const archivedChats = getArchivedChatHistory();
  const activeChats = getVisibleChatHistory();
  const serversMarkup = appSettings.mcp.servers.length
    ? appSettings.mcp.servers.map((server, index) => `
        <div class="settings-list-item">
          <div>
            <div class="setting-name">${escapeHtml(server.name)}</div>
            <div class="setting-description">${escapeHtml(server.command)}</div>
          </div>
          ${renderActionButton('remove-mcp-server', 'Remove', false, String(index))}
        </div>
      `).join('')
    : '<div class="empty-card">No MCP servers connected yet.</div>';
  const projectsMarkup = appSettings.environments.projects.length
    ? appSettings.environments.projects.map((project, index) => `
        <div class="settings-list-item">
          <div>
            <div class="setting-name">${escapeHtml(project.name)}</div>
            <div class="setting-description">${escapeHtml(project.path || 'Local workspace')}</div>
          </div>
          ${renderActionButton('remove-project', 'Remove', false, String(index))}
        </div>
      `).join('')
    : '<div class="empty-card">No environment projects added yet.</div>';
  const archivedMarkup = archivedChats.length
    ? archivedChats.map(chat => `
        <div class="settings-list-item">
          <div>
            <div class="setting-name">${escapeHtml(chat.title)}</div>
            <div class="setting-description">${new Date(chat.timestamp).toLocaleString()}</div>
          </div>
          <div class="settings-button-row">
            ${renderActionButton('restore-chat', 'Restore', false, String(chat.id))}
            ${renderActionButton('delete-chat', 'Delete', true, String(chat.id))}
          </div>
        </div>
      `).join('')
    : '<div class="empty-card">No archived chats.</div>';
  const recentChatsMarkup = activeChats.slice(0, 6).length
    ? activeChats.slice(0, 6).map(chat => `
        <div class="settings-list-item">
          <div>
            <div class="setting-name">${escapeHtml(chat.title)}</div>
            <div class="setting-description">${new Date(chat.timestamp).toLocaleString()}</div>
          </div>
          ${renderActionButton('archive-chat', 'Archive', false, String(chat.id))}
        </div>
      `).join('')
    : '<div class="empty-card">No active chats to archive.</div>';

  return {
    general: `
      <h2>General</h2>
      <div class="settings-card">
        ${settingRow("Default open destination", "Where files and folders open by default.", renderSelectControl('general.openDestination', appSettings.general.openDestination, [{ value: 'file-explorer', label: 'File Explorer' }, { value: 'new-tab', label: 'New tab' }, { value: 'last-workspace', label: 'Last workspace' }]))}
        ${settingRow("Integrated terminal shell", "Choose which shell opens in the integrated terminal.", renderSelectControl('general.terminalShell', appSettings.general.terminalShell, [{ value: 'PowerShell', label: 'PowerShell' }, { value: 'Command Prompt', label: 'Command Prompt' }, { value: 'Git Bash', label: 'Git Bash' }]))}
        ${settingRow("Language", "Language for the app UI.", renderSelectControl('general.language', appSettings.general.language, [{ value: 'Auto Detect', label: 'Auto Detect' }, { value: 'English', label: 'English' }, { value: 'Hindi', label: 'Hindi' }]))}
        ${settingRow("Detail level", "Choose which detail mode to show in the app.", renderSelectControl('general.detailLevel', appSettings.general.detailLevel, [{ value: 'Coding', label: 'Coding' }, { value: 'Balanced', label: 'Balanced' }, { value: 'Compact', label: 'Compact' }]))}
        ${settingRow("Popout Window hotkey", "Leave blank to keep it off.", renderInputControl('general.popoutHotkey', appSettings.general.popoutHotkey, 'Ctrl+Shift+P'))}
        ${settingRow("Require Shift+Enter to send long prompts", "Single-line prompts still send with Enter.", renderSwitchControl('general.requireShiftEnter', appSettings.general.requireShiftEnter))}
        ${settingRow("Follow-up behavior", "Queue follow-ups or steer the current run.", renderSegmentControl('general.followUpBehavior', appSettings.general.followUpBehavior, [{ value: 'queue', label: 'Queue' }, { value: 'steer', label: 'Steer' }]))}
        ${settingRow("Code review", "Open reviews inline or in a separate chat.", renderSegmentControl('general.codeReview', appSettings.general.codeReview, [{ value: 'inline', label: 'Inline' }, { value: 'detached', label: 'Detached' }]))}
      </div>
      <div class="settings-group">
        <h2>Notifications</h2>
        <div class="settings-card">
          ${settingRow("Turn completion notifications", "Choose when completion alerts appear.", renderSelectControl('general.turnCompletionNotifications', appSettings.general.turnCompletionNotifications, [{ value: 'Always', label: 'Always' }, { value: 'Only when unfocused', label: 'Only when unfocused' }, { value: 'Never', label: 'Never' }]))}
          ${settingRow("Enable permission notifications", "Show alerts when command approval is required.", renderSwitchControl('general.permissionNotifications', appSettings.general.permissionNotifications))}
          ${settingRow("Enable question notifications", "Show alerts when more input is needed.", renderSwitchControl('general.questionNotifications', appSettings.general.questionNotifications))}
        </div>
      </div>
    `,
    appearance: `
      <h2>Appearance</h2>
      <p>Theme changes apply immediately across the app shell.</p>
      <div class="theme-preview-grid">
        ${renderThemePreviewCard('Light preview', 'light', { background: appSettings.appearance.lightBackground, foreground: appSettings.appearance.lightForeground })}
        ${renderThemePreviewCard('Dark preview', 'dark', { background: appSettings.appearance.darkBackground, foreground: appSettings.appearance.darkForeground })}
      </div>
      <div class="settings-card">
        ${settingRow("Theme mode", "Choose the active theme source.", renderSegmentControl('appearance.themeMode', appSettings.appearance.themeMode, [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]))}
        ${settingRow("Accent", "Primary interactive color.", renderColorControl('appearance.accent', appSettings.appearance.accent))}
        ${settingRow("UI font", "Used for the main application UI.", renderSelectControl('appearance.uiFont', appSettings.appearance.uiFont, [{ value: '"Segoe UI", system-ui, sans-serif', label: 'Segoe UI' }, { value: '"Trebuchet MS", system-ui, sans-serif', label: 'Trebuchet MS' }, { value: 'Georgia, serif', label: 'Georgia' }]))}
        ${settingRow("Code font", "Used for code-like previews.", renderSelectControl('appearance.codeFont', appSettings.appearance.codeFont, [{ value: 'Consolas, "SFMono-Regular", monospace', label: 'Consolas' }, { value: '"JetBrains Mono", monospace', label: 'JetBrains Mono' }, { value: '"Courier New", monospace', label: 'Courier New' }]))}
        ${settingRow("Translucent sidebar", "Blend panels with the active background.", renderSwitchControl('appearance.translucentSidebar', appSettings.appearance.translucentSidebar))}
        ${settingRow("Contrast", "Higher values strengthen borders and separation.", renderRangeControl('appearance.contrast', appSettings.appearance.contrast, 0, 100))}
      </div>
      <div class="settings-group">
        <h2>Light theme</h2>
        <div class="settings-card">
          ${settingRow("Preset", "", renderSelectControl('appearance.lightTheme', appSettings.appearance.lightTheme, [{ value: 'Aa Ceres', label: 'Aa Ceres' }, { value: 'Warm Paper', label: 'Warm Paper' }, { value: 'Cool Slate', label: 'Cool Slate' }, { value: 'Custom', label: 'Custom' }]))}
          ${settingRow("Background", "", renderColorControl('appearance.lightBackground', appSettings.appearance.lightBackground))}
          ${settingRow("Foreground", "", renderColorControl('appearance.lightForeground', appSettings.appearance.lightForeground))}
        </div>
      </div>
      <div class="settings-group">
        <h2>Dark theme</h2>
        <div class="settings-card">
          ${settingRow("Preset", "", renderSelectControl('appearance.darkTheme', appSettings.appearance.darkTheme, [{ value: 'Aa Ceres', label: 'Aa Ceres' }, { value: 'Carbon', label: 'Carbon' }, { value: 'Night Ink', label: 'Night Ink' }, { value: 'Custom', label: 'Custom' }]))}
          ${settingRow("Background", "", renderColorControl('appearance.darkBackground', appSettings.appearance.darkBackground))}
          ${settingRow("Foreground", "", renderColorControl('appearance.darkForeground', appSettings.appearance.darkForeground))}
        </div>
      </div>
    `,
    configuration: `
      <h2>Configuration</h2>
      <p>These settings are local UI preferences in this replica.</p>
      <div class="settings-card">
        ${settingRow("Custom config.toml settings", "", renderSelectControl('configuration.customConfig', appSettings.configuration.customConfig, [{ value: 'user', label: 'User config' }, { value: 'workspace', label: 'Workspace config' }]))}
        ${settingRow("Approval policy", "Choose when approvals are requested.", renderSelectControl('configuration.approvalPolicy', appSettings.configuration.approvalPolicy, [{ value: 'on-request', label: 'On request' }, { value: 'on-failure', label: 'On failure' }, { value: 'never', label: 'Never' }]))}
        ${settingRow("Sandbox settings", "Choose how much commands can do.", renderSelectControl('configuration.sandbox', appSettings.configuration.sandbox, [{ value: 'read-only', label: 'Read only' }, { value: 'workspace-write', label: 'Workspace write' }, { value: 'full-access', label: 'Full access' }]))}
      </div>
      <div class="settings-group">
        <h2>Workspace Dependencies</h2>
        <div class="settings-card">
          ${settingRow("Current version", "Electron shell version shown below.", `<div class="setting-control">${escapeHtml((window.process?.versions?.electron || 'Not installed'))}</div>`)}
          ${settingRow("Ceres dependencies", "Allow bundled tools and helpers.", renderSwitchControl('configuration.dependenciesEnabled', appSettings.configuration.dependenciesEnabled))}
          ${settingRow("Diagnose issues in Ceres Workspace", "Simulate a diagnostic pass.", renderActionButton('diagnose-workspace', 'Diagnose'))}
          ${settingRow("Reset and install Workspace", "Reset local replica settings for workspace tooling.", renderActionButton('reinstall-workspace', 'Reinstall', true))}
        </div>
      </div>
    `,
    personalization: `
      <h2>Personalization</h2>
      <div class="settings-card">
        ${settingRow("Personality", "Choose a default tone for Ceres responses.", renderSelectControl('personalization.personality', appSettings.personalization.personality, [{ value: 'Friendly', label: 'Friendly' }, { value: 'Balanced', label: 'Balanced' }, { value: 'Direct', label: 'Direct' }]))}
      </div>
      <div class="settings-group">
        <h2>User Instructions File</h2>
        <p>Upload an MD file with your preferences, coding style, or context that Ceres should know about.</p>
        <div class="settings-card">
          <input type="file" id="userInstructionsFileInput" accept=".md" style="margin-bottom: 8px;">
          ${appSettings.personalization.userInstructionsFile ? `<div style="font-size: 12px; color: #22c55e;">✓ File loaded: ${escapeHtml(appSettings.personalization.userInstructionsFile.split('/').pop())}</div>` : ''}
          <button onclick="removeUserInstructionsFile()" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">Remove File</button>
        </div>
      </div>
      <div class="settings-group">
        <h2>Custom instructions</h2>
        <p>Saved automatically in local storage.</p>
        <textarea class="textarea-block" placeholder="Add your custom instructions..." data-setting-key="personalization.customInstructions">${escapeHtml(appSettings.personalization.customInstructions)}</textarea>
      </div>
      <div class="settings-group">
        <h2>Memory</h2>
        <div class="settings-card">
          ${settingRow("Enable memories", "Generate new memories from chats.", renderSwitchControl('personalization.memoriesEnabled', appSettings.personalization.memoriesEnabled))}
          ${settingRow("Skip tool-assisted chats", "Ignore chats that used tools or web search.", renderSwitchControl('personalization.skipToolChats', appSettings.personalization.skipToolChats))}
          ${settingRow("Reset memories", "Clears locally stored memory-like preferences.", renderActionButton('reset-memories', 'Reset', true))}
        </div>
      </div>
    `,
    mcp: `
      <h2>MCP servers</h2>
      <p>Manage a local list of external tool connections.</p>
      <div class="settings-group">
        <div class="section-heading section-with-actions" style="padding-left:0;color:#66615d"><span>Servers</span>${renderActionButton('add-mcp-server', '+ Add server')}</div>
        <div class="settings-card">${serversMarkup}</div>
      </div>
    `,
    git: `
      <h2>Git</h2>
      <div class="settings-card">
        ${settingRow("Branch prefix", "Prefix used when creating new branches in Ceres.", renderInputControl('git.branchPrefix', appSettings.git.branchPrefix, 'ceres/'))}
        ${settingRow("Pull request merge method", "Choose how Ceres merges pull requests.", renderSegmentControl('git.mergeMethod', appSettings.git.mergeMethod, [{ value: 'merge', label: 'Merge' }, { value: 'squash', label: 'Squash' }]))}
        ${settingRow("Show PR icons in sidebar", "Display PR status icons on chat rows.", renderSwitchControl('git.showPrIcons', appSettings.git.showPrIcons))}
        ${settingRow("Always force push", "Use force-with-lease when pushing.", renderSwitchControl('git.alwaysForcePush', appSettings.git.alwaysForcePush))}
        ${settingRow("Create draft pull requests", "Use draft pull requests by default.", renderSwitchControl('git.draftPrs', appSettings.git.draftPrs))}
      </div>
      <div class="settings-group">
        <h2>Commit instructions</h2>
        <textarea class="textarea-block" placeholder="Add commit message guidance..." data-setting-key="git.commitInstructions">${escapeHtml(appSettings.git.commitInstructions)}</textarea>
      </div>
      <div class="settings-group">
        <h2>Pull request instructions</h2>
        <textarea class="textarea-block" placeholder="Add pull request guidance..." data-setting-key="git.prInstructions">${escapeHtml(appSettings.git.prInstructions)}</textarea>
      </div>
    `,
    environments: `
      <h2>Environments</h2>
      <p>Store local environment definitions for projects and worktrees.</p>
      <div class="settings-group">
        <div class="section-heading section-with-actions" style="padding-left:0;color:#66615d"><span>Projects</span>${renderActionButton('add-project', 'Add project')}</div>
        <div class="settings-card">${projectsMarkup}</div>
      </div>
    `,
    worktrees: `
      <h2>Worktrees</h2>
      <div class="settings-card">
        ${settingRow("Automatically delete old worktrees", "Recommended for most users.", renderSwitchControl('worktrees.autoDelete', appSettings.worktrees.autoDelete))}
        ${settingRow("Auto-delete limit", "Number of worktrees to keep before pruning.", renderInputControl('worktrees.autoDeleteLimit', appSettings.worktrees.autoDeleteLimit, '', 'number', 'min="1" max="99"'))}
      </div>
      <div class="settings-group">
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-description">Current policy: keep the latest ${escapeHtml(String(appSettings.worktrees.autoDeleteLimit))} worktrees and auto-delete is ${appSettings.worktrees.autoDelete ? 'enabled' : 'disabled'}.</div>
          </div>
        </div>
      </div>
    `,
    archived: `
      <h2>Archived chats</h2>
      <div class="settings-group">
        <h2>Recent chats</h2>
        <div class="settings-card">${recentChatsMarkup}</div>
      </div>
      <div class="settings-group">
        <h2>Archived</h2>
        <div class="settings-card">${archivedMarkup}</div>
      </div>
    `
  };
}

function initSettings() {
  const nav = document.getElementById("settingsNav");
  nav.innerHTML = settingsSections
    .map(
      (section) =>
        `<button class="settings-nav-item ${section.id === state.settingsPage ? "active" : ""}" data-settings-target="${section.id}">${settingsIcons[section.icon]}<span>${section.label}</span></button>`
    )
    .join("");

  Object.entries(renderSettingsMarkup()).forEach(([id, markup]) => {
    const node = document.querySelector(`[data-settings-page="${id}"]`);
    if (node) {
      node.innerHTML = markup;
    }
  });
  
  // Add event listener for user instructions file input
  const userInstructionsFileInput = document.getElementById('userInstructionsFileInput');
  if (userInstructionsFileInput) {
    userInstructionsFileInput.addEventListener('change', handleUserInstructionsFileUpload);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function mixColors(first, second, weight) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  return rgbToHex({
    r: a.r + (b.r - a.r) * weight,
    g: a.g + (b.g - a.g) * weight,
    b: a.b + (b.b - a.b) * weight
  });
}

function rgbaFromHex(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getResolvedThemeMode() {
  if (appSettings.appearance.themeMode === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return appSettings.appearance.themeMode;
}

function applyAppearanceSettings() {
  const root = document.documentElement;
  const themeMode = getResolvedThemeMode();
  const isDark = themeMode === 'dark';
  const background = isDark ? appSettings.appearance.darkBackground : appSettings.appearance.lightBackground;
  const foreground = isDark ? appSettings.appearance.darkForeground : appSettings.appearance.lightForeground;
  const accent = appSettings.appearance.accent;
  const contrastWeight = clamp(Number(appSettings.appearance.contrast) || 45, 0, 100) / 100;
  const panelAlpha = appSettings.appearance.translucentSidebar ? (isDark ? 0.72 : 0.88) : 1;
  const panelStrongAlpha = appSettings.appearance.translucentSidebar ? (isDark ? 0.82 : 0.96) : 1;
  const bgSoft = mixColors(background, foreground, isDark ? 0.08 : 0.05);
  const stroke = mixColors(background, foreground, isDark ? 0.18 + contrastWeight * 0.12 : 0.08 + contrastWeight * 0.15);
  const strokeSoft = mixColors(background, foreground, isDark ? 0.11 : 0.05);
  const textSoft = mixColors(foreground, background, 0.28);
  const muted = mixColors(foreground, background, 0.48);
  const mutedSoft = mixColors(foreground, background, 0.66);
  const controlBg = rgbaFromHex(isDark ? mixColors(background, '#ffffff', 0.08) : '#f7f6f3', appSettings.appearance.translucentSidebar ? 0.92 : 1);
  const controlHover = rgbaFromHex(accent, isDark ? 0.16 : 0.1);
  const controlBorder = mixColors(background, foreground, isDark ? 0.22 + contrastWeight * 0.18 : 0.1 + contrastWeight * 0.12);
  const sidebarSurface = appSettings.appearance.translucentSidebar
    ? `linear-gradient(180deg, ${rgbaFromHex(background, isDark ? 0.76 : 0.8)}, ${rgbaFromHex(bgSoft, isDark ? 0.72 : 0.78)})`
    : background;
  const panelBg = rgbaFromHex(isDark ? mixColors(background, '#ffffff', 0.06) : '#ffffff', appSettings.appearance.translucentSidebar ? 0.76 : 1);
  const panelMuted = rgbaFromHex(isDark ? mixColors(background, '#ffffff', 0.04) : bgSoft, appSettings.appearance.translucentSidebar ? 0.68 : 1);
  const panelBorder = rgbaFromHex(stroke, isDark ? 0.92 : 1);
  const overlay = rgbaFromHex(background, isDark ? 0.94 : 0.9);
  const codeBg = mixColors(background, foreground, isDark ? 0.16 : 0.06);
  const codeMutedBg = mixColors(background, foreground, isDark ? 0.11 : 0.04);

  root.style.setProperty('--bg', background);
  root.style.setProperty('--bg-soft', bgSoft);
  root.style.setProperty('--panel', rgbaFromHex(isDark ? mixColors(background, '#ffffff', 0.08) : '#ffffff', panelAlpha));
  root.style.setProperty('--panel-strong', rgbaFromHex(isDark ? mixColors(background, '#ffffff', 0.12) : '#ffffff', panelStrongAlpha));
  root.style.setProperty('--stroke', stroke);
  root.style.setProperty('--stroke-soft', strokeSoft);
  root.style.setProperty('--text', foreground);
  root.style.setProperty('--text-soft', textSoft);
  root.style.setProperty('--muted', muted);
  root.style.setProperty('--muted-soft', mutedSoft);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-soft', rgbaFromHex(accent, 0.14));
  root.style.setProperty('--control-bg', controlBg);
  root.style.setProperty('--control-hover', controlHover);
  root.style.setProperty('--control-border', controlBorder);
  root.style.setProperty('--sidebar-surface', sidebarSurface);
  root.style.setProperty('--panel-bg', panelBg);
  root.style.setProperty('--panel-muted', panelMuted);
  root.style.setProperty('--panel-border', panelBorder);
  root.style.setProperty('--overlay-bg', overlay);
  root.style.setProperty('--code-bg', codeBg);
  root.style.setProperty('--code-muted-bg', codeMutedBg);
  root.style.setProperty('--ui-font', appSettings.appearance.uiFont);
  root.style.setProperty('--code-font', appSettings.appearance.codeFont);
  root.style.fontFamily = appSettings.appearance.uiFont;
  root.style.colorScheme = isDark ? 'dark' : 'light';
  document.body.dataset.theme = themeMode;
}

function applyBehaviorSettings() {
  const composer = document.getElementById('main-textarea');
  if (!composer) return;
  composer.placeholder = currentMode === 'agent'
    ? 'Ask agent to write code, fix bugs, or search files...'
    : 'Ask Codex anything. @ to use plugins or use files';
}

function applySettings() {
  applyAppearanceSettings();
  applyBehaviorSettings();
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (appSettings.appearance.themeMode === 'system') {
      applyAppearanceSettings();
    }
  });
}

function refreshSettingsView() {
  initSettings();
  render();
}

function updateSettingRangeValue(settingKey, value) {
  const range = document.querySelector(`.setting-range-input[data-setting-key="${settingKey}"]`);
  const valueEl = range?.closest('.setting-range')?.querySelector('.setting-range-value');
  if (valueEl) {
    valueEl.textContent = String(value);
  }
}

function handleSettingsAction(action, rawValue) {
  if (action === 'diagnose-workspace') {
    showNotification('Workspace diagnostics completed.');
    return;
  }

  if (action === 'reinstall-workspace') {
    localStorage.removeItem('multiAgentConfig');
    showNotification('Workspace tooling preferences were reset.');
    return;
  }

  if (action === 'reset-memories') {
    appSettings.personalization.memoriesEnabled = false;
    appSettings.personalization.skipToolChats = false;
    saveAppSettings();
    refreshSettingsView();
    showNotification('Memory settings reset.');
    return;
  }
}

// Handle user instructions file upload
function handleUserInstructionsFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!file.name.endsWith('.md')) {
    alert('Please upload a .md file');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    appSettings.personalization.userInstructionsFile = file.name;
    appSettings.personalization.userInstructionsContent = e.target.result;
    saveAppSettings();
    refreshSettingsView();
    showNotification('User instructions file loaded successfully.');
  };
  reader.readAsText(file);
}

// Remove user instructions file
function removeUserInstructionsFile() {
  appSettings.personalization.userInstructionsFile = '';
  appSettings.personalization.userInstructionsContent = '';
  saveAppSettings();
  refreshSettingsView();
  showNotification('User instructions file removed.');
  const fileInput = document.getElementById('userInstructionsFileInput');
  if (fileInput) fileInput.value = '';
}

function handleSettingsAction(action, rawValue) {
  if (action === 'add-mcp-server') {
    const name = window.prompt('Server name');
    if (!name) return;
    const command = window.prompt('Server command');
    if (!command) return;
    appSettings.mcp.servers.push({ name, command });
    saveAppSettings();
    refreshSettingsView();
    showNotification('MCP server added.');
    return;
  }

  if (action === 'remove-mcp-server') {
    const index = parseInt(rawValue);
    if (!isNaN(index) && index >= 0 && index < appSettings.mcp.servers.length) {
      appSettings.mcp.servers.splice(index, 1);
      saveAppSettings();
      refreshSettingsView();
      showNotification('MCP server removed.');
    }
    return;
  }

  if (action === 'add-project') {
    const name = window.prompt('Project name');
    if (!name) return;
    const path = window.prompt('Project path', name) || '';
    appSettings.environments.projects.push({ name, path });
    saveAppSettings();
    refreshSettingsView();
    showNotification('Project added.');
    return;
  }

  if (action === 'remove-project') {
    appSettings.environments.projects.splice(Number(rawValue), 1);
    saveAppSettings();
    refreshSettingsView();
    return;
  }

  if (action === 'archive-chat' || action === 'restore-chat') {
    const chat = chatHistory.find(entry => String(entry.id) === rawValue);
    if (!chat) return;
    chat.archived = action === 'archive-chat';
    saveChatHistory();
    updateChatList();
    updateSearchResults();
    refreshSettingsView();
    return;
  }

  if (action === 'delete-chat') {
    const chatIndex = chatHistory.findIndex(entry => String(entry.id) === rawValue);
    if (chatIndex === -1) return;
    chatHistory.splice(chatIndex, 1);
    saveChatHistory();
    updateChatList();
    updateSearchResults();
    refreshSettingsView();
  }
}

function render() {
  document.querySelectorAll(".content-view").forEach((view) => {
    view.classList.toggle("active", view.dataset.view === state.view);
  });

  document.querySelectorAll(".settings-nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.settingsTarget === state.settingsPage);
  });

  document.querySelectorAll(".settings-page").forEach((page) => {
    page.classList.toggle("active", page.dataset.settingsPage === state.settingsPage);
  });

  document.getElementById("leftSidebar").classList.toggle("collapsed", state.leftSidebarCollapsed);
  applyBehaviorSettings();
}

function hidePopups() {
  document.getElementById("projectMenu").classList.add("hidden");
  document.getElementById("accountMenu").classList.add("hidden");
  document.getElementById("searchModal").classList.add("hidden");
}

function positionMenu(menuId, target) {
  const menu = document.getElementById(menuId);
  const rect = target.getBoundingClientRect();
  menu.classList.remove("hidden");
  const width = menu.offsetWidth;
  menu.style.top = `${rect.bottom + 6}px`;
  menu.style.left = `${menuId === "accountMenu" ? Math.max(8, rect.right - width) : rect.left}px`;
}

document.addEventListener('click', (event) => {
  const dropdownTrigger = event.target.closest('.setting-dropdown-trigger');
  if (dropdownTrigger) {
    const dropdown = dropdownTrigger.closest('[data-setting-type="dropdown"]');
    const key = dropdown?.dataset.settingKey || null;
    dropdownState.openSetting = dropdownState.openSetting === key ? null : key;
    refreshSettingsView();
    return;
  }

  const dropdownOption = event.target.closest('.setting-dropdown-option');
  if (dropdownOption) {
    const dropdown = dropdownOption.closest('[data-setting-type="dropdown"]');
    if (!dropdown) return;
    const settingKey = dropdown.dataset.settingKey;
    const nextValue = dropdownOption.dataset.settingOption;
    setSettingValue(settingKey, nextValue);
    if (settingKey === 'appearance.lightTheme' && nextValue !== 'Custom') {
      applyThemePresetSelection('light', nextValue);
    }
    if (settingKey === 'appearance.darkTheme' && nextValue !== 'Custom') {
      applyThemePresetSelection('dark', nextValue);
    }
    dropdownState.openSetting = null;
    applySettings();
    refreshSettingsView();
    return;
  }

  const switchEl = event.target.closest('[data-setting-type="switch"]');
  if (switchEl) {
    const nextValue = !getSettingValue(switchEl.dataset.settingKey);
    setSettingValue(switchEl.dataset.settingKey, nextValue);
    switchEl.classList.toggle('on', nextValue);
    switchEl.setAttribute('aria-pressed', String(nextValue));
    applySettings();
    if (state.view === 'settings') {
      refreshSettingsView();
    }
    return;
  }

  const segmentOption = event.target.closest('[data-setting-option]');
  if (segmentOption) {
    const segment = segmentOption.closest('[data-setting-type="segment"]');
    if (!segment) return;
    setSettingValue(segment.dataset.settingKey, segmentOption.dataset.settingOption);
    applySettings();
    refreshSettingsView();
    return;
  }

  const actionButton = event.target.closest('[data-settings-action]');
  if (actionButton) {
    handleSettingsAction(actionButton.dataset.settingsAction, actionButton.dataset.settingsValue || '');
    return;
  }

  if (!event.target.closest('[data-setting-type="dropdown"]') && dropdownState.openSetting) {
    dropdownState.openSetting = null;
    refreshSettingsView();
  }
});

document.addEventListener('change', (event) => {
  const field = event.target.closest('input[data-setting-key][type="color"], input[data-setting-key][type="number"], input[data-setting-key][type="range"]');
  if (!field) return;
  const nextValue = field.type === 'number' || field.type === 'range' ? Number(field.value || 0) : field.value;
  setSettingValue(field.dataset.settingKey, nextValue);
  if (field.dataset.settingKey === 'appearance.lightTheme') {
    applyThemePresetSelection('light', nextValue);
  }
  if (field.dataset.settingKey === 'appearance.darkTheme') {
    applyThemePresetSelection('dark', nextValue);
  }
  applySettings();
  if (state.view === 'settings') {
    refreshSettingsView();
  }
});

document.addEventListener('input', (event) => {
  const liveNumericField = event.target.closest('input[data-setting-key][type="range"]');
  if (liveNumericField) {
    const nextValue = Number(liveNumericField.value || 0);
    setSettingValue(liveNumericField.dataset.settingKey, nextValue);
    updateSettingRangeValue(liveNumericField.dataset.settingKey, nextValue);
    applySettings();
    return;
  }

  const field = event.target.closest('textarea[data-setting-key], input[data-setting-key]:not([type="color"]):not([type="number"]):not([type="range"])');
  if (!field) return;
  setSettingValue(field.dataset.settingKey, field.value);
});

document.addEventListener("click", (event) => {
  const actionEl = event.target.closest("[data-action]");
  const settingsEl = event.target.closest("[data-settings-target]");

  if (settingsEl) {
    state.settingsPage = settingsEl.dataset.settingsTarget;
    render();
    return;
  }

  if (!actionEl) {
    if (!event.target.closest(".floating-menu") && !event.target.closest(".search-modal")) {
      hidePopups();
    }
    return;
  }

  const { action } = actionEl.dataset;

  if (action === "view-home") {
    state.view = "home";
    hidePopups();
    resetChatView();
  }

  if (action === "view-settings") {
    state.view = "settings";
    hidePopups();
  }

  if (action === "toggle-account") {
    document.getElementById("accountMenu").classList.toggle("hidden");
  }

  if (action === "toggle-search") {
    document.getElementById("searchModal").classList.remove("hidden");
    updateSearchResults();
    return;
  }

  if (action === "view-settings") {
    state.view = "settings";
    state.settingsPage = "general";
    state.leftSidebarCollapsed = true;
    hidePopups();
  }

  if (action === "toggle-left") {
    state.leftSidebarCollapsed = !state.leftSidebarCollapsed;
  }

  if (action === "project-menu") {
    hidePopups();
    positionMenu("projectMenu", actionEl);
  }

  if (action === "workspace-menu") {
    hidePopups();
    positionMenu("accountMenu", actionEl);
  }

  if (action === "open-search") {
    hidePopups();
    document.getElementById("searchModal").classList.remove("hidden");
    updateSearchResults();
  }

  render();
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    hidePopups();
    document.getElementById("searchModal").classList.remove("hidden");
    updateSearchResults();
  }

  if (event.key === "Escape") {
    hidePopups();
  }
});

// File Explorer Functions
async function openFolder() {
  try {
    let dirHandle;
    let folderPath = '';
    let folderFiles = [];
    
    // Try Electron dialog first (gives real path for terminal commands)
    if (window.electronAPI && window.electronAPI.selectFolder) {
      const result = await window.electronAPI.selectFolder();
      if (result.canceled) {
        return;
      }
      folderPath = result.path;
      folderFiles = result.files;
      
      // Create a mock dirHandle that uses Node fs via IPC
      dirHandle = createElectronDirHandle(folderPath);
    } else {
      // Fallback to File System Access API
      if (!('showDirectoryPicker' in window)) {
        alert('File System Access API not supported. Please use a modern browser.');
        return;
      }
      dirHandle = await window.showDirectoryPicker();
      folderPath = dirHandle.name; // Only gives folder name, not full path
    }
    
    fileExplorerState.directoryHandle = dirHandle;
    fileExplorerState.folderPath = folderPath;
    fileExplorerState.expandedFolders.clear();
    fileExplorerState.expandedFolders.add('root');
    
    // Set agent working directory with both handle and real path
    if (window.aiAgent) {
      window.aiAgent.setWorkingDirectory(dirHandle, folderPath);
    }
    
    // Add to recent folders and update operation folder
    addToRecentFolders(folderPath);
    updateOperationFolderUI(folderPath);
    updateTerminalPrompt(folderPath);
    
    // Build file tree
    const fileTree = await buildFileTree(dirHandle);
    fileExplorerState.fileTree = fileTree;
    
    // Render file explorer
    renderFileExplorer();
    
    // Stay on home view (editor view removed)
    state.view = "home";
    render();
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Error opening folder:', err);
      alert('Error opening folder: ' + err.message);
    }
  }
}

// Create a directory handle that uses Electron's fs IPC
function createElectronDirHandle(folderPath) {
  return {
    name: folderPath.split(/[\\/]/).pop(),
    path: folderPath,
    kind: 'directory',
    isElectron: true,
    async *entries() {
      if (window.electronAPI && window.electronAPI.readDir) {
        const result = await window.electronAPI.readDir(folderPath);
        if (result.success) {
          for (const entry of result.entries) {
            const entryPath = folderPath + '/' + entry.name;
            if (entry.isDirectory) {
              yield [entry.name, createElectronDirHandle(entryPath)];
            } else {
              yield [entry.name, createElectronFileHandle(entryPath)];
            }
          }
        }
      }
    },
    async getDirectoryHandle(name, options = {}) {
      const newPath = folderPath + '/' + name;
      // Create directory if requested
      if (options.create && window.electronAPI && window.electronAPI.mkdir) {
        await window.electronAPI.mkdir(newPath);
      }
      return createElectronDirHandle(newPath);
    },
    async getFileHandle(name, options = {}) {
      const newPath = folderPath + '/' + name;
      return createElectronFileHandle(newPath, options);
    },
    async removeEntry(name) {
      if (window.electronAPI && window.electronAPI.unlink) {
        await window.electronAPI.unlink(folderPath + '/' + name);
      }
    }
  };
}

function createElectronFileHandle(filePath, options = {}) {
  return {
    name: filePath.split(/[\\/]/).pop(),
    path: filePath,
    kind: 'file',
    isElectron: true,
    async getFile() {
      return {
        text: async () => {
          if (window.electronAPI && window.electronAPI.readFile) {
            const result = await window.electronAPI.readFile(filePath);
            return result.success ? result.content : '';
          }
          return '';
        }
      };
    },
    async createWritable() {
      let content = '';
      return {
        write: async (data) => {
          content += data;
        },
        close: async () => {
          if (window.electronAPI && window.electronAPI.writeFile) {
            await window.electronAPI.writeFile(filePath, content);
          }
        }
      };
    }
  };
}

async function buildFileTree(dirHandle, path = '') {
  const entries = [];
  
  for await (const [name, handle] of dirHandle.entries()) {
    const entryPath = path ? `${path}/${name}` : name;
    const entry = {
      name,
      path: entryPath,
      kind: handle.kind,
      handle
    };
    
    if (handle.kind === 'directory') {
      entry.children = []; // Will be loaded on expand
    }
    
    entries.push(entry);
  }
  
  // Sort: folders first, then files, alphabetically
  entries.sort((a, b) => {
    if (a.kind === b.kind) {
      return a.name.localeCompare(b.name);
    }
    return a.kind === 'directory' ? -1 : 1;
  });
  
  return entries;
}

async function loadFolderChildren(folderEntry) {
  if (folderEntry.children && folderEntry.children.length === 0 && folderEntry.handle) {
    folderEntry.children = await buildFileTree(folderEntry.handle, folderEntry.path);
  }
}

function renderFileExplorer() {
  const container = document.getElementById('fileExplorer');
  if (!container) return;
  
  if (!fileExplorerState.fileTree) {
    container.innerHTML = `
      <div class="explorer-empty">
        <p>No folder opened</p>
        <button class="open-folder-btn" id="sidebarOpenFolder">Open Folder</button>
      </div>
    `;
    attachOpenFolderListener();
    return;
  }
  
  const treeHtml = renderFileTree(fileExplorerState.fileTree, '');
  container.innerHTML = `<div class="file-tree-container">${treeHtml}</div>`;
  
  // Attach event listeners
  attachTreeEventListeners(container);
}

function renderFileTree(entries, parentPath) {
  if (!entries || entries.length === 0) return '';
  
  // Get AI modified files from agent
  const aiModifiedPaths = window.aiAgent?.aiModifiedFiles?.map(f => f.path) || [];
  
  return entries.map(entry => {
    const isExpanded = fileExplorerState.expandedFolders.has(entry.path);
    const isFolder = entry.kind === 'directory';
    const isActive = fileExplorerState.activeFile === entry.path;
    const isAIModified = aiModifiedPaths.includes(entry.path);
    const aiModifiedClass = isAIModified ? 'ai-modified' : '';
    const aiModifiedBadge = isAIModified ? '<span class="ai-badge" style="margin-left: 4px; padding: 1px 4px; background: #28a745; color: white; font-size: 9px; border-radius: 3px;">AI</span>' : '';
    
    if (isFolder) {
      const childrenHtml = isExpanded && entry.children ? 
        `<div class="tree-children ${isExpanded ? 'expanded' : ''}">${renderFileTree(entry.children, entry.path)}</div>` : 
        '';
      
      return `
        <div class="tree-folder ${aiModifiedClass}" data-path="${entry.path}">
          <div class="tree-item folder ${isExpanded ? 'expanded' : ''} ${aiModifiedClass}" data-kind="directory" data-path="${entry.path}">
            <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <svg class="folder-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="item-name">${escapeHtml(entry.name)}</span>${aiModifiedBadge}
          </div>
          ${childrenHtml}
        </div>
      `;
    } else {
      const fileIcon = getFileIcon(entry.name);
      return `
        <div class="tree-item file ${isActive ? 'active' : ''} ${aiModifiedClass}" data-kind="file" data-path="${entry.path}" data-name="${entry.name}">
          <svg class="file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            ${fileIcon}
          </svg>
          <span class="item-name" style="${isAIModified ? 'color: #28a745; font-weight: 500;' : ''}">${escapeHtml(entry.name)}</span>${aiModifiedBadge}
        </div>
      `;
    }
  }).join('');
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const icons = {
    js: '<path d="M10 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10"/><path d="M16 18l2 2 4-4"/>',
    ts: '<path d="M10 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10"/><path d="M16 16h4"/><path d="M18 14v4"/>',
    json: '<path d="M10 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/>',
    html: '<path d="M10 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10"/><path d="M8 16l4-4 4 4"/><path d="M8 10l4 4 4-4"/>',
    css: '<path d="M10 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10"/><path d="M8 10h8"/><path d="M8 14h8"/>',
    md: '<path d="M10 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10"/><path d="M8 9l4 4 4-4"/>',
    py: '<path d="M10 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10"/><path d="M9 12a3 3 0 1 0 3 3"/><path d="M12 7a3 3 0 1 1 3 3"/>'
  };
  return icons[ext] || '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>';
}

function attachTreeEventListeners(container) {
  container.querySelectorAll('.tree-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const path = item.dataset.path;
      const kind = item.dataset.kind;
      
      if (kind === 'directory') {
        // Toggle folder expansion
        const isExpanded = fileExplorerState.expandedFolders.has(path);
        if (isExpanded) {
          fileExplorerState.expandedFolders.delete(path);
          item.classList.remove('expanded');
          const children = item.nextElementSibling;
          if (children) children.classList.remove('expanded');
        } else {
          // Load children if needed
          const folderEntry = findEntryInTree(fileExplorerState.fileTree, path);
          if (folderEntry) {
            await loadFolderChildren(folderEntry);
          }
          fileExplorerState.expandedFolders.add(path);
          item.classList.add('expanded');
          renderFileExplorer(); // Re-render to show children
        }
      } else {
        // Open file
        await openFile(path, item.dataset.name);
      }
    });
  });
}

function findEntryInTree(entries, path) {
  for (const entry of entries) {
    if (entry.path === path) return entry;
    if (entry.children) {
      const found = findEntryInTree(entry.children, path);
      if (found) return found;
    }
  }
  return null;
}

async function openFile(path, name) {
  const entry = findEntryInTree(fileExplorerState.fileTree, path);
  if (!entry || entry.kind !== 'file') return;
  
  fileExplorerState.activeFile = path;
  
  // Check if already open
  if (!fileExplorerState.openTabs.has(path)) {
    try {
      const file = await entry.handle.getFile();
      const content = await file.text();
      
      fileExplorerState.files.set(path, {
        name: entry.name,
        content,
        type: file.type,
        size: file.size
      });
      
      fileExplorerState.openTabs.set(path, content);
      fileExplorerState.tabsOrder.push(path);
    } catch (err) {
      console.error('Error reading file:', err);
      alert('Error reading file: ' + err.message);
      return;
    }
  }
  
  // Update UI
  renderTabs();
  renderFileExplorer(); // To update active state
  showFileInEditor(path);
}

function renderTabs() {
  const tabBar = document.getElementById('tabBar');
  if (!tabBar) return;
  
  if (fileExplorerState.tabsOrder.length === 0) {
    tabBar.innerHTML = '';
    showWelcomeScreen();
    return;
  }
  
  tabBar.innerHTML = fileExplorerState.tabsOrder.map(path => {
    const file = fileExplorerState.files.get(path);
    const name = file ? file.name : path.split('/').pop();
    const isActive = path === fileExplorerState.activeFile;
    return `
      <div class="tab ${isActive ? 'active' : ''}" data-file="${path}">
        ${escapeHtml(name)}
        <span class="close-tab" data-path="${path}">×</span>
      </div>
    `;
  }).join('') + `
    <button class="new-tab-btn" id="newTabBtnInline" title="New file">
      <svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
  `;
  
  // Attach tab click handlers
  tabBar.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('close-tab')) {
        e.stopPropagation();
        closeTab(e.target.dataset.path);
      } else {
        const path = tab.dataset.file;
        fileExplorerState.activeFile = path;
        renderTabs();
        // Check if browser tab
        const file = fileExplorerState.files.get(path);
        if (file && file.isBrowser) {
          showBrowserView(path);
        } else {
          showFileInEditor(path);
        }
      }
    });
  });
  
  // Attach new tab button handler - show dropdown
  const newTabBtn = document.getElementById('newTabBtnInline');
  const newTabDropdown = document.getElementById('newTabDropdown');
  if (newTabBtn && newTabDropdown) {
    newTabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      newTabDropdown.classList.toggle('hidden');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      newTabDropdown.classList.add('hidden');
    });
  }
}

function closeTab(path) {
  fileExplorerState.openTabs.delete(path);
  fileExplorerState.tabsOrder = fileExplorerState.tabsOrder.filter(p => p !== path);
  
  if (fileExplorerState.activeFile === path) {
    if (fileExplorerState.tabsOrder.length > 0) {
      fileExplorerState.activeFile = fileExplorerState.tabsOrder[fileExplorerState.tabsOrder.length - 1];
      showFileInEditor(fileExplorerState.activeFile);
    } else {
      fileExplorerState.activeFile = null;
      showWelcomeScreen();
    }
  }
  
  renderTabs();
}

let untitledCounter = 1;
let browserCounter = 1;
function createNewUntitledFile() {
  const path = `untitled-${untitledCounter++}`;
  
  fileExplorerState.files.set(path, {
    name: `Untitled-${untitledCounter - 1}`,
    content: '',
    type: 'text/plain',
    size: 0,
    isNew: true,
    isBrowser: false
  });
  
  fileExplorerState.openTabs.set(path, '');
  fileExplorerState.tabsOrder.push(path);
  fileExplorerState.activeFile = path;
  
  renderTabs();
  showFileInEditor(path);
}

function createNewBrowserTab() {
  const path = `browser-${browserCounter++}`;
  
  fileExplorerState.files.set(path, {
    name: `Browser`,
    content: '',
    type: 'browser',
    size: 0,
    isNew: true,
    isBrowser: true,
    url: 'about:blank'
  });
  
  fileExplorerState.openTabs.set(path, '');
  fileExplorerState.tabsOrder.push(path);
  fileExplorerState.activeFile = path;
  
  renderTabs();
  showBrowserView(path);
}

function showBrowserView(path) {
  const previewPanel = document.getElementById('filePreviewPanel');
  const previewContent = document.getElementById('previewContent');
  const browserBar = document.getElementById('browserBar');
  const browserFrame = document.getElementById('browserFrame');
  const breadcrumbFile = document.getElementById('breadcrumbFile');
  const urlInput = document.getElementById('urlInput');
  
  const file = fileExplorerState.files.get(path);
  if (!file) return;
  
  // Show preview panel
  if (previewPanel) previewPanel.classList.add('active');
  
  // Update breadcrumb
  if (breadcrumbFile) {
    breadcrumbFile.textContent = 'Browser';
  }
  
  // Show browser UI
  if (previewContent) previewContent.classList.add('hidden');
  if (browserBar) browserBar.classList.remove('hidden');
  if (browserFrame) {
    browserFrame.classList.remove('hidden');
    browserFrame.src = file.url || 'about:blank';
  }
  if (urlInput) {
    urlInput.value = file.url === 'about:blank' ? '' : file.url;
  }
}

function showWelcomeScreen() {
  // Show empty state in preview panel
  const previewPanel = document.getElementById('filePreviewPanel');
  const previewContent = document.getElementById('previewContent');
  if (previewPanel) previewPanel.classList.remove('active');
  if (previewContent) previewContent.innerHTML = '<div class="preview-empty">Select a file to preview</div>';
}

function showFileInEditor(path) {
  const previewPanel = document.getElementById('filePreviewPanel');
  const previewContent = document.getElementById('previewContent');
  const breadcrumbFile = document.getElementById('breadcrumbFile');
  const browserBar = document.getElementById('browserBar');
  const browserFrame = document.getElementById('browserFrame');
  const urlInput = document.getElementById('urlInput');
  
  const file = fileExplorerState.files.get(path);
  if (!file || !previewContent) return;
  
  // Check if it's an HTML file - preview in browser instead
  const isHtmlFile = file.name.endsWith('.html') || file.name.endsWith('.htm');
  
  if (isHtmlFile && browserFrame && browserBar) {
    // Show preview panel
    if (previewPanel) previewPanel.classList.add('active');
    
    // Update breadcrumb
    if (breadcrumbFile) {
      breadcrumbFile.textContent = file.name + ' (Preview)';
    }
    
    // Show browser UI for HTML preview
    previewContent.classList.add('hidden');
    browserBar.classList.remove('hidden');
    browserFrame.classList.remove('hidden');
    
    // Create blob URL for HTML content preview
    const blob = new Blob([file.content], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    browserFrame.src = blobUrl;
    
    if (urlInput) {
      urlInput.value = 'Preview: ' + file.name;
      urlInput.readOnly = true;
    }
    
    // Store reference to clean up blob URL later
    fileExplorerState.currentHtmlPreview = blobUrl;
    return;
  }
  
  // Show preview panel
  if (previewPanel) previewPanel.classList.add('active');
  
  // Update breadcrumb
  if (breadcrumbFile) {
    breadcrumbFile.textContent = file.name;
  }
  
  // Hide browser UI, show file content
  if (browserBar) browserBar.classList.add('hidden');
  if (browserFrame) browserFrame.classList.add('hidden');
  previewContent.classList.remove('hidden');
  
  // Reset URL input
  if (urlInput) {
    urlInput.readOnly = false;
  }
  
  // Simple syntax highlighting
  const highlightedContent = highlightSyntax(file.content, file.name);
  previewContent.innerHTML = `<pre style="margin:0; white-space:pre-wrap; word-break:break-word;">${highlightedContent}</pre>`;
}

// Function to preview a local port
function previewLocalPort(port, title = 'Local Server') {
  const path = `port-${port}`;
  
  // Check if already exists
  if (fileExplorerState.files.has(path)) {
    // Just activate the existing tab
    fileExplorerState.activeFile = path;
    renderTabs();
    showBrowserView(path);
    return;
  }
  
  // Create new browser tab for this port
  fileExplorerState.files.set(path, {
    name: `${title} :${port}`,
    content: '',
    type: 'browser',
    size: 0,
    isNew: true,
    isBrowser: true,
    url: `http://localhost:${port}`,
    isPortPreview: true,
    port: port
  });
  
  fileExplorerState.openTabs.set(path, '');
  fileExplorerState.activeFile = path;
  
  renderTabs();
  showBrowserView(path);
}

// Open file in browser panel
function openFileInBrowser(path) {
  const file = fileExplorerState.files.get(path);
  if (!file) return;
  
  // Check if it's HTML
  const isHtmlFile = file.name.endsWith('.html') || file.name.endsWith('.htm');
  
  if (isHtmlFile) {
    // Open HTML in browser preview
    fileExplorerState.activeFile = path;
    renderTabs();
    showFileInEditor(path);
  } else {
    // For other files, create a browser tab with file:// protocol
    const browserPath = `file-browser-${Date.now()}`;
    fileExplorerState.files.set(browserPath, {
      name: `View: ${file.name}`,
      content: '',
      type: 'browser',
      size: 0,
      isNew: true,
      isBrowser: true,
      url: `file://${path}`,
      isFilePreview: true,
      originalFile: path
    });
    
    fileExplorerState.openTabs.set(browserPath, '');
    fileExplorerState.activeFile = browserPath;
    
    renderTabs();
    showBrowserView(browserPath);
  }
}

function highlightSyntax(content, filename) {
  // Escape HTML first
  let escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // Simple highlighting based on file extension
  const ext = filename.split('.').pop().toLowerCase();
  
  if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) {
    // JavaScript keywords
    escaped = escaped.replace(/\b(const|let|var|function|class|import|export|from|return|if|else|for|while|switch|case|break|default|try|catch|async|await|new|this|typeof|instanceof)\b/g, '<span style="color:#c678dd;">$1</span>');
    // Strings
    escaped = escaped.replace(/('.*?')|(".*?")|(`[\s\S]*?`)/g, '<span style="color:#98c379;">$&</span>');
    // Comments
    escaped = escaped.replace(/(\/\/.*$)/gm, '<span style="color:#5c6370;font-style:italic;">$1</span>');
    // Numbers
    escaped = escaped.replace(/\b(\d+)\b/g, '<span style="color:#d19a66;">$1</span>');
  } else if (['json'].includes(ext)) {
    // JSON
    escaped = escaped.replace(/"([^"]+)":/g, '<span style="color:#c678dd;">"$1"</span>:');
    escaped = escaped.replace(/: "([^"]*)"/g, ': <span style="color:#98c379;">"$1"</span>');
    escaped = escaped.replace(/\b(true|false|null)\b/g, '<span style="color:#d19a66;">$1</span>');
    escaped = escaped.replace(/\b(\d+)\b/g, '<span style="color:#d19a66;">$1</span>');
  } else if (['html', 'xml'].includes(ext)) {
    // HTML/XML tags
    escaped = escaped.replace(/(&lt;\/?)([\w-]+)/g, '$1<span style="color:#e06c75;">$2</span>');
    escaped = escaped.replace(/(\s)([\w-]+)=/g, '$1<span style="color:#d19a66;">$2</span>=');
    escaped = escaped.replace(/"([^"]*)"/g, '<span style="color:#98c379;">"$1"</span>');
  } else if (['css', 'scss', 'less'].includes(ext)) {
    // CSS properties
    escaped = escaped.replace(/([\w-]+):/g, '<span style="color:#d19a66;">$1</span>:');
    escaped = escaped.replace(/(:\s*)([^;]+)/g, '$1<span style="color:#98c379;">$2</span>');
    escaped = escaped.replace(/\./g, '<span style="color:#e06c75;">.</span>');
    escaped = escaped.replace(/#/g, '<span style="color:#e06c75;">#</span>');
  }
  
  return escaped;
}

function updateFileInfo(file) {
  const infoName = document.getElementById('infoName');
  const infoType = document.getElementById('infoType');
  const infoSize = document.getElementById('infoSize');
  const infoLines = document.getElementById('infoLines');
  
  if (infoName) infoName.textContent = file.name || '-';
  if (infoType) infoType.textContent = file.type || 'text/plain';
  if (infoSize) infoSize.textContent = formatFileSize(file.size);
  if (infoLines) infoLines.textContent = file.content ? file.content.split('\n').length : '0';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function attachOpenFolderListener() {
  const btn = document.getElementById('sidebarOpenFolder');
  if (btn) {
    btn.addEventListener('click', openFolder);
  }
}

// Initialize file explorer listeners
document.addEventListener('DOMContentLoaded', () => {
  attachOpenFolderListener();
  
  const openFolderBtn = document.getElementById('openFolderBtn');
  if (openFolderBtn) {
    openFolderBtn.addEventListener('click', openFolder);
  }
  
  // Save file handler
  const saveFileBtn = document.getElementById('saveFileBtn');
  if (saveFileBtn) {
    saveFileBtn.addEventListener('click', saveCurrentFile);
  }
  
  // Close tab handler
  const closeTabBtn = document.getElementById('closeTabBtn');
  if (closeTabBtn) {
    closeTabBtn.addEventListener('click', () => {
      if (fileExplorerState.activeFile) {
        closeTab(fileExplorerState.activeFile);
      }
    });
  }
  
  // Dropdown option handlers
  const openFileOption = document.getElementById('openFileOption');
  const openBrowserOption = document.getElementById('openBrowserOption');
  
  if (openFileOption) {
    openFileOption.addEventListener('click', () => {
      createNewUntitledFile();
      document.getElementById('newTabDropdown').classList.add('hidden');
    });
  }
  
  if (openBrowserOption) {
    openBrowserOption.addEventListener('click', () => {
      createNewBrowserTab();
      document.getElementById('newTabDropdown').classList.add('hidden');
    });
  }
  
  // Browser controls
  const browserBack = document.getElementById('browserBack');
  const browserForward = document.getElementById('browserForward');
  const browserRefresh = document.getElementById('browserRefresh');
  const urlInput = document.getElementById('urlInput');
  const urlGoBtn = document.getElementById('urlGoBtn');
  const browserFrame = document.getElementById('browserFrame');
  
  if (browserBack && browserFrame) {
    browserBack.addEventListener('click', () => {
      if (browserFrame.canGoBack()) browserFrame.goBack();
    });
  }
  if (browserForward && browserFrame) {
    browserForward.addEventListener('click', () => {
      if (browserFrame.canGoForward()) browserFrame.goForward();
    });
  }
  if (browserRefresh && browserFrame) {
    browserRefresh.addEventListener('click', () => browserFrame.reload());
  }
  if (urlGoBtn && browserFrame) {
    urlGoBtn.addEventListener('click', () => navigateToUrlOrSearch(urlInput.value));
  }
  if (urlInput && browserFrame) {
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        navigateToUrlOrSearch(urlInput.value);
      }
    });
  }
  
  function navigateToUrlOrSearch(input) {
    let query = input.trim();
    if (!query) return;
    
    // Check if it's a URL (contains . or starts with http)
    const isUrl = /^(https?:\/\/)?([\w-]+\.)+[\w-]+/.test(query) || query.includes('.');
    
    if (isUrl) {
      // It's a URL
      let url = query;
      if (!url.startsWith('http')) url = 'https://' + url;
      browserFrame.src = url;
    } else {
      // It's a search query - use Google
      browserFrame.src = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }
  }
  
  // Update URL bar when webview navigates
  if (browserFrame) {
    browserFrame.addEventListener('did-navigate', (e) => {
      if (urlInput) urlInput.value = e.url;
    });
    browserFrame.addEventListener('did-navigate-in-page', (e) => {
      if (urlInput) urlInput.value = e.url;
    });
  }
  
  // Sidebar resize functionality
  const fileExplorerSidebar = document.getElementById('fileExplorerSidebar');
  setupSidebarResize('leftSidebarResizeHandle', 'leftSidebar', 'right');
  setupSidebarResize('fileExplorerResizeHandle', 'fileExplorerSidebar', 'left');
  setupSidebarResize('previewResizeHandle', 'filePreviewPanel', 'preview');
  
  // Title bar explorer toggle
  const titleBarExplorer = document.getElementById('titleBarExplorer');
  if (titleBarExplorer && fileExplorerSidebar) {
    titleBarExplorer.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isHidden = fileExplorerSidebar.classList.contains('hidden');
      console.log('Toggle clicked, isHidden:', isHidden);
      console.log('Classes before:', fileExplorerSidebar.className);
      if (isHidden) {
        fileExplorerSidebar.classList.remove('hidden');
        titleBarExplorer.classList.add('active');
      } else {
        fileExplorerSidebar.classList.add('hidden');
        titleBarExplorer.classList.remove('active');
      }
      console.log('Classes after:', fileExplorerSidebar.className);
    });
  } else {
    console.error('Missing elements:', { titleBarExplorer, fileExplorerSidebar });
  }
});

// Keyboard shortcut - Focus chat input (Cmd/Ctrl + Shift + I)
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
    e.preventDefault();
    const textarea = document.querySelector('.chat-textarea, #chatInput textarea');
    if (textarea) {
      textarea.focus();
    }
  }
});

// Keyboard shortcut - Clear chat (Cmd/Ctrl + Shift + C)
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
    e.preventDefault();
    clearChat();
  }
});

// Keyboard shortcut - Toggle file explorer (Cmd/Ctrl + Shift + E)
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
    e.preventDefault();
    toggleFileExplorer();
  }
});

// Event delegation for Accept/Reject buttons on file diffs
document.addEventListener('click', (e) => {
  // Handle Accept button
  const acceptBtn = e.target.closest('.diff-accept-btn');
  if (acceptBtn) {
    const path = acceptBtn.dataset.path;
    const content = decodeURIComponent(acceptBtn.dataset.content || '');
    const diffContainer = acceptBtn.closest('[style*="border: 1px solid #ddd"]');
    
    // Write the file content to finalize it
    if (window.aiAgent && content) {
      window.aiAgent.writeFile({ path, content, isAI: false });
    }
    
    // Remove from AI modified files (finalize it)
    if (window.aiAgent) {
      window.aiAgent.aiModifiedFiles = window.aiAgent.aiModifiedFiles.filter(f => f.path !== path);
    }
    
    // Remove from pending changes
    pendingFileChanges = pendingFileChanges.filter(c => c.path !== path);
    pendingAIChanges = pendingAIChanges.filter(c => c.path !== path);
    if (pendingFileChanges.length === 0) {
      hideFileChangesBar();
    } else {
      const totalAdditions = pendingFileChanges.reduce((sum, c) => sum + (c.additions || 0), 0);
      const totalDeletions = pendingFileChanges.reduce((sum, c) => sum + (c.deletions || 0), 0);
      showFileChangesBar(pendingFileChanges.length, totalAdditions, totalDeletions);
    }
    
    // Visual feedback
    if (diffContainer) {
      diffContainer.style.opacity = '0.5';
      acceptBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Accepted';
      acceptBtn.disabled = true;
    }
    
    showToast(`Accepted ${path}`);
    refreshFileExplorer();
    return;
  }
  
  // Handle Reject button
  const rejectBtn = e.target.closest('.diff-reject-btn');
  if (rejectBtn) {
    const path = rejectBtn.dataset.path;
    const diffContainer = rejectBtn.closest('[style*="border: 1px solid #ddd"]');
    
    // Revert the file
    if (window.aiAgent) {
      const file = window.aiAgent.aiModifiedFiles.find(f => f.path === path);
      if (file) {
        if (file.type === 'created') {
          // Delete created file
          window.aiAgent.getDirectoryHandle(path.substring(0, path.lastIndexOf('/')) || '')
            .then(dirHandle => {
              if (dirHandle && dirHandle.removeEntry) {
                dirHandle.removeEntry(path.split('/').pop());
              }
            });
        } else if (file.originalContent) {
          // Revert to original
          window.aiAgent.writeFile({ path, content: file.originalContent, isAI: false });
        }
        window.aiAgent.aiModifiedFiles = window.aiAgent.aiModifiedFiles.filter(f => f.path !== path);
      }
    }
    
    // Remove from pending changes
    pendingFileChanges = pendingFileChanges.filter(c => c.path !== path);
    if (pendingFileChanges.length === 0) {
      hideFileChangesBar();
    } else {
      const totalAdditions = pendingFileChanges.reduce((sum, c) => sum + (c.additions || 0), 0);
      const totalDeletions = pendingFileChanges.reduce((sum, c) => sum + (c.deletions || 0), 0);
      showFileChangesBar(pendingFileChanges.length, totalAdditions, totalDeletions);
    }
    
    // Visual feedback - hide the diff
    if (diffContainer) {
      diffContainer.style.display = 'none';
    }
    
    showToast(`Rejected ${path}`);
    return;
  }
  
  // Handle Open button - preview file in browser
  const openBtn = e.target.closest('.diff-open-btn');
  if (openBtn) {
    const path = openBtn.dataset.path;
    
    // Find the file content
    let fileContent = '';
    const file = window.aiAgent?.aiModifiedFiles?.find(f => f.path === path);
    if (file) {
      fileContent = file.content || '';
    }
    
    // Create temporary file entry for preview
    const tempPath = `preview-${Date.now()}`;
    fileExplorerState.files.set(tempPath, {
      name: path.split('/').pop() || path,
      content: fileContent,
      type: 'text/html',
      size: fileContent.length,
      isNew: false,
      isBrowser: false
    });
    
    // Open in browser preview
    fileExplorerState.openTabs.set(tempPath, '');
    fileExplorerState.activeFile = tempPath;
    renderTabs();
    
    // Use the openFileInBrowser function for preview
    openFileInBrowser(tempPath);
    
    showToast(`Opening ${path.split('/').pop()}...`);
    return;
  }
});

// Keyboard shortcut to toggle Agent mode (Cmd/Ctrl + Shift + A)
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    // Toggle between Ask and Agent mode
    currentMode = currentMode === 'agent' ? 'ask' : 'agent';
    
    // Update UI
    const selectedModeSpan = document.querySelector('.selected-mode-prompt');
    if (selectedModeSpan) {
      selectedModeSpan.textContent = currentMode === 'agent' ? 'Agent' : 'Ask';
    }
    
    // Update dropdown checkmarks
    document.querySelectorAll('.mode-dropdown-prompt .dropdown-item').forEach(item => {
      const modeName = item.querySelector('span')?.textContent || '';
      const isSelected = (currentMode === 'agent' && modeName === 'Agent') || 
                         (currentMode === 'ask' && modeName === 'Ask');
      
      if (isSelected && !item.querySelector('.check')) {
        item.innerHTML = `<span>${modeName}</span><svg class="icon-svg check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
      } else if (!isSelected) {
        item.innerHTML = `<span>${modeName}</span>`;
      }
    });
    
    // Focus main textarea
    const mainTextarea = document.getElementById('main-textarea');
    if (mainTextarea) {
      mainTextarea.placeholder = currentMode === 'agent' 
        ? 'Ask agent to write code, fix bugs, or search files...'
        : 'Ask Ceres anything. @ to use plugins or use files';
      mainTextarea.focus();
    }
    
    console.log('Toggled mode to:', currentMode);
  }
});

initSettings();
applySettings();
render();

// Pending file changes management
let pendingFileChanges = [];

function showFileChangesBar(fileCount, additions, deletions) {
  const bar = document.getElementById('fileChangesBar');
  const composerCard = document.querySelector('.composer-card');
  if (!bar) return;
  
  document.getElementById('changesFilesCount').textContent = `${fileCount} file${fileCount > 1 ? 's' : ''}`;
  
  const statsEl = document.getElementById('changesStats');
  if (statsEl) {
    statsEl.innerHTML = `<span style="color: #22c55e;">+${additions}</span> <span style="color: #dc2626;">-${deletions}</span>`;
  }
  
  bar.style.display = 'flex';
  
  // Add connected class to prompt box
  if (composerCard) {
    composerCard.classList.add('connected');
  }
}

function hideFileChangesBar() {
  const bar = document.getElementById('fileChangesBar');
  const composerCard = document.querySelector('.composer-card');
  if (bar) bar.style.display = 'none';
  if (composerCard) {
    composerCard.classList.remove('connected');
  }
}

function acceptAllChanges() {
  // Find all accept buttons in diff views and click them
  document.querySelectorAll('.diff-accept-btn, .accept-change-btn').forEach(btn => {
    btn.click();
  });
  
  pendingFileChanges = [];
  hideFileChangesBar();
  
  // Show toast
  showToast('All changes accepted');
}

function rejectAllChanges() {
  // Find all reject buttons in diff views and click them
  document.querySelectorAll('.diff-reject-btn, .reject-change-btn').forEach(btn => {
    btn.click();
  });
  
  pendingFileChanges = [];
  hideFileChangesBar();
  
  // Show toast
  showToast('All changes rejected');
}

function addPendingChange(change) {
  pendingFileChanges.push(change);
  const totalAdditions = pendingFileChanges.reduce((sum, c) => sum + (c.additions || 0), 0);
  const totalDeletions = pendingFileChanges.reduce((sum, c) => sum + (c.deletions || 0), 0);
  showFileChangesBar(pendingFileChanges.length, totalAdditions, totalDeletions);
}

function setupSidebarResize(handleId, sidebarId, edge) {
  const handle = document.getElementById(handleId);
  const sidebar = document.getElementById(sidebarId);
  if (!handle || !sidebar) return;
  
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  
  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    handle.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    let delta;
    if (edge === 'left') {
      delta = startX - e.clientX;
    } else if (edge === 'preview') {
      delta = startX - e.clientX; // Inverted: dragging left expands panel
    } else {
      delta = e.clientX - startX;
    }
    const newWidth = startWidth + delta;
    const minWidth = 200;
    const maxWidth = 800;
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      sidebar.style.width = newWidth + 'px';
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      handle.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

// Terminal Panel Controls
function toggleTerminalPanel() {
  const panel = document.getElementById('terminalPanel');
  if (panel) {
    if (panel.classList.contains('hidden')) {
      panel.classList.remove('hidden');
      panel.classList.remove('minimized');
      // Focus input
      const input = document.getElementById('terminalInput');
      if (input) input.focus();
    } else {
      panel.classList.add('hidden');
    }
  }
}

function toggleTerminal() {
  const panel = document.getElementById('terminalPanel');
  if (panel) {
    panel.classList.toggle('minimized');
  }
}

function maximizeTerminal() {
  const panel = document.getElementById('terminalPanel');
  if (panel) {
    panel.classList.toggle('maximized');
  }
}

function closeTerminal() {
  const panel = document.getElementById('terminalPanel');
  if (panel) {
    panel.classList.add('hidden');
  }
}

function showTerminal() {
  const panel = document.getElementById('terminalPanel');
  if (panel) {
    panel.classList.remove('hidden');
    panel.classList.remove('minimized');
  }
}

// Terminal Input Handler
function setupTerminalInput() {
  const input = document.getElementById('terminalInput');
  const output = document.getElementById('terminalOutput');
  
  if (!input || !output) return;
  
  // Show initial message
  const isElectron = window.electronAPI && window.electronAPI.executeTerminal;
  if (!isElectron) {
    addTerminalOutput('Ceres AI Agent Terminal', 'success');
    addTerminalOutput('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'normal');
    addTerminalOutput('Running in BROWSER MODE', 'error');
    addTerminalOutput('Terminal commands cannot execute in browser.', 'error');
    addTerminalOutput('To use git push/pull, run this app with: npm run electron', 'normal');
    addTerminalOutput('', 'normal');
  }
  
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const command = input.value.trim();
      if (!command) return;
      
      // Add command to output with command styling
      const line = document.createElement('div');
      line.className = 'output-line command';
      line.textContent = `PS C:\Users\DELL\Desktop\New folder (18)> ${command}`;
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
      
      // Clear input
      input.value = '';
      
      // Execute command
      try {
        if (window.electronAPI && window.electronAPI.executeTerminal) {
          const cwd = getCurrentFolderPath();
          const result = await window.electronAPI.executeTerminal({ command, cwd });
          if (result.stdout) {
            addTerminalOutput(result.stdout, 'success');
          }
          if (result.stderr) {
            addTerminalOutput(result.stderr, 'error');
          }
        } else {
          addTerminalOutput('[BROWSER MODE] Command would execute here in Electron:', 'error');
          addTerminalOutput(`  ${command}`, 'normal');
          addTerminalOutput('', 'normal');
          addTerminalOutput('To actually run commands, use:', 'normal');
          addTerminalOutput('  npm run electron', 'success');
        }
      } catch (err) {
        addTerminalOutput(`Error: ${err.message}`, 'error');
      }
    }
  });
}

function addTerminalOutput(text, type = 'normal') {
  const output = document.getElementById('terminalOutput');
  if (!output) return;
  
  const line = document.createElement('div');
  line.className = `output-line ${type}`;
  line.textContent = text;
  output.appendChild(line);
  
  // Auto scroll to bottom
  output.scrollTop = output.scrollHeight;
}

// Terminal functions are initialized in the main DOMContentLoaded above

// Update terminal prompt with current folder path
function updateTerminalPrompt(folderPath) {
  const prompt = document.getElementById('terminalPrompt');
  if (!prompt) return;
  
  if (!folderPath) {
    // Default prompt if no folder opened
    prompt.textContent = 'PS C:\\Users\\DELL\\Desktop\\New folder (18)>';
    return;
  }
  
  // Format path for PowerShell style
  const formattedPath = folderPath.replace(/\//g, '\\');
  prompt.textContent = `PS ${formattedPath}>`;
}

// Get current folder path for terminal commands
function getCurrentFolderPath() {
  return fileExplorerState?.folderPath || window.aiAgent?.workingDirectoryPath || 'C:\\Users\\DELL\\Desktop\\New folder (18)';
}
