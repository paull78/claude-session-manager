---
name: tracking-a-project
description: Use when the user starts work that should be tracked as a project, creates a PRD, enters plan mode, or begins a multi-session feature
---

# Tracking a Project

When you detect that the user is starting significant work (creating a plan, starting a multi-step feature, writing a PRD), create or update a project tracking file.

## When to Create a Project

- User enters plan mode or creates a plan file
- User starts a multi-step feature that will span sessions
- User explicitly asks to track work as a project
- You detect this is the 2nd+ session on the same branch without an existing project

## How to Create/Update

1. **Determine project slug**: Derive from branch name or user's description. Use lowercase-with-hyphens format.

2. **Read existing projects**: Check `~/.claude/session-manager/repos/{slug}/projects/` for existing projects on this branch.

3. **Create project JSON** at `~/.claude/session-manager/repos/{slug}/projects/{project-slug}.json`:
   ```json
   {
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
