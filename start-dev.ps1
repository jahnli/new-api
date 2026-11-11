$ErrorActionPreference = 'Stop'

try {
    foreach ($command in @('wt.exe', 'go.exe', 'bun.exe')) {
        Get-Command $command -CommandType Application -ErrorAction Stop | Out-Null
    }

    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'web/dist/index.html'))) {
        throw 'Frontend build missing. Run bun install and bun run build in web/ before starting the Go backend.'
    }

    $shell = (Get-Command powershell.exe -CommandType Application -ErrorAction Stop).Source
    $terminalArgs = @(
        # Reuse the shared development window, or create it if it is closed.
        '-w', 'local-dev',
        'new-tab', '--title', 'AI Gateway Backend', '--suppressApplicationTitle',
        '-d', $PSScriptRoot,
        $shell, '-NoLogo', '-NoExit', '-Command', 'go run .',
        ';',
        'new-tab', '--title', 'AI Gateway Frontend', '--suppressApplicationTitle',
        '-d', (Join-Path $PSScriptRoot 'web'),
        $shell, '-NoLogo', '-NoExit', '-Command', 'bun dev'
    )

    & wt.exe @terminalArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Windows Terminal exited with code $LASTEXITCODE."
    }
} catch {
    Write-Host $_ -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}
