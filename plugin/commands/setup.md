---
description: First-time configuration for session tracking. Scans for repos, sets up groups, creates config.
---

# Setup Session Manager

You are setting up the claude-session-manager plugin for the user. This creates the configuration file at `~/.claude/session-manager/config.json`.

## Steps

1. **Check if config already exists** at `~/.claude/session-manager/config.json`. If it does, ask the user if they want to reconfigure or keep existing settings.

2. **Scan for repositories**: List directories in the user's current parent directory (and common code directories like ~/code, ~/projects, ~/repos) that contain a `.git` directory.

3. **Present repos to the user**: Use AskUserQuestion with multiSelect to let them choose which repos to track. Group repos that appear to be copies (e.g., `my-app`, `my-app-2`, `my-app-3` — same base name with `-N` suffix).

4. **Auto-detect groups**: For repos with `-1`, `-2`, `-3` etc. suffixes, suggest grouping them together. Ask the user to confirm. The group name is the base name (e.g., "my-app" for my-app, my-app-2, my-app-3).

5. **Ask about resume behavior**: Use AskUserQuestion to ask:
   "When you start a session on a branch where you've worked before, how should Claude handle it?"
   - **Ask first (Recommended)**: Claude shows a quick summary and asks if you want to resume — set `resumeMode` to `"ask"`
   - **Auto-load context**: Claude automatically loads the full resume briefing — set `resumeMode` to `"auto"`
   - **Do nothing**: No auto-resume; you run `/claude-session-manager:resume` when you want context — set `resumeMode` to `"manual"`

6. **Create the config**: Write `~/.claude/session-manager/config.json` with this structure:
   ```json
   {
     "schemaVersion": 1,
     "autoTrack": true,
     "resumeMode": "ask",
     "repos": {
       "my-app": { "path": "/home/user/code/my-app", "group": "my-app" },
       "my-app-2": { "path": "/home/user/code/my-app-2", "group": "my-app" },
       "my-app-3": { "path": "/home/user/code/my-app-3", "group": "my-app" },
       "other-project": { "path": "/home/user/code/other-project" }
     }
   }
   ```

7. **Create directory structure**: For each tracked repo, create:
   - `~/.claude/session-manager/repos/{slug}/sessions/`
   - `~/.claude/session-manager/repos/{slug}/projects/`
   - `~/.claude/session-manager/repos/{slug}/briefings/`

8. **Confirm**: Tell the user setup is complete and that session tracking is now active. Mention they can run `/claude-session-manager:dashboard` to see status.
