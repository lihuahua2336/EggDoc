# Adapt the EggAi ecosystem contract

EggDoc integrates with the configured Logto resource audience and ecosystem scopes. As of 2026-10-26, the deployed adapter targets Sub2API's `/api/v1/ecosystem/me`, `/api/v1/ecosystem/models`, and `/api/v1/ecosystem/keys` routes. This supersedes the original New API route contract shared with Infinite Canvas. An EggDoc-owned adapter translates the external responses into EggAi API Account and EggAi API Credential concepts so tutorial UI and configuration templates do not depend directly on upstream field names.

Sub2API success envelopes use `code: 0`. Key lists use `data.items` plus pagination metadata; all pages must be read. Models identify names with `model`, and credentials use `id`, `key`, `name`, and nullable `group_id`. Credentials without a group display as ungrouped, and expired or quota-exhausted keys are excluded. The adapter also accepts the legacy `success: true` envelope and legacy data fields, but it does not fall back to the legacy route paths.

An HTTP 401 requires reauthorization. An HTTP 403 must preserve the authenticated EggDoc Session: an unlinked Sub2API identity leads to account activation, while a missing scope, disallowed client, disabled adapter, or unavailable user remains a permission failure. Only allowlisted upstream reason codes may be returned or logged; tokens, cookies, identity claims, and upstream response bodies are never logged.

The configured issuer, resource audience, and ecosystem origin must be checked against the target deployment's `/api/v1/ecosystem/docs`. A local Sub2API instance and the public API can have different audiences even when they run the same code.
