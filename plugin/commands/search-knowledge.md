---
description: Search past project takeaways for relevant patterns, lessons, and snippets. Optionally provide search terms or let Claude infer from context.
---

# Search Knowledge

Search across all completed project takeaways for relevant knowledge.

## Usage

With search terms:
```
/claude-session-manager:search-knowledge "drag and drop"
```

Without (Claude infers from current context):
```
/claude-session-manager:search-knowledge
```

## Steps

1. **Read the knowledge index** at `~/.claude/session-manager/knowledge-index.json`. The file is a JSON object with `schemaVersion` and an `entries` array. If it doesn't exist, has no entries, or is empty, tell the user: "No past projects found in the knowledge base. Complete a project with `/claude-session-manager:close-project` to start building your knowledge base."

2. **Determine search context**:
   - If the user provided search terms, use those
   - If no terms provided, infer from:
     - Current branch name (`git rev-parse --abbrev-ref HEAD`)
     - Recent commit messages (`git log --oneline -10`)
     - Any active project for the current branch
     - If still unclear, ask the user what they're looking for

3. **Match against the index**:
   - Compare search terms against each entry's `tags` and `summary`
   - Rank by relevance (number of matching tags, summary keyword overlap)
   - Include entries from ANY repo — knowledge is cross-repo

4. **Present results**:
   - Show matching projects with their summary, repo, date, and matching tags
   - If no matches found, say so and suggest broadening the search
   - If matches found, ask which takeaways the user wants to load

5. **Load selected takeaways**:
   - Read the takeaway files at the paths in the selected index entries
   - Present the relevant sections — focus on patterns, lessons, and snippets that relate to the search context
   - Don't dump entire takeaways; extract what's useful

6. **Offer to apply**: Ask if any of the knowledge should inform the current work (e.g., "Should I keep these patterns in mind as we work?").
