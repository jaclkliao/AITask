$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..")
$logDir = Join-Path $repo "logs"
if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
}

$mvn = "mvn"
$mvnCmd = Get-Command mvn.cmd -ErrorAction SilentlyContinue
if ($mvnCmd) {
    $mvn = $mvnCmd.Source
}

Start-Process -FilePath $mvn `
    -ArgumentList "spring-boot:run" `
    -WorkingDirectory $repo `
    -RedirectStandardOutput (Join-Path $logDir "backend.log") `
    -RedirectStandardError (Join-Path $logDir "backend.err.log") `
    -WindowStyle Hidden

Write-Host "Backend starting: http://localhost:8080"
