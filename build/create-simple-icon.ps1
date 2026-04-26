# Create a simple icon for Ceres AI Agent
# This script creates a basic icon.ico from the SVG

$ErrorActionPreference = "Stop"

Write-Host "Creating Ceres AI Agent icon..." -ForegroundColor Green

$assetsDir = Join-Path $PSScriptRoot "..\assets"
$iconPath = Join-Path $assetsDir "icon.ico"

# Check if icon already exists
if (Test-Path $iconPath) {
    Write-Host "Icon already exists at: $iconPath" -ForegroundColor Yellow
    exit 0
}

# Try to use ImageMagick if available
$magick = Get-Command "magick" -ErrorAction SilentlyContinue
if ($magick) {
    Write-Host "Found ImageMagick, creating icon..." -ForegroundColor Green
    $svgPath = Join-Path $assetsDir "icon.svg"
    & magick convert $svgPath $iconPath
    if (Test-Path $iconPath) {
        Write-Host "✓ Icon created successfully!" -ForegroundColor Green
        exit 0
    }
}

# Try to use Inkscape if available
$inkscape = Get-Command "inkscape" -ErrorAction SilentlyContinue
if ($inkscape) {
    Write-Host "Found Inkscape, creating icon..." -ForegroundColor Green
    $svgPath = Join-Path $assetsDir "icon.svg"
    $pngPath = Join-Path $assetsDir "icon-256.png"
    & inkscape $svgPath --export-filename=$pngPath --export-width=256 --export-height=256
    if (Test-Path $pngPath) {
        Write-Host "✓ PNG exported, convert to ICO using online tool" -ForegroundColor Yellow
        Write-Host "  Visit: https://cloudconvert.com/png-to-ico" -ForegroundColor Cyan
    }
}

# Create a simple placeholder using .NET
Write-Host "Creating placeholder icon using .NET..." -ForegroundColor Yellow

try {
    Add-Type -AssemblyName System.Drawing
    
    $bitmap = New-Object System.Drawing.Bitmap(256, 256)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # Background gradient simulation
    $graphics.Clear([System.Drawing.Color]::FromArgb(59, 130, 246))
    
    # Draw a simple "C" or code symbol
    $font = New-Object System.Drawing.Font("Consolas", 120, [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $graphics.DrawString("<>", $font, $brush, 10, 40)
    
    # Save as PNG first (ICO is complex in .NET without libraries)
    $pngPath = Join-Path $assetsDir "icon-256.png"
    $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $bitmap.Dispose()
    $font.Dispose()
    $brush.Dispose()
    
    Write-Host "✓ Created icon-256.png" -ForegroundColor Green
    Write-Host "" -ForegroundColor White
    Write-Host "NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "  1. Convert icon-256.png to icon.ico using:" -ForegroundColor White
    Write-Host "     https://cloudconvert.com/png-to-ico" -ForegroundColor Cyan
    Write-Host "  2. Save the icon.ico to: assets\icon.ico" -ForegroundColor White
    Write-Host "" -ForegroundColor White
    
} catch {
    Write-Host "Could not create icon: $_" -ForegroundColor Red
    Write-Host "" -ForegroundColor White
    Write-Host "Please manually convert assets\icon.svg to icon.ico" -ForegroundColor Yellow
}

Write-Host "" -ForegroundColor White
Write-Host "Icon creation complete!" -ForegroundColor Green
