param(
    [string]$WorkspaceFolder = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

function Get-SevenZipExecutable {
    $sevenZipPaths = @(
        "7z",
        "C:\Program Files\7-Zip\7z.exe",
        "C:\Program Files (x86)\7-Zip\7z.exe"
    )

    foreach ($path in $sevenZipPaths) {
        if (Get-Command $path -ErrorAction SilentlyContinue) {
            return $path
        }
    }

    return $null
}

function Compress-GzipFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem

    $gzipPath = "$FilePath.gz"
    if (Test-Path $gzipPath) {
        Remove-Item $gzipPath -Force
    }

    $inputStream = [System.IO.File]::OpenRead($FilePath)
    try {
        $outputStream = [System.IO.File]::Create($gzipPath)
        try {
            $gzipStream = New-Object System.IO.Compression.GzipStream($outputStream, [System.IO.Compression.CompressionLevel]::Optimal)
            try {
                $inputStream.CopyTo($gzipStream)
            }
            finally {
                $gzipStream.Dispose()
            }
        }
        finally {
            $outputStream.Dispose()
        }
    }
    finally {
        $inputStream.Dispose()
    }
}

function Optimize-ThemeAssets {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ThemeRoot
    )

    $assetFiles = Get-ChildItem -Path $ThemeRoot -Recurse -File |
        Where-Object {
            ($_.Extension -in @('.css', '.js')) -and
            ($_.Name -notmatch '\.min\.(css|js)$')
        }

    foreach ($file in $assetFiles) {
        # Safe minify-lite pass: normalize CRLF and collapse repeated blank lines.
        $original = Get-Content -Path $file.FullName -Raw
        $normalized = $original -replace "`r?`n", "`n"
        $normalized = $normalized -replace "(`n){3,}", "`n`n"
        $normalized = $normalized -replace "`n", "`r`n"

        if ($normalized -ne $original) {
            $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText($file.FullName, $normalized, $utf8NoBom)
        }

        Compress-GzipFile -FilePath $file.FullName
    }
}

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

    $stagingRoot = Join-Path $distDir ".build-staging"
    $stagingThemeDir = Join-Path $stagingRoot "eventostri-calendar"

    if (Test-Path $stagingRoot) {
        Remove-Item -Path $stagingRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null

    Copy-Item -Path $themeDir -Destination $stagingRoot -Recurse -Force

    # Preserve previous artifact shape by excluding parts from deployment zip.
    $partsPath = Join-Path $stagingThemeDir "parts"
    if (Test-Path $partsPath) {
        Remove-Item -Path $partsPath -Recurse -Force
    }

    Write-Host "Running pre-zip asset optimization on staging copy..."
    Optimize-ThemeAssets -ThemeRoot $stagingThemeDir
    
    # Backup existing zip with timestamp
    if (Test-Path $zipPath) {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $backupName = "eventostri-calendar-backup-$timestamp.zip"
        Rename-Item -Path $zipPath -NewName $backupName
        Write-Host "Backed up: $backupName"
    }
    
    $sevenZipExe = Get-SevenZipExecutable
    
    if ($sevenZipExe) {
        Write-Host "Using 7-Zip to create archive..."
        
        # Remove old zip
        if (Test-Path $zipPath) {
            Remove-Item $zipPath -Force
        }
        
        # Use 7-Zip: a = add to archive, -tzip = zip format, -r = recurse
        $maxRetries = 3
        $attempt = 0
        
        while ($attempt -lt $maxRetries) {
            $attempt++
            try {
                & $sevenZipExe a -tzip "$zipPath" "$stagingThemeDir" -r | Out-Null
                
                if (Test-Path $zipPath) {
                    Write-Host "Created: $zipPath"
                    if (Test-Path $stagingRoot) {
                        Remove-Item -Path $stagingRoot -Recurse -Force
                    }
                    exit 0
                }
                else {
                    throw "Zip file was not created"
                }
            }
            catch {
                if ($attempt -lt $maxRetries) {
                    Write-Host "Attempt $attempt failed, retrying..."
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
