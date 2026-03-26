# claude-session-manager

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that tracks and resumes parallel development sessions across repo copies.

## The Problem

If you work across multiple copies of a repository (e.g., `my-app`, `my-app-2`, `my-app-3`) — each on a different branch with its own Claude Code session — you know the pain:

- **Lost context**: You open a session in `my-app-2` and can't remember what you were working on, what decisions were made, or what's left to do.
- **No continuity**: Each new Claude session starts from scratch. The previous session's reasoning, plan progress, and key decisions are gone.
- **No big picture**: There's no way to see what's happening across all your repos and branches at a glance.
- **Forgotten lessons**: When a project is done, the patterns you discovered and mistakes you made evaporate.

**claude-session-manager** solves all of this.

## What It Does

### Automatic Session Tracking
Every time you open Claude Code in a tracked repo, the plugin silently records the session — which branch, which commits, what time. When the session ends, it extracts a summary, key decisions, and plan references from Claude's conversation transcript.

### Smart Resume
When you start a new session on a branch where you've worked before, Claude shows you a quick summary of what was happening and asks if you want to resume. If yes, it loads the full context — plan progress, decisions, next steps. If not, it stays out of the way. You control the behavior: `"ask"` (default), `"auto"`, or `"manual"`.

### Cross-Repo Dashboard
One command shows the status of all your repos, branches, and active projects in a single table — grouped by repo copies.

### Project Lifecycle
Track work from start to finish. When a project is complete, generate a structured takeaway capturing patterns, lessons learned, and reusable snippets. You decide per-section what goes to CLAUDE.md, Claude's memory files, both, or stays in the takeaway only.

## Installation

### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed and working
- Node.js (v18+) — required for the extraction hooks
- Git

### Step 1: Add the marketplace

Open your Claude Code settings file at `~/.claude/settings.json` and add the marketplace source under `extraKnownMarketplaces`:

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

### Step 2: Enable the plugin

In the same `~/.claude/settings.json`, add the plugin to `enabledPlugins`:

```json
{
  "enabledPlugins": {
    "claude-session-manager@paull78": true
  }
}
```

### Step 3: Restart Claude Code

Close and reopen Claude Code (or run `/clear`) so the plugin hooks are loaded.

### Step 4: Run setup

In any Claude Code session, run:

```
/claude-session-manager:setup
```

This walks you through:
1. Scanning your filesystem for git repositories
2. Choosing which repos to track
3. Auto-detecting repo copies (e.g., `my-app`, `my-app-2`, `my-app-3`) and grouping them
4. Choosing your resume mode (`ask`, `auto`, or `manual`)
5. Creating the configuration at `~/.claude/session-manager/config.json`

## Commands

| Command | Description |
|---------|-------------|
| `/claude-session-manager:setup` | First-time configuration wizard |
| `/claude-session-manager:dashboard` | Cross-repo status overview of all tracked repos |
| `/claude-session-manager:resume` | Generate a full context briefing and resume work |
| `/claude-session-manager:note "text"` | Add a note to the current session (for decisions, context) |
| `/claude-session-manager:history` | View all past projects with filters (`--active`, `--completed`, `--all`) |
| `/claude-session-manager:close-project` | Mark project complete, generate takeaway, interactively distribute learnings |

### Example: Dashboard

```
/claude-session-manager:dashboard
```

```
## Development Dashboard
Updated: 2026-03-24 14:45

### my-app group (wireframe editor)
| Copy      | Branch                    | Project        | Last Session | Status |
|-----------|---------------------------|----------------|-------------|--------|
| my-app    | main                      | —              | 2 days ago  | —      |
| my-app-2  | feature/icon-resize       | Icon Resize    | 3h ago      | active |
| my-app-3  | feature/comments-panel    | Comments Panel | yesterday   | paused |

Active projects: 2 | Paused: 1 | Completed this week: 0
```

### Example: Session Start (ask mode)

When you open Claude Code on a branch with prior work, you'll see:

```
I see you have prior work on this branch:
- Project: "Icon Resize" (active)
- Branch: feature/icon-resize
- Last session: 3h ago (4 total sessions)
- Last activity: "Implemented resize handle rendering"

Want me to load the full context, or are you starting something new?
```

If you say yes, Claude reads the full briefing with plan progress, key decisions, and next steps. If no, it proceeds normally.

### Example: Resume

```
/claude-session-manager:resume
```

Generates a fresh briefing with:
- **Current State** — branch, last commit, uncommitted changes
- **Project Context** — what's being built and why
- **Progress** — tasks done vs pending, plan status
- **Key Decisions** — choices made in prior sessions
- **Next Steps** — what to work on next

The briefing is saved for future session starts.

### Example: Close Project

```
/claude-session-manager:close-project
```

Generates a structured takeaway with:
- **Summary** — what was built, session count, timespan
- **Patterns & Conventions** — code patterns that emerged
- **Lessons Learned** — what was harder than expected, mistakes to avoid
- **Reusable Snippets** — code worth templating for future use

The takeaway is saved to the plugin folder. Then each section is presented one at a time — you choose where it goes:

| Destination | What it means |
|-------------|--------------|
| **CLAUDE.md** | Appended to your repo's project instructions |
| **Memory** | Written to Claude's auto-loaded memory files |
| **Both** | Written to both |
| **Skip** | Kept only in the takeaway file |

You can also edit the content before confirming each section. Nothing is written to CLAUDE.md or memory without your explicit approval.

## How It Works

### Hooks (Automatic)

The plugin registers three Claude Code hooks:

| Hook | When | What it does |
|------|------|-------------|
| **SessionStart** | Session opens (sync) | Records session, detects branch/repo, injects resume context based on `resumeMode` |
| **Stop** | Claude finishes responding (async) | Extracts latest summary, plan references, task creation |
| **SessionEnd** | Session closes (async) | Full extraction: decisions, commits, tasks. Generates briefing. |

- **SessionStart** is a fast bash script (~50ms) that runs synchronously — it must not slow down session startup.
- **Stop** and **SessionEnd** are Node.js scripts that run asynchronously — they parse Claude's JSONL transcript to extract structured data.

### Skills (Automatic)

Three skills trigger automatically based on context:

| Skill | Triggers when |
|-------|--------------|
| `resuming-a-session` | Prior sessions detected on current branch |
| `tracking-a-project` | User starts significant work, enters plan mode, or creates a PRD |
| `generating-takeaways` | Project is marked complete |

### Agents

Two specialized agents handle complex synthesis tasks:

- **briefing-writer** — Reads session metadata, git state, plan files, and task files to produce structured resume briefings.
- **takeaway-writer** — Reads full project history to produce structured post-mortems with patterns, lessons, and reusable snippets.

### Data Storage

All data lives centrally at `~/.claude/session-manager/`:

```
~/.claude/session-manager/
  config.json                       # Tracked repos, groups, preferences
  repos/
    {repo-slug}/
      repo.json                     # Repo metadata
      sessions/
        {session-id}.json           # Per-session snapshot (branch, commits, summary, decisions)
      projects/
        {project-slug}.json         # Project tracking (status, sessions, plan files)
        {project-slug}.takeaway.md  # Post-mortem when completed
      briefings/
        latest.md                   # Most recent resume briefing
```

The plugin **reads** Claude Code's existing data (session transcripts at `~/.claude/projects/`, plans at `~/.claude/plans/`, tasks at `~/.claude/tasks/`) but **never modifies** it. All plugin data is stored separately.

## Compatibility

- Works alongside other Claude Code plugins (superpowers, claude-mem, commit-commands, etc.)
- No hook conflicts — uses SessionStart/Stop/SessionEnd only, avoids PostToolUse/UserPromptSubmit
- No external dependencies beyond Node.js built-ins

## Configuration

After running `/claude-session-manager:setup`, the config lives at `~/.claude/session-manager/config.json`:

```json
{
  "autoTrack": true,
  "resumeMode": "ask",
  "repos": {
    "my-app": { "path": "/home/user/code/my-app", "group": "my-app" },
    "my-app-2": { "path": "/home/user/code/my-app-2", "group": "my-app" },
    "other-project": { "path": "/home/user/code/other-project" }
  }
}
```

- **autoTrack** (`true`/`false`) — When `true`, any git repo you open Claude Code in gets automatically tracked.
- **resumeMode** (`"ask"` / `"auto"` / `"manual"`) — Controls how prior session context is presented:
  - `"ask"` (default) — Shows a summary and asks before loading full context
  - `"auto"` — Automatically loads the full resume briefing
  - `"manual"` — No auto-resume; run `/claude-session-manager:resume` explicitly
- **repos** — Manually configured repos. The `group` field links repo copies so the dashboard shows them together.

## License

MIT — see [LICENSE](LICENSE)
