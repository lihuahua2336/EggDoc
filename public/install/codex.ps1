[CmdletBinding()]
param(
  [string]$BaseUrl,
  [Alias("SkKey")]
  [string]$Sk_Key,
  [ValidateSet("zh-cn", "en-us")]
  [string]$Language,
  [string]$Model,
  [Alias("CodexPackageId")]
  [string]$CodexPackage,
  [switch]$EggAi,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$DefaultBaseUrl = "https://api.eggai.icu/v1"
$OfficialInstallerUrl = if ($env:CODEX_INSTALLER_URL) { $env:CODEX_INSTALLER_URL } else { "https://chatgpt.com/codex/install.ps1" }
if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  $BaseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { $DefaultBaseUrl }
}
if ([string]::IsNullOrWhiteSpace($Sk_Key)) {
  $Sk_Key = if ($env:SK_KEY) { $env:SK_KEY } else { $env:EGGAI_API_KEY }
}
if ([string]::IsNullOrWhiteSpace($Language)) {
  $Language = if ($env:LANGUAGE) { $env:LANGUAGE } else { "zh-cn" }
}
if ([string]::IsNullOrWhiteSpace($Model)) {
  $Model = if ($env:MODEL) { $env:MODEL } else { $env:CODEX_MODEL }
}
if ([string]::IsNullOrWhiteSpace($CodexPackage)) {
  $CodexPackage = $env:CODEX_PACKAGE_ID
}
$EggAiMode = $EggAi.IsPresent

function Write-Step {
  param([string]$Key)

  switch ($Key) {
    "winget" { Write-Host "Installing or updating Codex with an exact winget package ID..." }
    "official" { Write-Host "Installing or updating Codex with the official Codex CLI installer..." }
    "config" { Write-Host "Writing EggAi Codex configuration..." }
    "env" { Write-Host "Saving EggAi API key for provider-scoped authentication..." }
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

function Get-TemporaryDirectory {
  $temporaryDirectory = if (-not [string]::IsNullOrWhiteSpace($env:TEMP)) {
    $env:TEMP
  } elseif (-not [string]::IsNullOrWhiteSpace($env:TMP)) {
    $env:TMP
  } else {
    [IO.Path]::GetTempPath()
  }
  New-Item -ItemType Directory -Force -Path $temporaryDirectory | Out-Null
  $temporaryDirectory
}

function Get-CodexBinCandidates {
  $codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
  $userHome = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
  @(
    if ($env:CODEX_INSTALL_DIR) {
      $env:CODEX_INSTALL_DIR
    }
    if ($env:LOCALAPPDATA) {
      Join-Path $env:LOCALAPPDATA "Programs\OpenAI\Codex\bin"
      Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links"
    }
    (Join-Path $codexHome "bin")
    (Join-Path $userHome ".local\bin")
    (Join-Path $userHome "bin")
  )
}

function Test-CodexBinaryDirectory {
  param([string]$Directory)
  foreach ($fileName in @("codex.exe", "codex.cmd", "codex.ps1", "codex")) {
    if (Test-Path -LiteralPath (Join-Path $Directory $fileName)) {
      return $true
    }
  }
  return $false
}

function Add-CodexBinToPath {
  $binCandidates = Get-CodexBinCandidates

  $pathEntries = @($env:PATH -split ";" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  foreach ($codexBin in $binCandidates) {
    if (-not (Test-CodexBinaryDirectory $codexBin)) {
      continue
    }
    $alreadyPresent = $pathEntries | Where-Object {
      $_.TrimEnd("\") -ieq $codexBin.TrimEnd("\")
    }
    if (-not $alreadyPresent) {
      $env:PATH = "$codexBin;$env:PATH"
    }
    break
  }
}

function Install-CodexWithOfficialInstaller {
  $temporaryInstaller = Join-Path (Get-TemporaryDirectory) "eggdoc-codex-$([guid]::NewGuid()).ps1"
  try {
    try {
      Invoke-WebRequest -Uri $OfficialInstallerUrl -OutFile $temporaryInstaller -UseBasicParsing
    } catch {
      Throw-InstallError "could not download the official Codex installer: $($_.Exception.Message)"
    }

    $installerSource = Get-Content -LiteralPath $temporaryInstaller -Raw
    if ([string]::IsNullOrWhiteSpace($installerSource)) {
      Throw-InstallError "the official Codex installer response was empty."
    }
    if ($installerSource.TrimStart().StartsWith("<")) {
      Throw-InstallError "the official Codex installer returned HTML instead of a script. Check network and region availability."
    }

    if (-not $env:CODEX_NON_INTERACTIVE) {
      $env:CODEX_NON_INTERACTIVE = "1"
    }
    try {
      $installer = [scriptblock]::Create($installerSource)
      $global:LASTEXITCODE = 0
      & $installer
      $installerExitCode = $LASTEXITCODE
      if ($installerExitCode -ne 0) {
        Throw-InstallError "the official Codex installer exited with code $installerExitCode."
      }
    } catch {
      if ($_.Exception.Message -like "EggAi Codex installer failed:*") {
        throw
      }
      Throw-InstallError "could not execute the official Codex installer: $($_.Exception.Message)"
    }
  } finally {
    Remove-Item -LiteralPath $temporaryInstaller -Force -ErrorAction SilentlyContinue
  }
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

  $winget = if ([string]::IsNullOrWhiteSpace($CodexPackage)) { $null } else { Get-WingetCommand }
  Add-CodexBinToPath
  $codex = Get-Command codex -ErrorAction SilentlyContinue

  Write-Host "Codex installer dry run"
  Write-Host "Mode: $(if ($EggAiMode) { 'eggai' } else { 'default' })"
  Write-Host "Codex package ID: $(if ($CodexPackage) { $CodexPackage } else { 'not specified' })"
  Write-Host "Codex home: $(Split-Path -Parent $ConfigFile)"
  Write-Host "Official installer: $OfficialInstallerUrl"
  Write-Host ""
  Write-Host "Windows scenario check:"

  if ([string]::IsNullOrWhiteSpace($CodexPackage)) {
    Write-Host "- Codex install/update path: would use the official PowerShell installer directly"
  } elseif ($winget) {
    Write-Host "- winget exists: yes ($($winget.Source))"
    Write-Host "- Codex install/update path: would use --id $CodexPackage --exact"
    Write-Host "- winget failure path: official installer fallback is available"
  } else {
    Write-Host "- winget exists: no"
    Write-Host "- Codex install/update path: would use the official PowerShell installer fallback"
  }
  Write-Host "- Codex command exists: $(if ($codex) { "yes ($($codex.Source))" } else { 'no' })"

  Write-Host ""
  Write-Host "Would install/update Codex: yes"
  if (-not $EggAiMode) {
    Write-Host "Would write config.toml: no"
    Write-Host "Would change existing Codex login: no"
    return
  }

  Write-Host "Config file: $ConfigFile"
  Write-Host "Backup file: $ConfigFile.eggai.bak"
  Write-Host "Base URL: $ProviderBaseUrl"
  Write-Host "Language: $Language"
  Write-Host "Model: $(if ($Model) { $Model } else { 'Codex provider default' })"
  if ([string]::IsNullOrWhiteSpace($Sk_Key)) {
    Write-Host "API key: missing"
  } else {
    Write-Host "API key: provided (redacted)"
  }
  Write-Host "Would write config.toml: yes"
  Write-Host "Would save EGGAI_API_KEY for provider-scoped authentication: yes"
  Write-Host "Would change existing Codex login: no"
  Write-Host "Managed config preview:"
  Write-Host "# >>> eggai-codex"
  Write-Host "# Managed by EggDoc's EggAi Codex installer."
  Write-Host 'model_provider = "eggai"'
  Write-Host "developer_instructions = $(ConvertTo-TomlString $Instructions)"
  if (-not [string]::IsNullOrWhiteSpace($Model)) {
    Write-Host "model = $(ConvertTo-TomlString $Model)"
  }
  Write-Host "# <<< eggai-codex"
  Write-Host ""
  Write-Host "[model_providers.eggai]"
  Write-Host 'name = "EggAi"'
  Write-Host "base_url = $(ConvertTo-TomlString $ProviderBaseUrl)"
  Write-Host 'env_key = "EGGAI_API_KEY"'
  Write-Host 'env_key_instructions = "EggDoc stores EGGAI_API_KEY in the user environment."'
  Write-Host 'wire_api = "responses"'
}

function Update-CodexConfig {
  param(
    [string]$ConfigFile,
    [string]$ProviderBaseUrl,
    [string]$Instructions,
    [string]$ConfiguredModel
  )

  $configDir = Split-Path -Parent $ConfigFile
  New-Item -ItemType Directory -Force -Path $configDir | Out-Null
  $configExisted = Test-Path -LiteralPath $ConfigFile
  $originalContent = if ($configExisted) { [IO.File]::ReadAllText($ConfigFile) } else { "" }
  $content = $originalContent

  $managedBlockOpen = $false
  foreach ($markerLine in ($content -split "\r?\n")) {
    if ($markerLine -match '^# >>> eggai-codex$') {
      if ($managedBlockOpen) {
        Throw-InstallError "config.toml contains an invalid EggAi managed block. Restore the backup or remove the block, then retry."
      }
      $managedBlockOpen = $true
    } elseif ($markerLine -match '^# <<< eggai-codex$') {
      if (-not $managedBlockOpen) {
        Throw-InstallError "config.toml contains an invalid EggAi managed block. Restore the backup or remove the block, then retry."
      }
      $managedBlockOpen = $false
    }
  }
  if ($managedBlockOpen) {
    Throw-InstallError "config.toml contains an incomplete EggAi managed block. Restore the backup or remove the incomplete block, then retry."
  }
  $content = [regex]::Replace($content, "(?ms)^# >>> eggai-codex\r?\n.*?^# <<< eggai-codex\r?\n?", "")

  $lines = $content -split "\r?\n"
  $kept = New-Object System.Collections.Generic.List[string]
  $inEggAiProvider = $false
  $seenTable = $false

  foreach ($line in $lines) {
    if ($line -match '^\s*\[\[?\s*model_providers\s*\.\s*(?:"eggai"|''eggai''|eggai)(?:\s*\.[^\]]+)?\s*\]\]?\s*(?:#.*)?$') {
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

    if (-not $seenTable -and $line -match '^\s*(developer_instructions|model_provider|model_providers\.eggai)\s*=') {
      continue
    }

    if (-not $seenTable -and -not [string]::IsNullOrWhiteSpace($ConfiguredModel) -and $line -match '^\s*model\s*=') {
      continue
    }

    $kept.Add($line)
  }

  while ($kept.Count -gt 0 -and [string]::IsNullOrWhiteSpace($kept[0])) {
    $kept.RemoveAt(0)
  }
  while ($kept.Count -gt 0 -and [string]::IsNullOrWhiteSpace($kept[$kept.Count - 1])) {
    $kept.RemoveAt($kept.Count - 1)
  }

  $rootBlock = @(
    "# >>> eggai-codex",
    "# Managed by EggDoc's EggAi Codex installer.",
    "model_provider = `"eggai`"",
    "developer_instructions = $(ConvertTo-TomlString $Instructions)"
  )
  if (-not [string]::IsNullOrWhiteSpace($ConfiguredModel)) {
    $rootBlock += "model = $(ConvertTo-TomlString $ConfiguredModel)"
  }
  $rootBlock += "# <<< eggai-codex"

  $providerBlock = @(
    "[model_providers.eggai]",
    "name = `"EggAi`"",
    "base_url = $(ConvertTo-TomlString $ProviderBaseUrl)",
    "env_key = `"EGGAI_API_KEY`"",
    "env_key_instructions = `"EggDoc stores EGGAI_API_KEY in the user environment.`"",
    "wire_api = `"responses`""
  )

  $newLines = New-Object System.Collections.Generic.List[string]
  $newLines.AddRange([string[]]$rootBlock)
  $newLines.Add("")
  if ($kept.Count -gt 0) {
    $newLines.AddRange($kept)
    $newLines.Add("")
  }
  $newLines.AddRange([string[]]$providerBlock)
  $newContent = ($newLines -join [Environment]::NewLine) + [Environment]::NewLine

  if ($configExisted -and $originalContent -ceq $newContent) {
    return [pscustomobject]@{ BackupFile = $null; Changed = $false; Existed = $true }
  }

  $backupFile = $null
  $temporaryConfig = "$ConfigFile.eggai.tmp.$([guid]::NewGuid())"
  $replaceBackup = "$ConfigFile.eggai.replace.$([guid]::NewGuid())"
  try {
    [IO.File]::WriteAllText($temporaryConfig, $newContent, (New-Object Text.UTF8Encoding($false)))

    if ($configExisted) {
      $sourceAcl = Get-Acl -LiteralPath $ConfigFile
      Set-Acl -LiteralPath $temporaryConfig -AclObject $sourceAcl
      $backupFile = "$ConfigFile.eggai.bak"
      Copy-Item -LiteralPath $ConfigFile -Destination $backupFile -Force
      Set-Acl -LiteralPath $backupFile -AclObject $sourceAcl
      [IO.File]::Replace($temporaryConfig, $ConfigFile, $replaceBackup)
    } else {
      $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
      $secureAcl = Get-Acl -LiteralPath $temporaryConfig
      $secureAcl.SetAccessRuleProtection($true, $false)
      $accessRule = New-Object Security.AccessControl.FileSystemAccessRule($identity, "FullControl", "Allow")
      $secureAcl.SetAccessRule($accessRule)
      Set-Acl -LiteralPath $temporaryConfig -AclObject $secureAcl
      Move-Item -LiteralPath $temporaryConfig -Destination $ConfigFile
    }
  } finally {
    Remove-Item -LiteralPath $temporaryConfig -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $replaceBackup -Force -ErrorAction SilentlyContinue
  }

  return [pscustomobject]@{ BackupFile = $backupFile; Changed = $true; Existed = $configExisted }
}

function Restore-CodexConfig {
  param(
    [string]$ConfigFile,
    $ConfigUpdate
  )

  if (-not $ConfigUpdate.Changed) {
    return
  }
  if (-not $ConfigUpdate.Existed) {
    Remove-Item -LiteralPath $ConfigFile -Force -ErrorAction Stop
    if (Test-Path -LiteralPath $ConfigFile) {
      Throw-InstallError "the generated Codex configuration could not be removed."
    }
    return
  }
  if (-not $ConfigUpdate.BackupFile -or -not (Test-Path -LiteralPath $ConfigUpdate.BackupFile)) {
    Throw-InstallError "the previous Codex configuration backup is unavailable."
  }

  $temporaryRestore = "$ConfigFile.eggai.restore.$([guid]::NewGuid())"
  $replaceBackup = "$ConfigFile.eggai.restore-replace.$([guid]::NewGuid())"
  try {
    Copy-Item -LiteralPath $ConfigUpdate.BackupFile -Destination $temporaryRestore -Force
    $sourceAcl = Get-Acl -LiteralPath $ConfigUpdate.BackupFile
    Set-Acl -LiteralPath $temporaryRestore -AclObject $sourceAcl
    [IO.File]::Replace($temporaryRestore, $ConfigFile, $replaceBackup)
  } finally {
    Remove-Item -LiteralPath $temporaryRestore -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $replaceBackup -Force -ErrorAction SilentlyContinue
  }
}

function Set-EggAiApiKey {
  param([string]$ApiKey)

  $targetName = if ($env:EGGDOC_CODEX_ENV_SCOPE) { $env:EGGDOC_CODEX_ENV_SCOPE } else { "User" }
  $target = switch ($targetName) {
    "Process" { [EnvironmentVariableTarget]::Process }
    "User" { [EnvironmentVariableTarget]::User }
    default { Throw-InstallError "EGGDOC_CODEX_ENV_SCOPE must be Process or User." }
  }

  [Environment]::SetEnvironmentVariable("EGGAI_API_KEY", $ApiKey, $target)
  $savedKey = [Environment]::GetEnvironmentVariable("EGGAI_API_KEY", $target)
  if ($savedKey -cne $ApiKey) {
    Throw-InstallError "EGGAI_API_KEY could not be verified in the $targetName environment."
  }
  $env:EGGAI_API_KEY = $ApiKey
  $targetName
}

if ($EggAiMode -and $Language -ne "zh-cn" -and $Language -ne "en-us") {
  Throw-InstallError "language must be zh-cn or en-us."
}

if ($EggAiMode -and $BaseUrl -notmatch "^https?://") {
  Throw-InstallError "baseurl must start with http:// or https://."
}
if ($EggAiMode -and $BaseUrl -match "[\x00-\x20\x7f]") {
  Throw-InstallError "baseurl must not contain whitespace or control characters."
}
if ($EggAiMode) {
  $baseUri = $null
  if (-not [Uri]::TryCreate($BaseUrl, [UriKind]::Absolute, [ref]$baseUri) -or [string]::IsNullOrWhiteSpace($baseUri.Host)) {
    Throw-InstallError "baseurl must include a host."
  }
  if (-not [string]::IsNullOrWhiteSpace($baseUri.UserInfo)) {
    Throw-InstallError "baseurl must not contain user information."
  }
  if (-not [string]::IsNullOrWhiteSpace($baseUri.Query)) {
    Throw-InstallError "baseurl must not contain a query string."
  }
  if (-not [string]::IsNullOrWhiteSpace($baseUri.Fragment)) {
    Throw-InstallError "baseurl must not contain a fragment."
  }
  if (-not [string]::IsNullOrWhiteSpace($Model) -and $Model -notmatch '^[A-Za-z0-9._:/-]+$') {
    Throw-InstallError "model contains unsupported characters."
  }
  if ($Sk_Key -match '[\x00-\x20\x7f]') {
    Throw-InstallError "sk-key must not contain whitespace or control characters."
  }
}
if (-not [string]::IsNullOrWhiteSpace($CodexPackage) -and $CodexPackage -notmatch '^[A-Za-z0-9._-]+$') {
  Throw-InstallError "CodexPackage must be an exact winget package ID."
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

$wingetInstallSucceeded = $false
if (-not [string]::IsNullOrWhiteSpace($CodexPackage)) {
  $winget = Get-WingetCommand
  if ($winget) {
    Write-Step "winget"
    $global:LASTEXITCODE = 0
    $listOutput = @(& $winget.Source list --id $CodexPackage --exact --source msstore --disable-interactivity 2>$null)
    $listExitCode = $LASTEXITCODE
    if ($listExitCode -eq 0 -and ($listOutput -join "`n") -match [regex]::Escape($CodexPackage)) {
      $global:LASTEXITCODE = 0
      & $winget.Source upgrade --id $CodexPackage --exact --source msstore --accept-source-agreements --accept-package-agreements --disable-interactivity
    } else {
      $global:LASTEXITCODE = 0
      & $winget.Source install --id $CodexPackage --exact --source msstore --accept-source-agreements --accept-package-agreements --disable-interactivity
    }
    $wingetExitCode = $LASTEXITCODE
    if ($wingetExitCode -eq 0) {
      $wingetInstallSucceeded = $true
    } else {
      Write-Warning "winget could not install or update the exact package '$CodexPackage' (exit code $wingetExitCode); using the official installer."
    }
  } else {
    Write-Warning "winget is unavailable; using the official Codex installer."
  }
}

Add-CodexBinToPath
if (-not $wingetInstallSucceeded -or -not (Get-Command codex -ErrorAction SilentlyContinue)) {
  Write-Step "official"
  Install-CodexWithOfficialInstaller
}

Add-CodexBinToPath
$codexCommand = Get-Command codex -ErrorAction SilentlyContinue
if (-not $codexCommand) {
  Throw-InstallError "Codex was installed, but the codex command is not on PATH. Restart PowerShell and retry."
}
$codexExecutable = if (-not [string]::IsNullOrWhiteSpace($codexCommand.Path)) {
  $codexCommand.Path
} elseif (-not [string]::IsNullOrWhiteSpace($codexCommand.Source)) {
  $codexCommand.Source
} else {
  $codexCommand.Name
}

$global:LASTEXITCODE = 0
$versionOutput = @(& $codexExecutable --version)
if ($LASTEXITCODE -ne 0) {
  Throw-InstallError "codex --version failed after installation with exit code $LASTEXITCODE."
}
$versionText = ($versionOutput -join [Environment]::NewLine).Trim()
if ([string]::IsNullOrWhiteSpace($versionText)) {
  Throw-InstallError "codex --version returned no version information."
}

if (-not $EggAiMode) {
  Write-Step "done"
  Write-Host $versionText
  exit 0
}

Write-Step "config"
$configUpdate = Update-CodexConfig `
  -ConfigFile $configFile `
  -ProviderBaseUrl $BaseUrl `
  -Instructions (Get-DeveloperInstructions) `
  -ConfiguredModel $Model

Write-Step "env"
try {
  $environmentTarget = Set-EggAiApiKey -ApiKey $Sk_Key
} catch {
  $environmentError = $_.Exception.Message
  try {
    Restore-CodexConfig -ConfigFile $configFile -ConfigUpdate $configUpdate
  } catch {
    Throw-InstallError "EGGAI_API_KEY could not be saved, and the previous configuration could not be restored: $($_.Exception.Message)"
  }
  Throw-InstallError "EGGAI_API_KEY could not be saved. The previous configuration was restored. $environmentError"
}

Write-Step "eggai-done"
Write-Host $versionText
Write-Host "Config: $configFile"
Write-Host "Environment: EGGAI_API_KEY ($environmentTarget scope)"
if ($configUpdate.BackupFile) {
  Write-Host "Backup: $($configUpdate.BackupFile)"
} elseif ($configUpdate.Existed -and -not $configUpdate.Changed) {
  Write-Host "Backup: unchanged (configuration already current)"
} else {
  Write-Host "Backup: not needed (new configuration)"
}
