---
description: Show status of all tracked repos and active projects in a cross-repo dashboard.
---

# Development Dashboard

Generate a cross-repo status overview of all tracked repositories and projects.

## Steps

1. **Read config**: Parse `~/.claude/session-manager/config.json` to get all tracked repos.

2. **For each tracked repo**, gather:
   - Current git branch: `git -C {path} rev-parse --abbrev-ref HEAD`
   - Last commit: `git -C {path} log --oneline -1 --no-decorate`
   - Active project: scan `~/.claude/session-manager/repos/{slug}/projects/*.json` for status "active"
   - Last session: find the most recent session JSON in `~/.claude/session-manager/repos/{slug}/sessions/` by `startedAt` timestamp
   - Calculate "time ago" from the last session's timestamp

3. **Group by group field**: Repos with the same `group` value in config should be displayed under a shared header. Repos without a group get their own section.

4. **Present as formatted markdown table**:

```
## Development Dashboard
Updated: {current date/time}

### {group name} ({description if available})
| Copy | Branch | Project | Last Session | Status |
|------|--------|---------|-------------|--------|
| {slug} | {branch} | {project title or —} | {time ago} | {status} |

### {ungrouped repo}
| Branch | Project | Last Session | Status |
|--------|---------|-------------|--------|
| {branch} | {project title or —} | {time ago} | {status} |

Active projects: {count} | Paused: {count} | Completed this week: {count}
```

5. **Show summary line** at the bottom with counts.

## Web Dashboard

If the user passes `--web` or asks for a visual/graphical dashboard, launch the web dashboard:

1. Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/open-dashboard.js"`
   (or tell the user to run it manually if Bash is not available)
2. This starts a local server on a random port and opens the browser
3. The web dashboard has four views: Overview, Projects, Sessions (with cleanup/delete), and Knowledge
4. Tell the user the URL and that they can press Ctrl+C to stop the server
