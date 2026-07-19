[CmdletBinding()]
param(
  [string]$Version,
  [string]$BaseUrl,
  [Alias("SkKey")]
  [string]$Sk_Key,
  [string]$Model,
  [string]$OpusModel,
  [string]$SonnetModel,
  [string]$HaikuModel,
  [string]$FableModel,
  [switch]$EggAi,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$OfficialInstallerUrl = if ($env:CLAUDE_CODE_INSTALLER_URL) { $env:CLAUDE_CODE_INSTALLER_URL } else { "https://claude.ai/install.ps1" }
$GatewayTimeoutSeconds = if ($env:EGGDOC_GATEWAY_TIMEOUT_SECONDS) { $env:EGGDOC_GATEWAY_TIMEOUT_SECONDS } else { "60" }
if ([string]::IsNullOrWhiteSpace($Version)) {
  $Version = if ($env:CLAUDE_CODE_VERSION) { $env:CLAUDE_CODE_VERSION } else { "latest" }
}
if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  $BaseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { "https://api.eggai.icu/v1" }
}
if ([string]::IsNullOrWhiteSpace($Sk_Key)) {
  $Sk_Key = if ($env:SK_KEY) { $env:SK_KEY } else { $env:EGGAI_API_KEY }
}
if ([string]::IsNullOrWhiteSpace($Model)) {
  $Model = if ($env:MODEL) { $env:MODEL } else { $env:ANTHROPIC_MODEL }
}
if ([string]::IsNullOrWhiteSpace($OpusModel)) {
  $OpusModel = if ($env:OPUS_MODEL) { $env:OPUS_MODEL } elseif ($env:ANTHROPIC_DEFAULT_OPUS_MODEL) { $env:ANTHROPIC_DEFAULT_OPUS_MODEL } else { $Model }
}
if ([string]::IsNullOrWhiteSpace($SonnetModel)) {
  $SonnetModel = if ($env:SONNET_MODEL) { $env:SONNET_MODEL } elseif ($env:ANTHROPIC_DEFAULT_SONNET_MODEL) { $env:ANTHROPIC_DEFAULT_SONNET_MODEL } else { $Model }
}
if ([string]::IsNullOrWhiteSpace($HaikuModel)) {
  $HaikuModel = if ($env:HAIKU_MODEL) { $env:HAIKU_MODEL } elseif ($env:ANTHROPIC_DEFAULT_HAIKU_MODEL) { $env:ANTHROPIC_DEFAULT_HAIKU_MODEL } else { $Model }
}
if ([string]::IsNullOrWhiteSpace($FableModel)) {
  $FableModel = if ($env:FABLE_MODEL) { $env:FABLE_MODEL } elseif ($env:ANTHROPIC_DEFAULT_FABLE_MODEL) { $env:ANTHROPIC_DEFAULT_FABLE_MODEL } else { $Model }
}
$EggAiMode = $EggAi.IsPresent

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

function Get-AnthropicBaseUrl {
  param([string]$Value)

  $uri = $null
  if (-not [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne "https") {
    Throw-InstallError "baseurl must be an HTTPS URL."
  }
  if ($Value -match "[\x00-\x20\x7f]") {
    Throw-InstallError "baseurl must not contain whitespace or control characters."
  }
  if ([string]::IsNullOrWhiteSpace($uri.Host)) {
    Throw-InstallError "baseurl must contain a host."
  }
  if (-not [string]::IsNullOrEmpty($uri.UserInfo) -or -not [string]::IsNullOrEmpty($uri.Query) -or -not [string]::IsNullOrEmpty($uri.Fragment)) {
    Throw-InstallError "baseurl must not contain user information, a query, or a fragment."
  }

  $normalized = $Value.TrimEnd("/")
  if ($normalized -match "/v1$") {
    $normalized = $normalized.Substring(0, $normalized.Length - 3)
  }
  return $normalized
}

function Update-ClaudeSettings {
  param(
    [string]$SettingsFile,
    [string]$ProviderBaseUrl,
    [string]$AuthToken,
    [string]$ClaudeModel,
    [string]$ClaudeOpusModel,
    [string]$ClaudeSonnetModel,
    [string]$ClaudeHaikuModel,
    [string]$ClaudeFableModel
  )

  $settingsDirectory = Split-Path -Parent $SettingsFile
  New-Item -ItemType Directory -Force -Path $settingsDirectory | Out-Null
  if (Test-Path -LiteralPath $SettingsFile -PathType Container) {
    Throw-InstallError "Claude Code settings path exists but is not a regular file."
  }
  $settingsExisted = Test-Path -LiteralPath $SettingsFile
  $content = if ($settingsExisted) { Get-Content -LiteralPath $SettingsFile -Raw } else { "{}" }
  try {
    $settings = $content | ConvertFrom-Json
  } catch {
    Throw-InstallError "settings.json is not valid JSON: $($_.Exception.Message)"
  }
  if ($null -eq $settings -or $settings -is [Array] -or $settings -isnot [PSCustomObject]) {
    Throw-InstallError "settings.json must contain a JSON object."
  }

  if ($null -eq $settings.env) {
    $settings | Add-Member -NotePropertyName env -NotePropertyValue ([PSCustomObject]@{}) -Force
  } elseif ($settings.env -isnot [PSCustomObject]) {
    Throw-InstallError "settings.json env must contain a JSON object."
  }

  $settings.env.PSObject.Properties.Remove("ANTHROPIC_API_KEY")
  $settings.env | Add-Member -NotePropertyName ANTHROPIC_BASE_URL -NotePropertyValue $ProviderBaseUrl -Force
  $settings.env | Add-Member -NotePropertyName ANTHROPIC_AUTH_TOKEN -NotePropertyValue $AuthToken -Force
  $settings.env | Add-Member -NotePropertyName ANTHROPIC_MODEL -NotePropertyValue $ClaudeModel -Force
  $settings.env | Add-Member -NotePropertyName ANTHROPIC_DEFAULT_FABLE_MODEL -NotePropertyValue $ClaudeFableModel -Force
  $settings.env | Add-Member -NotePropertyName ANTHROPIC_DEFAULT_OPUS_MODEL -NotePropertyValue $ClaudeOpusModel -Force
  $settings.env | Add-Member -NotePropertyName ANTHROPIC_DEFAULT_SONNET_MODEL -NotePropertyValue $ClaudeSonnetModel -Force
  $settings.env | Add-Member -NotePropertyName ANTHROPIC_DEFAULT_HAIKU_MODEL -NotePropertyValue $ClaudeHaikuModel -Force

  $json = $settings | ConvertTo-Json -Depth 100
  $newContent = "$json`n"
  if ($settingsExisted -and $content.TrimStart([char]0xFEFF) -ceq $newContent) {
    return [pscustomobject]@{ BackupFile = $null; Changed = $false; Existed = $true }
  }

  $backupFile = $null
  $temporarySettings = "$SettingsFile.eggai.tmp.$([guid]::NewGuid())"
  $replaceBackup = "$SettingsFile.eggai.replace.$([guid]::NewGuid())"
  try {
    [IO.File]::WriteAllText($temporarySettings, $newContent, (New-Object Text.UTF8Encoding($false)))
    Get-Content -LiteralPath $temporarySettings -Raw | ConvertFrom-Json | Out-Null

    if ($settingsExisted) {
      $sourceAcl = Get-Acl -LiteralPath $SettingsFile
      Set-Acl -LiteralPath $temporarySettings -AclObject $sourceAcl
      $backupFile = "$SettingsFile.eggai.bak"
      Copy-Item -LiteralPath $SettingsFile -Destination $backupFile -Force
      Set-Acl -LiteralPath $backupFile -AclObject $sourceAcl
      [IO.File]::Replace($temporarySettings, $SettingsFile, $replaceBackup)
    } else {
      $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
      $secureAcl = Get-Acl -LiteralPath $temporarySettings
      $secureAcl.SetAccessRuleProtection($true, $false)
      $accessRule = New-Object Security.AccessControl.FileSystemAccessRule($identity, "FullControl", "Allow")
      $secureAcl.SetAccessRule($accessRule)
      Set-Acl -LiteralPath $temporarySettings -AclObject $secureAcl
      Move-Item -LiteralPath $temporarySettings -Destination $SettingsFile
    }
  } finally {
    Remove-Item -LiteralPath $temporarySettings -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $replaceBackup -Force -ErrorAction SilentlyContinue
  }

  return [pscustomobject]@{ BackupFile = $backupFile; Changed = $true; Existed = $settingsExisted }
}

if ($Version -ne "latest" -and $Version -ne "stable" -and $Version -notmatch "^\d+(\.\d+){2,}$") {
  Throw-InstallError "version must be latest, stable, or a numeric dotted version."
}

$parsedGatewayTimeoutSeconds = 0
if (-not [int]::TryParse([string]$GatewayTimeoutSeconds, [ref]$parsedGatewayTimeoutSeconds) -or $parsedGatewayTimeoutSeconds -lt 1) {
  Throw-InstallError "EGGDOC_GATEWAY_TIMEOUT_SECONDS must be a positive integer."
}
$GatewayTimeoutSeconds = $parsedGatewayTimeoutSeconds
$anthropicBaseUrl = if ($EggAiMode) { Get-AnthropicBaseUrl $BaseUrl } else { $null }
if ($EggAiMode -and [string]::IsNullOrWhiteSpace($Sk_Key)) {
  Throw-InstallError "sk-key is required with EggAi mode. Set SK_KEY, EGGAI_API_KEY, or pass -SkKey."
}
if ($EggAiMode -and [string]::IsNullOrWhiteSpace($Model)) {
  Throw-InstallError "model is required with EggAi mode. Set MODEL, ANTHROPIC_MODEL, or pass -Model."
}
if ($EggAiMode) {
  foreach ($configuredModel in @($Model, $OpusModel, $SonnetModel, $HaikuModel, $FableModel)) {
    if ([string]::IsNullOrWhiteSpace($configuredModel) -or $configuredModel -notmatch "^[A-Za-z0-9._:/-]+$") {
      Throw-InstallError "model contains unsupported characters."
    }
  }
}

$userHome = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
$claudeHome = if ($env:CLAUDE_HOME) { $env:CLAUDE_HOME } else { Join-Path $userHome ".claude" }
$settingsFile = Join-Path $claudeHome "settings.json"

if ($DryRun) {
  Write-Host "Claude Code installer dry run"
  Write-Host "Mode: $(if ($EggAiMode) { 'eggai' } else { 'default' })"
  Write-Host "Official installer URL: $OfficialInstallerUrl"
  Write-Host "Release: $Version"
  Write-Host "Would install/update Claude Code: yes"
  if ($EggAiMode) {
    Write-Host "Settings file: $settingsFile"
    Write-Host "Backup file: $settingsFile.eggai.bak"
    Write-Host "Anthropic Base URL: $anthropicBaseUrl"
    Write-Host "Model: $Model"
    Write-Host "Opus model: $OpusModel"
    Write-Host "Sonnet model: $SonnetModel"
    Write-Host "Haiku model: $HaikuModel"
    Write-Host "Fable model: $FableModel"
    Write-Host "Gateway timeout: $($GatewayTimeoutSeconds)s"
    Write-Host "API key: provided (redacted)"
    Write-Host "Would modify Claude Code configuration: yes"
  } else {
    Write-Host "Would modify Claude Code configuration: no"
  }
  exit 0
}

if ($EggAiMode) {
  Write-Host "Verifying the EggAi Claude gateway..."
  $gatewayBody = @{
    model = $Model
    max_tokens = 16
    stream = $true
    tools = @(@{
      name = "eggdoc_check"
      description = "Verify tool use"
      input_schema = @{ type = "object"; properties = @{}; additionalProperties = $false }
    })
    tool_choice = @{ type = "tool"; name = "eggdoc_check" }
    messages = @(@{ role = "user"; content = "Run the check tool." })
  } | ConvertTo-Json -Depth 8 -Compress
  try {
    $gatewayResponse = Invoke-WebRequest `
      -Uri "$anthropicBaseUrl/v1/messages" `
      -Method Post `
      -Headers @{ Authorization = "Bearer $Sk_Key"; "anthropic-version" = "2023-06-01" } `
      -ContentType "application/json" `
      -Body $gatewayBody `
      -TimeoutSec $GatewayTimeoutSeconds `
      -UseBasicParsing
    if ([int]$gatewayResponse.StatusCode -lt 200 -or [int]$gatewayResponse.StatusCode -ge 300) {
      Throw-InstallError "gateway verification returned HTTP $($gatewayResponse.StatusCode)."
    }
    $gatewayState = 0
    foreach ($block in [regex]::Split(([string]$gatewayResponse.Content).Trim(), "\r?\n\r?\n")) {
      $event = $null
      $dataLines = New-Object System.Collections.Generic.List[string]
      foreach ($line in [regex]::Split($block, "\r?\n")) {
        if ($line.StartsWith("event:")) {
          $event = $line.Substring(6).Trim()
        } elseif ($line.StartsWith("data:")) {
          $dataLines.Add($line.Substring(5).TrimStart())
        }
      }
      if (-not $event -or $dataLines.Count -eq 0) { continue }
      try {
        $payload = ($dataLines -join "`n") | ConvertFrom-Json
      } catch {
        Throw-InstallError "gateway verification did not return a valid streaming Anthropic tool-use response."
      }
      if ($gatewayState -eq 0 -and $event -eq "message_start" -and $payload.type -eq "message_start" -and $payload.message.id -like "msg_*") {
        $gatewayState = 1
      } elseif ($gatewayState -eq 1 -and $event -eq "content_block_start" -and $payload.type -eq "content_block_start" -and $payload.content_block.type -eq "tool_use" -and $payload.content_block.name -eq "eggdoc_check") {
        $gatewayState = 2
      } elseif ($gatewayState -eq 2 -and $event -eq "message_stop" -and $payload.type -eq "message_stop") {
        $gatewayState = 3
      }
    }
    if ($gatewayState -ne 3) {
      Throw-InstallError "gateway verification did not return a valid streaming Anthropic tool-use response."
    }
  } catch {
    Throw-InstallError "could not verify the EggAi gateway: $($_.Exception.Message)"
  }
}

$temporaryInstaller = Join-Path (Get-TemporaryDirectory) "eggdoc-claude-code-$([guid]::NewGuid()).ps1"

try {
  Write-Host "Installing or updating Claude Code from Anthropic..."
  try {
    Invoke-WebRequest -Uri $OfficialInstallerUrl -OutFile $temporaryInstaller -TimeoutSec 300 -UseBasicParsing
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
$versionText = ($versionOutput -join [Environment]::NewLine).Trim()
if ([string]::IsNullOrWhiteSpace($versionText)) {
  Throw-InstallError "claude --version returned no version information."
}

Write-Host "Done: Claude Code is installed."
Write-Host $versionText

if ($EggAiMode) {
  Write-Host "Writing EggAi Claude Code configuration..."
  $settingsUpdate = Update-ClaudeSettings `
    -SettingsFile $settingsFile `
    -ProviderBaseUrl $anthropicBaseUrl `
    -AuthToken $Sk_Key `
    -ClaudeModel $Model `
    -ClaudeOpusModel $OpusModel `
    -ClaudeSonnetModel $SonnetModel `
    -ClaudeHaikuModel $HaikuModel `
    -ClaudeFableModel $FableModel
  Write-Host "Done: Claude Code is installed and configured to use EggAi."
  Write-Host "Settings: $settingsFile"
  if ($settingsUpdate.BackupFile) {
    Write-Host "Backup: $($settingsUpdate.BackupFile)"
  } elseif ($settingsUpdate.Existed -and -not $settingsUpdate.Changed) {
    Write-Host "Backup: unchanged (configuration already current)"
  } else {
    Write-Host "Backup: not needed (new configuration)"
  }
}
