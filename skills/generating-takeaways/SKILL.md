---
name: generating-takeaways
description: Use when a project is marked complete, the user runs close-project, or asks to generate a retrospective or post-mortem for finished work
---

# Generating Takeaways

When a project is being closed or the user wants to capture learnings from completed work, generate a structured takeaway document.

## What to Do

1. **Gather all project context**:
   - Read the project JSON from `~/.claude/session-manager/repos/{slug}/projects/{project-slug}.json`
   - Read all linked session JSON files for notes, summaries, and key decisions
   - Read the plan file if one is referenced
   - Run `git log --oneline` for the project's branch
   - Read the repo's CLAUDE.md for existing conventions

2. **Generate the takeaway** with sections: Summary, Patterns & Conventions, Lessons Learned, Reusable Snippets, CLAUDE.md Recommendations.

3. **Save the takeaway** to `~/.claude/session-manager/repos/{slug}/projects/{project-slug}.takeaway.md`

4. **Present the CLAUDE.md recommendations** to the user and ask if they'd like to append them to the repo's CLAUDE.md.

5. **If approved**, append under a dated "## Learnings" section.

## Key Principles
- Be specific, not generic — reference actual files, functions, and patterns
- Focus on knowledge that helps FUTURE work, not just documenting what happened
- Keep it concise — under 500 words
- The takeaway should be useful months from now when the details have been forgotten
