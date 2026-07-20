#!/usr/bin/env sh
set -eu
umask 077

OFFICIAL_INSTALLER_URL="https://claude.ai/install.sh"
NPM_REGISTRY="${NPM_CONFIG_REGISTRY:-https://registry.npmmirror.com}"
INSTALL_TARGET="${CLAUDE_CODE_VERSION:-latest}"
DRY_RUN="${DRY_RUN:-0}"
GATEWAY_TIMEOUT_SECONDS="${EGGDOC_GATEWAY_TIMEOUT_SECONDS:-60}"
BASE_URL="${BASE_URL:-https://api.eggai.icu/v1}"
SK_KEY="${SK_KEY:-${EGGAI_API_KEY:-}}"
MODEL="${MODEL:-${ANTHROPIC_MODEL:-}}"
OPUS_MODEL="${OPUS_MODEL:-${ANTHROPIC_DEFAULT_OPUS_MODEL:-}}"
SONNET_MODEL="${SONNET_MODEL:-${ANTHROPIC_DEFAULT_SONNET_MODEL:-}}"
HAIKU_MODEL="${HAIKU_MODEL:-${ANTHROPIC_DEFAULT_HAIKU_MODEL:-}}"
FABLE_MODEL="${FABLE_MODEL:-${ANTHROPIC_DEFAULT_FABLE_MODEL:-}}"
EGGAI_MODE=0
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
SETTINGS_FILE="$CLAUDE_HOME/settings.json"

usage() {
  cat <<'EOF'
Usage:
  (installer="$(mktemp)" && trap 'rm -f "$installer"' 0 && trap 'exit 129' HUP && trap 'exit 130' INT && trap 'exit 143' TERM && curl -fsSL --retry 2 --connect-timeout 15 --max-time 120 -o "$installer" https://doc.eggai.icu/install/claude-code.sh && [ -s "$installer" ] && sh "$installer")
  (installer="$(mktemp)" && trap 'rm -f "$installer"' 0 && trap 'exit 129' HUP && trap 'exit 130' INT && trap 'exit 143' TERM && curl -fsSL --retry 2 --connect-timeout 15 --max-time 120 -o "$installer" https://doc.eggai.icu/install/claude-code.sh && [ -s "$installer" ] && sh "$installer" --eggai --sk-key sk-... --model claude-...)
  (installer="$(mktemp)" && trap 'rm -f "$installer"' 0 && trap 'exit 129' HUP && trap 'exit 130' INT && trap 'exit 143' TERM && curl -fsSL --retry 2 --connect-timeout 15 --max-time 120 -o "$installer" https://doc.eggai.icu/install/claude-code.sh && [ -s "$installer" ] && sh "$installer" --version stable)

Options:
  --eggai            Configure Claude Code to use EggAi after installation.
  --sk-key <key>     Required with --eggai. EggAi API key.
  --baseurl <url>    Optional. Default: https://api.eggai.icu/v1
  --model <id>       Required with --eggai. Claude model available to this account.
  --opus-model <id>  Optional. Opus role model. Defaults to --model.
  --sonnet-model <id> Optional. Sonnet role model. Defaults to --model.
  --haiku-model <id> Optional. Haiku role model. Defaults to --model.
  --fable-model <id> Optional. Fable role model. Defaults to --model.
  --version <value>   latest, stable, or a numeric dotted version. Default: latest
  --dry-run           Check what would happen without downloading or installing.
  --help              Show this help.

Environment variables are also supported:
  CLAUDE_CODE_VERSION, CLAUDE_HOME, SK_KEY, EGGAI_API_KEY,
  BASE_URL, MODEL, ANTHROPIC_MODEL, OPUS_MODEL, SONNET_MODEL, HAIKU_MODEL, FABLE_MODEL,
  EGGDOC_GATEWAY_TIMEOUT_SECONDS, NPM_CONFIG_REGISTRY, DRY_RUN
EOF
}

fail() {
  echo "Error: $1" >&2
  exit 1
}

valid_install_target() (
  case "$1" in
    latest|stable) exit 0 ;;
    ""|.*|*.|*..*|*[!0-9.]*) exit 1 ;;
  esac

  IFS=.
  set -- $1
  [ "$#" -ge 3 ] || exit 1
  for part in "$@"; do
    case "$part" in
      ""|*[!0-9]*) exit 1 ;;
    esac
  done
)

while [ "$#" -gt 0 ]; do
  case "$1" in
    --eggai)
      EGGAI_MODE=1
      shift
      ;;
    --sk-key|--sk_key|-k)
      [ "$#" -ge 2 ] || fail "$1 requires a value."
      SK_KEY="$2"
      shift 2
      ;;
    --baseurl|--base-url|-b)
      [ "$#" -ge 2 ] || fail "$1 requires a value."
      BASE_URL="$2"
      shift 2
      ;;
    --model|-m)
      [ "$#" -ge 2 ] || fail "$1 requires a value."
      MODEL="$2"
      shift 2
      ;;
    --opus-model)
      [ "$#" -ge 2 ] || fail "$1 requires a value."
      OPUS_MODEL="$2"
      shift 2
      ;;
    --sonnet-model)
      [ "$#" -ge 2 ] || fail "$1 requires a value."
      SONNET_MODEL="$2"
      shift 2
      ;;
    --haiku-model)
      [ "$#" -ge 2 ] || fail "$1 requires a value."
      HAIKU_MODEL="$2"
      shift 2
      ;;
    --fable-model)
      [ "$#" -ge 2 ] || fail "$1 requires a value."
      FABLE_MODEL="$2"
      shift 2
      ;;
    --version|--channel)
      [ "$#" -ge 2 ] || fail "$1 requires a value."
      INSTALL_TARGET="$2"
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
      fail "unknown option: $1"
      ;;
  esac
done

case "$DRY_RUN" in
  1|true|TRUE|yes|YES) DRY_RUN=1 ;;
  0|false|FALSE|no|NO) DRY_RUN=0 ;;
  *) fail "DRY_RUN must be 1 or 0." ;;
esac

case "$GATEWAY_TIMEOUT_SECONDS" in
  ''|*[!0-9]*|0) fail "EGGDOC_GATEWAY_TIMEOUT_SECONDS must be a positive integer." ;;
esac

valid_install_target "$INSTALL_TARGET" || \
  fail "version must be latest, stable, or a numeric dotted version."

normalize_base_url() {
  normalized="${1%/}"
  case "$normalized" in
    */v1) normalized="${normalized%/v1}" ;;
  esac
  printf '%s' "$normalized"
}

if [ "$EGGAI_MODE" = "1" ]; then
  [ -n "$SK_KEY" ] || fail "sk-key is required with --eggai. Pass --sk-key or set SK_KEY."
  [ -n "$MODEL" ] || fail "model is required with --eggai. Pass --model or set MODEL."
  OPUS_MODEL="${OPUS_MODEL:-$MODEL}"
  SONNET_MODEL="${SONNET_MODEL:-$MODEL}"
  HAIKU_MODEL="${HAIKU_MODEL:-$MODEL}"
  FABLE_MODEL="${FABLE_MODEL:-$MODEL}"
  for configured_model in "$MODEL" "$OPUS_MODEL" "$SONNET_MODEL" "$HAIKU_MODEL" "$FABLE_MODEL"; do
    case "$configured_model" in
      *[!A-Za-z0-9._:/-]*) fail "model contains unsupported characters." ;;
    esac
  done
  case "$BASE_URL" in
    https://?*) ;;
    *) fail "baseurl must be an HTTPS URL." ;;
  esac
  BASE_URL_AUTHORITY="${BASE_URL#https://}"
  BASE_URL_AUTHORITY="${BASE_URL_AUTHORITY%%/*}"
  case "$BASE_URL_AUTHORITY" in
    ""|:*|*:|/*|*@*) fail "baseurl must contain a host and no user information." ;;
  esac
  case "$BASE_URL" in
    *[[:space:]?#]*) fail "baseurl must not contain whitespace, a query, or a fragment." ;;
  esac
  case "$SK_KEY" in
    *[[:space:]]*|*[[:cntrl:]]*) fail "sk-key must not contain whitespace or control characters." ;;
  esac
fi

ANTHROPIC_BASE_URL="$(normalize_base_url "$BASE_URL")"

if [ "$DRY_RUN" = "1" ]; then
  echo "Claude Code installer dry run"
  echo "Mode: $([ "$EGGAI_MODE" = "1" ] && echo eggai || echo default)"
  echo "Official installer URL: $OFFICIAL_INSTALLER_URL"
  echo "npm registry for installer subprocesses: $NPM_REGISTRY"
  echo "Release: $INSTALL_TARGET"
  echo "Would install/update Claude Code: yes"
  if [ "$EGGAI_MODE" = "1" ]; then
    echo "Settings file: $SETTINGS_FILE"
    echo "Backup file: $SETTINGS_FILE.eggai.bak"
    echo "Anthropic Base URL: $ANTHROPIC_BASE_URL"
    echo "Model: $MODEL"
    echo "Opus model: $OPUS_MODEL"
    echo "Sonnet model: $SONNET_MODEL"
    echo "Haiku model: $HAIKU_MODEL"
    echo "Fable model: $FABLE_MODEL"
    echo "Gateway timeout: ${GATEWAY_TIMEOUT_SECONDS}s"
    echo "API key: provided (redacted)"
    echo "Would modify Claude Code configuration: yes"
  else
    echo "Would modify Claude Code configuration: no"
  fi
  exit 0
fi

command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v bash >/dev/null 2>&1 || fail "bash is required."
command -v mktemp >/dev/null 2>&1 || fail "mktemp is required."

JSON_ENGINE=""
if [ "$EGGAI_MODE" = "1" ]; then
  if [ -n "${EGGDOC_JSON_ENGINE:-}" ]; then
    case "$EGGDOC_JSON_ENGINE" in
      node)
        node -e 'JSON.parse("{}")' >/dev/null 2>&1 || fail "node JSON support is not available."
        JSON_ENGINE=node
        ;;
      python3)
        python3 -c 'import json' >/dev/null 2>&1 || fail "python3 JSON support is not available."
        JSON_ENGINE=python3
        ;;
      jq)
        jq --version >/dev/null 2>&1 || fail "jq is not available."
        JSON_ENGINE=jq
        ;;
      perl)
        perl -MJSON::PP -e 1 >/dev/null 2>&1 || fail "Perl JSON::PP is not available."
        JSON_ENGINE=perl
        ;;
      *) fail "EGGDOC_JSON_ENGINE must be node, python3, jq, or perl." ;;
    esac
  elif command -v node >/dev/null 2>&1 && node -e 'JSON.parse("{}")' >/dev/null 2>&1; then
    JSON_ENGINE=node
  elif command -v python3 >/dev/null 2>&1 && python3 -c 'import json' >/dev/null 2>&1; then
    JSON_ENGINE=python3
  elif command -v jq >/dev/null 2>&1 && jq --version >/dev/null 2>&1; then
    JSON_ENGINE=jq
  elif command -v perl >/dev/null 2>&1 && perl -MJSON::PP -e 1 >/dev/null 2>&1; then
    JSON_ENGINE=perl
  else
    fail "EggAi configuration requires node, python3, jq, or Perl JSON::PP to merge settings.json safely."
  fi
fi

TMP_FILE=""
VERIFY_FILE=""
BACKUP_TMP=""
cleanup() {
  [ -z "$TMP_FILE" ] || rm -f "$TMP_FILE"
  [ -z "$VERIFY_FILE" ] || rm -f "$VERIFY_FILE"
  [ -z "$BACKUP_TMP" ] || rm -f "$BACKUP_TMP"
  if [ -n "${SETTINGS_TMP:-}" ]; then
    rm -f "$SETTINGS_TMP"
  fi
  if [ -n "${SETTINGS_SOURCE_TMP:-}" ]; then
    rm -f "$SETTINGS_SOURCE_TMP"
  fi
}
trap cleanup EXIT
trap 'exit 130' HUP INT
trap 'exit 143' TERM

TMP_FILE="$(mktemp "${TMPDIR:-/tmp}/eggdoc-claude-code-installer.XXXXXX")" || \
  fail "could not create a temporary installer file."
if [ "$EGGAI_MODE" = "1" ]; then
  VERIFY_FILE="$(mktemp "${TMPDIR:-/tmp}/eggdoc-claude-code-verify.XXXXXX")" || \
    fail "could not create a temporary gateway response file."
fi

if [ "$EGGAI_MODE" = "1" ]; then
  echo "Verifying the EggAi Claude gateway..."
  VERIFY_BODY="{\"model\":\"$MODEL\",\"max_tokens\":16,\"stream\":true,\"tools\":[{\"name\":\"eggdoc_check\",\"description\":\"Verify tool use\",\"input_schema\":{\"type\":\"object\",\"properties\":{},\"additionalProperties\":false}}],\"tool_choice\":{\"type\":\"tool\",\"name\":\"eggdoc_check\"},\"messages\":[{\"role\":\"user\",\"content\":\"Run the check tool.\"}]}"
  if ! HTTP_STATUS="$(curl -sS -o "$VERIFY_FILE" -w '%{http_code}' \
    --retry 2 --connect-timeout 15 --max-time "$GATEWAY_TIMEOUT_SECONDS" \
    -X POST "$ANTHROPIC_BASE_URL/v1/messages" \
    -H "Authorization: Bearer $SK_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    --data-binary "$VERIFY_BODY")"; then
    fail "could not reach the EggAi Anthropic Messages endpoint."
  fi
  case "$HTTP_STATUS" in
    2??) ;;
    *) fail "gateway verification returned HTTP $HTTP_STATUS. Check the selected EggAi group and Claude model." ;;
  esac
  case "$JSON_ENGINE" in
    node)
      node - "$VERIFY_FILE" <<'NODE' || fail "gateway verification did not return a valid streaming Anthropic tool-use response."
const fs = require("fs");
const blocks = fs.readFileSync(process.argv[2], "utf8").replace(/\r\n/g, "\n").split(/\n\n+/);
let state = 0;
for (const block of blocks) {
  const lines = block.split("\n");
  const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
  const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
  if (!event || !data) continue;
  const payload = JSON.parse(data);
  if (state === 0 && event === "message_start" && payload.type === "message_start" && payload.message?.id?.startsWith("msg_")) state = 1;
  else if (state === 1 && event === "content_block_start" && payload.type === "content_block_start" && payload.content_block?.type === "tool_use" && payload.content_block?.name === "eggdoc_check") state = 2;
  else if (state === 2 && event === "message_stop" && payload.type === "message_stop") state = 3;
}
if (state !== 3) process.exit(1);
NODE
      ;;
    python3)
      python3 - "$VERIFY_FILE" <<'PYTHON' || fail "gateway verification did not return a valid streaming Anthropic tool-use response."
import json, re, sys
state = 0
text = open(sys.argv[1], encoding="utf-8").read().replace("\r\n", "\n")
for block in re.split(r"\n\n+", text):
    lines = block.splitlines()
    event = next((line[6:].strip() for line in lines if line.startswith("event:")), None)
    data = "\n".join(line[5:].lstrip() for line in lines if line.startswith("data:"))
    if not event or not data:
        continue
    payload = json.loads(data)
    if state == 0 and event == "message_start" and payload.get("type") == "message_start" and str(payload.get("message", {}).get("id", "")).startswith("msg_"):
        state = 1
    elif state == 1 and event == "content_block_start" and payload.get("type") == "content_block_start" and payload.get("content_block", {}).get("type") == "tool_use" and payload.get("content_block", {}).get("name") == "eggdoc_check":
        state = 2
    elif state == 2 and event == "message_stop" and payload.get("type") == "message_stop":
        state = 3
raise SystemExit(0 if state == 3 else 1)
PYTHON
      ;;
    jq)
      jq -R -s -e '
        gsub("\\r\\n"; "\\n")
        | [splits("\\n\\n+")
          | split("\\n")
          | . as $lines
          | select(any($lines[]; startswith("event:")) and any($lines[]; startswith("data:")))
          | {
              event: ([$lines[] | select(startswith("event:")) | sub("^event:\\s*"; "")][0]),
              data: ([$lines[] | select(startswith("data:")) | sub("^data:\\s*"; "")] | join("\\n") | fromjson)
            }
        ]
        | reduce .[] as $e (0;
            if . == 0 and $e.event == "message_start" and $e.data.type == "message_start" and ($e.data.message.id | startswith("msg_")) then 1
            elif . == 1 and $e.event == "content_block_start" and $e.data.type == "content_block_start" and $e.data.content_block.type == "tool_use" and $e.data.content_block.name == "eggdoc_check" then 2
            elif . == 2 and $e.event == "message_stop" and $e.data.type == "message_stop" then 3
            else . end)
        | . == 3
      ' "$VERIFY_FILE" >/dev/null || fail "gateway verification did not return a valid streaming Anthropic tool-use response."
      ;;
    perl)
      perl -MJSON::PP -0777 -e '
        my $text = <>; $text =~ s/\r\n/\n/g; my $state = 0;
        for my $block (split /\n\n+/, $text) {
          my ($event) = $block =~ /^event:\s*(.+)$/m;
          my @data = $block =~ /^data:\s?(.*)$/mg;
          next unless defined $event && @data;
          my $payload = decode_json(join "\n", @data);
          if ($state == 0 && $event eq "message_start" && ($payload->{type} // "") eq "message_start" && ($payload->{message}->{id} // "") =~ /^msg_/) { $state = 1; }
          elsif ($state == 1 && $event eq "content_block_start" && ($payload->{type} // "") eq "content_block_start" && ($payload->{content_block}->{type} // "") eq "tool_use" && ($payload->{content_block}->{name} // "") eq "eggdoc_check") { $state = 2; }
          elsif ($state == 2 && $event eq "message_stop" && ($payload->{type} // "") eq "message_stop") { $state = 3; }
        }
        exit($state == 3 ? 0 : 1);
      ' "$VERIFY_FILE" || fail "gateway verification did not return a valid streaming Anthropic tool-use response."
      ;;
  esac
fi

echo "Installing or updating Claude Code from Anthropic..."
NPM_CONFIG_REGISTRY="$NPM_REGISTRY"
export NPM_CONFIG_REGISTRY
if ! curl -fsSL --retry 2 --connect-timeout 15 --max-time 300 \
  "$OFFICIAL_INSTALLER_URL" -o "$TMP_FILE"; then
  fail "could not download the Anthropic installer. Check network and region availability."
fi

[ -s "$TMP_FILE" ] || fail "the Anthropic installer response was empty."
FIRST_CONTENT_LINE="$(sed -n '/[^[:space:]]/ { p; q; }' "$TMP_FILE")"
[ -n "$FIRST_CONTENT_LINE" ] || fail "the Anthropic installer response was empty."
if printf '%s\n' "$FIRST_CONTENT_LINE" | grep -Eq '^[[:space:]]*<'; then
  fail "the Anthropic installer returned HTML instead of a script. Check network and region availability."
fi

if ! bash "$TMP_FILE" "$INSTALL_TARGET"; then
  fail "the Anthropic installer did not complete successfully."
fi

CLAUDE_BIN_DIR="$HOME/.local/bin"
if ! command -v claude >/dev/null 2>&1 && [ -x "$CLAUDE_BIN_DIR/claude" ]; then
  PATH="$CLAUDE_BIN_DIR:$PATH"
  export PATH
fi

command -v claude >/dev/null 2>&1 || \
  fail "Claude Code was installed, but claude is not on PATH. Restart the shell and run claude --version."

VERSION_OUTPUT="$(claude --version)" || fail "claude --version failed after installation."
[ -n "$VERSION_OUTPUT" ] || fail "claude --version returned no version information."

if [ "$EGGAI_MODE" = "0" ]; then
  echo "Done: Claude Code is installed."
  echo "$VERSION_OUTPUT"
  exit 0
fi

echo "Writing EggAi Claude Code configuration..."
mkdir -p "$CLAUDE_HOME"
chmod 700 "$CLAUDE_HOME" || fail "could not secure the Claude Code settings directory."
if [ -e "$SETTINGS_FILE" ] && [ ! -f "$SETTINGS_FILE" ]; then
  fail "Claude Code settings path exists but is not a regular file."
fi
SETTINGS_SOURCE="$SETTINGS_FILE"
SETTINGS_SOURCE_TMP=""
SETTINGS_EXISTED=1
if [ ! -f "$SETTINGS_FILE" ]; then
  SETTINGS_EXISTED=0
  SETTINGS_SOURCE_TMP="$(mktemp "$CLAUDE_HOME/.settings.json.source.XXXXXX")" || \
    fail "could not create a secure settings source file."
  chmod 600 "$SETTINGS_SOURCE_TMP"
  printf '{}\n' > "$SETTINGS_SOURCE_TMP"
  SETTINGS_SOURCE="$SETTINGS_SOURCE_TMP"
fi

SETTINGS_TMP="$(mktemp "$CLAUDE_HOME/.settings.json.eggai.XXXXXX")" || \
  fail "could not create a secure temporary settings file."
chmod 600 "$SETTINGS_TMP"

export EGGDOC_ANTHROPIC_BASE_URL="$ANTHROPIC_BASE_URL"
export EGGDOC_ANTHROPIC_AUTH_TOKEN="$SK_KEY"
export EGGDOC_ANTHROPIC_MODEL="$MODEL"
export EGGDOC_ANTHROPIC_OPUS_MODEL="$OPUS_MODEL"
export EGGDOC_ANTHROPIC_SONNET_MODEL="$SONNET_MODEL"
export EGGDOC_ANTHROPIC_HAIKU_MODEL="$HAIKU_MODEL"
export EGGDOC_ANTHROPIC_FABLE_MODEL="$FABLE_MODEL"

case "$JSON_ENGINE" in
  node)
    node - "$SETTINGS_SOURCE" "$SETTINGS_TMP" <<'NODE'
const fs = require("fs");
const [source, target] = process.argv.slice(2);
const settings = JSON.parse(fs.readFileSync(source, "utf8").replace(/^\uFEFF/, ""));
if (!settings || Array.isArray(settings) || typeof settings !== "object") {
  throw new Error("settings.json must contain a JSON object");
}
if (settings.env === undefined) settings.env = {};
if (!settings.env || Array.isArray(settings.env) || typeof settings.env !== "object") {
  throw new Error("settings.json env must contain a JSON object");
}
delete settings.env.ANTHROPIC_API_KEY;
settings.env.ANTHROPIC_BASE_URL = process.env.EGGDOC_ANTHROPIC_BASE_URL;
settings.env.ANTHROPIC_AUTH_TOKEN = process.env.EGGDOC_ANTHROPIC_AUTH_TOKEN;
settings.env.ANTHROPIC_MODEL = process.env.EGGDOC_ANTHROPIC_MODEL;
settings.env.ANTHROPIC_DEFAULT_FABLE_MODEL = process.env.EGGDOC_ANTHROPIC_FABLE_MODEL;
settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL = process.env.EGGDOC_ANTHROPIC_OPUS_MODEL;
settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL = process.env.EGGDOC_ANTHROPIC_SONNET_MODEL;
settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = process.env.EGGDOC_ANTHROPIC_HAIKU_MODEL;
fs.writeFileSync(target, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
NODE
    ;;
  python3)
    python3 - "$SETTINGS_SOURCE" "$SETTINGS_TMP" <<'PYTHON'
import json, os, sys
source, target = sys.argv[1:]
with open(source, encoding="utf-8-sig") as handle:
    settings = json.load(handle)
if not isinstance(settings, dict):
    raise TypeError("settings.json must contain a JSON object")
env = settings.setdefault("env", {})
if not isinstance(env, dict):
    raise TypeError("settings.json env must contain a JSON object")
env.pop("ANTHROPIC_API_KEY", None)
env["ANTHROPIC_BASE_URL"] = os.environ["EGGDOC_ANTHROPIC_BASE_URL"]
env["ANTHROPIC_AUTH_TOKEN"] = os.environ["EGGDOC_ANTHROPIC_AUTH_TOKEN"]
env["ANTHROPIC_MODEL"] = os.environ["EGGDOC_ANTHROPIC_MODEL"]
for family in ("FABLE", "OPUS", "SONNET", "HAIKU"):
    env[f"ANTHROPIC_DEFAULT_{family}_MODEL"] = os.environ[f"EGGDOC_ANTHROPIC_{family}_MODEL"]
with open(target, "w", encoding="utf-8") as handle:
    json.dump(settings, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
os.chmod(target, 0o600)
PYTHON
    ;;
  jq)
    jq --arg base_url "$ANTHROPIC_BASE_URL" --arg auth_token "$SK_KEY" --arg model "$MODEL" \
      --arg opus_model "$OPUS_MODEL" --arg sonnet_model "$SONNET_MODEL" \
      --arg haiku_model "$HAIKU_MODEL" --arg fable_model "$FABLE_MODEL" \
      'if type != "object" then error("settings.json must contain a JSON object") else . end
       | .env = (.env // {})
       | if (.env | type) != "object" then error("settings.json env must contain a JSON object") else . end
       | del(.env.ANTHROPIC_API_KEY)
       | .env.ANTHROPIC_BASE_URL = $base_url
       | .env.ANTHROPIC_AUTH_TOKEN = $auth_token
       | .env.ANTHROPIC_MODEL = $model
       | .env.ANTHROPIC_DEFAULT_FABLE_MODEL = $fable_model
       | .env.ANTHROPIC_DEFAULT_OPUS_MODEL = $opus_model
       | .env.ANTHROPIC_DEFAULT_SONNET_MODEL = $sonnet_model
       | .env.ANTHROPIC_DEFAULT_HAIKU_MODEL = $haiku_model' \
      "$SETTINGS_SOURCE" > "$SETTINGS_TMP"
    ;;
  perl)
    perl -MJSON::PP -0777 -e '
      use strict;
      use warnings;
      my ($source, $target) = @ARGV;
      open my $input, "<:raw", $source or die "cannot read settings.json: $!";
      my $settings = decode_json(do { local $/; <$input> });
      close $input;
      die "settings.json must contain a JSON object\n" unless ref($settings) eq "HASH";
      $settings->{env} = {} unless exists $settings->{env};
      die "settings.json env must contain a JSON object\n" unless ref($settings->{env}) eq "HASH";
      delete $settings->{env}->{ANTHROPIC_API_KEY};
      $settings->{env}->{ANTHROPIC_BASE_URL} = $ENV{EGGDOC_ANTHROPIC_BASE_URL};
      $settings->{env}->{ANTHROPIC_AUTH_TOKEN} = $ENV{EGGDOC_ANTHROPIC_AUTH_TOKEN};
      $settings->{env}->{ANTHROPIC_MODEL} = $ENV{EGGDOC_ANTHROPIC_MODEL};
      for my $family (qw(FABLE OPUS SONNET HAIKU)) {
        $settings->{env}->{"ANTHROPIC_DEFAULT_${family}_MODEL"} = $ENV{"EGGDOC_ANTHROPIC_${family}_MODEL"};
      }
      open my $output, ">:raw", $target or die "cannot write temporary settings: $!";
      print {$output} JSON::PP->new->utf8->pretty->encode($settings);
      close $output or die "cannot close temporary settings: $!";
      chmod 0600, $target;
    ' "$SETTINGS_SOURCE" "$SETTINGS_TMP"
    ;;
esac

BACKUP_FILE=""
SETTINGS_CHANGED=1
if [ "$SETTINGS_EXISTED" = "1" ] && cmp -s "$SETTINGS_FILE" "$SETTINGS_TMP"; then
  SETTINGS_CHANGED=0
  rm -f "$SETTINGS_TMP"
  SETTINGS_TMP=""
fi
if [ "$SETTINGS_CHANGED" = "1" ] && [ "$SETTINGS_EXISTED" = "1" ]; then
  BACKUP_FILE="$SETTINGS_FILE.eggai.bak"
  BACKUP_TMP="$(mktemp "$CLAUDE_HOME/.settings.json.backup.XXXXXX")" || \
    fail "could not create a secure backup file."
  chmod 600 "$BACKUP_TMP" || fail "could not secure the backup file."
  cp "$SETTINGS_FILE" "$BACKUP_TMP"
  chmod 600 "$BACKUP_TMP" || fail "could not secure the backup file."
  mv "$BACKUP_TMP" "$BACKUP_FILE"
  BACKUP_TMP=""
fi
if [ "$SETTINGS_CHANGED" = "1" ]; then
  mv "$SETTINGS_TMP" "$SETTINGS_FILE"
  SETTINGS_TMP=""
fi
if [ -n "$SETTINGS_SOURCE_TMP" ]; then
  rm -f "$SETTINGS_SOURCE_TMP"
fi
SETTINGS_SOURCE_TMP=""

echo "Done: Claude Code is installed and configured to use EggAi."
echo "$VERSION_OUTPUT"
echo "Settings: $SETTINGS_FILE"
if [ -n "$BACKUP_FILE" ]; then
  echo "Backup: $BACKUP_FILE"
elif [ "$SETTINGS_EXISTED" = "1" ] && [ "$SETTINGS_CHANGED" = "0" ]; then
  echo "Backup: unchanged (configuration already current)"
else
  echo "Backup: not created because settings.json did not exist"
fi
