export function buildShellInstallerCommand({
  argumentsText,
  scriptUrl,
}: {
  argumentsText?: string;
  scriptUrl: string;
}) {
  return `curl -fsSL ${quoteShellArgument(scriptUrl)} | sh -s --${
    argumentsText ? ` ${argumentsText}` : ""
  }`;
}

export function buildPowerShellInstallerCommand({
  argumentsText,
  scriptUrl,
}: {
  argumentsText?: string;
  scriptUrl: string;
}) {
  return `& ([scriptblock]::Create((Invoke-RestMethod -UseBasicParsing -Uri ${quotePowerShellArgument(
    scriptUrl,
  )})))${argumentsText ? ` ${argumentsText}` : ""}`;
}

export function quotePowerShellArgument(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

export function quoteShellArgument(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}
