# claude-session-manager

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that tracks parallel development work across repo copies, preserves project history, and builds a unified knowledge base from your sessions.

## The Problem

Claude Code can resume individual sessions, but if you work across multiple copies of a repository (e.g., `my-app`, `my-app-2`, `my-app-3`) — each on a different branch — the bigger challenges remain:

- **No big picture**: There's no way to see what's happening across all your repos and branches at a glance. Which copy has what in-flight? What's blocked?
- **Lost project history**: Once a feature is merged and the branch deleted, the reasoning, decisions, and false starts that shaped it are gone forever.
- **Forgotten lessons**: Patterns you discovered and mistakes you made in one project never surface when you start the next one. Every project starts from zero institutional knowledge.

**claude-session-manager** solves all of this.

## Installation

### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed and working
- Node.js (v18+) — required for the extraction hooks
- Git

### Option A: Install via `/plugin` (recommended)

1. Run `/plugin` in any Claude Code session
2. Select **"Add marketplace"**
3. Enter the repo: `paull78/claude-session-manager`
4. Once added, select the plugin to install and enable it
5. Restart Claude Code (or run `/clear`)

### Option B: Manual install via settings.json

**Step 1: Add the marketplace** — open `~/.claude/settings.json` and add:

```json
{
  "extraKnownMarketplaces": {
    "claude-session-manager": {
      "source": {
        "source": "github",
        "repo": "paull78/claude-session-manager"
      }
    }
  }
}
```

> If you already have other entries under `extraKnownMarketplaces`, just add the `"claude-session-manager"` key alongside them.

**Step 2: Enable the plugin** — in the same file, add:

```json
{
  "enabledPlugins": {
    "claude-session-manager@paull78": true
  }
}
```

**Step 3: Restart Claude Code** — close and reopen (or run `/clear`) so the plugin hooks are loaded.

## Getting Started

Run the setup wizard in any Claude Code session:

```
/claude-session-manager:setup
```

This walks you through:
1. Scanning your filesystem for git repositories
2. Choosing which repos to track
3. Auto-detecting repo copies (e.g., `my-app`, `my-app-2`, `my-app-3`) and grouping them
4. Choosing your resume mode (`ask`, `auto`, or `manual`)
5. Creating the configuration at `~/.claude/session-manager/config.json`

Once setup is complete, the plugin works silently in the background. Every Claude Code session in a tracked repo is automatically recorded.

## Core Concepts

### Sessions

A **session** is a single Claude Code conversation in a tracked repo. The plugin records sessions automatically — you don't need to do anything.

Each session captures:
- Which repo and branch you're on
- Start and end timestamps
- Commits made during the session
- A summary extracted from Claude's conversation
- Key decisions and plan file references

When you open Claude Code on a branch where you've worked before, the plugin shows a summary of prior work and asks if you want to resume. You control this behavior with the `resumeMode` setting:
- `"ask"` (default) — shows a summary, asks before loading full context
- `"auto"` — loads the full resume briefing immediately
- `"manual"` — no auto-resume; run `/claude-session-manager:resume` when you want it

The plugin also detects mid-session branch switches — if you `git checkout` to a different branch, the current session is closed and a new one starts automatically.

### Projects

A **project** groups related sessions into a tracked unit of work — like a feature, a refactor, or a migration that spans multiple sessions. Projects are **fully manual**: you decide when to create one and when to close it.

Not every session needs a project. Quick fixes, one-off tasks, and exploratory work are perfectly fine as standalone sessions. Projects are for work you want to preserve the history and extract learnings from.

A project tracks:
- Title and description
- Which branches and repos it spans
- All linked sessions
- Plan files
- Status (active, paused, completed)

### Knowledge

When you close a project, the plugin generates a **takeaway** — a structured post-mortem with:
- **Summary** — what was built, scope, timespan
- **Patterns & Conventions** — architecture and code patterns that emerged
- **Lessons Learned** — what was harder than expected, what went wrong
- **Reusable Snippets** — code patterns worth templating

The takeaway is saved as a permanent record. You then choose, section by section, what goes into CLAUDE.md (project instructions), Claude's memory files, or stays in the takeaway only. Sections destined for CLAUDE.md or memory are **generalized** — specific names and paths are stripped in favor of transferable principles.

All takeaways are indexed in a **knowledge base** that's searchable across repos. When you start new work, you can search for relevant lessons from past projects.

## Workflow

### 1. Start a Project

When you begin work that will span multiple sessions:

```
/claude-session-manager:start-project
```

Claude asks for a title (suggests one from the branch name), creates the project, and links the current session. If an active project already exists on the branch, it offers to attach instead.

### 2. Work Across Sessions

While you work, the plugin runs silently:
- **Every response**: extracts the latest summary and plan references
- **Branch switches**: detects `git checkout` and creates a new session automatically
- **Session end**: generates a resume briefing with progress, decisions, and next steps

When you return to the branch later, Claude shows what was happening and asks if you want to resume:

```
Prior work detected on this branch:
- Project: "Icon Resize" (active)
- Last session: 3h ago (4 total sessions)
- Last activity: "Implemented resize handle rendering"

Want me to load the full context, or are you starting something new?
```

You can also add notes to the current session at any time:

```
/claude-session-manager:note "decided to use SVG transforms instead of CSS"
```

Or generate a fresh resume briefing on demand:

```
/claude-session-manager:resume
```

### 3. Close a Project

When the work is done:

```
/claude-session-manager:close-project
```

This:
1. Marks the project as completed
2. Generates a takeaway from all linked sessions, git history, and plans
3. Presents each section for review — you choose where it goes (CLAUDE.md, memory, both, or skip)
4. Indexes the takeaway in the knowledge base for future search

### 4. Search Past Knowledge

When starting new work, search across all completed project takeaways:

```
/claude-session-manager:search-knowledge "pointer events drag"
```

```
Found 2 past projects that might be relevant:

1. "Icon Resize" (my-app-2, Mar 2026)
   Tags: resize, drag, SVG, pointer-events, controls
   → Takeaway has patterns for coordinate transforms and drag-based E2E testing

2. "Canvas Pan/Zoom" (my-app, Jan 2026)
   Tags: pointer-events, gesture, transform, viewport
   → Takeaway has lessons about pointer capture and event delegation

Load their takeaways? [Yes / Pick specific ones / No]
```

## Dashboard

### CLI

```
/claude-session-manager:dashboard
```

Shows a text table with all repos, branches, active projects, and recent sessions — grouped by repo copies.

### Web

```
/claude-session-manager:dashboard --web
```

Or standalone:
```bash
npx claude-session-dashboard
```

A local web app (dark theme, zero dependencies, localhost only) with four tabs:

| Tab | What it shows |
|-----|--------------|
| **Overview** | Stats cards (repos, projects, sessions) + recent activity |
| **Projects** | All projects with status, session count, dates. Filter by status/repo. Click ✓ to view takeaways. |
| **Sessions** | All sessions, classified as meaningful or noise. Bulk select and delete. |
| **Knowledge** | Searchable index of all takeaways with tag filtering |

Sessions are classified automatically:
- **Meaningful** — has commits or lasted more than 2 minutes
- **Noise** — short (< 2 min) with no commits

## Commands Reference

| Command | Description |
|---------|-------------|
| `setup` | First-time configuration wizard |
| `start-project` | Create a project to track multi-session work |
| `close-project` | Mark project complete, generate takeaway |
| `resume` | Generate a full context briefing |
| `note "text"` | Add a note to the current session |
| `dashboard` | Cross-repo status overview (`--web` for graphical) |
| `history` | View all past projects (`--active`, `--completed`, `--all`) |
| `search-knowledge` | Search past takeaways for patterns and lessons |

All commands are prefixed with `/claude-session-manager:`.

## Configuration

After running setup, the config lives at `~/.claude/session-manager/config.json`:

```json
{
  "schemaVersion": 1,
  "autoTrack": true,
  "resumeMode": "ask",
  "repos": {
    "my-app": { "path": "/home/user/code/my-app", "group": "my-app" },
    "my-app-2": { "path": "/home/user/code/my-app-2", "group": "my-app" },
    "other-project": { "path": "/home/user/code/other-project" }
  }
}
```

- **autoTrack** — When `true`, any git repo you open Claude Code in gets automatically tracked for sessions.
- **resumeMode** — Controls how prior session context is presented on startup (`ask`, `auto`, `manual`).
- **repos** — Tracked repos. The `group` field links repo copies so the dashboard shows them together.

## How It Works

### Hooks

Three Claude Code hooks run automatically:

| Hook | When | What |
|------|------|------|
| **SessionStart** | Session opens (sync, ~50ms) | Records session, detects branch, injects resume context |
| **Stop** | After each response (async) | Extracts summary, plan refs. Detects branch switches. |
| **SessionEnd** | Session closes (async) | Full extraction, briefing generation, stale session cleanup |

SessionStart is a bash script for speed. Stop and SessionEnd are Node.js scripts that parse Claude's JSONL transcript.

### Skills

Four skills activate based on context:

| Skill | When |
|-------|------|
| `resuming-a-session` | Prior sessions detected on current branch |
| `tracking-a-project` | User explicitly asks to track work or runs `start-project` |
| `generating-takeaways` | Project is marked complete |
| `searching-past-knowledge` | Starting significant new work |

### Agents

- **briefing-writer** — Synthesizes resume briefings from session metadata, git state, and plan files.
- **takeaway-writer** — Generates structured post-mortems from completed project history.

### Data Storage

All plugin data lives at `~/.claude/session-manager/`:

```
config.json                       # Tracked repos, groups, preferences
knowledge-index.json              # Cross-repo takeaway index
repos/
  {slug}/
    sessions/{id}.json            # Per-session snapshot
    projects/{slug}.json          # Project tracking
    projects/{slug}.takeaway.md   # Post-mortem
    briefings/latest.md           # Resume briefing
```

The plugin reads Claude Code's data (transcripts, plans, tasks) but never modifies it.

## Compatibility

- Works alongside other Claude Code plugins
- No hook conflicts — uses SessionStart/Stop/SessionEnd only
- No external dependencies beyond Node.js built-ins

## License

MIT — see [LICENSE](LICENSE)
