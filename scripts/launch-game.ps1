param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$projectPath = Split-Path $PSScriptRoot -Parent
$gameUrl = 'http://127.0.0.1:5173/dungeon.html'
$logPath = Join-Path $projectPath 'outputs'

function Test-GameServer {
    try {
        $page = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 2
        return $page.StatusCode -eq 200 -and $page.Content.Contains('/src/app/entry.js')
    } catch { return $false }
}

$launchLock = [Threading.Mutex]::new($false, 'Local\ChessDungeonsLauncher')
$locked = $false
try {
    $locked = $launchLock.WaitOne(45000)
    if (-not $locked) { throw 'Another game launch is still in progress. Try again shortly.' }
    if (-not (Test-GameServer)) {
        if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) {
            throw 'Port 5173 is occupied by another application. Close it and try again.'
        }
        $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
        $vitePath = Join-Path $projectPath 'node_modules/vite/bin/vite.js'
        if (-not (Test-Path -LiteralPath $vitePath)) { throw 'Game dependencies are missing. Run npm install in the project folder.' }
        New-Item -ItemType Directory -Path $logPath -Force | Out-Null
        $server = Start-Process -FilePath $nodePath -ArgumentList @(('"' + $vitePath + '"'), '--host', '127.0.0.1', '--port', '5173', '--strictPort') -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logPath 'local-server.log') -RedirectStandardError (Join-Path $logPath 'local-server-error.log') -PassThru
        $deadline = [DateTime]::UtcNow.AddSeconds(30)
        while (-not (Test-GameServer)) {
            if ($server.HasExited) { throw 'The local server could not start. See outputs/local-server-error.log.' }
            if ([DateTime]::UtcNow -gt $deadline) { throw 'The local server did not become ready within 30 seconds.' }
            Start-Sleep -Milliseconds 200
        }
    }
    if (-not $NoBrowser) { Start-Process $gameUrl }
    Write-Output "Ready: $gameUrl"
} catch {
    if ($NoBrowser) { throw }
    Add-Type -AssemblyName PresentationFramework
    [Windows.MessageBox]::Show($_.Exception.Message, 'Chess Dungeons', 'OK', 'Error') | Out-Null
    exit 1
} finally {
    if ($locked) { $launchLock.ReleaseMutex() }
    $launchLock.Dispose()
}
