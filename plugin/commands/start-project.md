---
description: Create a new project to track multi-session work. Links the current session and branch to the project.
---

# Start Project

Create a new project for the current repo and branch. Projects group sessions together and enable takeaways when the work is complete.

## Steps

1. **Check for existing projects**:
   - Get the repo slug from `~/.claude/session-manager/config.json` for the current directory.
   - Get the current branch with `git rev-parse --abbrev-ref HEAD`.
   - Check if an active project already exists for this branch in `~/.claude/session-manager/repos/{slug}/projects/*.json`.
   - If one exists, show it and ask: "Project **'{title}'** is already active on this branch. Attach this session to it?" If yes, update the session's `projectSlug` and the project's `sessions` array. Done.

2. **Ask for project details**:
   - Suggest a title based on the branch name (e.g., `feature/add-auth` → "Add Auth").
   - Ask the user to confirm or provide a different title.
   - Optionally ask for a brief description.

3. **Create the project JSON** at `~/.claude/session-manager/repos/{slug}/projects/{project-slug}.json`:
   ```json
   {
     "schemaVersion": 1,
     "slug": "project-slug",
     "title": "Human-readable title",
     "status": "active",
     "createdAt": "ISO timestamp",
     "updatedAt": "ISO timestamp",
     "branches": ["current-branch-name"],
     "repos": ["repo-slug"],
     "planFiles": [],
     "sessions": ["current-session-id"],
     "description": "Brief description if provided",
     "blockers": [],
     "completedAt": null
   }
   ```
   Derive the slug from the title: lowercase, replace spaces and special chars with hyphens.

4. **Link the current session**:
   - Read the current session ID from `~/.claude/session-manager/.current-session-{slug}`.
   - Update the session JSON's `projectSlug` field to the new project slug.
   - Add the session ID to the project's `sessions` array.

5. **Link plan files**: If any plan files exist in `~/.claude/plans/`, ask the user if they should be linked. Add confirmed paths to `planFiles`.

6. **Confirm**: Tell the user the project was created and the session is linked. Mention they can close it later with `/claude-session-manager:close-project`.
