# Hosted Codex Setup Scripts

EggDoc will host thin setup scripts for Codex + EggAi because Codex integration should be a repeatable install/update flow, not only a manual configuration tutorial. The scripts wrap the official Codex installers where possible, validate EggAi-specific inputs, update `config.toml`, and let Codex's own API-key login command update `auth.json`, keeping EggDoc responsible for EggAi configuration rather than reimplementing Codex installation or secret storage.
