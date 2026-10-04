param([Parameter(Mandatory=$true)][string]$ExecutablePath)
$ErrorActionPreference = 'Stop'
$executable = (Resolve-Path -LiteralPath $ExecutablePath).Path
$previousPath = $env:PATH
$previousNodeMode = $env:ELECTRON_RUN_AS_NODE
$started = Get-Date
try {
    # Verify the packaged runtime without a system Node or Bun on PATH.
    $env:PATH = "$env:SystemRoot\System32;$env:SystemRoot"
    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    $process = Start-Process -FilePath $executable -ArgumentList '--smoke-test' -WorkingDirectory (Split-Path $executable) -WindowStyle Hidden -PassThru
    if (-not $process.WaitForExit(60000)) {
        Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
        throw 'Desktop smoke timed out.'
    }
    if ($process.ExitCode -ne 0) { throw "Desktop smoke failed with exit code $($process.ExitCode)." }
    $reportPath = Join-Path $env:APPDATA 'foundry-translator\desktop-smoke.json'
    if ((Get-Item -LiteralPath $reportPath).LastWriteTime -lt $started) { throw 'Smoke report is stale.' }
    $report = Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($report.bridge -ne 'function' -or $report.node -ne 'undefined' -or -not $report.nativeSelectors -or -not $report.invalidPayloadRejected) { throw 'Desktop assertions failed.' }
    Write-Output 'PASS: packaged renderer, native bridge, payload rejection and bundled runtime without Node on PATH.'
} finally {
    $env:PATH = $previousPath
    if ($null -eq $previousNodeMode) { Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue }
    else { $env:ELECTRON_RUN_AS_NODE = $previousNodeMode }
}
