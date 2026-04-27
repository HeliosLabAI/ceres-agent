class AIAgent {
  constructor() {
    this.workingDirectory = null;
    this.isRunning = false;
    this.abortController = null; // For cancellation
    this.maxIterations = 12;
    this.maxRepairAttempts = 2;
    this.toolExecutor = new ToolExecutor(this);
    this.ollamaHost = "http://localhost:11434";
    this.ollamaModel = ""; // Will be set from UI dropdown
    this.conversationHistory = [];
    this.taskMemory = this.createEmptyTaskMemory();
    this.aiModifiedFiles = []; // Track files created/edited by AI
    this.planningShown = false; // Only show planning once per task
    this.attachModelSync();
  }

  // Cancel current agent run
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isRunning = false;
    this.emitToUI('cancelled', { message: 'Agent run cancelled' });
  }

  createEmptyTaskMemory() {
    return {
      goal: null,
      plan: [],
      completedSteps: [],
      currentStep: null,
      filesRead: new Set(),
      filesModified: new Set()
    };
  }

  resetMemory(userRequest) {
    this.taskMemory = this.createEmptyTaskMemory();
    this.taskMemory.goal = userRequest;
    this.aiModifiedFiles = []; // Clear AI modified files on new run
    this.planningShown = false; // Reset planning flag for new task
  }

  setConfig({ model, host } = {}) {
    if (typeof model === "string" && model.trim()) {
      this.ollamaModel = model.trim();
    }
    if (typeof host === "string" && host.trim()) {
      this.ollamaHost = host.trim().replace(/\/+$/, "");
    }
  }

  setWorkingDirectory(dirHandle) {
    this.workingDirectory = dirHandle;
    this.toolExecutor.setWorkingDirectory(dirHandle);
  }

  attachModelSync() {
    const sync = () => this.syncModelFromUI();

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", sync, { once: true });
    } else {
      sync();
    }
  }

  syncModelFromUI() {
    if (typeof window !== "undefined" && typeof window.__agentModel === "string" && window.__agentModel.trim()) {
      this.ollamaModel = window.__agentModel.trim();
      return;
    }

    const selectedModel = document.querySelector(".selected-model-prompt");
    const modelName = selectedModel?.textContent?.trim();
    if (modelName && modelName !== 'Select Model') {
      this.ollamaModel = modelName;
    }
  }

  getSystemPrompt() {
    // Get user instructions from settings if available
    let userInstructions = '';
    if (typeof window !== 'undefined' && window.appSettings?.personalization?.userInstructionsContent) {
      userInstructions = window.appSettings.personalization.userInstructionsContent;
    }

    return `You are an autonomous coding agent running inside a browser-based IDE.

USER CONTEXT AND PREFERENCES:
${userInstructions ? `The user has provided the following context about their preferences and coding style:\n${userInstructions}\n\nUse this information to tailor your responses and code style to match their preferences.\n` : ''}

BE AWARE AND RESPONSIVE:
- Understand the FULL context of the user's request before acting
- Read relevant files to understand the project structure first
- Consider the bigger picture - how changes affect the entire codebase
- Be proactive - if something seems wrong or unclear, investigate
- Ask yourself: "What is the user REALLY trying to accomplish?"
- Think about edge cases, dependencies, and side effects
- Provide clear, actionable responses that directly address the user's goal

BE UNDERSTANDABLE:
- Explain your reasoning clearly when making decisions
- If you encounter an issue, explain what happened and how you'll fix it
- Use plain language - avoid jargon unless necessary
- Structure your responses logically
- When showing code, explain WHY you made those changes

AUTONOMOUS WORKFLOW - YOU DECIDE:
Based on the user's request, YOU decide which tools to use and in what order. You can:
- Read files to understand the project
- Search for patterns or code
- Create new files
- Edit existing files
- Run terminal commands
All based on what the task requires. You are NOT limited to one tool per iteration.

PLANNING (Optional but recommended for complex tasks):
For complex multi-step tasks, create PLAN.md to track progress. For simple tasks, just execute directly.

CRITICAL - RETURN ONLY VALID JSON:
- NO markdown code blocks (no triple backticks json)
- NO explanations before or after JSON
- NO text outside the JSON object
- MUST be parseable JSON with all required fields
- If you cannot return valid JSON, set next_action="continue" and try again in next iteration

Schema:
{
  "goal": "string",
  "plan": ["remaining step 1", "remaining step 2"],
  "current_step": "ONLY the current step being executed",
  "reasoning": "string",
  "tool_calls": [
    // YOU decide how many tools to call - can be single or multiple
    { "name": "readFile", "parameters": { "path": "src/app.js" } },
    { "name": "searchFiles", "parameters": { "query": "function" } }
  ],
  "expected_outcome": "string",
  "next_action": "continue | finish",
  "final_response": "string"
}

Available tools (USE ANY BASED ON LOGIC):
- readFile({ path }) - Read a single file
- readFiles({ paths }) - Read MULTIPLE files at once
- writeFile({ path, content }) - Write/create a file
- writeFiles({ files }) - Write MULTIPLE files at once
- createFile({ path, content }) - Create a new file
- editFile({ path, oldText, newText, occurrence? }) - Precise text replacement (add a dot, change a word, etc.)
- applyPatch({ path, diff }) - Apply a diff/patch to a file
- deleteFile({ path }) - Delete a file
- moveFile({ from, to }) - Move/rename a file
- copyFile({ from, to }) - Copy a file
- getFileInfo({ path }) - Get file metadata
- listFiles({ path }) - List files in a directory
- getFileTree({ path, depth }) - Get full directory tree
- searchFiles({ query, maxResults }) - Search file contents
- grepSearch({ pattern, path, glob? }) - Search with regex pattern
- getSymbols({ path }) - Get code symbols (functions, classes, etc)
- findReferences({ symbol, path }) - Find where a symbol is used
- validateSyntax({ path, content? }) - Check if code is valid
- executeTerminal({ command, reason, cwd? }) - Run terminal commands (requires approval, only works in Electron mode)

DECISION EXAMPLES:
- "Create a website" → First: readFile/getFileTree to understand structure, THEN: createFile/writeFile to build it
- "Fix bug in app.js" → First: readFile to see code, searchFiles to find related code, THEN: applyPatch OR editFile to fix
- "Add a dot at line 1323" → Use editFile with oldText="text" newText="text." for precise single-character edits
- "Run the project" → First: readFile to check package.json, THEN: executeTerminal to run it
- "Search for API calls" → Use grepSearch to find all API calls, THEN: readFiles to analyze them

CRITICAL RULES - MUST FOLLOW:
- YOU decide the tool sequence based on logic and task requirements
- Can use SINGLE tool or MULTIPLE tools in one iteration
- Chain tools naturally: explore → understand → create → run
- For complex tasks, track progress in PLAN.md
- When next_action is "finish", write final_response summarizing what was done

MOST IMPORTANT - VALID JSON & TASK COMPLETION:
- ALWAYS return ONLY valid, complete JSON. No text before or after
- If your response gets cut off or is incomplete: set next_action="continue" and try again
- NEVER say "Task Complete" or set next_action="finish" if:
  * Your JSON was incomplete/invalid
  * Any tool failed (commands, file operations, etc)
  * The task is ACTUALLY finished
- ONLY say "Task Complete" when:
  * Your JSON is fully valid and complete
  * ALL operations succeeded AND VERIFIED
  * The task is ACTUALLY done
  * YOU HAVE VERIFIED THE WORK (e.g., file actually deleted, command actually succeeded)

CRITICAL - VERIFY BEFORE COMPLETING:
- After delete operations: VERIFY the file is actually gone (list directory or check)
- After write operations: VERIFY the file was actually created/modified
- After terminal commands: VERIFY the command actually succeeded with correct exit code
- If verification fails: set next_action="continue" and try again
- NEVER mark task complete based on tool success alone - always verify the actual result

BE CONCISE IN FINAL_RESPONSE:
- Keep final_response brief and direct
- DO NOT explain what you will do before doing it
- DO NOT narrate your actions step-by-step
- Just state what was done, no fluff
- Example: "Deleted sameer.html" not "I will now delete the file. Found it. Deleted it successfully."

TERMINAL COMMANDS - CRITICAL:
- ALWAYS check the command result (success, exitCode, error fields) BEFORE setting next_action="finish"
- NEVER set next_action="finish" while a terminal command is still running
- Wait for the command to COMPLETE and return success/fail result
- If command fails: analyze, try alternatives, set next_action="continue"
- Only set next_action="finish" AFTER command completes successfully
- The example shows a FAILED command - you must NOT complete until it's actually done`;
  }

  async run(userRequest) {
    // Cancel any previous run
    if (this.isRunning) {
      this.cancel();
    }
    
    // Create new abort controller for this run
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    if (!this.workingDirectory) {
      this.emitToUI("error", { message: "**No folder opened**\n\nClick **File → Open Folder** to select a project folder first." });
      return;
    }

    await this.resolveActiveModel();
    this.isRunning = true;
    this.resetMemory(userRequest);
    
    // Append to conversation history instead of resetting (keep context)
    this.conversationHistory.push({ role: "user", content: userRequest });
    
    // Limit history to last 80 messages to prevent token overflow (4x more context)
    if (this.conversationHistory.length > 80) {
      this.conversationHistory = this.conversationHistory.slice(-80);
    }

    this.emitToUI("thinking", { message: "Understanding request...", status: "analyzing" });

    try {
      for (let iteration = 1; iteration <= this.maxIterations; iteration += 1) {
        // Check if cancelled
        if (signal.aborted) {
          console.log('Agent run was cancelled');
          return;
        }
        
        const thinkingStatus = this.getThinkingMessage(iteration);
        this.emitToUI("thinking", {
          message: typeof thinkingStatus === 'object' ? thinkingStatus.text : thinkingStatus,
          status: "processing",
          step: iteration,
          color: typeof thinkingStatus === 'object' ? thinkingStatus.color : '#6b7280'
        });

        let decision;
        try {
          decision = await this.queryModel();
        } catch (error) {
          // Instead of stopping, create a fallback decision to continue
          this.emitToUI("error", { message: `Model error: ${error.message}. Continuing with best effort...` });
          decision = this.createFallbackDecision();
        }

        if (!decision) {
          decision = this.createFallbackDecision();
        }

        decision = this.normalizeDecision(decision);

        this.taskMemory.goal = decision.goal || this.taskMemory.goal;
        this.taskMemory.plan = Array.isArray(decision.plan) ? decision.plan : this.taskMemory.plan;
        this.taskMemory.currentStep = decision.current_step || this.taskMemory.currentStep;

        if (decision.reasoning) {
          this.emitToUI("reasoning", {
            message: decision.reasoning,
            status: "reasoning",
            step: iteration,
            current: decision.current_step,
            plan: decision.plan
          });
        }
        
        // Show planning only once at start (first iteration only)
        if (decision.plan?.length > 0 && !this.planningShown) {
          this.emitToUI("planning", {
            plan: decision.plan,
            current: decision.current_step
          });
          this.planningShown = true;
        }

        this.conversationHistory.push({
          role: "assistant",
          content: JSON.stringify(decision)
        });

        if (decision.tool_calls.length > 0) {
          this.emitToUI("working", {
            message: `Executing ${decision.tool_calls.length} tool(s)...`,
            status: "executing"
          });

          const results = await this.executeToolsWithProgress(decision.tool_calls);
          this.conversationHistory.push({
            role: "user",
            content: `Tool results:\n${JSON.stringify(results, null, 2)}`
          });
        }

        if (decision.next_action === "finish" || (decision.tool_calls.length === 0 && decision.final_response)) {
          this.emitToUI("complete", {
            message: decision.final_response || "Task completed successfully.",
            steps: iteration
          });
          return;
        }
      }

      this.emitToUI("warning", {
        message: "Max iterations reached. The model did not finish cleanly."
      });
    } catch (error) {
      console.error("Agent error:", error);
      this.emitToUI("error", { message: error.message || "Agent failed." });
    } finally {
      this.isRunning = false;
    }
  }

  normalizeDecision(decision) {
    const normalized = {
      goal: typeof decision.goal === "string" ? decision.goal : this.taskMemory.goal || "Complete the user's request",
      plan: Array.isArray(decision.plan) ? decision.plan.filter(step => typeof step === "string" && step.trim()) : [],
      current_step: typeof decision.current_step === "string" ? decision.current_step : "Working on the task",
      reasoning: typeof decision.reasoning === "string" ? decision.reasoning : "",
      tool_calls: Array.isArray(decision.tool_calls) ? decision.tool_calls.filter(call => call && typeof call.name === "string") : [],
      expected_outcome: typeof decision.expected_outcome === "string" ? decision.expected_outcome : "",
      next_action: typeof decision.next_action === "string" ? decision.next_action : "continue",
      final_response: typeof decision.final_response === "string" ? decision.final_response : ""
    };

    if (!["continue", "finish"].includes(normalized.next_action)) {
      normalized.next_action = normalized.final_response ? "finish" : "continue";
    }

    return normalized;
  }

  getThinkingMessage(step) {
    // Return animated status words based on iteration step
    const statuses = [
      { text: "Diving", color: "#6b6b6b" },      // Light black
      { text: "Exploring", color: "#6b6b6b" },   // Light black
      { text: "Sailing", color: "#6b6b6b" },    // Light black
      { text: "Monitoring", color: "#6b6b6b" }, // Light black
      { text: "Diving", color: "#6b6b6b" },
      { text: "Exploring", color: "#6b6b6b" },
      { text: "Sailing", color: "#6b6b6b" },
      { text: "Monitoring", color: "#6b6b6b" }
    ];
    
    const index = (step - 1) % statuses.length;
    return statuses[index] || { text: "working", color: "#6b6b6b" };
  }

  // Create a fallback decision when model returns invalid JSON
  createFallbackDecision() {
    // Try to extract what we know from conversation history
    const lastUserMessage = this.conversationHistory.findLast(m => m.role === "user");
    const goal = lastUserMessage ? lastUserMessage.content : "Complete the task";
    
    return {
      goal: goal,
      plan: this.taskMemory.plan.length > 0 ? this.taskMemory.plan : ["Analyze request", "Create necessary files", "Complete task"],
      current_step: "Working on task",
      reasoning: "The model response was incomplete. Using fallback logic to continue.",
      tool_calls: [],
      expected_outcome: "Files created/modified as requested",
      next_action: "continue",
      final_response: ""
    };
  }

  getStatusForTool(toolName) {
    // Return status word and color based on tool type
    const toolStatuses = {
      // Exploring - reading/navigating
      readFile: { text: "Exploring", color: "#6b6b6b" },
      readFiles: { text: "Exploring", color: "#6b6b6b" },
      listFiles: { text: "Exploring", color: "#6b6b6b" },
      getFileTree: { text: "Exploring", color: "#6b6b6b" },
      getFileInfo: { text: "Exploring", color: "#6b6b6b" },
      
      // Diving - writing/creating (deep work)
      writeFile: { text: "Diving", color: "#6b6b6b" },
      writeFiles: { text: "Diving", color: "#6b6b6b" },
      createFile: { text: "Diving", color: "#6b6b6b" },
      editFile: { text: "Diving", color: "#6b6b6b" },
      applyPatch: { text: "Diving", color: "#6b6b6b" },
      deleteFile: { text: "Diving", color: "#6b6b6b" },
      moveFile: { text: "Diving", color: "#6b6b6b" },
      copyFile: { text: "Diving", color: "#6b6b6b" },
      
      // Sailing - searching/navigating smoothly
      searchFiles: { text: "Sailing", color: "#6b6b6b" },
      grepSearch: { text: "Sailing", color: "#6b6b6b" },
      getSymbols: { text: "Sailing", color: "#6b6b6b" },
      
      // Monitoring - analyzing/watching
      runTerminal: { text: "Monitoring", color: "#6b6b6b" },
      runCommand: { text: "Monitoring", color: "#6b6b6b" }
    };
    
    return toolStatuses[toolName] || { text: "working", color: "#6b6b6b" };
  }

  async executeToolsWithProgress(toolCalls) {
    const results = [];

    for (let index = 0; index < toolCalls.length; index += 1) {
      const call = toolCalls[index];
      
      // Update thinking status based on current tool
      const status = this.getStatusForTool(call.name);
      this.emitToUI("thinking", {
        message: status.text,
        status: "processing",
        color: status.color
      });

      this.emitToUI("tool_pending", {
        name: call.name,
        params: call.parameters,
        progress: `${index + 1}/${toolCalls.length}`,
        status: "pending"
      });

      this.emitToUI("tool_executing", {
        name: call.name,
        status: "running"
      });

      try {
        const tool = this.toolExecutor.tools[call.name];
        if (!tool) {
          throw new Error(`Unknown tool: ${call.name}`);
        }

        const result = await tool(call.parameters || {});

        if (call.name === "readFile" && result.path) {
          this.taskMemory.filesRead.add(result.path);
        }
        if (["writeFile", "applyPatch", "createFile", "editFile"].includes(call.name) && result.path) {
          this.taskMemory.filesModified.add(result.path);
          // Emit writing animation AFTER executing write operations with actual data
          const filePath = result.path || call.parameters?.path || call.parameters?.to || "file";
          this.emitToUI("writing", { 
            file: filePath,
            additions: result.additions || 0,
            deletions: result.deletions || 0,
            status: "complete"
          });
        }

        results.push({ tool: call.name, success: true, result });
        this.emitToUI("tool_success", {
          name: call.name,
          result,
          progress: `${index + 1}/${toolCalls.length}`,
          status: "complete"
        });
      } catch (error) {
        results.push({ tool: call.name, success: false, error: error.message });
        this.emitToUI("tool_error", {
          name: call.name,
          error: error.message,
          status: "error"
        });
      }
    }

    return results;
  }

  async queryModel() {
    await this.resolveActiveModel();

    let lastRawResponse = "";

    for (let attempt = 0; attempt <= this.maxRepairAttempts; attempt += 1) {
      const messages = [
        { role: "system", content: this.getSystemPrompt() },
        ...this.conversationHistory
      ];

      if (attempt > 0) {
        messages.push({
          role: "user",
          content: "Your previous reply was not valid for the required JSON schema. Reply again with only valid JSON following the schema exactly."
        });
      }

      const response = await fetch(`${this.ollamaHost}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.ollamaModel,
          stream: false,
          format: "json",
          options: {
            temperature: 0.1,
            num_predict: 131072,
            stop: []
          },
          messages
        })
      });

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(`Ollama request failed (${response.status}). ${text || "No response body."} Check that Ollama is running and model '${this.ollamaModel}' exists.`);
      }

      const data = await response.json();
      lastRawResponse = data?.message?.content || "";

      const parsed = this.parseModelResponse(lastRawResponse);
      if (parsed) {
        return parsed;
      }
    }

    throw new Error(`Model '${this.ollamaModel}' returned invalid agent JSON. Raw response: ${lastRawResponse.slice(0, 400)}`);
  }

  parseModelResponse(response) {
    if (!response || typeof response !== "string") {
      return null;
    }

    const candidates = [response];
    const fencedMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      candidates.push(fencedMatch[1]);
    }

    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch?.[0]) {
      candidates.push(objectMatch[0]);
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate.trim());
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      } catch (_) {
        // Try to fix truncated JSON
        const fixed = this.attemptFixTruncatedJSON(candidate.trim());
        if (fixed) {
          return fixed;
        }
        continue;
      }
    }

    return null;
  }

  // Attempt to fix truncated/incomplete JSON by adding missing closing braces
  attemptFixTruncatedJSON(jsonStr) {
    try {
      let fixed = jsonStr.trim();
      
      // Handle mid-string truncation - find the last complete property
      // Remove any incomplete property at the end (ends with opening quote but no closing quote)
      const lastCompletePropMatch = fixed.match(/^(.*"[a-z_]+"\s*:\s*(?:"[^"]*"|\[[^\]]*\]|\{[^}]*\}|[^,\s]*))(?:,\s*)?$/s);
      if (lastCompletePropMatch) {
        fixed = lastCompletePropMatch[1];
      }
      
      // If ending mid-string (has opening quote without closing), remove it
      fixed = fixed.replace(/"[^"]*$/s, '');
      // Remove any trailing comma before closing
      fixed = fixed.replace(/,\s*$/s, '');
      
      // Count opening and closing braces/brackets
      const openBraces = (fixed.match(/\{/g) || []).length;
      const closeBraces = (fixed.match(/\}/g) || []).length;
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/\]/g) || []).length;
      
      // Add missing closing braces
      const missingBraces = openBraces - closeBraces;
      const missingBrackets = openBrackets - closeBrackets;
      
      for (let i = 0; i < missingBraces; i++) {
        fixed += '}';
      }
      for (let i = 0; i < missingBrackets; i++) {
        fixed += ']';
      }
      
      // Clean up trailing commas before closing braces/brackets
      fixed = fixed.replace(/,\s*\}/g, '}');
      fixed = fixed.replace(/,\s*\]/g, ']');
      fixed = fixed.replace(/,\s*$/s, '');
      
      const parsed = JSON.parse(fixed);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (e) {
      // Return null if we can't fix it
      console.log("Failed to repair JSON:", e.message);
    }
    return null;
  }

  async fetchAvailableModels() {
    const response = await fetch(`${this.ollamaHost}/api/tags`);
    if (!response.ok) {
      throw new Error(`Unable to load Ollama models (${response.status}).`);
    }

    const data = await response.json();
    return Array.isArray(data.models) ? data.models : [];
  }

  async resolveActiveModel() {
    this.syncModelFromUI();

    const availableModels = await this.fetchAvailableModels();
    if (availableModels.length === 0) {
      throw new Error("No Ollama models found. Pull a model first, for example: ollama pull llama3.1");
    }

    const exactMatch = availableModels.find(model => model.name === this.ollamaModel);
    if (exactMatch) {
      return this.ollamaModel;
    }

    const firstInstalled = availableModels[0].name;
    const previousModel = this.ollamaModel;
    this.ollamaModel = firstInstalled;

    this.emitToUI("fallback", {
      message: `Selected model '${previousModel}' is not installed. Using '${firstInstalled}' from Ollama instead.`
    });

    const selectedModel = document.querySelector(".selected-model-prompt");
    if (selectedModel) {
      selectedModel.textContent = firstInstalled;
    }

    if (typeof window !== "undefined") {
      window.__agentModel = firstInstalled;
    }

    return this.ollamaModel;
  }

  emitToUI(type, data) {
    if (typeof updateAgentUI === "function") {
      updateAgentUI(type, data);
      return;
    }
    console.log(`[Agent ${type}]`, data);
  }
}

class ToolExecutor {
  constructor(agent) {
    this.agent = agent;
    this.workingDirectory = null;
    this.textFileExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".json", ".html", ".css", ".md", ".txt", ".py", ".java", ".c", ".cpp", ".h", ".hpp"]);
    this.ignoredDirectories = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);
    
    // Performance optimizations
    this.fileCache = new Map(); // Cache for file contents: path -> {content, timestamp, size}
    this.cacheMaxSize = 50; // Max cached files
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes TTL
    this.pendingWrites = new Map(); // Batch pending writes
    this.writeDebounceMs = 100; // Debounce writes by 100ms
    
    this.tools = {
      readFile: this.readFileWithCache.bind(this),
      readFiles: this.readFilesBatch.bind(this), // Batch read
      writeFile: this.writeFileWithBatch.bind(this),
      writeFiles: this.writeFilesBatch.bind(this), // Batch write
      editFile: this.editFile.bind(this), // Precise text replacement
      applyPatch: this.applyPatchWithRetry.bind(this), // Retry logic
      clearFileCache: this.clearFileCache.bind(this), // Manual cache clear
      createFile: this.createFile.bind(this),
      deleteFile: this.deleteFile.bind(this),
      moveFile: this.moveFile.bind(this),
      copyFile: this.copyFile.bind(this),
      getFileInfo: this.getFileInfo.bind(this),
      searchFiles: this.searchFiles.bind(this),
      grepSearch: this.grepSearch.bind(this),
      listFiles: this.listFiles.bind(this),
      getFileTree: this.getFileTree.bind(this),
      getSymbols: this.getSymbols.bind(this),
      findReferences: this.findReferences.bind(this),
      validateSyntax: this.validateSyntax.bind(this),
      askUser: this.askUser.bind(this),
      executeTerminal: this.executeTerminal.bind(this)
    };
  }

  setWorkingDirectory(dirHandle, folderPath) {
    this.workingDirectory = dirHandle;
    this.permissionGranted = true;
    // Store the REAL path for terminal commands (e.g., "C:\Users\DELL\Projects\app1")
    if (folderPath) {
      this.workingDirectoryPath = folderPath;
    } else if (dirHandle && dirHandle.path) {
      this.workingDirectoryPath = dirHandle.path;
    } else if (dirHandle && dirHandle.name) {
      this.workingDirectoryPath = dirHandle.name;
    }
  }
  
  async verifyPermission() {
    if (!this.workingDirectory) {
      throw new Error("No folder opened. Click File → Open Folder first.");
    }
    
    // Electron handles don't need permission checks
    if (this.workingDirectory.isElectron) {
      return true;
    }
    
    // Check if we have permission (File System Access API only)
    const options = { mode: 'readwrite' };
    if ((await this.workingDirectory.queryPermission(options)) === 'granted') {
      return true;
    }
    
    // Request permission - this requires user gesture
    if ((await this.workingDirectory.requestPermission(options)) === 'granted') {
      return true;
    }
    
    throw new Error("Permission denied. Please click File → Open Folder and select the project folder again.");
  }

  // Cache management
  getCachedFile(path) {
    const cached = this.fileCache.get(path);
    if (!cached) return null;
    
    // Check TTL
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.fileCache.delete(path);
      return null;
    }
    
    return cached;
  }
  
  setCachedFile(path, content, size) {
    // Evict oldest if cache is full
    if (this.fileCache.size >= this.cacheMaxSize) {
      const oldest = this.fileCache.entries().next().value;
      if (oldest) this.fileCache.delete(oldest[0]);
    }
    
    this.fileCache.set(path, {
      content,
      size,
      timestamp: Date.now()
    });
  }
  
  clearFileCache() {
    this.fileCache.clear();
    return { cleared: true, count: 0 };
  }
  
  // Optimized read with caching - supports offset/limit for partial reads
  async readFileWithCache({ path, offset, limit }) {
    const normalizedPath = this.normalizePath(path);
    
    // Check cache first (only for full reads)
    const cached = this.getCachedFile(normalizedPath);
    if (cached && !offset && !limit) {
      return {
        path: normalizedPath,
        content: cached.content,
        size: cached.size,
        lines: cached.content.split("\n").length,
        cached: true
      };
    }
    
    // Read from disk
    this.ensureWorkingDirectory();
    await this.verifyPermission();
    const fileHandle = await this.getFileHandle(normalizedPath);
    const file = await fileHandle.getFile();
    let content = await file.text();
    
    // Track what was read
    const totalLines = content.split("\n").length;
    let readStart = 1;
    let readEnd = totalLines;
    
    // Apply offset/limit if specified (for partial reads)
    if (offset || limit) {
      const lines = content.split("\n");
      const startLine = Math.max(0, (offset || 1) - 1);
      const endLine = limit ? Math.min(lines.length, startLine + limit) : lines.length;
      content = lines.slice(startLine, endLine).join("\n");
      readStart = startLine + 1;
      readEnd = endLine;
    }
    
    // Cache only full reads
    if (!offset && !limit) {
      this.setCachedFile(normalizedPath, content, file.size);
    }
    
    return {
      path: normalizedPath,
      content,
      size: file.size,
      lines: content.split("\n").length,
      totalLines,
      readRange: offset || limit ? { start: readStart, end: readEnd } : null,
      cached: false
    };
  }
  
  // Batch read multiple files
  async readFilesBatch({ paths }) {
    if (!Array.isArray(paths)) {
      throw new Error("readFilesBatch requires an array of paths");
    }
    
    const results = [];
    const errors = [];
    
    // Read all files in parallel
    await Promise.all(paths.map(async (path) => {
      try {
        const result = await this.readFileWithCache({ path });
        results.push(result);
      } catch (error) {
        errors.push({ path, error: error.message });
      }
    }));
    
    return {
      results,
      errors,
      total: paths.length,
      successful: results.length,
      failed: errors.length
    };
  }
  
  // Legacy readFile - redirects to cached version
  async readFile({ path }) {
    return this.readFileWithCache({ path });
  }

  async writeFile({ path, content, isAI = true }) {
    this.ensureWorkingDirectory();
    await this.verifyPermission();
    const normalizedPath = this.normalizePath(path);
    
    // Check if file exists and get original content for diff
    let isNewFile = false;
    let originalContent = '';
    let originalLines = 0;
    try {
      const handle = await this.getFileHandle(normalizedPath);
      const file = await handle.getFile();
      originalContent = await file.text();
      originalLines = originalContent.split('\n').length;
    } catch {
      isNewFile = true;
    }
    
    const newContent = typeof content === "string" ? content : "";
    const newLines = newContent.split('\n').length;
    
    // Calculate additions and deletions
    const additions = isNewFile ? newLines : Math.max(0, newLines - originalLines);
    const deletions = isNewFile ? 0 : Math.max(0, originalLines - newLines);
    
    const fileHandle = await this.getFileHandle(normalizedPath, { create: true, createDirectories: true });
    const writable = await fileHandle.createWritable();
    await writable.write(newContent);
    await writable.close();
    
    // Track AI modified file
    if (isAI) {
      try {
        const existingIndex = this.aiModifiedFiles.findIndex(f => f.path === normalizedPath);
        if (existingIndex >= 0) {
          this.aiModifiedFiles[existingIndex] = { path: normalizedPath, type: isNewFile ? 'created' : 'edited', content: newContent, originalContent };
        } else {
          this.aiModifiedFiles.push({ path: normalizedPath, type: isNewFile ? 'created' : 'edited', content: newContent, originalContent });
        }
        // Emit file change event with diff info
        this.emitToUI("file_change", {
          path: normalizedPath,
          type: isNewFile ? 'created' : 'edited',
          content: newContent,
          linesAdded: newLines,
          additions,
          deletions,
          aiModifiedFiles: [...this.aiModifiedFiles]
        });
      } catch (trackError) {
        console.error("Error tracking file change:", trackError);
      }
    }
    
    refreshFileExplorer();
    return {
      path: normalizedPath,
      bytesWritten: newContent.length,
      content: newContent,
      isNew: isNewFile,
      additions,
      deletions
    };
  }

  async createFile({ path, content = "" }) {
    return this.writeFile({ path, content });
  }

  // Edit file - precise text replacement (add a dot, change a word, etc.)
  async editFile({ path, oldText, newText, occurrence = 1 }) {
    this.ensureWorkingDirectory();
    await this.verifyPermission();
    
    if (!path || typeof path !== "string") {
      throw new Error("editFile requires a valid path");
    }
    if (typeof oldText !== "string") {
      throw new Error("editFile requires oldText to be a string");
    }
    if (typeof newText !== "string") {
      throw new Error("editFile requires newText to be a string");
    }
    
    const normalizedPath = this.normalizePath(path);
    
    // Read current content
    const file = await this.readFileWithCache({ path: normalizedPath });
    const originalContent = file.content;
    
    // Find and replace the specified occurrence
    let content = originalContent;
    let index = -1;
    let foundCount = 0;
    let searchStart = 0;
    
    while (true) {
      index = content.indexOf(oldText, searchStart);
      if (index === -1) break;
      foundCount++;
      if (foundCount === occurrence) {
        // Replace this occurrence
        content = content.substring(0, index) + newText + content.substring(index + oldText.length);
        break;
      }
      searchStart = index + 1;
    }
    
    if (foundCount === 0) {
      throw new Error(`editFile: Could not find "${oldText}" in ${path}`);
    }
    if (foundCount < occurrence) {
      throw new Error(`editFile: Found ${foundCount} occurrence(s) of "${oldText}", but requested occurrence ${occurrence}`);
    }
    
    // Check if anything actually changed
    if (content === originalContent) {
      return {
        path: normalizedPath,
        description: "No changes needed",
        additions: 0,
        deletions: 0
      };
    }
    
    // Calculate additions and deletions
    const newLines = content.split('\n').length;
    const oldLines = originalContent.split('\n').length;
    const linesAdded = Math.max(0, newLines - oldLines);
    const linesRemoved = Math.max(0, oldLines - newLines);
    
    // Write the file
    await this.writeFile({ path: normalizedPath, content, isAI: true });
    
    return {
      path: normalizedPath,
      description: `Replaced "${oldText}" with "${newText}" (occurrence ${occurrence})`,
      additions: linesAdded,
      deletions: linesRemoved,
      oldText,
      newText,
      occurrence
    };
  }

  // Delete a file from the workspace
  async deleteFile({ path }) {
    this.ensureWorkingDirectory();
    await this.verifyPermission();
    const normalizedPath = this.normalizePath(path);

    // Remove from aiModifiedFiles if present
    this.aiModifiedFiles = this.aiModifiedFiles.filter(f => f.path !== normalizedPath);

    // Remove from cache
    this.fileCache.delete(normalizedPath);

    // Delete via Electron API
    if (window.electronAPI?.deleteFile) {
      const result = await window.electronAPI.deleteFile(normalizedPath);
      if (!result.success) {
        throw new Error(result.error || `Failed to delete ${normalizedPath}`);
      }
    } else {
      // Fallback to File System Access API
      const fileHandle = await this.getFileHandle(normalizedPath);
      await this.workingDirectory.removeEntry(fileHandle.name, { recursive: true });
    }

    this.emitToUI("file_deleted", {
      path: normalizedPath,
      status: "complete"
    });

    refreshFileExplorer();
    return { path: normalizedPath, deleted: true };
  }

  // Move/rename a file
  async moveFile({ from, to }) {
    this.ensureWorkingDirectory();
    await this.verifyPermission();
    const normalizedFrom = this.normalizePath(from);
    const normalizedTo = this.normalizePath(to);

    // Update aiModifiedFiles if present
    const fileIndex = this.aiModifiedFiles.findIndex(f => f.path === normalizedFrom);
    if (fileIndex !== -1) {
      this.aiModifiedFiles[fileIndex].path = normalizedTo;
    }

    // Update cache
    const cached = this.fileCache.get(normalizedFrom);
    if (cached) {
      this.fileCache.delete(normalizedFrom);
      this.fileCache.set(normalizedTo, cached);
    }

    // Move via Electron API
    if (window.electronAPI?.moveFile) {
      const result = await window.electronAPI.moveFile(normalizedFrom, normalizedTo);
      if (!result.success) {
        throw new Error(result.error || `Failed to move ${normalizedFrom} to ${normalizedTo}`);
      }
    } else {
      throw new Error("moveFile not supported in browser mode");
    }

    this.emitToUI("file_moved", {
      from: normalizedFrom,
      to: normalizedTo,
      status: "complete"
    });

    return { from: normalizedFrom, to: normalizedTo, moved: true };
  }

  // Copy a file
  async copyFile({ from, to }) {
    this.ensureWorkingDirectory();
    await this.verifyPermission();
    const normalizedFrom = this.normalizePath(from);
    const normalizedTo = this.normalizePath(to);

    // Copy via Electron API
    if (window.electronAPI?.copyFile) {
      const result = await window.electronAPI.copyFile(normalizedFrom, normalizedTo);
      if (!result.success) {
        throw new Error(result.error || `Failed to copy ${normalizedFrom} to ${normalizedTo}`);
      }
    } else {
      throw new Error("copyFile not supported in browser mode");
    }

    this.emitToUI("file_copied", {
      from: normalizedFrom,
      to: normalizedTo,
      status: "complete"
    });

    return { from: normalizedFrom, to: normalizedTo, copied: true };
  }

  // Get file metadata
  async getFileInfo({ path }) {
    this.ensureWorkingDirectory();
    const normalizedPath = this.normalizePath(path);

    // Get info via Electron API
    if (window.electronAPI?.getFileInfo) {
      const result = await window.electronAPI.getFileInfo(normalizedPath);
      if (!result.success) {
        throw new Error(result.error || `Failed to get info for ${normalizedPath}`);
      }
      return {
        path: normalizedPath,
        size: result.size,
        modified: result.modified,
        created: result.created,
        isDirectory: result.isDirectory,
        permissions: result.permissions
      };
    } else {
      throw new Error("getFileInfo not supported in browser mode");
    }
  }

  // Legacy applyPatch - redirects to retry version
  async applyPatch({ path, diff }) {
    return this.applyPatchWithRetry({ path, diff });
  }

  // Batch write multiple files with debouncing
  async writeFilesBatch({ files }) {
    if (!Array.isArray(files)) {
      throw new Error("writeFilesBatch requires an array of {path, content} objects");
    }
    
    const results = [];
    const errors = [];
    
    // Debounce writes - collect all and write at once
    const writePromises = files.map(async ({ path, content }) => {
      try {
        const result = await this.writeFile({ path, content, isAI: true });
        results.push(result);
      } catch (error) {
        errors.push({ path, error: error.message });
      }
    });
    
    await Promise.all(writePromises);
    
    return {
      results,
      errors,
      total: files.length,
      successful: results.length,
      failed: errors.length
    };
  }
  
  // Optimized single write with cache invalidation
  async writeFileWithBatch({ path, content, isAI = true }) {
    const result = await this.writeFile({ path, content, isAI });
    // Invalidate cache for this file
    const normalizedPath = this.normalizePath(path);
    this.fileCache.delete(normalizedPath);
    return result;
  }
  
  // Apply patch with retry logic for reliability
  async applyPatchWithRetry({ path, diff }, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.ensureWorkingDirectory();
        await this.verifyPermission();
        const normalizedPath = this.normalizePath(path);
        
        // Read with cache bypass to get fresh content
        const original = await this.readFileWithCache({ path: normalizedPath });
        const patched = this.applyUnifiedDiff(original.content, diff, normalizedPath);
        
        // Store original for potential revert
        const originalContent = original.content;
        
        await this.writeFile({ path: normalizedPath, content: patched, isAI: true });
        
        // Invalidate cache
        this.fileCache.delete(normalizedPath);
        
        // Update tracking with original content for revert and new content for preview
        const existingIndex = this.aiModifiedFiles.findIndex(f => f.path === normalizedPath);
        if (existingIndex >= 0) {
          this.aiModifiedFiles[existingIndex].originalContent = originalContent;
          this.aiModifiedFiles[existingIndex].content = patched;
          this.aiModifiedFiles[existingIndex].type = 'edited';
        } else {
          this.aiModifiedFiles.push({ 
            path: normalizedPath, 
            type: 'edited', 
            content: patched, 
            originalContent 
          });
        }
        
        const newLines = patched.split('\n').length;
        const oldLines = originalContent.split('\n').length;
        const linesAdded = Math.max(0, newLines - oldLines);
        const linesRemoved = Math.max(0, oldLines - newLines);
        
        return {
          path: normalizedPath,
          description: "Applied patch",
          bytesWritten: patched.length,
          linesAdded: newLines - oldLines,
          additions: linesAdded,
          deletions: linesRemoved,
          retries: attempt
        };
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
        }
      }
    }
    
    throw lastError;
  }
  
  // Accept all AI changes
  acceptAllChanges() {
    this.aiModifiedFiles = [];
    this.emitToUI("changes_accepted", { message: "All changes accepted" });
  }

  // Revert all AI changes
  async rejectAllChanges() {
    for (const file of this.aiModifiedFiles) {
      if (file.type === 'created') {
        // Delete created file
        try {
          const dirHandle = await this.getDirectoryHandle(file.path.substring(0, file.path.lastIndexOf('/')) || '');
          if (dirHandle && dirHandle.removeEntry) {
            await dirHandle.removeEntry(file.path.split('/').pop());
          }
        } catch (e) {
          console.error('Failed to delete file:', e);
        }
      } else if (file.type === 'edited' && file.originalContent) {
        // Revert to original content
        await this.writeFile({ path: file.path, content: file.originalContent, isAI: false });
      }
    }
    this.aiModifiedFiles = [];
    refreshFileExplorer();
    this.emitToUI("changes_reverted", { message: "All changes reverted" });
  }

  applyUnifiedDiff(originalContent, diff, path) {
    if (typeof diff !== "string" || !diff.trim()) {
      throw new Error(`Empty diff for ${path}`);
    }

    const originalLines = originalContent.split("\n");
    const diffLines = diff.replace(/\r\n/g, "\n").split("\n");
    const resultLines = [...originalLines];
    const hunks = [];
    let currentHunk = null;

    for (const line of diffLines) {
      const headerMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (headerMatch) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        currentHunk = {
          oldStart: Number(headerMatch[1]),
          oldCount: headerMatch[2] ? Number(headerMatch[2]) : 1,
          lines: []
        };
        continue;
      }

      if (!currentHunk) {
        continue;
      }

      if (line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("\\ No newline")) {
        continue;
      }

      currentHunk.lines.push(line);
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    if (hunks.length === 0) {
      throw new Error(`No valid hunks found for ${path}`);
    }

    for (let i = hunks.length - 1; i >= 0; i -= 1) {
      const hunk = hunks[i];
      const startIndex = Math.max(0, hunk.oldStart - 1);
      const expectedOldLines = [];
      const replacementLines = [];

      for (const line of hunk.lines) {
        const prefix = line[0];
        const value = line.slice(1);

        if (prefix === " " || prefix === "-") {
          expectedOldLines.push(value);
        }
        if (prefix === " " || prefix === "+") {
          replacementLines.push(value);
        }
      }

      const actualSlice = resultLines.slice(startIndex, startIndex + expectedOldLines.length);
      if (actualSlice.join("\n") !== expectedOldLines.join("\n")) {
        throw new Error(`Patch context mismatch in ${path} near line ${hunk.oldStart}`);
      }

      resultLines.splice(startIndex, expectedOldLines.length, ...replacementLines);
    }

    return resultLines.join("\n");
  }

  async searchFiles({ query, maxResults = 50 }) {
    this.ensureWorkingDirectory();
    await this.verifyPermission();
    if (typeof query !== "string" || !query.trim()) {
      throw new Error("searchFiles requires a non-empty query");
    }

    const results = [];
    let totalMatches = 0;

    const walk = async (dirHandle, basePath = "") => {
      for await (const [name, handle] of dirHandle.entries()) {
        if (results.length >= maxResults) {
          return;
        }

        const fullPath = basePath ? `${basePath}/${name}` : name;

        if (handle.kind === "directory") {
          if (this.ignoredDirectories.has(name)) {
            continue;
          }
          await walk(handle, fullPath);
          continue;
        }

        if (!this.isTextFile(name)) {
          continue;
        }

        try {
          const file = await handle.getFile();
          const content = await file.text();
          const lines = content.split("\n");
          const matches = [];

          for (let index = 0; index < lines.length; index += 1) {
            if (!lines[index].includes(query)) {
              continue;
            }

            matches.push({
              line: index + 1,
              text: lines[index].trim()
            });
            totalMatches += 1;

            if (matches.length >= maxResults) {
              break;
            }
          }

          if (matches.length > 0) {
            results.push({ path: fullPath, matches });
          }
        } catch (_) {
          continue;
        }
      }
    };

    await walk(this.workingDirectory);
    return { query, results, totalMatches };
  }

  // Grep search with regex pattern matching
  async grepSearch({ pattern, path = "", glob = "*" }) {
    this.ensureWorkingDirectory();
    await this.verifyPermission();
    if (typeof pattern !== "string" || !pattern.trim()) {
      throw new Error("grepSearch requires a non-empty pattern");
    }

    let regex;
    try {
      regex = new RegExp(pattern, "g");
    } catch (e) {
      throw new Error(`Invalid regex pattern: ${e.message}`);
    }

    // Convert glob to regex for file filtering
    const globToRegex = (globPattern) => {
      const escaped = globPattern
        .replace(/\./g, "\\.")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".");
      return new RegExp(escaped + "$", "i");
    };
    const fileRegex = globToRegex(glob);

    const results = [];
    let totalMatches = 0;

    const walk = async (dirHandle, basePath = "") => {
      for await (const [name, handle] of dirHandle.entries()) {
        const fullPath = basePath ? `${basePath}/${name}` : name;

        if (handle.kind === "directory") {
          if (this.ignoredDirectories.has(name)) {
            continue;
          }
          await walk(handle, fullPath);
          continue;
        }

        // Check if file matches glob pattern
        if (!fileRegex.test(name)) {
          continue;
        }

        if (!this.isTextFile(name)) {
          continue;
        }

        try {
          const file = await handle.getFile();
          const content = await file.text();
          const lines = content.split("\n");
          const matches = [];

          for (let index = 0; index < lines.length; index += 1) {
            regex.lastIndex = 0; // Reset regex for each line
            if (!regex.test(lines[index])) {
              continue;
            }

            matches.push({
              line: index + 1,
              text: lines[index].trim()
            });
            totalMatches += 1;
          }

          if (matches.length > 0) {
            results.push({ path: fullPath, matches });
          }
        } catch (_) {
          continue;
        }
      }
    };

    const startPath = path ? await this.getDirectoryHandle(path) : this.workingDirectory;
    await walk(startPath, path);
    return { pattern, glob, results, totalMatches };
  }

  async listFiles({ path = "" }) {
    this.ensureWorkingDirectory();
    await this.verifyPermission();
    const normalizedPath = this.normalizePath(path);
    // If path is empty or ".", use working directory directly
    const dirHandle = (normalizedPath && normalizedPath !== ".") 
      ? await this.getDirectoryHandle(normalizedPath) 
      : this.workingDirectory;
    const entries = [];

    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === "directory" && this.ignoredDirectories.has(name)) {
        continue;
      }
      entries.push({
        name,
        type: handle.kind,
        path: normalizedPath ? `${normalizedPath}/${name}` : name
      });
    }

    entries.sort((a, b) => a.path.localeCompare(b.path));
    return { path: normalizedPath || ".", entries };
  }

  async getFileTree({ path = "", depth = 3 }) {
    this.ensureWorkingDirectory();
    await this.verifyPermission();
    const normalizedPath = this.normalizePath(path);
    
    // If path is empty or ".", use working directory directly
    const rootHandle = (normalizedPath && normalizedPath !== ".") 
      ? await this.getDirectoryHandle(normalizedPath) 
      : this.workingDirectory;

    const buildTree = async (dirHandle, currentPath, currentDepth) => {
      if (currentDepth > depth) {
        return [];
      }

      const nodes = [];
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === "directory" && this.ignoredDirectories.has(name)) {
          continue;
        }

        const fullPath = currentPath ? `${currentPath}/${name}` : name;
        if (handle.kind === "directory") {
          nodes.push({
            name,
            type: "directory",
            path: fullPath,
            children: await buildTree(handle, fullPath, currentDepth + 1)
          });
        } else {
          nodes.push({
            name,
            type: "file",
            path: fullPath
          });
        }
      }

      nodes.sort((a, b) => a.path.localeCompare(b.path));
      return nodes;
    };

    return {
      path: normalizedPath || ".",
      tree: await buildTree(rootHandle, normalizedPath, 0)
    };
  }

  async getSymbols({ path }) {
    const { content } = await this.readFile({ path });
    const symbols = [];
    const lines = content.split("\n");
    const patterns = [
      { type: "function", regex: /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g },
      { type: "class", regex: /\bclass\s+([A-Za-z_$][\w$]*)\b/g },
      { type: "const", regex: /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g },
      { type: "method", regex: /\b([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?\(/g }
    ];

    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(line)) !== null) {
          symbols.push({
            type: pattern.type,
            name: match[1],
            line: index + 1
          });
        }
      }
    });

    return { path: this.normalizePath(path), symbols, count: symbols.length };
  }

  async findReferences({ symbol, path }) {
    const search = await this.searchFiles({ query: symbol, maxResults: 100 });
    const normalizedPath = this.normalizePath(path);
    const references = search.results.filter(result => result.path !== normalizedPath);
    return {
      symbol,
      definition: normalizedPath,
      references,
      totalReferences: references.length
    };
  }

  async validateSyntax({ path, content }) {
    const normalizedPath = this.normalizePath(path);
    const text = typeof content === "string" ? content : (await this.readFile({ path: normalizedPath })).content;
    const issues = [];
    const extension = this.getExtension(normalizedPath);

    if (extension === ".json") {
      try {
        JSON.parse(text);
      } catch (error) {
        issues.push({ type: "error", message: error.message });
      }
    } else if ([".js", ".jsx", ".ts", ".tsx"].includes(extension)) {
      try {
        // eslint-disable-next-line no-new-func
        new Function(text);
      } catch (error) {
        issues.push({ type: "error", message: error.message });
      }
    } else {
      const openBraces = (text.match(/\{/g) || []).length;
      const closeBraces = (text.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        issues.push({ type: "warning", message: "Brace count does not match." });
      }
    }

    return {
      path: normalizedPath,
      valid: issues.length === 0,
      issues,
      stats: {
        lines: text.split("\n").length,
        characters: text.length
      }
    };
  }

  async askUser({ question }) {
    const answer = prompt(question || "Provide input");
    return { question, answer };
  }

  async executeTerminal({ command, reason, cwd }) {
    if (!command || typeof command !== "string") {
      throw new Error("Command is required and must be a string");
    }
    
    // Get working directory path - prioritize loaded folder, only use provided cwd if explicitly different
    // This ensures commands run in the opened project folder, not the AI's directory
    const workingDir = this.workingDirectoryPath || cwd || process.cwd();
    
    // Emit UI event to show command is pending approval FIRST
    this.agent.emitToUI("terminal_command", {
      command,
      reason: reason || "Executing terminal command",
      cwd: workingDir,
      status: "pending_approval"
    });
    
    // Check if we have a working directory
    if (!this.workingDirectory) {
      const error = {
        success: false,
        error: "No folder opened. Click File → Open Folder first.",
        command,
        stdout: "",
        stderr: ""
      };
      this.agent.emitToUI("terminal_command", {
        command,
        status: "error",
        result: error
      });
      return error;
    }
    
    // Request approval via Electron IPC
    let approval;
    try {
      if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.requestCommandApproval) {
        approval = await window.electronAPI.requestCommandApproval({
          command,
          reason: reason || "AI wants to execute a terminal command",
          cwd: workingDir
        });
      } else {
        // Fallback for non-Electron environment
        const approved = confirm(`Allow command: ${command}\n\nReason: ${reason || "No reason provided"}`);
        approval = { approved, timeout: null }; // No timeout
      }
    } catch (err) {
      // If IPC fails, reject the command for safety
      return {
        success: false,
        error: "Command approval system unavailable",
        command,
        stdout: "",
        stderr: ""
      };
    }
    
    if (!approval || !approval.approved) {
      this.agent.emitToUI("terminal_command", {
        command,
        status: "rejected"
      });
      return {
        success: false,
        error: "Command rejected by user",
        command,
        stdout: "",
        stderr: ""
      };
    }
    
    // Execute the command
    this.agent.emitToUI("terminal_command", {
      command,
      status: "executing"
    });
    
    try {
      let result;
      if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.executeTerminal) {
        result = await window.electronAPI.executeTerminal({
          command,
          cwd: workingDir,
          timeout: approval.timeout // No default - runs until completion
        });
      } else {
        // Fallback for non-Electron - can't execute
        const isGitCommand = command.trim().startsWith('git ');
        return {
          success: false,
          error: isGitCommand 
            ? "Git commands require Electron mode. Run: npm run electron"
            : "Terminal execution not available in browser mode. Run: npm run electron",
          command,
          stdout: "",
          stderr: "BROWSER MODE: Commands cannot execute. Use the terminal panel to manually copy-paste commands."
        };
      }
      
      this.agent.emitToUI("terminal_command", {
        command,
        status: "completed",
        result
      });
      
      return {
        success: result.success,
        command,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        error: result.error
      };
    } catch (err) {
      this.agent.emitToUI("terminal_command", {
        command,
        status: "error",
        error: err.message
      });
      
      return {
        success: false,
        error: err.message,
        command,
        stdout: "",
        stderr: ""
      };
    }
  }

  ensureWorkingDirectory() {
    if (!this.workingDirectory) {
      throw new Error("No folder opened. Click File → Open Folder first.");
    }
  }

  normalizePath(path) {
    if (typeof path !== "string") {
      return "";
    }
    return path.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/^\/+/, "").trim();
  }

  getExtension(path) {
    const match = this.normalizePath(path).match(/(\.[^.\/]+)$/);
    return match ? match[1].toLowerCase() : "";
  }

  isTextFile(name) {
    return this.textFileExtensions.has(this.getExtension(name));
  }

  async getFileHandle(path, options = {}) {
    const normalizedPath = this.normalizePath(path);
    if (!normalizedPath) {
      throw new Error("Invalid file path");
    }

    const parts = normalizedPath.split("/").filter(Boolean);
    const fileName = parts.pop();
    let currentDir = this.workingDirectory;

    for (const part of parts) {
      currentDir = await currentDir.getDirectoryHandle(part, { create: Boolean(options.createDirectories) });
    }

    return currentDir.getFileHandle(fileName, { create: Boolean(options.create) });
  }

  async getDirectoryHandle(path) {
    const normalizedPath = this.normalizePath(path);
    const parts = normalizedPath.split("/").filter(Boolean);
    let currentDir = this.workingDirectory;

    for (const part of parts) {
      currentDir = await currentDir.getDirectoryHandle(part);
    }

    return currentDir;
  }
}

function updateAgentUI(action, details) {
  if (typeof createAgentLogEntry === "function" && typeof addMessageToChat === "function") {
    const message = createAgentLogEntry(action, details);
    if (message) {
      addMessageToChat("agent", message);
    }
    return;
  }

  console.log("Agent:", action, details);
}

// Debounced file explorer refresh to prevent rapid updates
let fileExplorerRefreshTimeout = null;
const FILE_EXPLORER_REFRESH_DELAY = 150; // 150ms debounce

// Full refresh - rebuilds file tree from disk then renders
async function refreshFileExplorerFull() {
  // Clear existing timeout
  if (fileExplorerRefreshTimeout) {
    clearTimeout(fileExplorerRefreshTimeout);
  }
  
  fileExplorerRefreshTimeout = setTimeout(async () => {
    // Rebuild file tree from disk if we have a directory handle
    if (typeof fileExplorerState !== 'undefined' && fileExplorerState.directoryHandle && typeof buildFileTree === 'function') {
      try {
        const newTree = await buildFileTree(fileExplorerState.directoryHandle);
        fileExplorerState.fileTree = newTree;
      } catch (e) {
        console.error('Failed to rebuild file tree:', e);
      }
    }
    
    // Render the explorer
    if (typeof renderFileExplorer === 'function') {
      renderFileExplorer();
    }
    fileExplorerRefreshTimeout = null;
  }, FILE_EXPLORER_REFRESH_DELAY);
}

// Simple render refresh (legacy compatibility)
function refreshFileExplorer() {
  refreshFileExplorerFull();
}

// Immediate refresh for when you need it right away
function refreshFileExplorerImmediate() {
  if (fileExplorerRefreshTimeout) {
    clearTimeout(fileExplorerRefreshTimeout);
    fileExplorerRefreshTimeout = null;
  }
  
  // Rebuild file tree from disk
  if (typeof fileExplorerState !== 'undefined' && fileExplorerState.directoryHandle && typeof buildFileTree === 'function') {
    buildFileTree(fileExplorerState.directoryHandle).then(newTree => {
      fileExplorerState.fileTree = newTree;
      if (typeof renderFileExplorer === 'function') {
        renderFileExplorer();
      }
    }).catch(e => console.error('Failed to rebuild file tree:', e));
  } else if (typeof renderFileExplorer === 'function') {
    renderFileExplorer();
  }
}

const aiAgent = new AIAgent();
window.AIAgent = AIAgent;
window.aiAgent = aiAgent;
