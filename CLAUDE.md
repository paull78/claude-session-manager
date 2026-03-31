# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code plugin that tracks and resumes parallel development sessions across repo copies. Hooks into Claude Code's lifecycle (SessionStart, Stop, SessionEnd) to automatically record sessions, extract context from JSONL transcripts, and provide smart resume capabilities with cross-repo dashboards and knowledge capture.

## Build & Development

**No build step, no external dependencies, no test framework.** Pure Node.js (built-ins only) and POSIX Bash.

- Install: via `/plugin` marketplace (`paull78/claude-session-manager`) or manual `settings.json` config
- Launch dashboard: `npx claude-session-dashboard` or `node plugin/scripts/open-dashboard.js`
- All runtime data lives at `~/.claude/session-manager/` (config, sessions, projects, briefings, knowledge index)

## Architecture

### Hook-Based Lifecycle

Three hooks registered in `plugin/.claude-plugin/hooks.json`:

1. **SessionStart** (`plugin/hooks/session-start`) — Sync bash hook (~50ms budget). Generates session ID, records repo/branch, detects prior work, injects resume context. Uses shared utilities from `plugin/hooks/lib.sh`.
2. **Stop** (`plugin/scripts/stop-hook.js`) — Async Node.js hook after each Claude response. Extracts summary, plan refs, and task creation from JSONL transcript. Detects mid-session branch switches (closes old session, creates new one).
3. **SessionEnd** (`plugin/scripts/session-end-hook.js`) — Async Node.js hook on session close. Full transcript extraction, briefing generation, project tracking update.

### Plugin Structure

```
plugin/
├── .claude-plugin/     # Plugin metadata (plugin.json, hooks.json)
├── hooks/              # Bash hooks + shared lib.sh
├── scripts/            # Node.js extraction logic + shared utils.js
├── commands/           # User-facing slash commands (8 .md files)
├── agents/             # Remote agents: briefing-writer, takeaway-writer
├── skills/             # Auto-triggered skills (4 directories)
└── web/                # Dashboard: server.js + index.html (zero-dep)
```

### Key Patterns

- **Commands, agents, and skills are all Markdown files** — they define prompts, not code
- **Shared utilities**: `hooks/lib.sh` for bash hooks, `scripts/utils.js` for Node.js hooks
- **Read-only transcript access** — plugin reads Claude's JSONL transcripts but never modifies them
- **Zero external npm dependencies** — only Node.js built-ins (fs, path, os, child_process, http)
- **Schema versioning** on all JSON data structures
- **Cross-platform** — POSIX bash with macOS/Linux date format handling

### Data Storage (`~/.claude/session-manager/`)

```
config.json                          # User configuration (repos, groups, resumeMode)
knowledge-index.json                 # Searchable index of all takeaways
repos/{slug}/
  sessions/{id}.json                 # Per-session snapshots
  projects/{slug}.json               # Project tracking
  projects/{slug}.takeaway.md        # Post-mortem on completion
  briefings/latest.md                # Most recent resume briefing
```

### Web Dashboard

`plugin/web/server.js` serves a REST API + `plugin/web/index.html` (vanilla HTML/CSS/JS, no framework). Four views: Overview, Projects, Sessions, Knowledge. Classifies sessions as meaningful or noise.

### Project Lifecycle

Projects are **manual only** — never auto-created or auto-linked. Users explicitly create projects via `/claude-session-manager:start-project` and close them via `/claude-session-manager:close-project`. Session-start detects active projects for context messages but never auto-attaches sessions.
