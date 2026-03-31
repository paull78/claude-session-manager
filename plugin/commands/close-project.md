---
description: Mark the current project as completed and generate a structured takeaway with patterns, lessons, and reusable knowledge.
---

# Close Project

Mark the current project as completed and generate a takeaway document. Nothing is written to CLAUDE.md or memory without explicit per-section approval.

## Steps

1. **Identify the current project**:
   - Get the repo slug from `~/.claude/session-manager/config.json` for the current directory.
   - Get the current branch with `git rev-parse --abbrev-ref HEAD`.
   - Find the active project matching this branch in `~/.claude/session-manager/repos/{slug}/projects/*.json`.
   - If no project found, tell the user: "No active project found on this branch. Run `/claude-session-manager:start-project` first to create one."

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
   - **Patterns & Conventions**: Code patterns that emerged or were established.
   - **Lessons Learned**: What was harder than expected, what went wrong, what was surprisingly easy.
   - **Reusable Snippets**: Code patterns, configurations, or test setups worth reusing.

6. **Interactive section review**: Present each section one at a time. For each section:

   First, **generalize the content** for CLAUDE.md/memory destinations. The takeaway file keeps project-specific details (class names, file paths, specific code), but what goes into CLAUDE.md or memory must be **generic and transferable**:
   - Strip specific class names, function names, file paths, and variable names
   - Extract the underlying principle or pattern (e.g., "ViewControllerBase.initialize() needs explicit null checks" → "Base class lifecycle methods may receive null arguments — always guard")
   - If a lesson is too project-specific to generalize meaningfully, recommend **Skip**
   - Compare against the existing CLAUDE.md — don't add what's already documented

   Then present the **generalized version** and ask where it should go, using AskUserQuestion with these options:
   - **CLAUDE.md** — Append to the repo's CLAUDE.md (project conventions and instructions)
   - **Memory** — Write to Claude's memory files at `~/.claude/projects/{encoded-path}/memory/` (auto-loaded knowledge in future sessions)
   - **Both** — Write to both CLAUDE.md and memory
   - **Skip** — Keep only in the takeaway file, don't write anywhere else

   The user can also edit or correct the content before confirming. If they provide corrections, apply them before writing.

7. **Execute the user's choices**:
   - **For CLAUDE.md destinations**: Append the selected sections to the repo's CLAUDE.md under a dated `## Learnings ({project title})` heading. If CLAUDE.md doesn't exist, create it with just the learnings section.
   - **For Memory destinations**:
     - Compute the encoded project path (e.g., `/home/user/code/my-app` → `-home-user-code-my-app`)
     - Write a memory file to `~/.claude/projects/{encoded-path}/memory/project-{project-slug}-takeaway.md` with the selected sections
     - Read the existing `MEMORY.md` in that directory (create if it doesn't exist)
     - Add a link to the new memory file in `MEMORY.md`

8. **Update the knowledge index**: Add an entry to `~/.claude/session-manager/knowledge-index.json` (create the file if it doesn't exist as an empty JSON array `[]`):
   The knowledge index file wraps entries in an object with a schema version:
   ```json
   {
     "schemaVersion": 1,
     "entries": [...]
   }
   ```

   Each entry:
   ```json
   {
     "project": "{project-slug}",
     "repo": "{repo-slug}",
     "completedAt": "{ISO timestamp}",
     "summary": "{one-line summary from the takeaway's Summary section}",
     "tags": ["{auto-extracted keywords}"],
     "takeawayPath": "~/.claude/session-manager/repos/{slug}/projects/{project-slug}.takeaway.md"
   }
   ```

   For tags, extract 5-15 key technical terms from the takeaway content: technologies, libraries, patterns, concepts, and problem domains. These are used for knowledge search in future projects.

9. **Confirm**: Summarize what was written where. Tell the user the full takeaway is always available at the file path, and that it's now searchable via `/claude-session-manager:search-knowledge`.
