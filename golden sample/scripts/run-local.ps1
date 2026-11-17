# Windows PowerShell 5.1 compatible. Keep console messages ASCII for cmd.exe.
[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 5173,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Receive-File {
    param([string]$Uri, [string]$Destination)

    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $Destination -TimeoutSec 180
            return
        }
        catch {
            if ($attempt -eq 3) { throw }
            Write-Host 'Tai file chua thanh cong. Dang thu lai...'
            Start-Sleep -Seconds 2
        }
    }
}

try {
    if ($PSVersionTable.PSVersion -lt [version]'5.1') {
        throw 'Can Windows PowerShell 5.1 tro len (co san tren Windows 10/11).'
    }

    $projectRoot = Split-Path -Parent $PSScriptRoot
    Set-Location -LiteralPath $projectRoot
    foreach ($requiredFile in @('package.json', 'package-lock.json', 'vite.config.ts')) {
        if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $requiredFile))) {
            throw "Thieu $requiredFile. Hay giai nen/copy TOAN BO thu muc du an truoc khi chay."
        }
    }

    $processor = $env:PROCESSOR_ARCHITECTURE
    if ($env:PROCESSOR_ARCHITEW6432) { $processor = $env:PROCESSOR_ARCHITEW6432 }
    switch ($processor) {
        'AMD64' { $architecture = 'x64' }
        'ARM64' { $architecture = 'arm64' }
        default { throw 'Chi ho tro Windows 10/11 ban 64-bit (Intel/AMD hoac ARM64).' }
    }

    $runtimeRoot = Join-Path $projectRoot '.runtime'
    $nodeRoot = Join-Path $runtimeRoot "node-win-$architecture"
    New-Item -ItemType Directory -Path $nodeRoot -Force | Out-Null
    $nodeMarker = Join-Path $nodeRoot 'current.txt'
    $nodeExecutable = $null
    if (Test-Path -LiteralPath $nodeMarker) {
        $nodeFolder = (Get-Content -LiteralPath $nodeMarker -Raw).Trim()
        if ($nodeFolder -match "^node-v24\.\d+\.\d+-win-$architecture$") {
            $nodeDirectory = Join-Path $nodeRoot $nodeFolder
            $candidate = Join-Path $nodeDirectory 'node.exe'
            $npmCandidate = Join-Path $nodeDirectory 'node_modules\npm\bin\npm-cli.js'
            if ((Test-Path -LiteralPath $candidate) -and (Test-Path -LiteralPath $npmCandidate)) {
                try {
                    $cachedVersion = & $candidate --version
                    if ($LASTEXITCODE -eq 0 -and $cachedVersion -match '^v24\.\d+\.\d+$') {
                        $nodeExecutable = $candidate
                    }
                }
                catch { $nodeExecutable = $null }
            }
        }
    }

    if (-not $nodeExecutable) {
        Write-Host "Lan dau: dang tai Node.js portable cho Windows $architecture..."
        Write-Host 'Khong can cai Node.js thu cong hay quyen Administrator.'
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        $checksumsPath = Join-Path $nodeRoot 'SHASUMS256.txt'
        Receive-File 'https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt' $checksumsPath
        $checksums = Get-Content -LiteralPath $checksumsPath -Raw
        $entry = [regex]::Match($checksums, "(?m)^([a-fA-F0-9]{64})\s+(node-(v24\.\d+\.\d+)-win-$architecture\.zip)\s*$")
        if (-not $entry.Success) { throw 'Khong tim thay ban Node.js phu hop tu nodejs.org.' }

        $archiveName = $entry.Groups[2].Value
        $nodeVersion = $entry.Groups[3].Value
        $archivePath = Join-Path $nodeRoot $archiveName
        Receive-File "https://nodejs.org/dist/$nodeVersion/$archiveName" $archivePath
        if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $entry.Groups[1].Value) {
            throw 'File Node.js tai ve bi loi (SHA256 khong khop). Hay chay lai run.bat.'
        }

        Write-Host 'Dang giai nen Node.js...'
        Expand-Archive -LiteralPath $archivePath -DestinationPath $nodeRoot -Force
        $nodeFolder = $archiveName.Substring(0, $archiveName.Length - 4)
        $nodeDirectory = Join-Path $nodeRoot $nodeFolder
        $nodeExecutable = Join-Path $nodeDirectory 'node.exe'
        $installedVersion = & $nodeExecutable --version
        if ($LASTEXITCODE -ne 0 -or $installedVersion -ne $nodeVersion) {
            throw 'Node.js portable khong chay duoc tren may nay.'
        }
        Set-Content -LiteralPath $nodeMarker -Value $nodeFolder -Encoding ASCII
        Remove-Item -LiteralPath $archivePath
    }

    # Use our own Node/npm even when the system has no Node or an older version.
    $env:PATH = "$nodeDirectory;$env:PATH"
    $npmCli = Join-Path $nodeDirectory 'node_modules\npm\bin\npm-cli.js'
    $nodeVersion = & $nodeExecutable --version
    Write-Host "Dang dung Node.js $nodeVersion ($architecture)."

    # Reinstall when this folder moves to another machine/path or dependencies change.
    $installIdentity = @(
        $env:COMPUTERNAME
        $projectRoot
        $architecture
        $nodeVersion
        (Get-FileHash -LiteralPath (Join-Path $projectRoot 'package.json') -Algorithm SHA256).Hash
        (Get-FileHash -LiteralPath (Join-Path $projectRoot 'package-lock.json') -Algorithm SHA256).Hash
    ) -join '|'
    $installMarker = Join-Path $runtimeRoot 'dependencies.txt'
    $viteCli = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
    $needsInstall = -not (Test-Path -LiteralPath $viteCli)
    if (-not (Test-Path -LiteralPath $installMarker)) {
        $needsInstall = $true
    }
    elseif ((Get-Content -LiteralPath $installMarker -Raw).Trim() -ne $installIdentity) {
        $needsInstall = $true
    }

    if ($needsInstall) {
        Write-Host 'Dang cai thu vien dung phien ban cua du an. Lan dau co the mat vai phut...'
        if (Test-Path -LiteralPath $installMarker) { Remove-Item -LiteralPath $installMarker }
        $npmCache = Join-Path ([IO.Path]::GetTempPath()) 'helpdesk-harmony-npm-cache'
        for ($installAttempt = 1; $installAttempt -le 3; $installAttempt++) {
            & $nodeExecutable $npmCli ci --include=dev --include=optional --ignore-scripts=false --offline=false --prefer-offline --prefer-online=false --cache $npmCache --registry=https://registry.npmjs.org --no-audit --no-fund
            if ($LASTEXITCODE -eq 0) { break }
            if ($installAttempt -lt 3) {
                Write-Host 'Cai dat chua xong (mang hoac file dang ban). Dang thu lai...'
                Start-Sleep -Seconds 3
            }
        }
        if ($LASTEXITCODE -ne 0) {
            throw 'Cai thu vien that bai. Kiem tra mang va dong cua so web cu cua du an, roi chay lai.'
        }
        Set-Content -LiteralPath $installMarker -Value $installIdentity -Encoding UTF8
    }

    Write-Host ''
    Write-Host 'Dang khoi dong web. Neu cong ban dau ban, web se tu chon cong trong.'
    Write-Host 'Giu cua so nay mo khi dung web. Nhan Ctrl+C de dung.'
    $viteArguments = @($viteCli, 'dev', '--host', '127.0.0.1', '--port', "$Port")
    if (-not $NoBrowser) { $viteArguments += '--open' }
    & $nodeExecutable @viteArguments
    exit $LASTEXITCODE
}
catch {
    Write-Host ''
    Write-Host "Khong the chay web: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Lan dau can Internet de tai Node.js va thu vien tu nodejs.org / registry.npmjs.org.'
    exit 1
}
