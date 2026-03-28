---
description: Add a note to the current session. Use to record decisions, context, or anything a future session should know.
---

# Add Session Note

The user wants to add a note to the current tracking session. Notes are included in resume briefings so future sessions can see important context and decisions.

## Steps

1. **Get the note text**: The user's message after the command is the note. If no text was provided, ask them what they'd like to note.

2. **Find the current session**:
   - Read `~/.claude/session-manager/config.json` to find the repo slug for the current directory.
   - Find the current session marker at `~/.claude/session-manager/.current-session-{slug}` — it contains the session ID.
   - Read the session JSON at `~/.claude/session-manager/repos/{slug}/sessions/{sessionId}.json`.

3. **Append the note**: Add the note text to the session JSON's `notes` array. Include a timestamp.
   ```json
   {
     "notes": [
       ...existing notes,
       "2026-03-24T14:30:00Z: Decided to use MobX instead of signals for state management"
     ]
   }
   ```

4. **Confirm**: Tell the user the note was added to session {sessionId}. Keep it brief.

## Tips
- Notes should be concise but complete enough to be useful out of context
- Good notes capture decisions, not just facts: "Decided X because Y" is better than "Changed X"
- Notes are surfaced in resume briefings under "Key Decisions"
