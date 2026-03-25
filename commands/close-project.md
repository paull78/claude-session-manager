---
description: Mark the current project as completed and generate a structured takeaway with patterns, lessons, and CLAUDE.md recommendations.
---

# Close Project

Mark the current project as completed and generate a takeaway document.

## Steps

1. **Identify the current project**:
   - Get the repo slug from `~/.claude/session-manager/config.json` for the current directory.
   - Get the current branch with `git rev-parse --abbrev-ref HEAD`.
   - Find the active project matching this branch in `~/.claude/session-manager/repos/{slug}/projects/*.json`.
   - If no project found, tell the user and ask if they want to create one first.

2. **Confirm with the user**: Show the project title and ask them to confirm they want to close it.

3. **Update project status**:
   - Set `status` to `"completed"`
   - Set `completedAt` to current ISO timestamp
   - Update `updatedAt`

4. **Gather context for takeaway**:
   - Read all session JSONs linked to this project
   - Read the plan file if one exists
   - Run `git log --oneline` for the branch to see all commits
   - Read session notes and key decisions
   - Check the repo's CLAUDE.md for existing conventions

5. **Generate takeaway**: Write a structured post-mortem to `~/.claude/session-manager/repos/{slug}/projects/{project-slug}.takeaway.md` with these sections:

   - **Summary**: What was built, in one paragraph. Include session count and timespan.
   - **Patterns & Conventions**: Code patterns that emerged or were established during this project.
   - **Lessons Learned**: What was harder than expected, what went wrong, what was surprisingly easy.
   - **Reusable Snippets**: Any code patterns, configurations, or test setups worth reusing in future projects.
   - **Recommendations for CLAUDE.md**: Specific additions or updates to suggest for the repo's CLAUDE.md file.

6. **Present recommendations**: Show the CLAUDE.md recommendations and ask if the user wants to append them.

7. **If approved**, append the recommendations to the repo's CLAUDE.md under a dated "## Learnings" section. If CLAUDE.md doesn't exist, create it with just the learnings section.

8. **Confirm**: Tell the user the project is closed and the takeaway is saved at the file path.
