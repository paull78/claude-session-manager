---
description: Resume a previous session with full context. Generates a briefing from session history, git state, and plan files.
---

# Resume Session

You are helping the user resume work from a previous Claude Code session. This command can be invoked explicitly by the user, or the `resuming-a-session` skill may guide you here when the SessionStart hook detects prior work.

## Context

The plugin has three resume modes (configured via `resumeMode` in `~/.claude/session-manager/config.json`):
- `"ask"` (default) — The SessionStart hook shows a summary and asks before loading. If the user agrees, you end up here.
- `"auto"` — The hook tells you to read the briefing directly. You may already have context.
- `"manual"` — The hook says nothing. The user runs this command explicitly when they want context.

Regardless of mode, this command always generates a full briefing.

## Steps

1. **Identify current context**: Read the current repo path (CWD) and git branch (`git rev-parse --abbrev-ref HEAD`).

2. **Find session data**: Look at `~/.claude/session-manager/config.json` to find the repo slug for this directory. Then scan `~/.claude/session-manager/repos/{slug}/sessions/` for session JSON files matching the current branch. Sort by `startedAt` descending.

3. **Check for existing briefing**: Read `~/.claude/session-manager/repos/{slug}/briefings/latest.md` if it exists. If it's recent (generated within the last session), present it directly.

4. **Generate fresh briefing if needed**: If no briefing exists or it's stale, gather context:
   - Read the most recent session JSON files (last 2-3 sessions on this branch)
   - Read any linked plan file (from session's `planFile` field)
   - Read task files from `~/.claude/tasks/{taskSessionId}/` if referenced
   - Run `git log --oneline -20` and `git diff --stat` for current state
   - Run `git status --short` for uncommitted changes

5. **Present the briefing** with these sections:
   - **Current State**: repo, branch, last commit, uncommitted changes
   - **Project Context**: what is being built (from project JSON if exists, or inferred from plan/commits)
   - **Progress**: tasks done vs pending, plan status
   - **Key Decisions**: from session notes and extracted decisions
   - **Blockers**: anything noted
   - **Next Steps**: what to work on next

6. **Save the briefing**: Write it to `~/.claude/session-manager/repos/{slug}/briefings/latest.md` so the SessionStart hook can reference it in future sessions.

7. **Ask**: "Would you like to continue from where the last session left off?"
