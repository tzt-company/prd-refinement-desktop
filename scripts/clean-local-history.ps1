param(
  [switch]$Check,
  [ValidateSet('All', 'AcceptanceRuntime', 'LegacyBuild', 'UserData')]
  [string]$Scope = 'All'
)

$ErrorActionPreference = 'Stop'
$workspaceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$userDataRoot = Join-Path $env:APPDATA 'prd-refinement-desktop'

$workspaceTargets = @(
  'docs\tmp',
  '.codex-init-probe', '.codex-live-probe', '.codex-live-probe-2',
  '.codex-probe', '.codex-probe-2', '.codex-probe-3',
  '.e2e-ilcd', '.e2e-ilcd-v2', '.e2e-ilcd-v3', '.e2e-ilcd-v4',
  '.e2e-ilcd-v5', '.e2e-ilcd-v6', '.e2e-ilcd-v8', '.e2e-ilcd-v10',
  '.e2e-ilcd-v11', '.e2e-ilcd-v12',
  '.runtime-adapter-probe', '.runtime-probe', '.runtime-test-evidence-flow',
  '.runtime-test-scheduler', '.runtime-test-scheduler-17',
  '.tmp-diff-contract-0913', '.unified-runtime-e2e', 'test-results',
  'dist', 'dist-electron', 'dist-release', 'premium-audit.json',
  'docs\acceptance\material-bundle-index\round-4\premium-audit.json',
  'docs\acceptance\unified-analysis-input\round-1\premium-audit.json'
) | ForEach-Object { Join-Path $workspaceRoot $_ }

$acceptanceRoot = Join-Path $workspaceRoot 'docs\acceptance'
$generatedDirectoryNames = @(
  'profile', 'user-data', 'drop-user-data', 'ui-test-data',
  'electron-profile', 'runtime', 'package-fixture', 'portable-copy'
)
$acceptanceTargets = if (Test-Path -LiteralPath $acceptanceRoot) {
  @(Get-ChildItem -LiteralPath $acceptanceRoot -Recurse -Directory -Force | Where-Object {
    $_.Name -in $generatedDirectoryNames
  } | Select-Object -ExpandProperty FullName)
} else { @() }

$userDataTargets = @(
  'analysis-tasks', 'materials', 'projects', 'material-vision',
  'runtime-probe', 'validation-pipeline12'
) | ForEach-Object { Join-Path $userDataRoot $_ }

function Assert-ChildPath([string]$Root, [string]$Target) {
  $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
  $targetFull = [System.IO.Path]::GetFullPath($Target).TrimEnd('\')
  if ($targetFull -eq $rootFull -or -not $targetFull.StartsWith($rootFull + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "拒绝处理边界外路径：$targetFull"
  }
  $targetFull
}

function Measure-Target([string]$Root, [string]$Target, [string]$Kind) {
  $resolved = Assert-ChildPath $Root $Target
  $exists = Test-Path -LiteralPath $resolved
  $files = if ($exists) { @(Get-ChildItem -LiteralPath $resolved -Recurse -File -Force -ErrorAction Stop) } else { @() }
  [pscustomobject]@{
    kind = $Kind
    path = $resolved
    exists = $exists
    files = $files.Count
    bytes = [long](($files | Measure-Object Length -Sum).Sum)
  }
}

$processes = @(Get-CimInstance Win32_Process | Where-Object {
  $_.ProcessId -ne $PID -and (
  $_.Name -in @('electron.exe', '需求细化平台.exe') -or
  ($_.CommandLine -and $_.CommandLine.Contains($workspaceRoot, [System.StringComparison]::OrdinalIgnoreCase))
  )
})
if ($processes.Count) {
  throw "检测到本项目仍有运行进程：$($processes.ProcessId -join ', ')"
}

$targets = @(
  $workspaceTargets | ForEach-Object { Measure-Target $workspaceRoot $_ 'workspace' }
  $acceptanceTargets | ForEach-Object { Measure-Target $acceptanceRoot $_ 'acceptance-runtime' }
  if (Test-Path -LiteralPath $userDataRoot) {
    $resolvedUserDataRoot = (Resolve-Path -LiteralPath $userDataRoot).Path
    $userDataTargets | ForEach-Object { Measure-Target $resolvedUserDataRoot $_ 'user-data' }
  }
)
if ($Scope -eq 'LegacyBuild') {
  $legacyBuildRoot = Join-Path $workspaceRoot 'dist-release'
  $targets = @($targets | Where-Object { $_.path -eq $legacyBuildRoot })
} elseif ($Scope -eq 'AcceptanceRuntime') {
  $targets = @($targets | Where-Object { $_.kind -eq 'acceptance-runtime' })
} elseif ($Scope -eq 'UserData') {
  $targets = @($targets | Where-Object { $_.kind -eq 'user-data' })
}

$targets | ConvertTo-Json -Depth 3
if ($Check) { exit 0 }

$failures = @()
foreach ($target in $targets | Where-Object exists) {
  try {
    Remove-Item -LiteralPath $target.path -Recurse -Force
  } catch {
    $failures += [pscustomobject]@{ path = $target.path; error = $_.Exception.Message }
  }
}

$remaining = @($targets | Where-Object { Test-Path -LiteralPath $_.path })
if ($remaining.Count) {
  $failures | ConvertTo-Json -Depth 3
  throw "清理后仍存在目标：$($remaining.path -join ', ')"
}
Write-Output "清理完成：$($targets.Count) 个受控目标均不存在。"
