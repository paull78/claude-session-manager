#!/usr/bin/env bash
# Shared library functions for claude-session-manager hooks

SESSION_MANAGER_DIR="$HOME/.claude/session-manager"
CONFIG_FILE="$SESSION_MANAGER_DIR/config.json"

# Ensure a directory exists
ensure_dir() {
  mkdir -p "$1"
}

# Escape a string for embedding in JSON
# Uses fast bash parameter substitution (same pattern as superpowers plugin)
escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

# Read a top-level string field from a JSON file using grep/sed (no jq dependency)
# Usage: read_json_field <file> <field_name>
# Returns the value (unquoted) or empty string if not found
read_json_field() {
  local file="$1"
  local field="$2"
  if [ ! -f "$file" ]; then
    return
  fi
  # Match "field": "value" and extract value
  sed -n 's/.*"'"$field"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$file" | head -1
}

# Resolve the repo slug for the current working directory
# Looks up CWD in config.json repos. If autoTrack is on and CWD is a git repo
# not yet tracked, auto-adds it with slug derived from directory name.
# Outputs the slug to stdout, or empty string if not resolvable.
resolve_slug() {
  local cwd="$1"

  ensure_dir "$SESSION_MANAGER_DIR"

  # If config doesn't exist, create a minimal one
  if [ ! -f "$CONFIG_FILE" ]; then
    printf '{\n  "autoTrack": true,\n  "repos": {}\n}\n' > "$CONFIG_FILE"
  fi

  # Try to find a matching repo in config by scanning for path entries
  # We look for lines like "path": "/some/path" and match against cwd
  local slug=""
  local found_path=""

  # Read repos from config: find slug keys and their paths
  # Config format: "repos": { "slug": { "path": "/path/to/repo" }, ... }
  # We iterate through the config looking for path matches
  while IFS= read -r line; do
    # Check for a slug key (a key inside repos object)
    if echo "$line" | grep -qE '^\s*"[a-zA-Z0-9_-]+"\s*:\s*\{'; then
      local candidate_slug
      candidate_slug=$(echo "$line" | sed -n 's/.*"\([a-zA-Z0-9_-]*\)"[[:space:]]*:.*/\1/p')
      if [ -n "$candidate_slug" ] && [ "$candidate_slug" != "repos" ] && [ "$candidate_slug" != "autoTrack" ]; then
        slug="$candidate_slug"
      fi
    fi
    # Check for path field
    if [ -n "$slug" ] && echo "$line" | grep -qE '"path"'; then
      found_path=$(echo "$line" | sed -n 's/.*"path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
      if [ "$found_path" = "$cwd" ]; then
        printf '%s' "$slug"
        return
      fi
    fi
  done < "$CONFIG_FILE"

  # Not found in config - check if autoTrack is enabled
  local auto_track
  auto_track=$(read_json_field "$CONFIG_FILE" "autoTrack")

  # autoTrack defaults to true; only skip if explicitly "false"
  if [ "$auto_track" = "false" ]; then
    return
  fi

  # Check if CWD is a git repo
  if ! git -C "$cwd" rev-parse --git-dir >/dev/null 2>&1; then
    return
  fi

  # Derive slug from directory name (lowercase, replace spaces/special chars with hyphens)
  local dir_name
  dir_name=$(basename "$cwd")
  local new_slug
  new_slug=$(printf '%s' "$dir_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')

  if [ -z "$new_slug" ]; then
    return
  fi

  # Auto-add to config by rewriting the repos section
  # Read existing config, insert new repo entry
  local repos_dir="$SESSION_MANAGER_DIR/repos/$new_slug"
  ensure_dir "$repos_dir/sessions"
  ensure_dir "$repos_dir/projects"
  ensure_dir "$repos_dir/briefings"

  # Simple approach: read config, add repo entry
  # We rebuild the config to avoid complex JSON manipulation in bash
  local tmp_config="$CONFIG_FILE.tmp"
  local existing_repos=""

  # Extract existing repo entries (everything between "repos": { and the closing })
  local in_repos=0
  local brace_depth=0
  while IFS= read -r line; do
    if echo "$line" | grep -qE '"repos"[[:space:]]*:'; then
      in_repos=1
      brace_depth=0
      continue
    fi
    if [ "$in_repos" -eq 1 ]; then
      # Count braces
      local opens closes
      opens=$(printf '%s' "$line" | tr -cd '{' | wc -c)
      closes=$(printf '%s' "$line" | tr -cd '}' | wc -c)
      brace_depth=$((brace_depth + opens - closes))
      if [ "$brace_depth" -le 0 ]; then
        in_repos=0
        continue
      fi
      # Skip the opening brace line
      if [ "$brace_depth" -ge 1 ] && [ "$opens" -gt 0 ] && [ $((brace_depth - opens + closes)) -le 0 ]; then
        continue
      fi
      existing_repos="${existing_repos}${line}"$'\n'
    fi
  done < "$CONFIG_FILE"

  # Preserve existing autoTrack value (defaults to true)
  local auto_track_value
  auto_track_value=$(read_json_field "$CONFIG_FILE" "autoTrack")
  auto_track_value="${auto_track_value:-true}"

  # Write new config with escaped path
  {
    printf '{\n'
    printf '  "autoTrack": %s,\n' "$auto_track_value"
    printf '  "repos": {\n'
    if [ -n "$existing_repos" ]; then
      # Trim trailing newline and add comma
      printf '%s' "$existing_repos" | sed '$ s/$/,/'
      printf '\n'
    fi
    printf '    "%s": {\n' "$new_slug"
    printf '      "path": "%s"\n' "$(escape_for_json "$cwd")"
    printf '    }\n'
    printf '  }\n'
    printf '}\n'
  } > "$tmp_config"
  mv "$tmp_config" "$CONFIG_FILE"

  printf '%s' "$new_slug"
}

# Get the active project for a given repo slug and branch
# Scans repos/{slug}/projects/*.json for a project with status "active"
# that has the given branch in its "branches" array.
# Outputs the project slug or empty string.
get_active_project() {
  local slug="$1"
  local branch="$2"
  local projects_dir="$SESSION_MANAGER_DIR/repos/$slug/projects"

  if [ ! -d "$projects_dir" ]; then
    return
  fi

  for project_file in "$projects_dir"/*.json; do
    [ -f "$project_file" ] || continue

    # Check if status is "active"
    local status
    status=$(read_json_field "$project_file" "status")
    if [ "$status" != "active" ]; then
      continue
    fi

    # Check if branch is in branches array
    # Simple grep for the branch name within the branches array
    if grep -q "\"$branch\"" "$project_file"; then
      # Return the project slug (filename without extension)
      local project_slug
      project_slug=$(basename "$project_file" .json)
      printf '%s' "$project_slug"
      return
    fi
  done
}

# Count sessions matching a branch in repos/{slug}/sessions/
get_session_count() {
  local slug="$1"
  local branch="$2"
  local sessions_dir="$SESSION_MANAGER_DIR/repos/$slug/sessions"
  local count=0

  if [ ! -d "$sessions_dir" ]; then
    printf '0'
    return
  fi

  for sf in "$sessions_dir"/*.json; do
    [ -f "$sf" ] || continue
    if grep -q "\"branch\": \"$(escape_for_json "$branch")\"" "$sf" 2>/dev/null; then
      count=$((count + 1))
    fi
  done

  printf '%s' "$count"
}

# Get the summary and startedAt from the most recent session on a branch
# Outputs: summary|startedAt (pipe-delimited)
get_latest_session_info() {
  local slug="$1"
  local branch="$2"
  local current_session_file="${3:-}"
  local sessions_dir="$SESSION_MANAGER_DIR/repos/$slug/sessions"

  if [ ! -d "$sessions_dir" ]; then
    return
  fi

  local latest_file=""
  local latest_time=""

  for sf in "$sessions_dir"/*.json; do
    [ -f "$sf" ] || continue
    [ "$sf" = "$current_session_file" ] && continue
    if grep -q "\"branch\": \"$(escape_for_json "$branch")\"" "$sf" 2>/dev/null; then
      local started
      started=$(read_json_field "$sf" "startedAt")
      if [ -z "$latest_time" ] || [[ "$started" > "$latest_time" ]]; then
        latest_time="$started"
        latest_file="$sf"
      fi
    fi
  done

  if [ -z "$latest_file" ]; then
    return
  fi

  local summary
  summary=$(read_json_field "$latest_file" "summary")
  printf '%s|%s' "$summary" "$latest_time"
}

# Convert ISO timestamp to human-readable "time ago" string
# Input: ISO 8601 timestamp (e.g., 2026-03-24T14:30:00Z)
time_ago() {
  local ts="$1"
  if [ -z "$ts" ]; then
    printf 'unknown'
    return
  fi

  local now_epoch ts_epoch diff_secs
  now_epoch=$(date -u +%s)

  # Parse ISO timestamp to epoch (macOS date -j vs GNU date -d)
  if date -j -f "%Y-%m-%dT%H:%M:%SZ" "$ts" +%s >/dev/null 2>&1; then
    ts_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$ts" +%s 2>/dev/null)
  elif date -d "$ts" +%s >/dev/null 2>&1; then
    ts_epoch=$(date -d "$ts" +%s 2>/dev/null)
  else
    printf 'unknown'
    return
  fi

  diff_secs=$((now_epoch - ts_epoch))

  if [ "$diff_secs" -lt 60 ]; then
    printf 'just now'
  elif [ "$diff_secs" -lt 3600 ]; then
    printf '%dm ago' $((diff_secs / 60))
  elif [ "$diff_secs" -lt 86400 ]; then
    printf '%dh ago' $((diff_secs / 3600))
  elif [ "$diff_secs" -lt 172800 ]; then
    printf 'yesterday'
  else
    printf '%dd ago' $((diff_secs / 86400))
  fi
}

# Emit context JSON, detecting platform to use the right format
# Uses printf instead of heredoc to avoid bash 5.3+ heredoc expansion bug
emit_context() {
  local context="$1"

  if [ -z "$context" ]; then
    printf '{}\n'
    return
  fi

  local escaped
  escaped=$(escape_for_json "$context")

  if [ -n "${CURSOR_PLUGIN_ROOT:-}" ]; then
    printf '{\n  "additional_context": "%s"\n}\n' "$escaped"
  elif [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
    printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$escaped"
  else
    printf '{\n  "additional_context": "%s"\n}\n' "$escaped"
  fi
}
