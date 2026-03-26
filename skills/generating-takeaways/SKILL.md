---
name: generating-takeaways
description: Use when a project is marked complete, the user runs close-project, or asks to generate a retrospective or post-mortem for finished work
---

# Generating Takeaways

When a project is being closed or the user wants to capture learnings from completed work, generate a structured takeaway document and let the user decide where each section goes.

## What to Do

1. **Gather all project context**:
   - Read the project JSON from `~/.claude/session-manager/repos/{slug}/projects/{project-slug}.json`
   - Read all linked session JSON files for notes, summaries, and key decisions
   - Read the plan file if one is referenced
   - Run `git log --oneline` for the project's branch
   - Read the repo's CLAUDE.md for existing conventions

2. **Generate the takeaway** with sections: Summary, Patterns & Conventions, Lessons Learned, Reusable Snippets.

3. **Save the takeaway** to `~/.claude/session-manager/repos/{slug}/projects/{project-slug}.takeaway.md`. This file always contains the complete takeaway regardless of what the user does next.

4. **Interactive section review**: Present each section to the user one at a time. For each section, ask where it should go:
   - **CLAUDE.md** — project conventions/instructions (appended under a dated heading)
   - **Memory** — Claude's auto-loaded memory files at `~/.claude/projects/{encoded-path}/memory/`
   - **Both**
   - **Skip** — keep only in the takeaway file

   The user can edit or correct the content before confirming each section. Apply any corrections before writing.

5. **Execute choices**: Write approved sections to the chosen destinations. For memory, create a memory file and update the MEMORY.md index.

## Key Principles
- **Never auto-write** to CLAUDE.md or memory — always ask per section
- Be specific, not generic — reference actual files, functions, and patterns
- Focus on knowledge that helps FUTURE work, not just documenting what happened
- Keep it concise — under 500 words total
- The takeaway should be useful months from now when the details have been forgotten
