#!/usr/bin/env bash

if [[ -n "${VOICE_HUB_COMMON_LOADED:-}" ]]; then
  return 0
fi
VOICE_HUB_COMMON_LOADED=1

log_info() {
  printf '[INFO] %s\n' "$*"
}

log_warn() {
  printf '[WARN] %s\n' "$*" >&2
}

log_error() {
  printf '[ERROR] %s\n' "$*" >&2
}

log_success() {
  printf '[OK] %s\n' "$*"
}

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
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Required command not found: $cmd"
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
    y|Y|yes|YES)
      return 0
      ;;
    *)
      log_warn 'Installation cancelled by user.'
      return 1
      ;;
  esac
}

ensure_file_exists() {
  local file_path="$1"
  if [[ ! -f "$file_path" ]]; then
    log_error "Required file missing: $file_path"
    return 1
  fi
}
