#!/usr/bin/env sh
set -eu

OFFICIAL_INSTALLER_URL="https://claude.ai/install.sh"
INSTALL_TARGET="${CLAUDE_CODE_VERSION:-latest}"
DRY_RUN="${DRY_RUN:-0}"

usage() {
  cat <<'EOF'
Usage:
  curl -fsSL https://eggdoc.pages.dev/install/claude-code.sh | sh
  curl -fsSL https://eggdoc.pages.dev/install/claude-code.sh | sh -s -- --version stable

Options:
  --version <value>   latest, stable, or a numeric dotted version. Default: latest
  --dry-run           Check what would happen without downloading or installing.
  --help              Show this help.

Environment variables are also supported:
  CLAUDE_CODE_VERSION, DRY_RUN
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

valid_install_target "$INSTALL_TARGET" || \
  fail "version must be latest, stable, or a numeric dotted version."

if [ "$DRY_RUN" = "1" ]; then
  echo "Claude Code installer dry run"
  echo "Official installer URL: $OFFICIAL_INSTALLER_URL"
  echo "Release: $INSTALL_TARGET"
  echo "Would install/update Claude Code: yes"
  echo "Would modify Claude Code configuration: no"
  exit 0
fi

command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v bash >/dev/null 2>&1 || fail "bash is required."
command -v mktemp >/dev/null 2>&1 || fail "mktemp is required."

TMP_FILE="$(mktemp "${TMPDIR:-/tmp}/eggdoc-claude-code-installer.XXXXXX")" || \
  fail "could not create a temporary installer file."
cleanup() {
  rm -f "$TMP_FILE"
}
trap cleanup EXIT HUP INT TERM

echo "Installing or updating Claude Code from Anthropic..."
if ! curl -fsSL "$OFFICIAL_INSTALLER_URL" -o "$TMP_FILE"; then
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
echo "Done: Claude Code is installed."
echo "$VERSION_OUTPUT"
