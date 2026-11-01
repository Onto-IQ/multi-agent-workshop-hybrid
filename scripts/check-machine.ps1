# Machine check for the Registry Insight workshop (Windows PowerShell).
# Confirms Claude Code, OpenCode, Node, and DuckDB.
# Confirms OPENROUTER_API_KEY is set without printing it.
# Confirms ANTHROPIC_API_KEY is empty.
#
#   powershell -ExecutionPolicy Bypass -File scripts/check-machine.ps1

$ErrorActionPreference = 'Continue'
Set-Location (Split-Path -Parent $PSScriptRoot)

$script:Problems = 0

function Ok([string]$Message) { Write-Output "OK   | $Message" }
function Warn([string]$Message) { Write-Output "WARN | $Message" }
function Bad([string]$Message) {
  $script:Problems += 1
  Write-Output "FAIL | $Message"
}

function Get-DottedVersion([string]$Text) {
  if ($Text -match '(\d+)\.(\d+)\.(\d+)') {
    return [version]::new([int]$Matches[1], [int]$Matches[2], [int]$Matches[3])
  }
  return $null
}

function Get-ToolLine([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) { return $null }
  $output = & $Name --version 2>&1 | Select-Object -First 1
  return [string]$output
}

$nodeLine = Get-ToolLine 'node'
if (-not $nodeLine) {
  Bad 'node is not on PATH'
} else {
  $nodeVer = Get-DottedVersion $nodeLine
  if ($nodeVer -and $nodeVer -ge [version]'20.0.0') { Ok "node $nodeLine" }
  else { Bad "node $nodeLine is below 20" }
}

$claudeLine = Get-ToolLine 'claude'
if (-not $claudeLine) {
  Bad 'claude is not on PATH. Install @anthropic-ai/claude-code and log in with the class account.'
} else {
  $claudeVer = Get-DottedVersion $claudeLine
  if (-not $claudeVer) { Bad 'claude is on PATH but the version was not recognized' }
  elseif ($claudeVer -ge [version]'2.1.296') { Ok "claude $claudeLine" }
  else { Bad "claude $($claudeVer.ToString()) is below 2.1.296. Run: claude update" }
}

$opencodeLine = Get-ToolLine 'opencode'
if (-not $opencodeLine) { Bad 'opencode is not on PATH. See the course SETUP.md' }
else { Ok "opencode $opencodeLine" }

$duckLine = Get-ToolLine 'duckdb'
if (-not $duckLine) {
  Warn 'duckdb is not on PATH. Install the DuckDB CLI before Lab 05. This warning does not fail the check.'
} else {
  Ok "duckdb $duckLine"
}

$anthropic = [Environment]::GetEnvironmentVariable('ANTHROPIC_API_KEY')
if (-not [string]::IsNullOrWhiteSpace($anthropic)) {
  Bad 'ANTHROPIC_API_KEY is set. Unset it so the class Claude account is used. Value not printed.'
} else {
  Ok 'ANTHROPIC_API_KEY is empty'
}

$openrouter = [Environment]::GetEnvironmentVariable('OPENROUTER_API_KEY')
if ([string]::IsNullOrWhiteSpace($openrouter)) {
  Bad 'OPENROUTER_API_KEY is empty. Set the key from the training center in your user environment. Never commit it.'
} elseif ($openrouter.Length -ge 20) {
  Ok "OPENROUTER_API_KEY is set ($($openrouter.Length) characters, value hidden)"
} else {
  Bad "OPENROUTER_API_KEY looks too short ($($openrouter.Length) characters, value hidden)"
}

if ($script:Problems -gt 0) {
  Write-Output "check-machine: $($script:Problems) problem(s)"
  exit 1
}

Write-Output 'check-machine: passed'
