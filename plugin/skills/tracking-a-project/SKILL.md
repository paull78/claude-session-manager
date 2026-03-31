---
name: tracking-a-project
description: Use when the user explicitly asks to track work as a project or runs /claude-session-manager:start-project
---

# Tracking a Project

Only create or update project tracking when the user explicitly requests it — via `/claude-session-manager:start-project` or by directly asking to track work as a project. Never auto-create projects.

## When to Activate

- User runs `/claude-session-manager:start-project`
- User explicitly says "track this as a project", "create a project for this", or similar

## Do NOT activate when

- User enters plan mode (plan ≠ project)
- User starts multi-step work (let them decide if it's worth tracking)
- You detect this is the 2nd+ session on the same branch

## How to Create/Update

1. **Determine project slug**: Derive from branch name or user's description. Use lowercase-with-hyphens format.

2. **Read existing projects**: Check `~/.claude/session-manager/repos/{slug}/projects/` for existing projects on this branch.

3. **Create project JSON** at `~/.claude/session-manager/repos/{slug}/projects/{project-slug}.json`:
   ```json
   {
     "schemaVersion": 1,
     "slug": "project-slug",
     "title": "Human-readable title",
     "status": "active",
     "createdAt": "ISO timestamp",
     "updatedAt": "ISO timestamp",
     "branches": ["branch-name"],
     "repos": ["repo-slug"],
     "planFiles": ["path to plan file if exists"],
     "sessions": ["current-session-id"],
     "description": "Brief description of what's being built",
     "blockers": [],
     "completedAt": null
   }
   ```

4. **Link to current session**: Read the current session ID from `~/.claude/session-manager/.current-session-{slug}` and add it to the project's sessions array. Also update the session JSON's `projectSlug` field.

5. **Link plan files**: If a plan file exists in `~/.claude/plans/`, add its path to `planFiles`.

## Updating Existing Projects

If a project already exists for this branch:
- Add the current session to the `sessions` array
- Update `updatedAt`
- Update `planFiles` if new plans were created
- Update `status` if needed (e.g., from "paused" to "active")
