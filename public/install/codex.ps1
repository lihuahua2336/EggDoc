[CmdletBinding()]
param(
  [string]$BaseUrl,
  [Alias("SkKey")]
  [string]$Sk_Key,
  [ValidateSet("zh-cn", "en-us")]
  [string]$Language,
  [string]$Model,
  [switch]$EggAi,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$DefaultBaseUrl = "https://api.eggai.icu/v1"
$CodexStoreProductId = "9PLM9XGG6VKS"
$CodexPackageName = "OpenAI.Codex"
$CodexPackageFamilyName = "OpenAI.Codex_2p2nqsd0c76g0"
$WingetNoApplicableUpgradeExitCode = 0x8A15002B
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
$EnvironmentScope = if ($env:EGGAI_CODEX_ENV_SCOPE) { $env:EGGAI_CODEX_ENV_SCOPE } else { "User" }
$GatewayTimeoutSeconds = if ($env:EGGDOC_GATEWAY_TIMEOUT_SECONDS) { $env:EGGDOC_GATEWAY_TIMEOUT_SECONDS } else { "60" }
$EggAiMode = $EggAi.IsPresent

function Write-Step {
  param([string]$Key)

  switch ($Key) {
    "verify" { Write-Host "Verifying the EggAi Codex endpoint..." }
    "store" { Write-Host "Installing or updating the Codex desktop app from Microsoft Store..." }
    "config" { Write-Host "Writing EggAi Codex configuration..." }
    "env" { Write-Host "Saving EggAi API key for provider-scoped authentication..." }
    "done" { Write-Host "Done: Codex desktop app is installed." }
    "eggai-done" { Write-Host "Done: Codex desktop app is installed and configured to use EggAi." }
    default { Write-Host $Key }
  }
}

function Throw-InstallError {
  param([string]$Message)
  throw "EggAi Codex installer failed: $Message"
}

function Get-WingetCommand {
  Get-Command winget -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Test-EggAiCodexEndpoint {
  param(
    [string]$ProviderBaseUrl,
    [string]$ApiKey,
    [string]$RequestedModel
  )

  try {
    $response = Invoke-WebRequest `
      -Uri "$($ProviderBaseUrl.TrimEnd('/'))/models" `
      -Method Get `
      -Headers @{ Authorization = "Bearer $ApiKey" } `
      -TimeoutSec $GatewayTimeoutSeconds `
      -UseBasicParsing
    if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 300) {
      Throw-InstallError "EggAi Codex endpoint verification returned HTTP $($response.StatusCode)."
    }
    if (-not [string]::IsNullOrWhiteSpace($RequestedModel)) {
      $verificationBody = @{
        model = $RequestedModel
        input = "Reply with OK."
        max_output_tokens = 16
      } | ConvertTo-Json -Compress
      $modelResponse = Invoke-WebRequest `
        -Uri "$($ProviderBaseUrl.TrimEnd('/'))/responses" `
        -Method Post `
        -Headers @{ Authorization = "Bearer $ApiKey" } `
        -ContentType "application/json" `
        -Body $verificationBody `
        -TimeoutSec $GatewayTimeoutSeconds `
        -UseBasicParsing
      if ([int]$modelResponse.StatusCode -lt 200 -or [int]$modelResponse.StatusCode -ge 300) {
        Throw-InstallError "EggAi model verification returned HTTP $($modelResponse.StatusCode)."
      }
    }
  } catch {
    if ($_.Exception.Message -like "EggAi Codex installer failed:*") {
      throw
    }
    Throw-InstallError "could not verify the EggAi Codex endpoint: $($_.Exception.Message)"
  }
}

function Get-CodexDesktopPackage {
  @(
    Get-AppxPackage -Name $CodexPackageName -ErrorAction SilentlyContinue |
      Where-Object { $_.PackageFamilyName -eq $CodexPackageFamilyName } |
      Sort-Object Version -Descending
  ) | Select-Object -First 1
}

function Install-CodexDesktopApp {
  $installedPackage = Get-CodexDesktopPackage
  $winget = Get-WingetCommand
  if (-not $winget) {
    $operation = if ($installedPackage) { "update" } else { "install" }
    Throw-InstallError "winget is required to $operation the official Codex desktop app from Microsoft Store (product $CodexStoreProductId). Install or update App Installer, then retry."
  }

  $wingetAction = if ($installedPackage) { "upgrade" } else { "install" }
  $wingetArguments = @(
    $wingetAction,
    "--id", $CodexStoreProductId,
    "--exact",
    "--source", "msstore",
    "--accept-source-agreements",
    "--accept-package-agreements",
    "--disable-interactivity"
  )
  $wingetProcess = Start-Process `
    -FilePath $winget.Source `
    -ArgumentList $wingetArguments `
    -Wait `
    -PassThru `
    -NoNewWindow
  $wingetExitCode = $wingetProcess.ExitCode
  $alreadyCurrent = $wingetAction -eq "upgrade" -and $wingetExitCode -eq $WingetNoApplicableUpgradeExitCode
  if ($wingetExitCode -ne 0 -and -not $alreadyCurrent) {
    Throw-InstallError "Microsoft Store could not $wingetAction the official Codex desktop app (product $CodexStoreProductId, exit code $wingetExitCode)."
  }
  if ($alreadyCurrent) {
    Write-Host "Codex desktop app is already up to date."
  }

  $installedPackage = Get-CodexDesktopPackage
  if (-not $installedPackage) {
    Throw-InstallError "Microsoft Store reported success, but the expected Codex package $CodexPackageFamilyName was not found."
  }
  return $installedPackage
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
  $codexPackage = Get-CodexDesktopPackage

  Write-Host "Codex desktop app installer dry run"
  Write-Host "Mode: $(if ($EggAiMode) { 'eggai' } else { 'default' })"
  Write-Host "Microsoft Store product ID: $CodexStoreProductId"
  Write-Host "Expected package family: $CodexPackageFamilyName"
  Write-Host "Codex home: $(Split-Path -Parent $ConfigFile)"
  Write-Host ""
  Write-Host "Windows scenario check:"
  Write-Host "- winget exists: $(if ($winget) { "yes ($($winget.Source))" } else { 'no' })"
  Write-Host "- Codex desktop app exists: $(if ($codexPackage) { "yes ($($codexPackage.Version))" } else { 'no' })"
  Write-Host "- Install source: Microsoft Store product $CodexStoreProductId (OpenAI)"

  Write-Host ""
  Write-Host "Would ensure Codex desktop app is installed: yes"
  if (-not $EggAiMode) {
    Write-Host "Would write config.toml: no"
    Write-Host "Would change existing Codex login: no"
    return
  }

  Write-Host "Config file: $ConfigFile"
  Write-Host "Backup file: $ConfigFile.eggai.bak"
  Write-Host "Base URL: $ProviderBaseUrl"
  Write-Host "Language: $Language"
  Write-Host "Model: $Model"
  if ([string]::IsNullOrWhiteSpace($Sk_Key)) {
    Write-Host "API key: missing"
  } else {
    Write-Host "API key: provided (redacted)"
  }
  Write-Host "Would write config.toml: yes"
  Write-Host "Would save EGGAI_API_KEY for provider-scoped authentication: yes"
  Write-Host "Would verify EggAi endpoint before installation: yes"
  Write-Host "Environment scope: $EnvironmentScope"
  Write-Host "Would change existing Codex login: no"
  Write-Host "Managed config preview:"
  Write-Host "# >>> eggai-codex"
  Write-Host "# Managed by EggDoc's EggAi Codex installer."
  Write-Host 'model_provider = "eggai"'
  Write-Host "developer_instructions = $(ConvertTo-TomlString $Instructions)"
  Write-Host "model = $(ConvertTo-TomlString $Model)"
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

    if (-not $seenTable -and $line -match '^\s*(developer_instructions|model_provider|model_providers\s*\.\s*(?:"eggai"|''eggai''|eggai))\s*=') {
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

function Get-EnvironmentVariableState {
  param([EnvironmentVariableTarget]$Target)

  $variables = [Environment]::GetEnvironmentVariables($Target)
  $exists = $variables.Contains("EGGAI_API_KEY")
  [pscustomobject]@{
    Exists = $exists
    Target = $Target
    Value = if ($exists) { [string]$variables["EGGAI_API_KEY"] } else { $null }
  }
}

function Restore-EnvironmentVariableState {
  param($State)

  $value = if ($State.Exists) { $State.Value } else { $null }
  [Environment]::SetEnvironmentVariable("EGGAI_API_KEY", $value, $State.Target)
}

function Send-EnvironmentChangeNotification {
  if (-not ("EggDoc.NativeMethods" -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

namespace EggDoc {
  public static class NativeMethods {
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr SendMessageTimeout(
      IntPtr hWnd,
      uint message,
      UIntPtr wParam,
      string lParam,
      uint flags,
      uint timeout,
      out UIntPtr result);
  }
}
"@
  }

  [UIntPtr]$result = [UIntPtr]::Zero
  $sent = [EggDoc.NativeMethods]::SendMessageTimeout(
    [IntPtr]0xffff,
    0x001a,
    [UIntPtr]::Zero,
    "Environment",
    0x0002,
    5000,
    [ref]$result
  )
  if ($sent -eq [IntPtr]::Zero) {
    Throw-InstallError "Windows could not notify running applications about the updated user environment."
  }
}

function Set-EggAiApiKey {
  param(
    [string]$ApiKey,
    [string]$TargetName
  )

  $target = switch ($TargetName) {
    "Process" { [EnvironmentVariableTarget]::Process }
    "User" { [EnvironmentVariableTarget]::User }
    default { Throw-InstallError "EGGAI_CODEX_ENV_SCOPE must be Process or User." }
  }

  $targetState = Get-EnvironmentVariableState -Target $target
  $processState = if ($target -eq [EnvironmentVariableTarget]::Process) {
    $targetState
  } else {
    Get-EnvironmentVariableState -Target ([EnvironmentVariableTarget]::Process)
  }

  try {
    [Environment]::SetEnvironmentVariable("EGGAI_API_KEY", $ApiKey, $target)
    if ($target -ne [EnvironmentVariableTarget]::Process) {
      [Environment]::SetEnvironmentVariable("EGGAI_API_KEY", $ApiKey, [EnvironmentVariableTarget]::Process)
    }
    if ($env:EGGDOC_TEST_FORCE_CODEX_ENV_VERIFY_FAILURE) {
      Throw-InstallError "forced EGGAI_API_KEY verification failure."
    }
    $savedKey = [Environment]::GetEnvironmentVariable("EGGAI_API_KEY", $target)
    $processKey = [Environment]::GetEnvironmentVariable("EGGAI_API_KEY", [EnvironmentVariableTarget]::Process)
    if ($savedKey -cne $ApiKey -or $processKey -cne $ApiKey) {
      Throw-InstallError "EGGAI_API_KEY could not be verified in the $TargetName environment."
    }
    if ($target -eq [EnvironmentVariableTarget]::User) {
      Send-EnvironmentChangeNotification
    }
  } catch {
    $writeError = $_
    $restoreErrors = New-Object System.Collections.Generic.List[string]
    try {
      Restore-EnvironmentVariableState -State $targetState
    } catch {
      $restoreErrors.Add($_.Exception.Message)
    }
    if ($target -ne [EnvironmentVariableTarget]::Process) {
      try {
        Restore-EnvironmentVariableState -State $processState
      } catch {
        $restoreErrors.Add($_.Exception.Message)
      }
    }
    if ($target -eq [EnvironmentVariableTarget]::User) {
      try {
        Send-EnvironmentChangeNotification
      } catch {
        $restoreErrors.Add($_.Exception.Message)
      }
    }
    if ($restoreErrors.Count -gt 0) {
      Throw-InstallError "EGGAI_API_KEY could not be saved or fully restored: $($restoreErrors -join '; ')"
    }
    throw $writeError
  }

  $TargetName
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
  if ([string]::IsNullOrWhiteSpace($Model)) {
    Throw-InstallError "model is required with EggAi mode. Set MODEL, CODEX_MODEL, or pass -Model."
  }
  if ($Model -notmatch '^[A-Za-z0-9._:/-]+$') {
    Throw-InstallError "model contains unsupported characters."
  }
  if ($Sk_Key -match '[\x00-\x20\x7f]') {
    Throw-InstallError "sk-key must not contain whitespace or control characters."
  }
}
if ($EggAiMode -and $EnvironmentScope -ne "Process" -and $EnvironmentScope -ne "User") {
  Throw-InstallError "EGGAI_CODEX_ENV_SCOPE must be Process or User."
}
$parsedGatewayTimeoutSeconds = 0
if (-not [int]::TryParse([string]$GatewayTimeoutSeconds, [ref]$parsedGatewayTimeoutSeconds) -or $parsedGatewayTimeoutSeconds -lt 1) {
  Throw-InstallError "EGGDOC_GATEWAY_TIMEOUT_SECONDS must be a positive integer."
}
$GatewayTimeoutSeconds = $parsedGatewayTimeoutSeconds

$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$configFile = Join-Path $codexHome "config.toml"

if ($DryRun) {
  Write-DryRunPlan -ConfigFile $configFile -ProviderBaseUrl $BaseUrl -Instructions (Get-DeveloperInstructions)
  return
}

if ($EggAiMode -and [string]::IsNullOrWhiteSpace($Sk_Key)) {
  Throw-InstallError "sk-key is required with EggAi mode. Set SK_KEY, EGGAI_API_KEY, or pass -SkKey."
}
if ($EggAiMode) {
  Write-Step "verify"
  Test-EggAiCodexEndpoint -ProviderBaseUrl $BaseUrl -ApiKey $Sk_Key -RequestedModel $Model
}

Write-Step "store"
$codexPackage = Install-CodexDesktopApp
$versionText = "Codex desktop app $($codexPackage.Version)"

if (-not $EggAiMode) {
  Write-Step "done"
  Write-Host $versionText
  return
}

Write-Step "config"
$configUpdate = Update-CodexConfig `
  -ConfigFile $configFile `
  -ProviderBaseUrl $BaseUrl `
  -Instructions (Get-DeveloperInstructions) `
  -ConfiguredModel $Model

Write-Step "env"
try {
  $environmentTarget = Set-EggAiApiKey -ApiKey $Sk_Key -TargetName $EnvironmentScope
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
Write-Host "Restart the Codex desktop app to load the updated user environment and configuration."
if ($configUpdate.BackupFile) {
  Write-Host "Backup: $($configUpdate.BackupFile)"
} elseif ($configUpdate.Existed -and -not $configUpdate.Changed) {
  Write-Host "Backup: unchanged (configuration already current)"
} else {
  Write-Host "Backup: not needed (new configuration)"
}
