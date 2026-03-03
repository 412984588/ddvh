#!/usr/bin/env bash

if [[ -n "${VOICE_HUB_TARGETS_LOADED:-}" ]]; then
  return 0
fi
VOICE_HUB_TARGETS_LOADED=1

install_openclaw_target() {
  local source_dir="$1"
  local force="$2"
  local openclaw_home="${OPENCLAW_PLUGIN_HOME:-$HOME/.openclaw/plugins}"
  local destination="$openclaw_home/voice-hub"
  local temp_destination="${destination}.tmp.$$"
  local backup_destination=""

  log_info "Installing OpenClaw plugin..."
  ensure_file_exists "$source_dir/packages/openclaw-plugin/openclaw.plugin.json"

  run_cmd pnpm --dir "$source_dir" --filter @voice-hub/openclaw-plugin build

  if [[ -d "$destination" ]]; then
    if [[ "$force" != "true" ]]; then
      log_error "Destination already exists: $destination"
      log_error "Re-run with --force to overwrite."
      return 1
    fi
    backup_destination="${destination}.bak.$(date +%s)"
    run_cmd mv "$destination" "$backup_destination"
  fi

  run_cmd mkdir -p "$openclaw_home"
  run_cmd mkdir -p "$temp_destination/dist"
  run_cmd cp "$source_dir/packages/openclaw-plugin/openclaw.plugin.json" "$temp_destination/"
  run_cmd cp -R "$source_dir/packages/openclaw-plugin/dist/." "$temp_destination/dist/"

  run_cmd mv "$temp_destination" "$destination"

  if [[ -n "$backup_destination" && -d "$backup_destination" ]]; then
    run_cmd rm -rf "$backup_destination"
  fi

  log_success "OpenClaw plugin installed: $destination"
}

install_claude_target() {
  local source_dir="$1"
  local force="$2"
  local marketplace_home="${CLAUDE_MARKETPLACE_HOME:-$HOME/.claude/marketplace}"
  local destination="$marketplace_home/voice-hub"
  local temp_destination="${destination}.tmp.$$"
  local backup_destination=""

  log_info "Installing Claude marketplace plugin..."
  ensure_file_exists "$source_dir/packages/claude-marketplace/.claude-plugin/marketplace.json"
  ensure_file_exists "$source_dir/packages/claude-marketplace/plugins/voice-hub-dev/.claude-plugin/plugin.json"
  ensure_file_exists "$source_dir/packages/claude-marketplace/plugins/voice-hub-dev/.mcp.json"

  run_cmd pnpm --dir "$source_dir" --filter @voice-hub/claude-mcp-server build

  if [[ -d "$destination" ]]; then
    if [[ "$force" != "true" ]]; then
      log_error "Destination already exists: $destination"
      log_error "Re-run with --force to overwrite."
      return 1
    fi
    backup_destination="${destination}.bak.$(date +%s)"
    run_cmd mv "$destination" "$backup_destination"
  fi

  run_cmd mkdir -p "$marketplace_home"
  run_cmd mkdir -p "$temp_destination/.claude-plugin"
  run_cmd mkdir -p "$temp_destination/plugins/voice-hub-dev/.claude-plugin"
  run_cmd mkdir -p "$temp_destination/plugins/voice-hub-dev/skills"
  run_cmd mkdir -p "$temp_destination/packages/claude-mcp-server/dist"

  run_cmd cp \
    "$source_dir/packages/claude-marketplace/.claude-plugin/marketplace.json" \
    "$temp_destination/.claude-plugin/"

  run_cmd cp \
    "$source_dir/packages/claude-marketplace/plugins/voice-hub-dev/.claude-plugin/plugin.json" \
    "$temp_destination/plugins/voice-hub-dev/.claude-plugin/"

  run_cmd cp \
    "$source_dir/packages/claude-marketplace/plugins/voice-hub-dev/.mcp.json" \
    "$temp_destination/plugins/voice-hub-dev/"

  run_cmd cp \
    "$source_dir/packages/claude-marketplace/plugins/voice-hub-dev/skills/"*.md \
    "$temp_destination/plugins/voice-hub-dev/skills/"

  run_cmd cp -R \
    "$source_dir/packages/claude-mcp-server/dist/." \
    "$temp_destination/packages/claude-mcp-server/dist/"

  run_cmd mv "$temp_destination" "$destination"

  if [[ -n "$backup_destination" && -d "$backup_destination" ]]; then
    run_cmd rm -rf "$backup_destination"
  fi

  log_success "Claude marketplace plugin installed: $destination"
}
