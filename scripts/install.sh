#!/usr/bin/env bash

set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]:-}"
SCRIPT_DIR=""
if [[ -n "$SCRIPT_PATH" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 && pwd || true)"
fi

if [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/lib/common.sh" ]]; then
  # shellcheck source=scripts/lib/common.sh
  source "$SCRIPT_DIR/lib/common.sh"
fi

if ! command -v log_info >/dev/null 2>&1; then
  log_info() { printf '[INFO] %s\n' "$*"; }
  log_warn() { printf '[WARN] %s\n' "$*" >&2; }
  log_error() { printf '[ERROR] %s\n' "$*" >&2; }
  log_success() { printf '[OK] %s\n' "$*"; }
  run_cmd() {
    if [[ "${DRY_RUN:-false}" == "true" ]]; then
      printf '[dry-run]'
      for arg in "$@"; do
        printf ' %q' "$arg"
      done
      printf '\n'
      return 0
    fi
    "$@"
  }
  require_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
      log_error "Required command not found: $1"
      return 1
    fi
  }
  confirm_or_exit() {
    local message="$1"
    if [[ "${ASSUME_YES:-false}" == "true" ]]; then
      return 0
    fi
    printf '%s [y/N]: ' "$message"
    read -r reply
    case "$reply" in
      y|Y|yes|YES) return 0 ;;
      *) log_warn 'Installation cancelled by user.'; return 1 ;;
    esac
  }
  ensure_file_exists() {
    if [[ ! -f "$1" ]]; then
      log_error "Required file missing: $1"
      return 1
    fi
  }
fi

usage() {
  cat <<'USAGE'
Usage: install.sh [options]

Options:
  --target <both|openclaw|claude>  Install target (default: both)
  --version <latest|tag|branch>    Source version (default: latest)
  --repo <owner/repo>              GitHub repository slug (required for remote install)
  --source-dir <path>              Local repository source directory
  --force                          Overwrite existing installation
  --dry-run                        Print commands without writing files
  --yes                            Skip interactive confirmation
  --help                           Show help
USAGE
}

is_repo_root() {
  local dir="$1"
  [[ -f "$dir/package.json" ]] && grep -Eq '"name"[[:space:]]*:[[:space:]]*"discord-doubao-voice-hub"' "$dir/package.json"
}

resolve_latest_tag() {
  local repo="$1"
  local tag
  tag="$(curl -fsSL "https://api.github.com/repos/${repo}/releases/latest" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1 || true)"
  printf '%s' "$tag"
}

download_source_archive() {
  local repo="$1"
  local requested_version="$2"
  local resolved_ref="$requested_version"
  local temp_root
  local archive_path
  local extracted_root

  require_cmd curl
  require_cmd tar

  if [[ "$requested_version" == "latest" ]]; then
    resolved_ref="$(resolve_latest_tag "$repo")"
    if [[ -z "$resolved_ref" ]]; then
      log_warn 'Unable to resolve latest release tag. Falling back to main branch.'
      resolved_ref='main'
    fi
  fi

  temp_root="$(mktemp -d)"
  archive_path="$temp_root/source.tar.gz"

  local tag_url="https://github.com/${repo}/archive/refs/tags/${resolved_ref}.tar.gz"
  local branch_url="https://github.com/${repo}/archive/refs/heads/${resolved_ref}.tar.gz"

  if ! curl -fsSL "$tag_url" -o "$archive_path"; then
    if ! curl -fsSL "$branch_url" -o "$archive_path"; then
      log_error "Failed to download source for ref: $resolved_ref"
      return 1
    fi
  fi

  extracted_root="$(tar -tzf "$archive_path" | head -1 | cut -d/ -f1)"
  if [[ -z "$extracted_root" ]]; then
    log_error 'Unable to determine extracted archive root directory.'
    return 1
  fi

  tar -xzf "$archive_path" -C "$temp_root"
  printf '%s\n%s' "$temp_root" "$temp_root/$extracted_root"
}

TARGET='both'
VERSION='latest'
REPO_SLUG="${VOICE_HUB_REPO:-}"
SOURCE_DIR=''
FORCE='false'
DRY_RUN='false'
ASSUME_YES='false'

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    --repo)
      REPO_SLUG="$2"
      shift 2
      ;;
    --source-dir)
      SOURCE_DIR="$2"
      shift 2
      ;;
    --force)
      FORCE='true'
      shift
      ;;
    --dry-run)
      DRY_RUN='true'
      shift
      ;;
    --yes)
      ASSUME_YES='true'
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      log_error "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

case "$TARGET" in
  both|openclaw|claude)
    ;;
  *)
    log_error "Invalid target: $TARGET"
    usage
    exit 1
    ;;
esac

TMP_ROOT=''
cleanup() {
  if [[ -n "$TMP_ROOT" && -d "$TMP_ROOT" ]]; then
    rm -rf "$TMP_ROOT"
  fi
}
trap cleanup EXIT

if [[ -z "$SOURCE_DIR" ]]; then
  if is_repo_root "$PWD"; then
    SOURCE_DIR="$PWD"
  elif [[ -n "$SCRIPT_DIR" ]] && is_repo_root "$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"; then
    SOURCE_DIR="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"
  else
    if [[ -z "$REPO_SLUG" ]]; then
      log_error 'Missing --repo <owner/repo> for remote installation.'
      exit 1
    fi
    if [[ "$REPO_SLUG" != */* ]]; then
      log_error "Invalid repo slug: $REPO_SLUG"
      log_error 'Expected format: owner/repo'
      exit 1
    fi
    log_info "Downloading source from GitHub: $REPO_SLUG ($VERSION)"
    download_result="$(download_source_archive "$REPO_SLUG" "$VERSION")"
    TMP_ROOT="$(printf '%s\n' "$download_result" | sed -n '1p')"
    SOURCE_DIR="$(printf '%s\n' "$download_result" | sed -n '2p')"
  fi
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  log_error "Source directory does not exist: $SOURCE_DIR"
  exit 1
fi

if [[ -f "$SOURCE_DIR/scripts/lib/common.sh" ]]; then
  # shellcheck source=scripts/lib/common.sh
  source "$SOURCE_DIR/scripts/lib/common.sh"
fi
if [[ -f "$SOURCE_DIR/scripts/lib/targets.sh" ]]; then
  # shellcheck source=scripts/lib/targets.sh
  source "$SOURCE_DIR/scripts/lib/targets.sh"
fi

if ! declare -F install_openclaw_target >/dev/null 2>&1 || ! declare -F install_claude_target >/dev/null 2>&1; then
  log_error 'Installer target functions are unavailable.'
  exit 1
fi

log_info "Source directory: $SOURCE_DIR"
log_info "Target: $TARGET"
log_info "Dry run: $DRY_RUN"

require_cmd node
require_cmd pnpm

confirm_or_exit "Proceed with Voice Hub installation?"

run_cmd pnpm --dir "$SOURCE_DIR" install --frozen-lockfile

case "$TARGET" in
  openclaw)
    install_openclaw_target "$SOURCE_DIR" "$FORCE"
    ;;
  claude)
    install_claude_target "$SOURCE_DIR" "$FORCE"
    ;;
  both)
    install_openclaw_target "$SOURCE_DIR" "$FORCE"
    install_claude_target "$SOURCE_DIR" "$FORCE"
    ;;
esac

log_success 'Installation completed.'
log_info 'Next steps:'
log_info '  - Restart OpenClaw / Claude to load plugin changes.'
log_info '  - Verify with your local plugin list command.'
