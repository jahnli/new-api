param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('release', 'electron')]
    [string]$Target
)

$ErrorActionPreference = 'Stop'
$buildVersion = (Get-Content -LiteralPath VERSION -Raw).Trim()
$env:GOWORK = 'off'
$env:CGO_ENABLED = '1'
$env:GOOS = 'windows'
$env:GOARCH = 'amd64'
$env:CC = 'gcc'

# Native commands do not consistently throw on Windows PowerShell failures.
function Invoke-BuildCommand {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed with exit code $LASTEXITCODE"
    }
}

Invoke-BuildCommand go @('mod', 'download')
$moduleDirectory = & go list -m -f '{{.Dir}}' github.com/MoeForge/moejs
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve the moejs PGO profile' }
$pgo = Join-Path $moduleDirectory 'default.pgo'
New-Item -ItemType Directory -Force -Path release-assets | Out-Null
$binary = "release-assets/ai-gateway-windows-amd64-$buildVersion.exe"
if ($Target -eq 'electron') { $binary = 'ai-gateway.exe' }
Invoke-BuildCommand go @('build', "-pgo=$pgo", '-ldflags', "-s -w -X github.com/QuantumNous/new-api/common.Version=$buildVersion", '-o', $binary)

if ($Target -eq 'electron') {
    Push-Location electron
    try {
        $electronVersion = $buildVersion -replace '^v', ''
        if ($electronVersion -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$') {
            $packageVersion = (Get-Content -LiteralPath package.json -Raw | ConvertFrom-Json).version
            $baseVersion = ($packageVersion -split '[-+]')[0]
            $electronVersion = "$baseVersion-git.$env:CI_COMMIT_SHORT_SHA"
        }
        Invoke-BuildCommand npm @('version', $electronVersion, '--no-git-tag-version', '--allow-same-version')
        # Match the existing GitHub workflow; the checked-in Electron locks lag package.json.
        Invoke-BuildCommand npm @('install')
        Invoke-BuildCommand npm @('run', 'build:win', '--', '--publish', 'never')
    }
    finally {
        Pop-Location
    }
    $installers = @(Get-ChildItem -Path electron/dist/*.exe -File)
    if ($installers.Count -eq 0) { throw 'Electron produced no Windows installers' }
    # GitLab's Generic Package Registry rejects spaces in package filenames.
    foreach ($installer in $installers) {
        $assetName = $installer.Name -replace '[^A-Za-z0-9_.+-]', '-'
        $destination = Join-Path 'release-assets' $assetName
        if (Test-Path -LiteralPath $destination) { throw "Duplicate release asset: $assetName" }
        Copy-Item -LiteralPath $installer.FullName -Destination $destination
    }
    Copy-Item -LiteralPath LICENSE, NOTICE, THIRD-PARTY-LICENSES.md -Destination release-assets
}

$checksumName = 'checksums-windows.txt'
if ($Target -eq 'electron') { $checksumName = 'checksums-electron.txt' }
$checksums = Get-ChildItem -Path release-assets/*.exe -File | Sort-Object Name | ForEach-Object {
    $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $($_.Name)"
}
$checksums | Set-Content -LiteralPath "release-assets/$checksumName" -Encoding ascii
