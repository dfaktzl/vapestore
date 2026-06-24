# ==========================================================================
# OZCHEAPVAPES AUTO-PUSH ENGINE (FileSystem Watcher for config.json)
# ==========================================================================
# Instructions:
# 1. Open PowerShell inside the project directory.
# 2. Run: .\watch_and_push.ps1
# 3. This script will run in the background. Whenever you export and overwrite
#    config.json from the admin panel, this script will automatically add, commit,
#    and push the updated file to your GitHub repository (dfaktzl/vapestore).
# ==========================================================================

$folder = Get-Location
$filter = "*.json"

Write-Host "=============================================" -ForegroundColor Gold
Write-Host "  OzCheapVapes Git Auto-Push Agent Active" -ForegroundColor Gold
Write-Host "=============================================" -ForegroundColor Gold
Write-Host "Watching for changes to config.json & orders.json in: $folder" -ForegroundColor Cyan
Write-Host "Keep this window open to automate git pushes." -ForegroundColor DarkGray
Write-Host "Press Ctrl+C to terminate." -ForegroundColor Yellow

# Create FileSystemWatcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $folder
$watcher.Filter = $filter
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true

# Action block on change
$action = {
    $path = $Event.SourceEventArgs.FullPath
    $fileName = Split-Path $path -Leaf
    
    if ($fileName -ne "config.json" -and $fileName -ne "orders.json") {
        return
    }
    
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Detected change in $fileName" -ForegroundColor Yellow
    
    # Wait for write completion
    Start-Sleep -Seconds 1
    
    try {
        Write-Host "Running Git automation..." -ForegroundColor Gray
        git add config.json
        if (Test-Path "orders.json") {
            git add orders.json
        }
        git commit -m "update: $fileName updated via merchant panel"
        git push
        Write-Host "Successfully committed and pushed to GitHub!" -ForegroundColor Green
    }
    catch {
        Write-Host "Git push failed. Ensure repository exists and credentials are configured." -ForegroundColor Red
        Write-Host $_ -ForegroundColor Red
    }
    Write-Host "Watching for changes..." -ForegroundColor Cyan
}

# Register Object Event
$watcherEvent = Register-ObjectEvent $watcher "Changed" -Action $action

# Infinite loop to keep PowerShell running
while ($true) {
    Start-Sleep -Seconds 1
}
