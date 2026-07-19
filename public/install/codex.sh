#!/usr/bin/env sh
set -eu
umask 077

DEFAULT_BASE_URL="https://api.eggai.icu/v1"
BASE_URL="${BASE_URL:-$DEFAULT_BASE_URL}"
SK_KEY="${SK_KEY:-${EGGAI_API_KEY:-}}"
LANGUAGE="${LANGUAGE:-zh-cn}"
MODEL="${MODEL:-${CODEX_MODEL:-}}"
DRY_RUN="${DRY_RUN:-0}"
GATEWAY_TIMEOUT_SECONDS="${EGGDOC_GATEWAY_TIMEOUT_SECONDS:-60}"
EGGAI_MODE=0
OFFICIAL_INSTALLER_URL="${CODEX_INSTALLER_URL:-https://chatgpt.com/codex/install.sh}"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
CONFIG_FILE="$CODEX_HOME/config.toml"
EGGAI_ENV_FILE="$CODEX_HOME/eggai.env"

usage() {
  cat <<'EOF'
Usage:
  curl -fsSL https://eggdoc.pages.dev/install/codex.sh | sh
  curl -fsSL https://eggdoc.pages.dev/install/codex.sh | sh -s -- --eggai --sk-key sk-...

Options:
  --eggai              Configure Codex to use EggAi after installation.
  --sk-key <key>       Required with --eggai. EggAi API key.
  --baseurl <url>      Optional. Default: https://api.eggai.icu/v1
  --language <value>   Optional. zh-cn or en-us. Default: zh-cn
  --model <id>         Optional. Set Codex's default model for EggAi.
  --dry-run            Check what would happen without installing or writing files.
  --help               Show this help.

Environment variables are also supported:
  SK_KEY, EGGAI_API_KEY, BASE_URL, LANGUAGE, MODEL, CODEX_HOME,
  CODEX_INSTALL_DIR, CODEX_INSTALLER_URL, CODEX_NON_INTERACTIVE, CODEX_PROFILE,
  EGGDOC_GATEWAY_TIMEOUT_SECONDS, DRY_RUN
EOF
}

require_option_value() {
  if [ "$#" -lt 2 ] || [ -z "${2+x}" ]; then
    echo "Error: $1 requires a value." >&2
    usage >&2
    exit 2
  fi
  case "$2" in
    -*)
      echo "Error: $1 requires a value, not an option." >&2
      usage >&2
      exit 2
      ;;
  esac
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --eggai)
      EGGAI_MODE=1
      shift
      ;;
    --sk-key|--sk_key|-k)
      require_option_value "$@"
      SK_KEY="${2:-}"
      shift 2
      ;;
    --baseurl|--base-url|-b)
      require_option_value "$@"
      BASE_URL="${2:-}"
      shift 2
      ;;
    --language|--lang|-l)
      require_option_value "$@"
      LANGUAGE="${2:-}"
      shift 2
      ;;
    --model|-m)
      require_option_value "$@"
      MODEL="${2:-}"
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
    verify) echo "Verifying the EggAi Codex endpoint..." ;;
    install) echo "Installing or updating Codex..." ;;
    config) echo "Writing EggAi Codex configuration..." ;;
    env) echo "Saving EggAi API key for provider-scoped authentication..." ;;
    done) echo "Done: Codex is installed." ;;
    eggai_done) echo "Done: Codex is installed and configured to use EggAi." ;;
    *) echo "$1" ;;
  esac
}

fail() {
  echo "Error: $1" >&2
  exit 1
}

case "$DRY_RUN" in
  1|true|TRUE|yes|YES) DRY_RUN=1 ;;
  0|false|FALSE|no|NO) DRY_RUN=0 ;;
  *) fail "DRY_RUN must be 1 or 0." ;;
esac

case "$EGGAI_MODE" in
  1|true|TRUE|yes|YES) EGGAI_MODE=1 ;;
  0|false|FALSE|no|NO) EGGAI_MODE=0 ;;
  *) fail "EGGAI_MODE must be 1 or 0." ;;
esac

case "$GATEWAY_TIMEOUT_SECONDS" in
  ''|*[!0-9]*|0) fail "EGGDOC_GATEWAY_TIMEOUT_SECONDS must be a positive integer." ;;
esac

validate_base_url() {
  case "$1" in
    *[[:space:]]*|*[[:cntrl:]]*) fail "baseurl must not contain whitespace or control characters." ;;
  esac

  case "$1" in
    http://*|https://*) ;;
    *) fail "baseurl must start with http:// or https://." ;;
  esac

  case "$1" in
    *\?*) fail "baseurl must not contain a query string." ;;
    *\#*) fail "baseurl must not contain a fragment." ;;
  esac

  base_url_authority="${1#*://}"
  base_url_hostport="${base_url_authority%%/*}"
  base_url_hostport="${base_url_hostport%%\?*}"
  base_url_hostport="${base_url_hostport%%\#*}"
  case "$base_url_hostport" in
    ""|:*|*:|/*|\?*|\#*|*@*|*\\*)
      fail "baseurl must include a host and must not contain user information."
      ;;
  esac
}

verify_eggai_codex_endpoint() {
  models_url="${BASE_URL%/}/models"
  if command -v curl >/dev/null 2>&1; then
    if ! models_status="$(curl -sS --retry 2 --connect-timeout 15 --max-time "$GATEWAY_TIMEOUT_SECONDS" \
      -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $SK_KEY" -- "$models_url")"; then
      fail "could not reach the EggAi Codex endpoint. Check the selected EggAi group, proxy, and network."
    fi
    case "$models_status" in
      2??) ;;
      *) fail "EggAi Codex endpoint verification returned HTTP $models_status. Check the selected EggAi group and API key." ;;
    esac
  elif command -v wget >/dev/null 2>&1; then
    if ! wget -q --timeout="$GATEWAY_TIMEOUT_SECONDS" --tries=3 \
      --header="Authorization: Bearer $SK_KEY" -O /dev/null "$models_url"; then
      fail "could not verify the EggAi Codex endpoint. Check the selected EggAi group, proxy, and network."
    fi
  else
    fail "curl or wget is required to verify the EggAi Codex endpoint."
  fi
}

if [ "$EGGAI_MODE" = "1" ]; then
  case "$LANGUAGE" in
    zh-cn|en-us) ;;
    *) fail "language must be zh-cn or en-us." ;;
  esac
  if [ -n "$MODEL" ]; then
    case "$MODEL" in
      *[!A-Za-z0-9._:/-]*) fail "model contains unsupported characters." ;;
    esac
  fi
  validate_base_url "$BASE_URL"
  case "$SK_KEY" in
    *[[:space:]]*|*[[:cntrl:]]*) fail "sk-key must not contain whitespace or control characters." ;;
  esac
fi

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

shell_single_quote() {
  printf "'"
  printf '%s' "$1" | sed "s/'/'\\\\''/g"
  printf "'"
}

select_shell_profile() {
  if [ -n "${CODEX_PROFILE:-}" ]; then
    printf '%s' "$CODEX_PROFILE"
    return
  fi

  case "${SHELL:-}" in
    */zsh) printf '%s' "${ZDOTDIR:-$HOME}/.zshrc" ;;
    */bash) printf '%s' "$HOME/.bashrc" ;;
    *) printf '%s' "$HOME/.profile" ;;
  esac
}

print_plan() {
  echo "Codex installer dry run"
  echo "Mode: $([ "$EGGAI_MODE" = "1" ] && echo eggai || echo default)"
  echo "Installer URL: $OFFICIAL_INSTALLER_URL"
  echo "Codex home: $CODEX_HOME"
  echo "Would install/update Codex: yes"

  if [ "$EGGAI_MODE" = "0" ]; then
    echo "Would write config.toml: no"
    echo "Would change existing Codex login: no"
    return
  fi

  if [ -n "$SK_KEY" ]; then
    api_key_status="provided (redacted)"
  else
    api_key_status="missing"
  fi

  echo "Config file: $CONFIG_FILE"
  echo "Backup file: $CONFIG_FILE.eggai.bak"
  echo "Base URL: $BASE_URL"
  echo "Language: $LANGUAGE"
  if [ -n "$MODEL" ]; then
    echo "Model: $MODEL"
  else
    echo "Model: Codex provider default"
  fi
  echo "API key: $api_key_status"
  echo "Would write config.toml: yes"
  echo "Would save EGGAI_API_KEY for provider-scoped authentication: yes"
  echo "Would verify EggAi endpoint before installation: yes"
  echo "Would change existing Codex login: no"
  echo "Shell profile: $(select_shell_profile)"
  echo "Managed config preview:"
  echo "# >>> eggai-codex"
  echo "# Managed by EggDoc's EggAi Codex installer."
  echo "model_provider = \"eggai\""
  echo "developer_instructions = \"$(developer_instructions | sed 's/\\/\\\\/g; s/"/\\"/g')\""
  if [ -n "$MODEL" ]; then
    echo "model = \"$(toml_escape "$MODEL")\""
  fi
  echo "# <<< eggai-codex"
  echo
  echo "[model_providers.eggai]"
  echo "name = \"EggAi\""
  echo "base_url = \"$(toml_escape "$BASE_URL")\""
  echo "env_key = \"EGGAI_API_KEY\""
  echo "env_key_instructions = \"EggDoc stores EGGAI_API_KEY in the user environment.\""
  echo "wire_api = \"responses\""
}

if [ "$DRY_RUN" = "1" ]; then
  print_plan
  exit 0
fi

if [ "$EGGAI_MODE" = "1" ]; then
  [ -n "$SK_KEY" ] || fail "sk-key is required with --eggai. Pass --sk-key or set SK_KEY."
  say verify
  verify_eggai_codex_endpoint
fi

command -v mktemp >/dev/null 2>&1 || fail "mktemp is required."

INSTALLER_TMP=""
CLEAN_FILE=""
CONFIG_TMP=""
BACKUP_TMP=""
EGGAI_ENV_TMP=""
PROFILE_TMP=""
EGGAI_ENV_BACKUP_TMP=""
PROFILE_BACKUP_TMP=""
EGGAI_ENV_CHANGED=0
PROFILE_CHANGED=0
cleanup() {
  [ -z "$INSTALLER_TMP" ] || rm -f "$INSTALLER_TMP"
  [ -z "$CLEAN_FILE" ] || rm -f "$CLEAN_FILE"
  [ -z "$CONFIG_TMP" ] || rm -f "$CONFIG_TMP"
  [ -z "$BACKUP_TMP" ] || rm -f "$BACKUP_TMP"
  [ -z "$EGGAI_ENV_TMP" ] || rm -f "$EGGAI_ENV_TMP"
  [ -z "$PROFILE_TMP" ] || rm -f "$PROFILE_TMP"
  [ -z "$EGGAI_ENV_BACKUP_TMP" ] || rm -f "$EGGAI_ENV_BACKUP_TMP"
  [ -z "$PROFILE_BACKUP_TMP" ] || rm -f "$PROFILE_BACKUP_TMP"
}
trap cleanup EXIT
trap 'exit 130' HUP INT
trap 'exit 143' TERM

INSTALLER_TMP="$(mktemp "${TMPDIR:-/tmp}/eggdoc-codex-installer.XXXXXX")" || \
  fail "could not create a temporary installer file."

say install
CODEX_NON_INTERACTIVE="${CODEX_NON_INTERACTIVE:-1}"
export CODEX_NON_INTERACTIVE
if command -v curl >/dev/null 2>&1; then
  if ! curl -fsSL --retry 2 --connect-timeout 15 --max-time 300 \
    -o "$INSTALLER_TMP" -- "$OFFICIAL_INSTALLER_URL"; then
    fail "could not download the official Codex installer. Check network and region availability."
  fi
elif command -v wget >/dev/null 2>&1; then
  if ! wget -q -O "$INSTALLER_TMP" "$OFFICIAL_INSTALLER_URL"; then
    fail "could not download the official Codex installer. Check network and region availability."
  fi
else
  fail "curl or wget is required."
fi

[ -s "$INSTALLER_TMP" ] || fail "the official Codex installer response was empty."
FIRST_CONTENT_LINE="$(sed -n '/[^[:space:]]/ { p; q; }' "$INSTALLER_TMP")"
[ -n "$FIRST_CONTENT_LINE" ] || fail "the official Codex installer response was empty."
case "$FIRST_CONTENT_LINE" in
  \<*) fail "the official Codex installer returned HTML instead of a script. Check network and region availability." ;;
esac

if sh "$INSTALLER_TMP"; then
  :
else
  installer_exit_code=$?
  fail "the official Codex installer did not complete successfully (exit code $installer_exit_code)."
fi

CODEX_COMMAND=""
CODEX_INSTALL_DIR="${CODEX_INSTALL_DIR:-$HOME/.local/bin}"
for CODEX_CANDIDATE in \
  "$CODEX_INSTALL_DIR/codex" \
  "$CODEX_HOME/bin/codex" \
  "$HOME/bin/codex" \
  "/usr/local/bin/codex"; do
  if [ -f "$CODEX_CANDIDATE" ]; then
    CODEX_COMMAND="$CODEX_CANDIDATE"
    CODEX_CANDIDATE_DIR="${CODEX_CANDIDATE%/*}"
    PATH="$CODEX_CANDIDATE_DIR:$PATH"
    export PATH
    break
  fi
done
if [ -z "$CODEX_COMMAND" ]; then
  CODEX_COMMAND="$(command -v codex || true)"
fi

[ -n "$CODEX_COMMAND" ] || fail "codex was installed, but the codex command is not on PATH. Restart the shell and retry."
VERSION_OUTPUT="$("$CODEX_COMMAND" --version)" || fail "codex --version failed after installation."
[ -n "$VERSION_OUTPUT" ] || fail "codex --version returned no version information."

if [ "$EGGAI_MODE" = "0" ]; then
  say done
  echo "$VERSION_OUTPUT"
  exit 0
fi

say config
mkdir -p "$CODEX_HOME"
chmod 700 "$CODEX_HOME" || fail "could not secure the Codex home directory."
CONFIG_EXISTED=0
CONFIG_CHANGED=0
BACKUP_FILE=""
if [ -f "$CONFIG_FILE" ]; then
  CONFIG_EXISTED=1
  CONFIG_SOURCE="$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE" || fail "could not secure the Codex configuration file."
else
  CONFIG_SOURCE="/dev/null"
fi

CLEAN_FILE="$(mktemp "$CODEX_HOME/.config.toml.eggai.clean.XXXXXX")" || \
  fail "could not create a temporary Codex configuration file."
CONFIG_TMP="$(mktemp "$CODEX_HOME/.config.toml.eggai.XXXXXX")" || \
  fail "could not create a temporary Codex configuration file."
chmod 600 "$CLEAN_FILE" "$CONFIG_TMP" || fail "could not secure temporary Codex configuration files."

REMOVE_MODEL=0
[ -z "$MODEL" ] || REMOVE_MODEL=1
awk -v remove_model="$REMOVE_MODEL" '
  BEGIN {
    in_managed = 0
    in_eggai_provider = 0
    seen_table = 0
    kept_started = 0
    pending_blank = 0
    managed_start = 0
    managed_end = 0
    managed_open = 0
    malformed_managed = 0
  }
  /^# >>> eggai-codex$/ {
    if (managed_open) {
      malformed_managed = 1
    }
    managed_start++
    managed_open = 1
    in_managed = 1
    next
  }
  /^# <<< eggai-codex$/ {
    if (!managed_open) {
      malformed_managed = 1
    }
    managed_end++
    managed_open = 0
    in_managed = 0
    next
  }
  in_managed {
    next
  }
  /^[[:space:]]*\[[[:space:]]*\[?[[:space:]]*model_providers[[:space:]]*\.[[:space:]]*(eggai|"eggai"|\047eggai\047)([[:space:]]*\.[^]]+)?[[:space:]]*\]?[[:space:]]*\][[:space:]]*(#.*)?$/ {
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
  !seen_table && /^[[:space:]]*(developer_instructions|model_provider|model_providers[.][[:space:]]*(eggai|"eggai"|\047eggai\047))[[:space:]]*=/ {
    next
  }
  !seen_table && remove_model && /^[[:space:]]*model[[:space:]]*=/ {
    next
  }
  {
    if ($0 ~ /^[[:space:]]*$/) {
      if (kept_started) {
        pending_blank++
      }
      next
    }
    while (pending_blank > 0) {
      print ""
      pending_blank--
    }
    print
    kept_started = 1
  }
  END {
    if (managed_open || malformed_managed || managed_start != managed_end) {
      exit 42
    }
  }
' "$CONFIG_SOURCE" > "$CLEAN_FILE" || {
  awk_exit=$?
  if [ "$awk_exit" = "42" ]; then
    fail "config.toml contains an incomplete EggAi managed block. Restore the backup or remove the incomplete block, then retry."
  fi
  fail "could not read config.toml while preparing the EggAi configuration."
}

BASE_URL_ESCAPED="$(toml_escape "$BASE_URL")"
INSTRUCTIONS_ESCAPED="$(developer_instructions | sed 's/\\/\\\\/g; s/"/\\"/g')"
MODEL_ESCAPED="$(toml_escape "$MODEL")"

{
  echo "# >>> eggai-codex"
  echo "# Managed by EggDoc's EggAi Codex installer."
  echo "model_provider = \"eggai\""
  echo "developer_instructions = \"$INSTRUCTIONS_ESCAPED\""
  if [ -n "$MODEL" ]; then
    echo "model = \"$MODEL_ESCAPED\""
  fi
  echo "# <<< eggai-codex"
  echo
  if [ -s "$CLEAN_FILE" ]; then
    cat "$CLEAN_FILE"
    echo
  fi
  echo "[model_providers.eggai]"
  echo "name = \"EggAi\""
  echo "base_url = \"$BASE_URL_ESCAPED\""
  echo "env_key = \"EGGAI_API_KEY\""
  echo "env_key_instructions = \"EggDoc stores EGGAI_API_KEY in the user environment.\""
  echo "wire_api = \"responses\""
} > "$CONFIG_TMP"

rm -f "$CLEAN_FILE"
CLEAN_FILE=""

if [ "$CONFIG_EXISTED" = "1" ] && cmp -s "$CONFIG_FILE" "$CONFIG_TMP"; then
  rm -f "$CONFIG_TMP"
  CONFIG_TMP=""
else
  if [ "$CONFIG_EXISTED" = "1" ]; then
    BACKUP_FILE="$CONFIG_FILE.eggai.bak"
    BACKUP_TMP="$(mktemp "$CODEX_HOME/.config.toml.eggai.backup.XXXXXX")" || \
      fail "could not create a temporary Codex configuration backup."
    cp "$CONFIG_FILE" "$BACKUP_TMP"
    chmod 600 "$BACKUP_TMP" || fail "could not secure the Codex configuration backup."
    mv "$BACKUP_TMP" "$BACKUP_FILE"
    BACKUP_TMP=""
  fi
  mv "$CONFIG_TMP" "$CONFIG_FILE"
  CONFIG_TMP=""
  CONFIG_CHANGED=1
fi

restore_previous_config() {
  [ "$CONFIG_CHANGED" = "1" ] || return 0
  if [ "$CONFIG_EXISTED" = "1" ]; then
    BACKUP_TMP="$(mktemp "$CODEX_HOME/.config.toml.eggai.restore.XXXXXX")" || return 1
    cp "$BACKUP_FILE" "$BACKUP_TMP" || return 1
    chmod 600 "$BACKUP_TMP" || return 1
    mv "$BACKUP_TMP" "$CONFIG_FILE" || return 1
    BACKUP_TMP=""
  else
    rm -f "$CONFIG_FILE" || return 1
  fi
}

rollback_eggai_api_key() {
  rollback_status=0

  if [ "$EGGAI_ENV_CHANGED" = "1" ]; then
    if [ "$EGGAI_ENV_EXISTED" = "1" ]; then
      if [ -z "$EGGAI_ENV_BACKUP_TMP" ] || ! cp -p "$EGGAI_ENV_BACKUP_TMP" "$EGGAI_ENV_FILE"; then
        rollback_status=1
      fi
    elif ! rm -f "$EGGAI_ENV_FILE"; then
      rollback_status=1
    fi
  fi

  if [ "$PROFILE_CHANGED" = "1" ]; then
    if [ "$PROFILE_EXISTED" = "1" ]; then
      if [ -z "$PROFILE_BACKUP_TMP" ] || ! cp -p "$PROFILE_BACKUP_TMP" "$PROFILE_FILE"; then
        rollback_status=1
      fi
    elif ! rm -f "$PROFILE_FILE"; then
      rollback_status=1
    fi
  fi

  if [ "$rollback_status" = "0" ]; then
    EGGAI_ENV_CHANGED=0
    PROFILE_CHANGED=0
  fi
  return "$rollback_status"
}

save_eggai_api_key() {
  EGGAI_ENV_EXISTED=0
  PROFILE_EXISTED=0
  EGGAI_ENV_CHANGED=0
  PROFILE_CHANGED=0

  if [ -e "$EGGAI_ENV_FILE" ]; then
    [ -f "$EGGAI_ENV_FILE" ] || return 1
    [ ! -L "$EGGAI_ENV_FILE" ] || return 1
    EGGAI_ENV_EXISTED=1
  fi

  EGGAI_ENV_TMP="$(mktemp "$CODEX_HOME/.eggai.env.XXXXXX")" || return 1
  chmod 600 "$EGGAI_ENV_TMP" || return 1
  {
    echo "# Managed by EggDoc's EggAi Codex installer."
    printf 'EGGAI_API_KEY='
    shell_single_quote "$SK_KEY"
    printf '\nexport EGGAI_API_KEY\n'
  } > "$EGGAI_ENV_TMP" || return 1

  PROFILE_FILE="$(select_shell_profile)"
  [ "$PROFILE_FILE" != "$CONFIG_FILE" ] || return 1
  [ "$PROFILE_FILE" != "$EGGAI_ENV_FILE" ] || return 1
  [ ! -L "$PROFILE_FILE" ] || return 1
  PROFILE_DIR="${PROFILE_FILE%/*}"
  if [ "$PROFILE_DIR" = "$PROFILE_FILE" ]; then
    PROFILE_DIR="."
  fi
  mkdir -p "$PROFILE_DIR" || return 1
  if [ -e "$PROFILE_FILE" ] && [ ! -f "$PROFILE_FILE" ]; then
    return 1
  fi
  if [ -f "$PROFILE_FILE" ]; then
    PROFILE_EXISTED=1
  fi

  PROFILE_TMP="$(mktemp "$PROFILE_DIR/.eggai-codex-profile.XXXXXX")" || return 1
  if [ "$PROFILE_EXISTED" = "1" ]; then
    cp -p "$PROFILE_FILE" "$PROFILE_TMP" || return 1
    PROFILE_SOURCE="$PROFILE_FILE"
  else
    chmod 600 "$PROFILE_TMP" || return 1
    PROFILE_SOURCE="/dev/null"
  fi

  awk '
    BEGIN { in_managed = 0; managed_open = 0; malformed = 0; started = 0; pending_blank = 0 }
    /^# >>> eggai-codex-env$/ {
      if (managed_open) malformed = 1
      managed_open = 1
      in_managed = 1
      next
    }
    /^# <<< eggai-codex-env$/ {
      if (!managed_open) malformed = 1
      managed_open = 0
      in_managed = 0
      next
    }
    in_managed { next }
    /^[[:space:]]*$/ {
      if (started) pending_blank++
      next
    }
    {
      while (pending_blank > 0) {
        print ""
        pending_blank--
      }
      print
      started = 1
    }
    END { if (managed_open || malformed) exit 42 }
  ' "$PROFILE_SOURCE" > "$PROFILE_TMP" || return 1

  if [ -s "$PROFILE_TMP" ]; then
    printf '\n' >> "$PROFILE_TMP" || return 1
  fi
  {
    echo "# >>> eggai-codex-env"
    printf '. '
    shell_single_quote "$EGGAI_ENV_FILE"
    printf '\n'
    echo "# <<< eggai-codex-env"
  } >> "$PROFILE_TMP" || return 1

  if [ "$EGGAI_ENV_EXISTED" = "1" ] && cmp -s "$EGGAI_ENV_FILE" "$EGGAI_ENV_TMP"; then
    chmod 600 "$EGGAI_ENV_FILE" || return 1
    rm -f "$EGGAI_ENV_TMP" || return 1
    EGGAI_ENV_TMP=""
  else
    if [ "$EGGAI_ENV_EXISTED" = "1" ]; then
      EGGAI_ENV_BACKUP_TMP="$(mktemp "$CODEX_HOME/.eggai.env.backup.XXXXXX")" || return 1
      cp -p "$EGGAI_ENV_FILE" "$EGGAI_ENV_BACKUP_TMP" || return 1
      chmod 600 "$EGGAI_ENV_BACKUP_TMP" || return 1
    fi
    EGGAI_ENV_CHANGED=1
  fi

  if [ "$PROFILE_EXISTED" = "1" ] && cmp -s "$PROFILE_FILE" "$PROFILE_TMP"; then
    rm -f "$PROFILE_TMP" || return 1
    PROFILE_TMP=""
  else
    if [ "$PROFILE_EXISTED" = "1" ]; then
      PROFILE_BACKUP_TMP="$(mktemp "$PROFILE_DIR/.eggai-codex-profile-backup.XXXXXX")" || return 1
      cp -p "$PROFILE_FILE" "$PROFILE_BACKUP_TMP" || return 1
    fi
    PROFILE_CHANGED=1
  fi

  if [ "$EGGAI_ENV_CHANGED" = "1" ]; then
    mv "$EGGAI_ENV_TMP" "$EGGAI_ENV_FILE" || return 1
    EGGAI_ENV_TMP=""
  fi
  if [ "$PROFILE_CHANGED" = "1" ]; then
    mv "$PROFILE_TMP" "$PROFILE_FILE" || return 1
    PROFILE_TMP=""
  fi

  EGGAI_API_KEY="$SK_KEY"
  export EGGAI_API_KEY
  [ "$EGGAI_API_KEY" = "$SK_KEY" ] || return 1
  return 0
}

trap 'rollback_eggai_api_key >/dev/null 2>&1 || :; exit 130' HUP INT
trap 'rollback_eggai_api_key >/dev/null 2>&1 || :; exit 143' TERM

say env
if ! save_eggai_api_key; then
  rollback_eggai_api_key || fail "could not save EGGAI_API_KEY and the previous environment/profile could not be restored."
  restore_previous_config || fail "could not save EGGAI_API_KEY and the previous configuration could not be restored."
  fail "could not save EGGAI_API_KEY. The previous configuration was restored."
fi

say eggai_done
echo "$VERSION_OUTPUT"
echo "Config: $CONFIG_FILE"
echo "Environment: $EGGAI_ENV_FILE"
if [ -n "$BACKUP_FILE" ]; then
  echo "Backup: $BACKUP_FILE"
elif [ "$CONFIG_EXISTED" = "1" ] && [ "$CONFIG_CHANGED" = "0" ]; then
  echo "Backup: unchanged (configuration already current)"
else
  echo "Backup: not needed (new configuration)"
fi
