[CmdletBinding()]
param(
  [string]$BaseUrl,
  [Alias("SkKey")]
  [string]$Sk_Key,
  [ValidateSet("zh-cn", "en-us")]
  [string]$Language,
  [string]$CodexPackage = "Codex",
  [switch]$EggAi,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$DefaultBaseUrl = "https://api.eggai.icu/v1"
if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  $BaseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { $DefaultBaseUrl }
}
if ([string]::IsNullOrWhiteSpace($Sk_Key)) {
  $Sk_Key = if ($env:SK_KEY) { $env:SK_KEY } else { $env:EGGAI_API_KEY }
}
if ([string]::IsNullOrWhiteSpace($Language)) {
  $Language = if ($env:LANGUAGE) { $env:LANGUAGE } else { "zh-cn" }
}
$EggAiMode = $EggAi.IsPresent

function Write-Step {
  param([string]$Key)

  switch ($Key) {
    "winget" { Write-Host "Checking Windows winget environment..." }
    "install" { Write-Host "Installing or updating Codex with winget..." }
    "fallback" { Write-Host "Using the official Codex CLI installer to make the CLI available..." }
    "config" { Write-Host "Writing EggAi Codex configuration..." }
    "login" { Write-Host "Writing Codex API key login cache..." }
    "done" { Write-Host "Done: Codex is installed." }
    "eggai-done" { Write-Host "Done: Codex is installed and configured to use EggAi." }
    default { Write-Host $Key }
  }
}

function Throw-InstallError {
  param([string]$Message)
  throw "EggAi Codex installer failed: $Message"
}

function Get-WingetCommand {
  Get-Command winget -ErrorAction SilentlyContinue
}

function Add-CodexBinToPath {
  $codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
  $codexBin = Join-Path $codexHome "bin"
  $codexExe = Join-Path $codexBin "codex.exe"

  if ((Test-Path -LiteralPath $codexExe) -and ($env:PATH -notlike "*$codexBin*")) {
    $env:PATH = "$codexBin;$env:PATH"
  }
}

function Repair-Winget {
  $existing = Get-WingetCommand
  if ($existing) {
    try {
      & $existing.Source source reset --force | Out-Null
      & $existing.Source source update | Out-Null
    } catch {
      Write-Warning "winget exists, but source repair failed: $($_.Exception.Message)"
    }
    return Get-WingetCommand
  }

  try {
    $installer = Join-Path $env:TEMP "Microsoft.DesktopAppInstaller.msixbundle"
    Invoke-WebRequest -Uri "https://aka.ms/getwinget" -OutFile $installer
    Add-AppxPackage -Path $installer
  } catch {
    try {
      Start-Process "ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1" | Out-Null
    } catch {
      # The explicit error below is more useful than a nested Store protocol error.
    }
    Throw-InstallError "winget was not found and automatic App Installer repair failed. Install or repair App Installer from Microsoft Store, then run this script again."
  }

  Get-WingetCommand
}

function ConvertTo-TomlString {
  param([string]$Value)
  '"' + $Value.Replace('\', '\\').Replace('"', '\"') + '"'
}

function Get-DeveloperInstructions {
  if ($Language -eq "zh-cn") {
    [System.Text.Encoding]::UTF8.GetString(
      [System.Convert]::FromBase64String("6K+36buY6K6k5L2/55So566A5L2T5Lit5paH5Zue562U77yM6Zmk6Z2e55So5oi35piO56Gu6KaB5rGC5YW25LuW6K+t6KiA44CC")
    )
  } else {
    "Respond in English by default unless the user explicitly asks for another language."
  }
}

function Write-DryRunPlan {
  param(
    [string]$ConfigFile,
    [string]$ProviderBaseUrl,
    [string]$Instructions
  )

  $winget = Get-WingetCommand
  Add-CodexBinToPath
  $codex = Get-Command codex -ErrorAction SilentlyContinue

  Write-Host "Codex installer dry run"
  Write-Host "Mode: $(if ($EggAiMode) { 'eggai' } else { 'default' })"
  Write-Host "Codex package: $CodexPackage"
  Write-Host "Codex home: $(Split-Path -Parent $ConfigFile)"
  Write-Host "Official fallback installer: https://chatgpt.com/codex/install.ps1"
  Write-Host ""
  Write-Host "Windows scenario check:"

  if ($winget) {
    Write-Host "- winget exists: yes ($($winget.Source))"
    Write-Host "- winget missing repair path: not needed in this run"
  } else {
    Write-Host "- winget exists: no"
    Write-Host "- winget missing repair path: would download https://aka.ms/getwinget and try Add-AppxPackage"
    Write-Host "- winget repair failure path: would open Microsoft Store App Installer page and stop with a clear error"
  }

  if ($codex) {
    Write-Host "- Codex command exists: yes ($($codex.Source))"
    Write-Host "- Codex install/update path: would run winget upgrade when Microsoft Store package is found"
  } else {
    Write-Host "- Codex command exists: no"
    Write-Host "- Codex install path: would run winget install, then official PowerShell installer if codex is still unavailable"
  }

  Write-Host ""
  Write-Host "Would install/update Codex: yes"
  if (-not $EggAiMode) {
    Write-Host "Would write config.toml: no"
    Write-Host "Would run codex login --with-api-key: no"
    return
  }

  Write-Host "Config file: $ConfigFile"
  Write-Host "Backup file: $ConfigFile.eggai.bak"
  Write-Host "Base URL: $ProviderBaseUrl"
  Write-Host "Language: $Language"
  if ([string]::IsNullOrWhiteSpace($Sk_Key)) {
    Write-Host "API key: missing"
  } else {
    Write-Host "API key: provided (redacted)"
  }
  Write-Host "Would write config.toml: yes"
  Write-Host "Would run codex login --with-api-key: yes"
  Write-Host "Managed config preview:"
  Write-Host "# >>> eggai-codex"
  Write-Host "# Managed by EggDoc's EggAi Codex installer."
  Write-Host 'cli_auth_credentials_store = "file"'
  Write-Host 'model_provider = "eggai"'
  Write-Host "developer_instructions = $(ConvertTo-TomlString $Instructions)"
  Write-Host "# <<< eggai-codex"
  Write-Host ""
  Write-Host "[model_providers.eggai]"
  Write-Host 'name = "EggAi"'
  Write-Host "base_url = $(ConvertTo-TomlString $ProviderBaseUrl)"
  Write-Host 'wire_api = "responses"'
  Write-Host 'requires_openai_auth = true'
}

function Update-CodexConfig {
  param(
    [string]$ConfigFile,
    [string]$ProviderBaseUrl,
    [string]$Instructions
  )

  $configDir = Split-Path -Parent $ConfigFile
  New-Item -ItemType Directory -Force -Path $configDir | Out-Null

  if (-not (Test-Path -LiteralPath $ConfigFile)) {
    New-Item -ItemType File -Path $ConfigFile | Out-Null
  }

  $backupFile = "$ConfigFile.eggai.bak"
  Copy-Item -LiteralPath $ConfigFile -Destination $backupFile -Force

  $content = Get-Content -LiteralPath $ConfigFile -Raw
  $content = [regex]::Replace($content, "(?ms)^# >>> eggai-codex\r?\n.*?^# <<< eggai-codex\r?\n?", "")

  $lines = $content -split "\r?\n"
  $kept = New-Object System.Collections.Generic.List[string]
  $inEggAiProvider = $false
  $seenTable = $false

  foreach ($line in $lines) {
    if ($line -match "^\s*\[model_providers\.eggai\]\s*$") {
      $inEggAiProvider = $true
      $seenTable = $true
      continue
    }

    if ($line -match "^\s*\[") {
      $inEggAiProvider = $false
      $seenTable = $true
    }

    if ($inEggAiProvider) {
      continue
    }

    if (-not $seenTable -and $line -match "^\s*(cli_auth_credentials_store|developer_instructions|model_provider)\s*=") {
      continue
    }

    $kept.Add($line)
  }

  $rootBlock = @(
    "# >>> eggai-codex",
    "# Managed by EggDoc's EggAi Codex installer.",
    "cli_auth_credentials_store = `"file`"",
    "model_provider = `"eggai`"",
    "developer_instructions = $(ConvertTo-TomlString $Instructions)",
    "# <<< eggai-codex",
    ""
  )

  $providerBlock = @(
    "",
    "[model_providers.eggai]",
    "name = `"EggAi`"",
    "base_url = $(ConvertTo-TomlString $ProviderBaseUrl)",
    "wire_api = `"responses`"",
    "requires_openai_auth = true"
  )

  $newContent = ($rootBlock + $kept + $providerBlock) -join [Environment]::NewLine
  Set-Content -LiteralPath $ConfigFile -Value $newContent -Encoding UTF8

  return $backupFile
}

if ($EggAiMode -and $Language -ne "zh-cn" -and $Language -ne "en-us") {
  Throw-InstallError "language must be zh-cn or en-us."
}

if ($EggAiMode -and $BaseUrl -notmatch "^https?://") {
  Throw-InstallError "baseurl must start with http:// or https://."
}

$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$configFile = Join-Path $codexHome "config.toml"

if ($DryRun) {
  Write-DryRunPlan -ConfigFile $configFile -ProviderBaseUrl $BaseUrl -Instructions (Get-DeveloperInstructions)
  exit 0
}

if ($EggAiMode -and [string]::IsNullOrWhiteSpace($Sk_Key)) {
  Throw-InstallError "sk-key is required with EggAi mode. Set SK_KEY, EGGAI_API_KEY, or pass -SkKey."
}

Write-Step "winget"
$winget = Repair-Winget
if (-not $winget) {
  Throw-InstallError "winget is still unavailable after repair."
}

Write-Step "install"
$listOutput = & $winget.Source list $CodexPackage -s msstore 2>$null
if ($LASTEXITCODE -eq 0 -and ($listOutput -join "`n") -match [regex]::Escape($CodexPackage)) {
  & $winget.Source upgrade $CodexPackage -s msstore --accept-source-agreements --accept-package-agreements
} else {
  & $winget.Source install $CodexPackage -s msstore --accept-source-agreements --accept-package-agreements
}

Add-CodexBinToPath
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
  Write-Step "fallback"
  if (-not $env:CODEX_NON_INTERACTIVE) {
    $env:CODEX_NON_INTERACTIVE = "1"
  }
  Invoke-Expression (Invoke-RestMethod "https://chatgpt.com/codex/install.ps1")
}

Add-CodexBinToPath
$codexCommand = Get-Command codex -ErrorAction SilentlyContinue
if (-not $codexCommand) {
  Throw-InstallError "Codex was installed, but the codex command is not on PATH. Restart PowerShell and retry."
}

if (-not $EggAiMode) {
  Write-Step "done"
  exit 0
}

Write-Step "config"
$backup = Update-CodexConfig -ConfigFile $configFile -ProviderBaseUrl $BaseUrl -Instructions (Get-DeveloperInstructions)

Write-Step "login"
$Sk_Key | & $codexCommand.Source login --with-api-key | Out-Null
& $codexCommand.Source login status | Out-Null

Write-Step "eggai-done"
Write-Host "Config: $configFile"
Write-Host "Backup: $backup"
