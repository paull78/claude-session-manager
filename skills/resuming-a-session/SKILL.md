---
name: resuming-a-session
description: Use when starting work in a repo where previous Claude sessions exist, the SessionStart hook injected context about prior sessions, or the user asks to resume or continue previous work
---

# Resuming a Session

When you detect that this repo has prior session data (the SessionStart hook may have injected context about this), help the user resume their work.

## What to Do

1. **Read the briefing** if one was referenced in the SessionStart context. The briefing is typically at `~/.claude/session-manager/repos/{slug}/briefings/latest.md`.

2. **If no briefing exists**, generate one by:
   - Reading session JSON files from `~/.claude/session-manager/repos/{slug}/sessions/` (sorted by startedAt, most recent first)
   - Reading any linked plan file
   - Checking git log and git status
   - Checking task files

3. **Present a concise summary** of:
   - What was being worked on
   - What's done and what's remaining
   - Key decisions made in prior sessions
   - Suggested next steps

4. **Ask if the user wants to continue** from where the last session left off, or if they want to work on something different.

5. **If continuing**, read the full plan file and pick up at the next incomplete task or step.

## When This Triggers
- The SessionStart hook injects context like "Resuming project..." or "Prior sessions found..."
- The user says "continue", "resume", "pick up where I left off", or similar
- The user runs /claude-session-manager:resume
