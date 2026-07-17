[CmdletBinding()]
param(
  [string]$Version,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$OfficialInstallerUrl = "https://claude.ai/install.ps1"
if ([string]::IsNullOrWhiteSpace($Version)) {
  $Version = if ($env:CLAUDE_CODE_VERSION) { $env:CLAUDE_CODE_VERSION } else { "latest" }
}

function Throw-InstallError {
  param([string]$Message)
  throw "Claude Code installer failed: $Message"
}

function Add-ClaudeBinToPath {
  $userHome = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
  $claudeBin = Join-Path $userHome ".local\bin"
  $claudeExe = Join-Path $claudeBin "claude.exe"

  if ((Test-Path -LiteralPath $claudeExe) -and ($env:PATH -notlike "*$claudeBin*")) {
    $env:PATH = "$claudeBin;$env:PATH"
  }
}

if ($Version -ne "latest" -and $Version -ne "stable" -and $Version -notmatch "^\d+(\.\d+){2,}$") {
  Throw-InstallError "version must be latest, stable, or a numeric dotted version."
}

if ($DryRun) {
  Write-Host "Claude Code installer dry run"
  Write-Host "Official installer URL: $OfficialInstallerUrl"
  Write-Host "Release: $Version"
  Write-Host "Would install/update Claude Code: yes"
  Write-Host "Would modify Claude Code configuration: no"
  exit 0
}

$temporaryInstaller = Join-Path $env:TEMP "eggdoc-claude-code-$([guid]::NewGuid()).ps1"

try {
  Write-Host "Installing or updating Claude Code from Anthropic..."
  try {
    Invoke-WebRequest -Uri $OfficialInstallerUrl -OutFile $temporaryInstaller -UseBasicParsing
  } catch {
    Throw-InstallError "could not download the Anthropic installer: $($_.Exception.Message) Check network and region availability."
  }

  $installerSource = Get-Content -LiteralPath $temporaryInstaller -Raw
  if ([string]::IsNullOrWhiteSpace($installerSource)) {
    Throw-InstallError "the Anthropic installer response was empty."
  }
  if ($installerSource.TrimStart().StartsWith("<")) {
    Throw-InstallError "the Anthropic installer returned HTML instead of a script. Check network and region availability."
  }

  $installer = [scriptblock]::Create($installerSource)
  $global:LASTEXITCODE = 0
  & $installer $Version
  $installerExitCode = $LASTEXITCODE
  if ($installerExitCode -ne 0) {
    Throw-InstallError "the Anthropic installer exited with code $installerExitCode."
  }
} finally {
  Remove-Item -LiteralPath $temporaryInstaller -Force -ErrorAction SilentlyContinue
}

Add-ClaudeBinToPath
$claudeCommand = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claudeCommand) {
  Throw-InstallError "Claude Code was installed, but claude is not on PATH. Restart PowerShell and run claude --version."
}

$versionOutput = & $claudeCommand.Source --version
if ($LASTEXITCODE -ne 0) {
  Throw-InstallError "claude --version failed after installation."
}

Write-Host "Done: Claude Code is installed."
Write-Host $versionOutput
