$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$nginxHome = Join-Path $repo ".local\nginx"
$nginxExe = Join-Path $nginxHome "nginx.exe"
$sourceConf = Join-Path $repo "deploy\nginx\nginx.conf"
$targetConf = Join-Path $nginxHome "conf\nginx.conf"
$frontendRoot = (Join-Path $repo "src\main\resources\static").Replace("\", "/")

if (!(Test-Path $nginxExe)) {
    throw "未找到 $nginxExe，请先下载并解压 Nginx 到 .local\nginx。"
}

$conf = Get-Content $sourceConf -Raw
$conf = $conf.Replace("__FRONTEND_ROOT__", $frontendRoot)
Set-Content -Path $targetConf -Value $conf -Encoding ASCII

Push-Location $nginxHome
try {
    $running = Get-Process nginx -ErrorAction SilentlyContinue
    if ($running) {
        & $nginxExe -s reload
    } else {
        Start-Process -FilePath $nginxExe -WorkingDirectory $nginxHome -WindowStyle Hidden
    }
} finally {
    Pop-Location
}

# $localIps = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -ExpandProperty IPAddress -Unique)
# Write-Host "Nginx frontend:"
Write-Host "  本机访问: http://localhost:8081"
# foreach ($ip in $localIps) {
#     Write-Host "  局域网访问: http://${ip}:8081"
# }
