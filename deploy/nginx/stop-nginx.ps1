$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$nginxExe = Join-Path $repo ".local\nginx\nginx.exe"

if (Test-Path $nginxExe) {
    Push-Location (Split-Path $nginxExe)
    try {
        & $nginxExe -s quit
    } finally {
        Pop-Location
    }
}
