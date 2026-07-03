#!/usr/bin/env sh
set -eu

DEFAULT_BASE_URL="https://api.eggai.icu/v1"
BASE_URL="${BASE_URL:-$DEFAULT_BASE_URL}"
SK_KEY="${SK_KEY:-${EGGAI_API_KEY:-}}"
LANGUAGE="${LANGUAGE:-zh-cn}"
DRY_RUN="${DRY_RUN:-0}"
OFFICIAL_INSTALLER_URL="${CODEX_INSTALLER_URL:-https://chatgpt.com/codex/install.sh}"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
CONFIG_FILE="$CODEX_HOME/config.toml"

usage() {
  cat <<'EOF'
Usage:
  curl -fsSL https://eggdoc.pages.dev/install/codex.sh | sh -s -- --sk-key sk-...

Options:
  --sk-key <key>       Required. EggAi API key.
  --baseurl <url>      Optional. Default: https://api.eggai.icu/v1
  --language <value>   Optional. zh-cn or en-us. Default: zh-cn
  --dry-run            Check what would happen without installing or writing files.
  --help              Show this help.

Environment variables are also supported:
  SK_KEY, EGGAI_API_KEY, BASE_URL, LANGUAGE, CODEX_HOME, DRY_RUN
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --sk-key|--sk_key|-k)
      SK_KEY="${2:-}"
      shift 2
      ;;
    --baseurl|--base-url|-b)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --language|--lang|-l)
      LANGUAGE="${2:-}"
      shift 2
      ;;
    --dry-run|--check)
      DRY_RUN=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

say() {
  case "$1" in
    install) echo "Installing or updating Codex..." ;;
    config) echo "Writing EggAi Codex configuration..." ;;
    login) echo "Writing Codex API key login cache..." ;;
    done) echo "Done: Codex is configured to use EggAi." ;;
    *) echo "$1" ;;
  esac
}

fail() {
  echo "Error: $1" >&2
  exit 1
}

case "$LANGUAGE" in
  zh-cn|en-us) ;;
  *) fail "language must be zh-cn or en-us." ;;
esac

case "$BASE_URL" in
  http://*|https://*) ;;
  *) fail "baseurl must start with http:// or https://." ;;
esac

case "$DRY_RUN" in
  1|true|TRUE|yes|YES) DRY_RUN=1 ;;
  0|false|FALSE|no|NO) DRY_RUN=0 ;;
  *) fail "DRY_RUN must be 1 or 0." ;;
esac

toml_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

developer_instructions() {
  if [ "$LANGUAGE" = "zh-cn" ]; then
    printf '%s' "请默认使用简体中文回答，除非用户明确要求其他语言。"
  else
    printf '%s' "Respond in English by default unless the user explicitly asks for another language."
  fi
}

print_plan() {
  if [ -n "$SK_KEY" ]; then
    api_key_status="provided (redacted)"
  else
    api_key_status="missing"
  fi

  echo "EggAi Codex installer dry run"
  echo "Mode: dry-run"
  echo "Installer URL: $OFFICIAL_INSTALLER_URL"
  echo "Codex home: $CODEX_HOME"
  echo "Config file: $CONFIG_FILE"
  echo "Backup file: $CONFIG_FILE.eggai.bak"
  echo "Base URL: $BASE_URL"
  echo "Language: $LANGUAGE"
  echo "API key: $api_key_status"
  echo "Would install/update Codex: yes"
  echo "Would write config.toml: yes"
  echo "Would run codex login --with-api-key: yes"
  echo "Managed config preview:"
  echo "# >>> eggai-codex"
  echo "# Managed by EggDoc's EggAi Codex installer."
  echo "cli_auth_credentials_store = \"file\""
  echo "model_provider = \"eggai\""
  echo "developer_instructions = \"$(developer_instructions | sed 's/\\/\\\\/g; s/"/\\"/g')\""
  echo "# <<< eggai-codex"
  echo
  echo "[model_providers.eggai]"
  echo "name = \"EggAi\""
  echo "base_url = \"$(toml_escape "$BASE_URL")\""
  echo "wire_api = \"responses\""
  echo "requires_openai_auth = true"
}

if [ "$DRY_RUN" = "1" ]; then
  print_plan
  exit 0
fi

[ -n "$SK_KEY" ] || fail "sk-key is required. Pass --sk-key or set SK_KEY."

command -v curl >/dev/null 2>&1 || fail "curl is required."

say install
CODEX_NON_INTERACTIVE="${CODEX_NON_INTERACTIVE:-1}"
export CODEX_NON_INTERACTIVE
curl -fsSL "$OFFICIAL_INSTALLER_URL" | sh

if ! command -v codex >/dev/null 2>&1; then
  if [ -x "$CODEX_HOME/bin/codex" ]; then
    PATH="$CODEX_HOME/bin:$PATH"
    export PATH
  fi
fi

command -v codex >/dev/null 2>&1 || fail "codex was installed, but the codex command is not on PATH. Restart the shell and retry."

say config
mkdir -p "$CODEX_HOME"
touch "$CONFIG_FILE"
BACKUP_FILE="$CONFIG_FILE.eggai.bak"
cp "$CONFIG_FILE" "$BACKUP_FILE"

CLEAN_FILE="$CONFIG_FILE.eggai.clean"
TMP_FILE="$CONFIG_FILE.eggai.tmp"

awk '
  BEGIN {
    in_managed = 0
    in_eggai_provider = 0
    seen_table = 0
  }
  /^# >>> eggai-codex$/ {
    in_managed = 1
    next
  }
  /^# <<< eggai-codex$/ {
    in_managed = 0
    next
  }
  in_managed {
    next
  }
  /^[[:space:]]*\[model_providers\.eggai\][[:space:]]*$/ {
    in_eggai_provider = 1
    seen_table = 1
    next
  }
  /^[[:space:]]*\[/ {
    in_eggai_provider = 0
    seen_table = 1
  }
  in_eggai_provider {
    next
  }
  !seen_table && /^[[:space:]]*(cli_auth_credentials_store|developer_instructions|model_provider)[[:space:]]*=/ {
    next
  }
  {
    print
  }
' "$CONFIG_FILE" > "$CLEAN_FILE"

BASE_URL_ESCAPED="$(toml_escape "$BASE_URL")"
INSTRUCTIONS_ESCAPED="$(developer_instructions | sed 's/\\/\\\\/g; s/"/\\"/g')"

{
  echo "# >>> eggai-codex"
  echo "# Managed by EggDoc's EggAi Codex installer."
  echo "cli_auth_credentials_store = \"file\""
  echo "model_provider = \"eggai\""
  echo "developer_instructions = \"$INSTRUCTIONS_ESCAPED\""
  echo "# <<< eggai-codex"
  echo
  cat "$CLEAN_FILE"
  echo
  echo "[model_providers.eggai]"
  echo "name = \"EggAi\""
  echo "base_url = \"$BASE_URL_ESCAPED\""
  echo "wire_api = \"responses\""
  echo "requires_openai_auth = true"
} > "$TMP_FILE"

mv "$TMP_FILE" "$CONFIG_FILE"
rm -f "$CLEAN_FILE"

say login
printf '%s' "$SK_KEY" | codex login --with-api-key >/dev/null
codex login status >/dev/null 2>&1 || fail "Codex login did not complete successfully."

say done
echo "Config: $CONFIG_FILE"
echo "Backup: $BACKUP_FILE"
