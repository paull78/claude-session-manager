---
name: searching-past-knowledge
description: Use when starting significant new work, entering plan mode, beginning a feature, or debugging a complex issue where past project experience might be relevant
---

# Searching Past Knowledge

When you detect that the user is starting significant new work, check if past completed projects might have relevant knowledge.

## When This Triggers

- User enters plan mode or starts a new feature
- User begins debugging a complex issue
- User asks about approaches or patterns for something they might have done before
- The `tracking-a-project` skill fires (new project starting)

## What to Do

1. **Read the knowledge index** at `~/.claude/session-manager/knowledge-index.json`. If it doesn't exist or is empty, skip silently — don't mention it.

2. **Compare** the current task against the index entries. Match on:
   - Tags that overlap with the current task's technologies, patterns, or concepts
   - Summaries that describe similar work
   - Consider the current branch name, recent commits, and the user's request as search context

3. **If potentially relevant entries exist, ask the user**:
   > "I found {n} past project(s) that might be relevant:
   > - **{project title}** ({repo}, {date}): {summary}
   > - **{project title}** ({repo}, {date}): {summary}
   >
   > Want me to load their takeaways for relevant patterns and lessons?"

4. **If the user says yes**: Read the takeaway files at the paths listed in the index entries. Present the relevant sections (patterns, lessons, snippets) that apply to the current task. Don't dump the entire takeaway — extract what's useful.

5. **If the user says no**: Proceed normally. Don't mention it again.

## Key Principles

- **Always ask** before loading takeaway content — never auto-load
- **Skip silently** if the index is empty or nothing looks relevant
- **Be selective** — only mention projects that genuinely match, not everything in the index
- **Extract, don't dump** — when loading a takeaway, present only the sections relevant to current work
