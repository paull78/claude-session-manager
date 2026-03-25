# claude-session-manager

Track and resume parallel development sessions across repo copies

## The Problem

When working across multiple copies of a repo (e.g., `b4`, `b4-2`, `b4-3`) with parallel Claude Code sessions, it's hard to remember what each session was doing, resume unfinished work, or capture learnings. Context gets lost between sessions, decisions go undocumented, and the same mistakes get repeated across branches.

## What It Does

- Auto-tracks sessions via hooks (branch, commits, timestamps)
- Generates resume briefings so new sessions pick up where old ones left off
- Cross-repo dashboard showing all active work
- Project tracking with completion and takeaway generation
- Extracts patterns, lessons, and CLAUDE.md recommendations from finished projects

## Installation

**1. Add to your marketplace** — add the following to `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": [
    {
      "name": "claude-session-manager",
      "sourceUrl": "https://raw.githubusercontent.com/paull78/claude-session-manager/main/package.json"
    }
  ]
}
```

**2. Enable the plugin** — add to `enabledPlugins` in `~/.claude/settings.json`:

```json
{
  "enabledPlugins": ["claude-session-manager"]
}
```

**3. Run setup**:

```
/claude-session-manager:setup
```

## Commands

| Command | Description |
|---------|-------------|
| `/claude-session-manager:setup` | First-time configuration |
| `/claude-session-manager:dashboard` | Cross-repo status overview |
| `/claude-session-manager:resume` | Resume with full context |
| `/claude-session-manager:note "text"` | Add note to current session |
| `/claude-session-manager:history` | View all past projects |
| `/claude-session-manager:close-project` | Complete project + generate takeaway |

## How It Works

- **SessionStart hook** auto-creates session records and injects resume context when a new Claude Code session begins
- **Stop/SessionEnd hooks** extract summaries, decisions, and plan references from Claude's JSONL transcripts
- **Briefings** are generated as markdown for Claude to read on next session start
- **Data** is stored at `~/.claude/session-manager/`

## Skills

These trigger automatically based on context:

- `resuming-a-session` — helps resume when prior sessions are detected
- `tracking-a-project` — creates project tracking when significant work starts
- `generating-takeaways` — produces post-mortems when projects complete

## Requirements

- [Claude Code](https://claude.ai/code)
- Node.js (for extraction hooks)

## License

MIT
