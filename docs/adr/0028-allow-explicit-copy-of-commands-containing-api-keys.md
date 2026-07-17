# Allow explicit copy of commands containing API keys

EggDoc may generate and copy a complete Codex command containing the Selected API Credential when the Reader explicitly requests it, prioritizing one-step setup over keeping secrets out of command text. The interface must not copy automatically and must warn that the clipboard, shell history, screenshots, and shared commands can expose the key; separate non-secret configuration and API-key copy actions remain available.
