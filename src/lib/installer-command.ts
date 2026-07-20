export function buildShellInstallerCommand({
  argumentsText,
  scriptUrl,
  successCommand,
}: {
  argumentsText?: string;
  scriptUrl: string;
  successCommand?: string;
}) {
  const command =
    `_eggdoc_installer="$(mktemp)" && trap 'rm -f "$_eggdoc_installer"' 0 && ` +
    `trap 'exit 129' HUP && trap 'exit 130' INT && trap 'exit 143' TERM && ` +
    `curl -fsSL --retry 2 --connect-timeout 15 --max-time 120 -o "$_eggdoc_installer" ` +
    `${quoteShellArgument(scriptUrl)} && ` +
    `{ _eggdoc_first_line="$(sed -n '/[^[:space:]]/ { s/^[[:space:]]*//; p; q; }' "$_eggdoc_installer")"; ` +
    `case "$_eggdoc_first_line" in '') echo 'Error: EggDoc installer response was empty.' >&2; exit 1 ;; ` +
    `"<"*) echo 'Error: EggDoc installer returned HTML instead of a script.' >&2; exit 1 ;; esac; } && ` +
    `sh "$_eggdoc_installer"`;
  const invocation = `(${command}${argumentsText ? ` ${argumentsText}` : ""})`;
  return successCommand ? `${invocation} && ${successCommand}` : invocation;
}

export function buildPowerShellInstallerCommand({
  argumentsText,
  scriptUrl,
}: {
  argumentsText?: string;
  scriptUrl: string;
}) {
  return (
    `& { $eggdocInstaller=Join-Path ([IO.Path]::GetTempPath()) ('eggdoc-' + [guid]::NewGuid().ToString('N') + '.ps1'); ` +
    `try { $eggdocDownloadError=$null; foreach ($eggdocAttempt in 1..3) { ` +
    `try { Invoke-WebRequest -Uri ${quotePowerShellArgument(scriptUrl)} -OutFile $eggdocInstaller -TimeoutSec 120 -UseBasicParsing; $eggdocDownloadError=$null; break } ` +
    `catch { $eggdocDownloadError=$_; if ($eggdocAttempt -lt 3) { Start-Sleep -Seconds 1 } } }; ` +
    `if ($eggdocDownloadError) { throw $eggdocDownloadError }; ` +
    `$eggdocSource=[IO.File]::ReadAllText($eggdocInstaller); ` +
    `if ([string]::IsNullOrWhiteSpace($eggdocSource)) { throw 'EggDoc installer response was empty.' }; ` +
    `if ($eggdocSource.TrimStart().StartsWith('<')) { throw 'EggDoc installer returned HTML instead of a script.' }; ` +
    `$eggdocPowerShell=if ($PSVersionTable.PSEdition -eq 'Core') { Join-Path $PSHOME 'pwsh.exe' } else { Join-Path $PSHOME 'powershell.exe' }; ` +
    `if (-not (Test-Path -LiteralPath $eggdocPowerShell -PathType Leaf)) { throw 'The current PowerShell executable could not be found.' }; ` +
    `$eggdocQuotedInstaller="'" + $eggdocInstaller.Replace("'","''") + "'"; ` +
    `$eggdocChildCommand='& ' + $eggdocQuotedInstaller + ${quotePowerShellArgument(argumentsText ? ` ${argumentsText}` : "")}; ` +
    `$eggdocEncodedCommand=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($eggdocChildCommand)); ` +
    `$eggdocProcess=Start-Process -FilePath $eggdocPowerShell -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',$eggdocEncodedCommand) -Wait -PassThru -NoNewWindow; ` +
    `$eggdocExitCode=$eggdocProcess.ExitCode; if ($eggdocExitCode -ne 0) { throw "EggDoc installer exited with code $eggdocExitCode." }; ` +
    `$eggdocUserPath=[Environment]::GetEnvironmentVariable('Path','User'); ` +
    `$eggdocMachinePath=[Environment]::GetEnvironmentVariable('Path','Machine'); ` +
    `$env:PATH=(@($env:PATH,$eggdocUserPath,$eggdocMachinePath) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join ';' ` +
    `} finally { Remove-Item -LiteralPath $eggdocInstaller -Force -ErrorAction SilentlyContinue } }`
  );
}

export function quotePowerShellArgument(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

export function quoteShellArgument(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}
