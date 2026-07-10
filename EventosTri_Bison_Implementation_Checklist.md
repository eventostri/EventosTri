# EventosTri Bison Phased Implementation Checklist

**Source design**: `D:\OneDrive\GitHub\EventosTri.worktrees\Bison-EventosTri\EventosTri_Bison_Technical_Design.md`  
**Source requirements**: `D:\OneDrive\GitHub\EventosTri.worktrees\Bison-EventosTri\EventosTri_Bison_Requirements.md`  
**Purpose**: execution checklist for the developer  
**Status**: Bison Phase 5 implemented  
**Last Updated**: 2026-07-09

---

## How to Use This Checklist

- Execute phases in order unless a phase is explicitly marked as parallel-safe.
- Treat every checkbox as a deliverable that must be implemented and verified.
- Complete each phase validation checklist before moving forward.
- Preserve Antelope foundations already present in the branch: stable `Id`, granular CRUD, settings localization, and single-item admin patching.

---

## Phase 0 - Baseline and Safety Setup

### Goal
Understand the current Bison starting point and lock implementation assumptions to the finalized design.

### Tasks
- [x] Review `EventosTri_Bison_Requirements.md`
- [x] Review `EventosTri_Bison_Technical_Design.md`
- [x] Confirm the branch already includes Antelope prerequisites:
  - [x] stable event `Id` in REST payloads
  - [x] granular create/update/delete endpoints
  - [x] admin single-item CRUD without full event rewrites
  - [x] shared settings localization into public and admin scripts
- [x] Review current implementation files:
  - [x] `eventostri.org\eventostri-calendar\functions.php`
  - [x] `eventostri.org\eventostri-calendar\admin\eventostri-settings.php`
  - [x] `eventostri.org\eventostri-calendar\assets\calendario\eventostri-calendario.js`
  - [x] `eventostri.org\eventostri-calendar\assets\admin-v2\admin-eventTri-v2.js`
  - [x] `eventostri.org\eventostri-calendar\style.css`
  - [x] `scripts\build-theme.ps1`
- [x] Confirm the finalized Bison decisions:
  - [x] default export duration is 120 minutes unless settings override it
  - [x] notification preferences require login
  - [x] favorite count badge is deferred
  - [x] new backend modules should be extracted into `inc/` files
  - [x] build pipeline should own asset minify/compress work

### Phase 0 Findings
- Antelope foundations are already present, so Bison can start directly on new feature work instead of repeating the CRUD refactor.
- The public calendar already has modal, search, and localStorage helper foundations that favorites and notification preferences can extend.
- The current backend still lacks favorites endpoints, calendar integration endpoints, notification processing, and public-read caching.
- The current build script only zips the theme and must be extended to satisfy FR-16.12.

### Exit Criteria
- [x] Developer understands the current codebase starting point
- [x] Finalized technical decisions are reflected in the execution plan

---

## Phase 1 - Shared Bison Foundation

### Goal
Establish the shared backend structure, read contexts, and normalized event metadata that Favorites, Integrations, Notifications, and Performance will all depend on.

### Tasks

#### 1.1 Backend extraction
- [x] Create and include backend modules:
  - [x] `eventostri.org\eventostri-calendar\inc\eventostri-favorites.php`
  - [x] `eventostri.org\eventostri-calendar\inc\eventostri-calendar-integrations.php`
  - [x] `eventostri.org\eventostri-calendar\inc\eventostri-notifications.php`
  - [x] `eventostri.org\eventostri-calendar\inc\eventostri-performance.php`
- [x] Keep bootstrap wiring in `functions.php` while moving feature-specific helpers out of it

#### 1.2 Public/admin read-context split
- [x] Extend `GET /wp-json/eventostri/v1/eventos` to support `context=public|admin`
- [x] Localize the public calendar with a public-context URL
- [x] Localize the admin calendar with an admin-context URL
- [x] Keep existing route family intact

#### 1.3 Normalized event datetime metadata
- [x] Add `_eventostri_start_ts` derived meta on create/update/import
- [x] Add `_eventostri_start_date` derived meta on create/update/import
- [x] Ensure derived meta stays synchronized with `Fecha_Hora`
- [x] Ensure import and compatibility sync paths also populate derived meta

#### 1.4 Shared invalidation/version helpers
- [x] Add public-events last-changed helper(s)
- [x] Add public-events cache key helper(s)
- [x] Wire invalidation triggers into create/update/delete/import/delete-past flows
- [x] Wire invalidation into deprecated sync flow while it still exists

### Validation
- [ ] Module includes load without fatal errors
- [ ] Public calendar still loads events after context split
- [ ] Admin calendar still loads editable data after context split
- [ ] Saving or importing an event writes normalized start meta correctly

### Exit Criteria
- [ ] Bison backend code is split into dedicated modules
- [ ] Public/admin reads are distinguishable without route churn
- [ ] Shared time and invalidation helpers are ready for later phases

---

## Phase 2 - Favorites

### Goal
Allow users to save and manage favorite events across anonymous and authenticated sessions.

### Tasks

#### 2.1 Backend storage and REST endpoints
- [x] Add helpers to read and write `eventostri_favorite_events` user meta
- [x] Sanitize favorites to unique valid integer event IDs
- [x] Implement `GET /wp-json/eventostri/v1/favorites`
- [x] Implement `POST /wp-json/eventostri/v1/favorites/toggle`
- [x] Implement `POST /wp-json/eventostri/v1/favorites/merge`
- [x] Reuse current authentication and nonce model

#### 2.2 Anonymous favorite flow
- [x] Add browser storage key for anonymous favorites
- [x] Persist anonymous favorites in localStorage
- [x] Hydrate favorite UI state from localStorage before auth round-trip completes

#### 2.3 Authenticated merge flow
- [x] Call `/auth-status` from the public calendar to detect logged-in state
- [x] Load authenticated favorites after login detection
- [x] Merge local favorites into server favorites one time per authenticated user session
- [x] Mirror merged canonical favorites back into localStorage
- [x] Avoid duplicate IDs during merge

#### 2.4 Public UI
- [x] Add favorite action to event-card/event-chip rendering
- [x] Add favorite action to the public event modal
- [x] Add a favorites-only filter to the public calendar
- [x] Keep favorite count badge deferred from this iteration

### Validation
- [ ] Anonymous favorites persist across page reloads
- [ ] Logged-in favorites persist across sessions
- [ ] Favoriting from the card and modal surfaces stays in sync
- [ ] Favorites filter shows only expected events
- [ ] Login merge produces no duplicate event IDs

### Exit Criteria
- [ ] FR-8.1 through FR-8.8 are satisfied
- [ ] AC-8.1 through AC-8.3 pass

---

## Phase 3 - Calendar Integrations

### Goal
Support event export and subscription flows for common calendar ecosystems.

### Tasks

#### 3.1 Integration settings and payload helpers
- [x] Add `eventostri_calendar_integration_settings` option and sanitization
- [x] Use `default_duration_minutes` with a default of 120 minutes
- [x] Add helper to build normalized export payloads for events
- [x] Derive event end time deterministically when only `Fecha_Hora` exists

#### 3.2 ICS generation
- [x] Implement `GET /wp-json/eventostri/v1/eventos/<id>/ics`
- [x] Implement `GET /wp-json/eventostri/v1/calendar/feed.ics`
- [x] Emit valid ICS with CRLF line endings
- [x] Escape text fields correctly
- [x] Include deterministic `UID` and `DTSTAMP`
- [x] Support `RRULE` output when recurrence metadata exists

#### 3.3 External calendar links
- [x] Generate Google Calendar links from the normalized export payload
- [x] Generate Outlook links from the normalized export payload
- [x] Add Apple/generic ICS action URLs

#### 3.4 Public modal integration actions
- [x] Extend the public event payload with `CalendarActions`
- [x] Localize the calendar feed URL in public script config
- [x] Render Google, Outlook, and ICS actions in the public event modal
- [x] Optionally render a subscription action for the ICS feed

### Validation
- [x] Google Calendar links open with correct event title/date/location data
- [x] Outlook links open with correct event payload data
- [x] Single-event ICS downloads open correctly in common calendar clients
- [x] Feed endpoint returns valid ICS content for public visible events

### Exit Criteria
- [ ] FR-9.1 through FR-9.7 are satisfied
- [ ] AC-9.1 and AC-9.2 pass

---

## Phase 4 - Notifications Baseline

### Goal
Deliver email-first notification flows with login-based preferences and idempotent operational behavior.

### Tasks

#### 4.1 Notification settings and user preferences
- [x] Add `eventostri_notification_settings` option and sanitization
- [x] Add helpers to read and write `eventostri_notification_preferences` user meta
- [x] Preserve forward-compatible keys for new-event alerts while keeping them disabled unless product-approved
- [x] Require login for notification preference persistence

#### 4.2 Public preference center
- [x] Add a notification preference center entry point in the public calendar UI
- [x] Implement `GET /wp-json/eventostri/v1/notification-preferences`
- [x] Implement `PUT /wp-json/eventostri/v1/notification-preferences`
- [x] Show a login-required state for anonymous users
- [x] Allow authenticated users to opt in or out of favorite reminder emails

#### 4.3 Notification log and idempotency
- [x] Create `wp_eventostri_notification_log` via `dbDelta`
- [x] Add unique `notification_key` enforcement
- [x] Add helpers for inserting, updating, and querying notification log rows
- [x] Compute deterministic keys for favorite reminders and admin notifications

#### 4.4 Cron processing
- [x] Register hourly cron schedules if needed
- [x] Register `eventostri_process_favorite_day_before_notifications`
- [x] Register `eventostri_process_favorite_day_of_notifications`
- [x] Select candidate reminders using normalized `_eventostri_start_date`
- [x] Skip sends when a notification key already exists in sent/sending/skipped state

#### 4.5 Admin notifications
- [x] Hook event publish detection into lifecycle hooks
- [x] Hook event update detection into lifecycle hooks
- [x] Read admin recipients from `eventostri_notification_settings`
- [x] Queue admin publish notifications through the notification log
- [x] Queue admin update notifications through the notification log

### Validation
- [ ] Preference center saves only for authenticated users
- [ ] Opted-out users do not receive reminder emails
- [ ] Day-before reminder reruns do not send duplicates
- [ ] Day-of reminder reruns do not send duplicates
- [ ] Admin publish/update notifications use configured recipients only

### Exit Criteria
- [ ] FR-10.1 through FR-10.8 are satisfied
- [ ] FR-10.9 remains explicitly deferred
- [ ] AC-10.1 and AC-10.2 pass

---

## Phase 5 - Performance and Scale

### Goal
Improve responsiveness and throughput for large event datasets without regressing Antelope CRUD behavior.

### Tasks

#### 5.1 Public caching and conditional responses
- [x] Add transient-backed caching for public event queries
- [x] Serve only visible current/future events for `context=public`
- [x] Add `Last-Modified` handling for public reads
- [x] Add `ETag` handling for public reads
- [x] Return `304 Not Modified` when request conditions match

#### 5.2 Query optimization
- [x] Order public events by normalized `_eventostri_start_ts`
- [x] Review public read loops for repeated meta lookups
- [x] Prime meta caches or otherwise reduce N+1-style access where practical
- [x] Review batch operations for invalidation and query cost
- [x] Evaluate pagination strategy and document whether it remains deferred for the current UI contract

#### 5.3 Frontend performance
- [x] Add lazy-loading semantics to event image tags where appropriate
- [x] Keep non-critical JavaScript deferred/footer-loaded
- [x] Preserve admin single-item CRUD patching behavior
- [x] Ensure favorites and integration UI additions do not trigger broad rerenders
- [x] Confirm search debounce behavior remains responsive

#### 5.4 Build pipeline asset optimization
- [x] Extend `scripts/build-theme.ps1` with a pre-zip minify/compress step for CSS and JS assets
- [x] Ensure build output still produces the deployable theme zip
- [x] Preserve existing backup behavior in the build pipeline

#### 5.5 Large dataset validation
- [x] Prepare or document a 1000+ event validation dataset
- [ ] Measure public calendar responsiveness with that dataset
- [ ] Confirm admin single insert/update/delete still avoids full event rewrites

### Validation
- [ ] Warm-cache public reads are faster than cold-cache reads
- [ ] Public conditional requests return `304` when unchanged
- [ ] Search remains responsive with debounce enabled on large datasets
- [ ] Admin single insert/update/delete still avoids full-calendar re-render behavior
- [ ] Build pipeline still creates a valid zip artifact after minify/compress changes

### Exit Criteria
- [ ] FR-16.1 through FR-16.4 are satisfied
- [ ] FR-16.6 through FR-16.14 are addressed or explicitly documented when evaluative/deferred
- [ ] AC-16.1 through AC-16.3 pass

---

## Phase 6 - Final Regression and Delivery Readiness

### Goal
Verify the complete Bison scope together and confirm no cross-cutting regressions were introduced.

### Tasks
- [ ] Re-run manual favorites validation after integrations and performance changes
- [ ] Re-run modal accessibility and keyboard checks with favorites and calendar actions present
- [ ] Re-run notification idempotency checks after performance/cache changes
- [ ] Confirm no Bison feature reintroduced destructive full-list sync for normal CRUD
- [ ] Confirm stable event `Id` remains the identity key across favorites, integrations, and notifications
- [ ] Confirm public and admin read contexts both still return the expected data shapes

### Validation
- [ ] All Bison acceptance criteria are met together
- [ ] Cross-cutting constraints CC-1 through CC-4 remain satisfied
- [ ] No regression is found in existing public or admin calendar core behavior

### Exit Criteria
- [ ] Bison is implementation-complete and ready for handoff or coding execution