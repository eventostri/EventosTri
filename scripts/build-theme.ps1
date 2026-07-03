param(
    [string]$WorkspaceFolder = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

try {
    # Determine site root
    $siteRoot = ""
    $candidateA = Join-Path $WorkspaceFolder "eventostri.org"
    $candidateB = $WorkspaceFolder
    
    if (Test-Path (Join-Path $candidateA "eventostri-calendar")) {
        $siteRoot = $candidateA
    }
    elseif (Test-Path (Join-Path $candidateB "eventostri-calendar")) {
        $siteRoot = $candidateB
    }
    else {
        throw "Theme folder not found under: $WorkspaceFolder"
    }
    
    $themeDir = Join-Path $siteRoot "eventostri-calendar"
    $distDir = Join-Path $siteRoot "dist"
    New-Item -ItemType Directory -Force -Path $distDir | Out-Null
    
    $zipPath = Join-Path $distDir "eventostri-calendar.zip"
    
    # Backup existing zip with timestamp
    if (Test-Path $zipPath) {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $backupName = "eventostri-calendar-backup-$timestamp.zip"
        Rename-Item -Path $zipPath -NewName $backupName
        Write-Host "Backed up: $backupName"
    }
    
    # Use 7-Zip from PATH or common locations
    $sevenZipPaths = @(
        "7z",
        "C:\Program Files\7-Zip\7z.exe",
        "C:\Program Files (x86)\7-Zip\7z.exe"
    )
    
    $sevenZipExe = $null
    foreach ($path in $sevenZipPaths) {
        if (Get-Command $path -ErrorAction SilentlyContinue) {
            $sevenZipExe = $path
            break
        }
    }
    
    if ($sevenZipExe) {
        Write-Host "Using 7-Zip to create archive..."
        
        # Remove old zip
        if (Test-Path $zipPath) {
            Remove-Item $zipPath -Force
        }
        
        # Use 7-Zip: a = add to archive, -tzip = zip format, -r = recurse, -x!parts = exclude parts folder
        $maxRetries = 3
        $attempt = 0
        
        while ($attempt -lt $maxRetries) {
            $attempt++
            try {
                & $sevenZipExe a -tzip "$zipPath" "$themeDir" -r -x!parts | Out-Null
                
                if (Test-Path $zipPath) {
                    Write-Host "Created: $zipPath"
                    exit 0
                }
                else {
                    throw "Zip file was not created"
                }
            }
            catch {
                if ($attempt -lt $maxRetries) {
                    Write-Host "Attempt $attempt failed, retrying in 2s..."
                    Start-Sleep -Seconds 2
                }
                else {
                    throw $_
                }
            }
        }
    }
    else {
        throw "7-Zip is not installed. Please install 7-Zip from https://www.7-zip.org/"
    }
}
catch {
    Write-Error $_
    exit 1
}
