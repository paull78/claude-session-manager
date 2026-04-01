# Changelog

## [1.2.2] — 2026-04-01

### Changed
- Rewrote README with logical user-journey structure: Core Concepts → Workflow → Dashboard → Reference
- Documentation now follows the natural flow: sessions (automatic) → projects (manual) → knowledge (takeaways)
- Consolidated scattered examples into a single Workflow section
- Moved internals (hooks, skills, agents) to end of README

## [1.2.1] — 2026-03-31

### Changed
- Takeaway sections destined for CLAUDE.md or memory are now generalized: specific class names, file paths, and code are stripped in favor of transferable principles
- Takeaway file itself remains project-specific as a historical record
- Sections that are too specific to generalize are recommended as Skip
- Existing CLAUDE.md content is checked to avoid duplication

## [1.2.0] — 2026-03-31

### Added
- `/claude-session-manager:start-project` command for explicit project creation

### Changed
- Project lifecycle is now fully manual — projects are never auto-created or auto-linked
- Session classification simplified: only "meaningful" and "noise" (removed "orphaned")
- `tracking-a-project` skill only triggers on explicit user request
- `close-project` command directs to `start-project` instead of offering to auto-create

### Removed
- Retroactive `projectSlug` auto-linking in stop hook
- Auto-detection of active projects in session-start and `createSession()`
- "Orphaned" session classification and dashboard filter

## [1.1.0] — 2026-03-30

### Added
- Branch switch detection in stop hook (closes old session, creates new one)
- Orphaned session recovery on `/clear`, `/compact`, and crash
- Stale session cleanup at session end
- `closedReason` field on session JSON (`branch-switch`, `orphaned`, `stale`)
- Takeaway viewer modal in web dashboard
- Repo display names from git remote (e.g. `b4 (b4-3)`)
- `/api/takeaway` endpoint for serving takeaway markdown
- `CLAUDE.md` for development guidance

### Fixed
- Project session count now uses both `projectSlug` and project's `sessions` array
- Knowledge tab was empty due to server/client array format mismatch

## [1.0.0] — 2026-03-28

Initial release.

- Automatic session tracking via SessionStart/Stop/SessionEnd hooks
- Smart resume with ask/auto/manual modes
- Cross-repo dashboard (CLI + web)
- Project lifecycle tracking with takeaway generation
- Knowledge base with search across completed projects
- Schema versioning on all JSON data structures
