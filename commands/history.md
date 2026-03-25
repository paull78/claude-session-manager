---
description: Show all past projects across tracked repos. Filter by status with arguments like --active, --completed, --all.
---

# Project History

Show the full history of all tracked projects across all repos.

## Steps

1. **Parse arguments**: Check if the user provided a filter:
   - `--active` — show only active projects
   - `--completed` — show only completed projects
   - `--paused` — show only paused projects
   - `--all` or no argument — show everything (default)

2. **Read all projects**: Scan `~/.claude/session-manager/repos/*/projects/*.json` for all project files across all tracked repos.

3. **For each project**, gather:
   - Title, status, repo slug(s)
   - Session count (length of sessions array)
   - Date range (createdAt to completedAt or updatedAt)
   - Whether a takeaway exists (check for `{project-slug}.takeaway.md` alongside the JSON)

4. **Group by repo group** (same as dashboard).

5. **Present as table**:

```
## Project History

### {group name}
| Project | Repos | Status | Sessions | Period | Takeaway |
|---------|-------|--------|----------|--------|----------|
| {title} | {slug(s)} | {status} | {count} | {date range} | yes/— |

Completed: {n} | Active: {n} | Paused: {n} | Total sessions: {n}
```

6. **For completed projects with takeaways**: Mention that the user can read the takeaway at the file path.
