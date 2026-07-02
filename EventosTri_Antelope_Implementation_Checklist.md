# EventosTri Antelope Phased Implementation Checklist

**Source design**: `D:\OneDrive\GitHub\EventosTri.worktrees\Antelope-EventosTri\EventosTri_Antelope_Technical_Design.md`  
**Source requirements**: `D:\OneDrive\GitHub\EventosTri.worktrees\Antelope-EventosTri\EventosTri_Antelope_Requirements.md`  
**Purpose**: execution checklist for the developer  
**Status**: Draft  
**Last Updated**: 2026-07-01

---

## How to Use This Checklist

- Execute phases in order unless a phase is explicitly marked as parallel-safe.
- Do not start Phases 5-10 until the shared CRUD refactor is complete.
- Treat every checkbox as a deliverable that must be implemented and verified.
- For each phase, complete the validation checklist before moving forward.

---

## Phase 0 - Baseline and Safety Setup

### Goal
Understand the current implementation and protect future work from regressions.

### Tasks
- [x] Review `EventosTri_Antelope_Requirements.md`
- [x] Review `EventosTri_Antelope_Technical_Design.md`
- [x] Review current implementation files:
  - [x] `eventostri.org\eventostri-calendar\functions.php`
  - [x] `eventostri.org\eventostri-calendar\admin\eventostri-settings.php`
  - [x] `eventostri.org\eventostri-calendar\assets\calendario\eventostri-calendario.js`
  - [x] `eventostri.org\eventostri-calendar\assets\admin-v2\admin-eventTri-v2.js`
  - [x] `eventostri.org\eventostri-calendar\assets\admin-v2\admin-eventTri-v2.css`
  - [x] `eventostri.org\eventostri-calendar\assets\admin-v2\admin-eventTri-v2-template.php`
- [x] Confirm current behavior for:
  - [x] public event image when `Imagen` is empty
  - [x] hardcoded event colors by `Tipos`
  - [x] admin single create/update/delete flow
  - [x] `/eventos/sync` full delete-and-recreate behavior
- [x] Record any implementation differences between the design doc and current code before coding

### Phase 0 Findings
- Current settings infrastructure already exists in `admin\eventostri-settings.php` and is more mature than an initial greenfield Phase 4 assumption:
  - branding background image setting already exists
  - brand color settings already exist
  - configurable labels already exist for `new_event`, `import_csv`, `export_csv`, and `delete_past`
- Public event image fallback is **not** implemented yet. In `assets\calendario\eventostri-calendario.js`, when `Imagen` is empty the modal removes the `src` and hides the image element instead of using a configurable fallback image.
- Event colors by `Tipos` are still hardcoded in JavaScript instead of being settings-driven:
  - public calendar contains explicit MTB / Running / default branches
  - admin calendar also applies color styling in JS during event rendering
- Admin single create/update/delete still uses full-list synchronization:
  - the admin UI mutates the local `eventos` array
  - then calls `/wp-json/eventostri/v1/eventos/sync`
  - then re-renders the calendar
- Backend sync remains destructive for normal CRUD. In `functions.php`, `eventostri_rest_sync_eventos()` deletes all existing `eventostri_evento` posts and recreates them from the submitted payload.
- Stable backend event IDs are not yet exposed in the canonical event payload returned to the frontend. The design's `Id` requirement is still outstanding.
- Search and mobile gesture foundations are already partially implemented in both calendars, so later phases should extend existing behavior rather than replace it wholesale.
- Several admin template strings remain hardcoded even though part of the labels system is already wired, so the configurable-label phase should be treated as an extension of the current implementation, not a brand new feature.

### Exit Criteria
- [x] Developer understands current limitations
- [x] Developer confirms design assumptions still match the codebase

---

## Phase 1 - Shared Platform Refactor (Critical Path)

### Goal
Establish stable IDs and granular CRUD so future work does not depend on full-event rewrites.

### Tasks

#### 1.1 Stable event identity
- [x] Add `Id` to the event payload returned by `eventostri_map_post_to_array()`
- [x] Ensure `GET /wp-json/eventostri/v1/eventos` returns `Id` for every event
- [x] Keep `_localId` only as a temporary client-side key for unsaved admin events
- [x] Refactor admin state to treat backend `Id` as the canonical identifier after create succeeds

#### 1.2 New REST endpoints for single-item CRUD
- [x] Add `POST /wp-json/eventostri/v1/eventos` for create
- [x] Add `PUT /wp-json/eventostri/v1/eventos/<id>` for update
- [x] Add `DELETE /wp-json/eventostri/v1/eventos/<id>` for delete
- [x] Ensure create returns the canonical saved event payload including `Id`
- [x] Ensure update returns the canonical saved event payload including `Id`
- [x] Ensure delete returns the deleted `Id`
- [x] Reuse current permission model (`edit_posts`)
- [x] Reuse current nonce / auth flow

#### 1.3 Dedicated batch endpoints
- [x] Add `POST /wp-json/eventostri/v1/eventos/import`
- [x] Add `POST /wp-json/eventostri/v1/eventos/delete-past`
- [x] Keep `/eventos/sync` only as temporary compatibility support if still needed
- [x] Mark `/eventos/sync` as deprecated in code comments if retained

#### 1.4 Admin JS migration away from full sync
- [x] Replace single-item save flow to use create/update endpoint instead of `/eventos/sync`
- [x] Replace single-item delete flow to use delete endpoint instead of `/eventos/sync`
- [x] Keep import using batch import endpoint
- [x] Keep delete-past using dedicated batch endpoint
- [x] Remove dependency on full-list sync for normal modal operations

#### 1.5 DOM and FullCalendar patching
- [x] Add helper to insert one event into FullCalendar
- [x] Add helper to update one event in FullCalendar
- [x] Add helper to remove one event from FullCalendar
- [x] Stop calling `removeAllEvents()` for single create/update/delete
- [x] Only regenerate filters when changed event affects `Tipos`, `Lugar`, or visibility

### Validation
- [x] Creating one admin event creates one WordPress post only
- [x] Updating one admin event updates one WordPress post only
- [x] Deleting one admin event deletes one WordPress post only
- [x] Single create/update/delete does not rebuild all events in the calendar
- [x] Admin UI still reflects the saved change correctly
- [x] `functions.php` passes `php -l`
- [x] `admin-eventTri-v2.js` passes syntax validation via QuickJS `new Function(...)`

### Exit Criteria
- [x] Stable IDs are in use everywhere
- [x] Single-item admin CRUD no longer rewrites all events
- [x] Future phases can build on granular CRUD

---

## Phase 2 - Admin Settings Foundation

### Goal
Expand the settings framework so branding, colors, labels, and later language/notification settings can be managed consistently.

### Tasks
- [x] Review existing settings registration in `admin\eventostri-settings.php`
- [x] Centralize helper getters for settings resolution in PHP
- [x] Ensure frontend scripts receive resolved settings through `wp_localize_script`
- [x] Keep WordPress options as the source of truth
- [x] Preserve defaults when options are empty or invalid

### Validation
- [x] Settings page still loads correctly
- [x] Existing background image setting still saves correctly
- [x] Existing color settings still save correctly

### Exit Criteria
- [x] Settings architecture is ready for Antelope-specific additions

---

## Phase 3 - Branding and Default Event Image

### Goal
Support configurable branding and a default public event image when `Imagen` is empty.

### Tasks

#### 3.1 Backend settings
- [x] Add `eventostri_calendar_default_event_image` option
- [x] Add sanitization for the new image URL option
- [x] Add helper functions:
  - [x] default event image URL getter
  - [x] stored event image URL getter
  - [x] event image resolver

#### 3.2 Admin settings page
- [x] Add URL field for default event image
- [x] Add media picker button for default event image
- [x] Add image preview
- [x] Add help text for recommended dimensions / size

#### 3.3 Public calendar rendering
- [x] Update public event modal rendering to use the event image if present
- [x] If `Imagen` is empty, use the configurable default event image
- [x] Only hide the image block if neither event image nor fallback image is available

### Validation
- [x] Public event with custom `Imagen` still shows its own image
- [x] Public event without `Imagen` shows the default configured image
- [x] Changing the default event image in admin updates frontend behavior

### Exit Criteria
- [x] Requirement for default public image fallback is complete

---

## Phase 4 - Configurable Brand Colors and Tipo-based Event Colors

### Goal
Replace hardcoded event colors with admin-configurable values.

### Tasks

#### 4.1 General brand colors
- [x] Preserve current configurable theme colors:
  - [x] primary
  - [x] accent
  - [x] secondary
  - [x] background
- [x] Confirm color preview and reset still work

#### 4.2 Tipo color configuration
- [x] Add `eventostri_calendar_tipo_colors` option
- [x] Add sanitization for up to 5 configured `Tipo` rows plus one default
- [x] Add settings UI rows for:
  - [x] Tipo 1 name + color
  - [x] Tipo 2 name + color
  - [x] Tipo 3 name + color
  - [x] Tipo 4 name + color
  - [x] Tipo 5 name + color
  - [x] default color
- [x] Store matching in a case-insensitive format

#### 4.3 Shared color resolution logic
- [x] Localize tipo color config to public calendar JS
- [x] Localize tipo color config to admin calendar JS
- [x] Replace hardcoded `obtenerColorPorTipos()` logic in public JS
- [x] Replace hardcoded `obtenerColorPorTipos()` logic in admin JS
- [x] Use first configured `Tipo` match when an event has multiple tipos
- [x] Use default color when no configured tipo matches
- [x] Derive readable border/text colors from background

### Validation
- [x] Public calendar no longer relies on hardcoded MTB / Running colors
- [x] Admin calendar no longer relies on hardcoded MTB / Running colors
- [x] Unknown `Tipo` uses default configured color
- [x] Mixed-case `Tipo` values still match correctly

### Exit Criteria
- [x] Hardcoded tipo-based colors are eliminated from both calendars

---

## Phase 5 - Configurable Labels and Text

### Goal
Make requested admin labels configurable and prepare the UI for localization.

### Tasks
- [x] Expand `eventostri_calendar_labels` schema
- [x] Add requested label fields to settings page
- [x] Localize configured labels into admin UI/template
- [x] Replace hardcoded action labels where required:
  - [x] Nuevo evento
  - [x] Importar CSV
  - [x] Exportar CSV
  - [x] Eliminar eventos pasados
- [x] Optionally include additional operational labels if approved:
  - [x] Verificar sesion
  - [x] Guardar
  - [x] Eliminar
  - [x] Cancelar
- [x] Preserve translation defaults when an option is empty

### Validation
- [x] Updated labels display in admin UI
- [x] Empty labels fall back to translated defaults

### Exit Criteria
- [x] Configurable label requirements are complete

---

## Phase 6 - Search UX Alignment (Admin + Public)

### Goal
Make search behavior consistent in both calendars and complete the inline + modal search flow.

### Tasks

#### 6.1 Shared search interaction behavior
- [x] Ensure admin inline search behaves like public inline search
- [x] Suggestions open after typing 1+ characters
- [x] Suggestions close on blur / Escape
- [x] Limit visible suggestions to top 8-10
- [x] Debounce search input to 150-250ms

#### 6.2 Inline selection behavior
- [x] Support mouse selection
- [x] Support keyboard selection
- [x] Navigate / scroll to matching event card on selection
- [x] Apply temporary highlight to the target event card

#### 6.3 Modal search entry
- [x] Double-click on `evento-search-input` opens advanced search modal in public calendar
- [x] Double-click on admin search input opens advanced search modal in admin calendar
- [x] Maintain existing shortcut support (`Ctrl+K` / `Cmd+K`)

#### 6.4 Advanced filters
- [x] Add date range filters
- [x] Add distance range filters
- [x] Add organizer filter
- [x] Add event status filter
- [x] Add max distance filter if geolocation is enabled
- [x] Persist filter selections
- [x] Show active filter count badge
- [x] Add clear-all filters action

#### 6.5 Accessibility
- [x] Use combobox/listbox semantics
- [x] Implement `aria-expanded`, `aria-controls`, `aria-activedescendant`
- [x] Support Arrow Up / Down, Enter, Escape
- [x] Announce result count and active option changes
- [x] Return focus appropriately after close

### Validation
- [x] Admin and public search inputs behave consistently
- [x] Inline search selection navigates correctly
- [x] Highlight is visible long enough to confirm the target
- [x] Existing filter/search behavior does not regress

### Exit Criteria
- [x] Search consistency requirement is complete

---

## Phase 7 - Mobile Gestures and Touch Navigation

### Goal
Complete modal back-gesture support and swipe navigation in both calendars.

### Tasks
- [x] Verify search modal closes via mobile back gesture in public calendar
- [x] Verify search modal closes via mobile back gesture in admin calendar
- [x] Verify event details modal closes via mobile back gesture in public calendar
- [x] Ensure swipe left triggers next period
- [x] Ensure swipe right triggers previous period
- [x] Prevent swipe conflicts with vertical scroll (threshold: absX ≥ 70, ratio 1.3)
- [x] Prevent swipe conflicts with interactive content (button/a/input/select/textarea guard)
- [x] Use the same behavior thresholds in both apps

### Validation
- [x] Gesture behavior matches arrow-button behavior
- [x] Existing keyboard/mouse behavior is unaffected

### Exit Criteria
- [x] Mobile gesture requirements are complete

---

## Phase 8 - Favorites

### Goal
Let users save favorite events across anonymous and logged-in sessions.

### Tasks
- [ ] Add favorite button/icon to public event cards
- [ ] Add favorite button/icon to public event detail modal
- [ ] Store anonymous favorites in `localStorage`
- [ ] Store authenticated favorites in WordPress user meta (`eventostri_favorite_events`)
- [ ] Use event `Id` as the favorite key
- [ ] Add favorites filter to public calendar
- [ ] Add favorite count badge in the detail modal if required by final UI
- [ ] Add login-sync behavior to merge local favorites into server favorites

### Validation
- [ ] Anonymous favorites persist across reloads
- [ ] Logged-in favorites persist across sessions
- [ ] No duplicate favorites after login merge

### Exit Criteria
- [ ] Favorites feature is complete

---

## Phase 9 - Calendar Integrations

### Goal
Support export and subscription workflows for external calendar systems.

### Tasks
- [ ] Add single-event ICS generation endpoint
- [ ] Add calendar subscription ICS feed endpoint
- [ ] Add Google Calendar link generation
- [ ] Add Outlook link generation
- [ ] Add Apple / generic ICS action
- [ ] Add event detail modal buttons/links
- [ ] Ensure recurring events are supported in ICS format when recurrence exists

### Validation
- [ ] ICS downloads open correctly in common calendar apps
- [ ] Google/Outlook links open with correct event data

### Exit Criteria
- [ ] Calendar integration requirement is complete

---

## Phase 10 - Notifications

### Goal
Introduce email-first notification flows.

### Tasks
- [ ] Design notification settings storage
- [ ] Add public preference center UI
- [ ] Add favorite-event reminder flows:
  - [ ] day-before reminder
  - [ ] day-of reminder
- [ ] Add new-event alerts for favorite locations/types if approved
- [ ] Add admin notification when an event is edited/published
- [ ] Implement cron-based sending strategy
- [ ] Make notification jobs idempotent
- [ ] Leave push notifications optional/deferred unless explicitly prioritized

### Validation
- [ ] Emails are sent only to opted-in users
- [ ] Duplicate sends do not occur on reruns

### Exit Criteria
- [ ] Email notification feature is complete

---

## Phase 11 - Analytics Foundation

### Goal
Capture event and search analytics in a backend-friendly structure.

### Tasks

#### 11.1 Event performance analytics
- [ ] Create analytics table for event interactions
- [ ] Log event modal opens
- [ ] Log event registration link clicks
- [ ] Log event external link clicks
- [ ] Create aggregate endpoint(s) for admin dashboards

#### 11.2 Search analytics
- [ ] Create analytics table for search activity
- [ ] Log popular search queries
- [ ] Log zero-result searches
- [ ] Log search-to-selection conversion behavior
- [ ] Include surface/source metadata (public inline, public modal, admin inline, admin modal)

#### 11.3 Dashboard groundwork
- [ ] Add backend aggregation methods for:
  - [ ] total events
  - [ ] events by type
  - [ ] events by location
  - [ ] public vs draft ratio
  - [ ] trending events
  - [ ] top searches
  - [ ] zero-result searches

### Validation
- [ ] Analytics data is persisted correctly
- [ ] Logged rows reference valid event IDs when applicable
- [ ] Logging does not degrade UX noticeably

### Exit Criteria
- [ ] Analytics data layer is ready for dashboard UI

---

## Phase 12 - Analytics Dashboard

### Goal
Expose analytics to admins in actionable dashboard views.

### Tasks
- [ ] Build event statistics dashboard UI
- [ ] Add charts for type/location analysis
- [ ] Add trending events module
- [ ] Add search analytics module
- [ ] Add query-to-result conversion reporting
- [ ] Add recommendations section if approved

### Validation
- [ ] Dashboard data matches stored analytics
- [ ] Charts render without blocking admin usability

### Exit Criteria
- [ ] Analytics dashboard is complete

---

## Phase 13 - Recurring Events / Event Series

### Goal
Support recurring series using a model that fits the current architecture.

### Tasks
- [ ] Add recurrence fields to event editor
- [ ] Add recurrence end date
- [ ] Add series generation logic
- [ ] Use pre-generated child posts linked by `series_id`
- [ ] Mark child instances with recurrence metadata
- [ ] Implement edit modes:
  - [ ] single occurrence
  - [ ] this and following
  - [ ] whole series
- [ ] Implement delete modes:
  - [ ] single occurrence
  - [ ] whole series
- [ ] Prevent duplicate generated children
- [ ] Ensure public/admin calendar views remain consistent

### Validation
- [ ] Recurring series generates expected child events
- [ ] Editing a series does not create duplicate children
- [ ] Deleting series removes linked children correctly

### Exit Criteria
- [ ] Recurring events requirement is complete

---

## Phase 14 - Event Templating

### Goal
Allow reusable event templates for faster event creation.

### Tasks
- [ ] Add template storage model (`is_template` meta or equivalent)
- [ ] Add "save as template" flow
- [ ] Add "create from template" flow
- [ ] Add admin template management UI
- [ ] Add sharing behavior across organizers if approved
- [ ] Ensure templates are excluded from public calendar

### Validation
- [ ] Template clone creates editable new events
- [ ] Templates never appear as live public events

### Exit Criteria
- [ ] Event templating requirement is complete

---

## Phase 15 - Bulk Event Operations

### Goal
Improve multi-event management in the admin calendar.

### Tasks
- [ ] Add select/deselect all behavior
- [ ] Add bulk publish/unpublish
- [ ] Add bulk type/location change
- [ ] Add bulk delete
- [ ] Use explicit batch endpoints
- [ ] Return affected event IDs so the admin UI can patch local state correctly

### Validation
- [ ] Bulk actions update only targeted events
- [ ] Admin UI stays in sync after batch operations

### Exit Criteria
- [ ] Bulk operations requirement is complete

---

## Phase 16 - Performance and Scale

### Goal
Improve backend and frontend performance for large event sets.

### Tasks

#### 16.1 Caching
- [ ] Add transients for public event queries
- [ ] Add cache invalidation on create/update/delete/import/delete-past/series regeneration
- [ ] Add cache headers for static assets where appropriate
- [ ] Add ETag or Last-Modified support for REST reads if practical
- [ ] Add cache monitoring support for admin analytics if approved

#### 16.2 Query optimization
- [ ] Review event query ordering and meta usage
- [ ] Add query performance monitoring hooks/logging if approved
- [ ] Reduce N+1 style loops where possible
- [ ] Consider pagination strategy for large datasets

#### 16.3 Frontend performance
- [ ] Lazy-load event images
- [ ] Defer non-critical JS
- [ ] Minify/compress CSS and JS via existing pipeline
- [ ] Measure Core Web Vitals where supported
- [ ] Reconfirm single-item admin CRUD still avoids full re-render

### Validation
- [ ] Public calendar remains responsive with 1000+ events
- [ ] Admin insert/update/delete does not trigger full event rewrite
- [ ] Search remains responsive after debounce

### Exit Criteria
- [ ] Performance requirements are complete

---

## Phase 17 - Localization and Multi-language

### Goal
Support Spanish/English translation readiness across PHP and JS.

### Tasks
- [ ] Inventory remaining hardcoded UI strings in PHP
- [ ] Inventory remaining hardcoded UI strings in JS
- [ ] Move PHP strings to WordPress i18n functions
- [ ] Move JS strings to localized config / translation workflow
- [ ] Create / update Spanish translation files
- [ ] Create / update English translation files
- [ ] Add language selector in admin settings if still required after product confirmation
- [ ] Translate developer-facing and user-facing documentation as required

### Validation
- [ ] Calendar UI can render correctly in both languages
- [ ] Configurable labels still work with translated defaults

### Exit Criteria
- [ ] Localization requirement is complete

---

## Phase 18 - Reporting and Compliance

### Goal
Provide exportable event reporting based on stable event data and analytics.

### Tasks
- [ ] Add report filters for date range, type, location, organizer
- [ ] Add CSV report generation
- [ ] Add PDF report generation if approved in implementation scope
- [ ] Add reports for:
  - [ ] all events
  - [ ] events by type/location
  - [ ] events by organizer
  - [ ] month / quarter / year ranges
- [ ] Add permission checks to all report actions

### Validation
- [ ] Exported report data matches calendar data
- [ ] Time-based report filters return correct ranges
- [ ] Access control is enforced

### Exit Criteria
- [ ] Reporting requirement is complete

---

## Final Regression Checklist

### Public Calendar
- [ ] Only current/future visible events are shown
- [ ] Empty `Imagen` uses configurable fallback image
- [ ] Tipo colors come from settings, not hardcoded logic
- [ ] Search behavior is accessible and responsive
- [ ] Back gesture works for search and detail modals
- [ ] Favorites and calendar integrations work correctly

### Admin Calendar
- [ ] Settings save correctly
- [ ] Single-item create/update/delete uses granular CRUD only
- [ ] Single-item create/update/delete does not rebuild all events
- [ ] Import/export still work
- [ ] Delete-past still works
- [ ] Search behavior remains aligned with public calendar

### Data Integrity
- [ ] Stable `Id` exists in event payloads
- [ ] Favorites reference stable IDs
- [ ] Analytics reference stable IDs when applicable
- [ ] Recurring children are not duplicated

### Accessibility
- [ ] Keyboard navigation works across both calendars
- [ ] ARIA semantics are preserved
- [ ] Focus management is correct
- [ ] Color choices preserve readable contrast

### Performance
- [ ] Admin single-item CRUD does not full-sync all events
- [ ] Public calendar is acceptable with large datasets
- [ ] Search interactions remain responsive

---

## Recommended Milestone Sequence

- [ ] Milestone 1: Phase 1 complete
- [ ] Milestone 2: Phases 2-5 complete
- [ ] Milestone 3: Phases 6-7 complete
- [ ] Milestone 4: Phases 8-12 complete
- [ ] Milestone 5: Phases 13-16 complete
- [ ] Milestone 6: Phases 17-18 complete
- [ ] Milestone 7: Final regression complete

---

## Short Version

If the team needs the shortest possible order of execution, use this:

1. [ ] Stable IDs + granular CRUD
2. [ ] Settings foundation
3. [ ] Default public event image
4. [ ] Configurable tipo colors
5. [ ] Configurable labels
6. [ ] Search parity
7. [ ] Mobile gestures
8. [ ] Favorites
9. [ ] Calendar integrations
10. [ ] Notifications
11. [ ] Analytics + dashboard
12. [ ] Recurring events
13. [ ] Templates + bulk ops
14. [ ] Performance
15. [ ] Localization
16. [ ] Reporting
