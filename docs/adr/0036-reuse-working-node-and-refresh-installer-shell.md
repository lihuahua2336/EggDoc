# Reuse working Node.js and refresh the installer shell

EggDoc's CLI installers treat Node.js and npm as installation prerequisites. They reuse a working local runtime without upgrading it to a fixed version. If either prerequisite is unavailable, Unix scripts obtain the current Node.js LTS release from the official release index and verify the downloaded archive; the Windows Claude script uses the official winget LTS package. npm package installation checks the target version first and skips an already current package.

The reader-facing Unix commands load the installed command path in the current shell after successful installation. Codex EggAi commands source the restricted `eggai.env` file after the child installer exits, so the selected provider credential is immediately available in that terminal. This replaces the stricter command shape and fixed Node.js minimum described in ADR 0035. PowerShell updates process environment and PATH within its invoked script block.
