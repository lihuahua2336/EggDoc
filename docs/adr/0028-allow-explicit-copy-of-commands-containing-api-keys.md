# Allow explicit copy of commands containing API keys

EggDoc may generate and copy a complete Codex command containing the Selected API Credential when the Reader explicitly requests it, prioritizing one-step setup over keeping secrets out of command text. The interface must not copy automatically and must warn that the clipboard, shell history, screenshots, and shared commands can expose the key; separate non-secret configuration and API-key copy actions remain available.

The `无配置安装` view remains the non-secret default. Selecting the `EggAi 配置` tab is the Reader's explicit request to reveal the Selected API Credential in the generated command preview. Copying that command remains a separate manual action, and the credential warning must remain visible while the personalized command is shown.
