# Publish only focused tool tutorials

EggDoc currently publishes two tool installation tutorials, Codex and Claude Code, plus a focused Codex EggAi configuration article linked from the Codex installation flow. The primary navigation names this collection `工具教程`, and the home page, collection page, article navigation, related content, and search experience expose only these tutorials.

Lesson, note, and learning-path publishing capabilities and their routes are intentionally removed. Each published article should complete one installation or configuration task without mixing broader product education into the same page.

This decision supersedes the product-scope portions of ADRs 0004, 0006, 0007, 0012, 0018, 0019, and 0021 that require learning paths, lessons, notes, or their navigation. Their general guidance about generated content navigation, readable technical documentation, and approachable presentation still applies where it does not conflict with this narrower scope.

The `draft` publication control remains, but the unused `featured` promotion control is removed. This supersedes only the `featured` portion of ADR 0017; publication state continues to be independent from navigation and ordering.

The `无配置安装` option must remain the non-secret default. For EggAi setup, selecting the `EggAi 配置` tab is an explicit request to reveal the Selected API Credential in the one-click command, as clarified by ADR 0028. The command is copied only after a separate manual copy action, and the interface continues to warn about credential exposure.
