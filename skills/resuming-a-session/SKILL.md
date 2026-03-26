---
name: resuming-a-session
description: Use when starting work in a repo where previous Claude sessions exist, the SessionStart hook injected context about prior sessions, or the user asks to resume or continue previous work
---

# Resuming a Session

When you detect that this repo has prior session data (the SessionStart hook may have injected context about this), help the user resume their work.

## Resume Modes

The plugin has three resume modes configured via `resumeMode` in `~/.claude/session-manager/config.json`:

### "ask" mode (default)
The SessionStart hook injected a **summary snippet** (project title, session count, last activity) and told you to **ask the user** before loading full context.

1. **Present the summary** that was injected by the hook. Keep it brief — the user just needs enough to decide.
2. **Ask if they want to resume**: "I see you have prior work on this branch. Want me to load the full context, or are you starting something new?"
3. **If they want to resume**: Read the full briefing at the path mentioned in the hook context (`~/.claude/session-manager/repos/{slug}/briefings/latest.md`), then present the detailed context and continue.
4. **If they want to start fresh**: Acknowledge and proceed with whatever they ask. Do not load the briefing.

### "auto" mode
The hook told you to read the briefing immediately. Do so:

1. **Read the briefing** at `~/.claude/session-manager/repos/{slug}/briefings/latest.md`.
2. **Present a concise summary** of the briefing content.
3. **Ask if the user wants to continue** from where the last session left off, or work on something different.

### "manual" mode
The hook only confirmed session tracking. Do nothing about prior sessions unless the user explicitly asks (e.g., "resume", "continue", or runs `/claude-session-manager:resume`).

## Generating a Fresh Briefing

If no briefing exists (or the user runs `/claude-session-manager:resume`), generate one by:
- Reading session JSON files from `~/.claude/session-manager/repos/{slug}/sessions/` (sorted by startedAt, most recent first)
- Reading any linked plan file
- Checking git log and git status
- Checking task files

Present: what was being worked on, what's done/remaining, key decisions, suggested next steps.

## When This Triggers
- The SessionStart hook injects context containing `[claude-session-manager]` (ask mode) or "Resuming project..." (auto mode)
- The user says "continue", "resume", "pick up where I left off", or similar
- The user runs `/claude-session-manager:resume`
