# EventosTri Antelope Technical Design

**Related requirements**: `D:\OneDrive\GitHub\EventosTri.worktrees\Antelope-EventosTri\EventosTri_Antelope_Requirements.md`  
**Purpose**: implementation guide / developer receipt  
**Audience**: developer implementing Phases 4-10  
**Status**: Draft  
**Last Updated**: 2026-07-01

---

## 1. Document Goal

This document converts the Antelope requirements into a concrete implementation design for the current EventosTri codebase.

It is intended to answer:
- which files must change
- which WordPress options / REST endpoints / UI surfaces are affected
- what data model additions are required
- what order the work should be done in
- what acceptance checks the developer should run before closing each item

This is not a product requirements document. It is the engineering playbook for implementing the requirements already approved in the Antelope requirements file.

---

## 2. Current System Snapshot

The current implementation is a WordPress theme-based calendar solution with two main JavaScript applications:

- **Public calendar**: `eventostri.org\eventostri-calendar\assets\calendario\eventostri-calendario.js`
- **Admin calendar v2**: `eventostri.org\eventostri-calendar\assets\admin-v2\admin-eventTri-v2.js`

Current backend surfaces:
- Custom post type: `eventostri_evento`
- Main PHP bootstrap: `eventostri.org\eventostri-calendar\functions.php`
- Admin settings page: `eventostri.org\eventostri-calendar\admin\eventostri-settings.php`

Current REST endpoints:
- `GET /wp-json/eventostri/v1/eventos`
- `POST /wp-json/eventostri/v1/eventos/sync`
- `POST /wp-json/eventostri/v1/auth-status`

Important current limitations already visible in code:
- Public event image is hidden when `Imagen` is empty instead of using a configurable fallback.
- Event colors by `Tipos` are hardcoded in JS.
- Admin single create/update/delete sends the full event list to `/eventos/sync`.
- `/eventos/sync` deletes all existing posts and recreates everything.
- Labels are only partially configurable.
- Most UI strings in JS are still hardcoded.

---

## 3. Phase Dependencies and Recommended Delivery Order

Dependencies from the requirements document should be respected.

Recommended implementation order:

1. **Phase 4 foundation**
   - settings framework
   - branding image
   - default event image
   - color settings
   - tipo color mapping
   - labels / text settings
2. **Shared platform refactor required before Phases 5-10**
   - stable event IDs in REST payloads
   - granular CRUD endpoints
   - stop full list delete/recreate behavior for single-item admin actions
3. **Phase 5 UX enhancements**
4. **Phase 6 analytics**
5. **Phase 7 event management** (can run partly in parallel after stable CRUD is in place)
6. **Phase 8 performance**
7. **Phase 9 localization**
8. **Phase 10 reporting**

Practical note: although the requirements say Phase 7 only depends on Phases 1-3, recurring events, templating, and bulk actions will be safer after the CRUD refactor is complete.

---

## 4. Cross-Cutting Design Decisions

### 4.1 Stable event identity is mandatory

Current admin code uses local-only IDs (`_localId`) and full-list sync. That is not enough for granular updates.

**Design decision**:
- Add a stable backend identifier to every event payload: `Id` = WordPress post ID.
- Keep `_localId` only as a client-only temporary key before create succeeds.
- All update/delete operations must use `Id`, not title/date matching.

**Backend change**:
- `eventostri_map_post_to_array()` must return `Id`.
- Admin create response must return the created event payload including `Id`.
- Admin update/delete responses must return the affected `Id`.

### 4.2 Replace full sync with granular CRUD

Current behavior:
- admin create/update/delete mutates the in-memory array
- client POSTs the full list to `/eventos/sync`
- server deletes all posts and recreates them

This is the main technical debt behind the new requirement "on every insert/delete/update avoid updating all the events".

**Design decision**:
- Keep `/eventos/sync` only for controlled bulk operations if needed (CSV import full replace only if explicitly requested).
- Add granular endpoints:
  - `POST /eventostri/v1/eventos` -> create one event
  - `PUT /eventostri/v1/eventos/<id>` -> update one event
  - `DELETE /eventostri/v1/eventos/<id>` -> delete one event
  - `POST /eventostri/v1/eventos/import` -> batch create from CSV
  - `POST /eventostri/v1/eventos/delete-past` -> bulk delete past events
- Admin UI must call granular endpoints for single-item actions.
- DOM/calendar updates must only touch the affected event card(s).

### 4.3 Centralize calendar settings resolution

Settings now exist but will expand significantly.

**Design decision**:
- Keep WordPress options as the source of truth.
- Continue using the existing admin settings page.
- Add PHP helper getters so frontends never read raw options directly.
- Localize resolved config to both JS apps using `wp_localize_script`.

### 4.4 Shared behavior must remain consistent between Admin and Public calendars

Any logic for:
- tipo color resolution
- default event image resolution
- label text
- search behavior
- modal close via mobile back gesture

must be implemented once conceptually and applied consistently in both apps.

### 4.5 Accessibility and performance are non-negotiable

Existing accessibility work must not regress. New UI must preserve:
- keyboard navigation
- ARIA semantics
- focus restoration
- screen reader announcements

Performance-sensitive areas:
- inline search suggestions
- DOM patching for single event updates
- analytics logging
- recurring event generation

---

## 5. Data Model and Configuration Design

### 5.1 Existing event fields

Continue using the current event meta keys:
- `Fecha_Hora`
- `Lugar`
- `Estado`
- `Tipos`
- `Distancias`
- `Link`
- `Imagen`
- `Descripcion`
- `Whatsapp`
- `InscripcionOnLine`
- `Organizador`
- `VisibleEnCalendario`

### 5.2 New event fields for later phases

Add these only when implementing the relevant phase:
- `series_id`
- `recurring_pattern`
- `recurring_interval`
- `recurring_end_date`
- `is_recurring_instance`
- `template_name`
- `is_template`

### 5.3 WordPress options

Use these options:

Existing / already present:
- `eventostri_calendar_background_image`
- `eventostri_calendar_colors`
- `eventostri_calendar_labels`

New options to add:
- `eventostri_calendar_default_event_image`
- `eventostri_calendar_tipo_colors`
- `eventostri_calendar_language`
- `eventostri_notification_settings`

Recommended format for `eventostri_calendar_tipo_colors`:

```json
{
  "items": [
    { "tipo": "MTB", "background": "#ffe2d7" },
    { "tipo": "Running", "background": "#dfeeff" },
    { "tipo": "Triatlon", "background": "#e8fff0" },
    { "tipo": "Ciclismo", "background": "#fff4d8" },
    { "tipo": "Acuatlon", "background": "#efe8ff" }
  ],
  "default_background": "#ece8ff"
}
```

Notes:
- Maximum configured `tipo` values: 5
- Matching should be case-insensitive and trim whitespace
- If multiple tipos are present in one event, use the first configured match found
- Border and text colors should be derived from background to preserve contrast

### 5.4 REST event payload contract

Recommended canonical payload:

```json
{
  "Id": 123,
  "Titulo": "Triatlon Riviera Maya",
  "Fecha_Hora": "2026-09-12T06:30",
  "Lugar": "Merida",
  "Estado": "YUC",
  "Tipos": "MTB, Running",
  "Distancias": "5 km, 10 km, 21 km",
  "Link": "https://facebook.com/evento",
  "Imagen": "https://example.com/evento.jpg",
  "ResolvedImage": "https://example.com/fallback-or-event-image.jpg",
  "Descripcion": "Evento deportivo anual",
  "Whatsapp": "529991234567",
  "InscripcionOnLine": "https://example.com/register",
  "Organizador": "EventosTri",
  "VisibleEnCalendario": true
}
```

`ResolvedImage` is optional but recommended so the frontend does not duplicate fallback logic everywhere.

---

## 6. Shared File Map

Primary files to update:

- `eventostri.org\eventostri-calendar\functions.php`
- `eventostri.org\eventostri-calendar\admin\eventostri-settings.php`
- `eventostri.org\eventostri-calendar\style.css`
- `eventostri.org\eventostri-calendar\assets\calendario\eventostri-calendario.js`
- `eventostri.org\eventostri-calendar\assets\admin-v2\admin-eventTri-v2.js`
- `eventostri.org\eventostri-calendar\assets\admin-v2\admin-eventTri-v2.css`
- `eventostri.org\eventostri-calendar\assets\admin-v2\admin-eventTri-v2-template.php`

Possible new files if the team wants to reduce `functions.php` growth:
- `eventostri.org\eventostri-calendar\inc\eventostri-rest.php`
- `eventostri.org\eventostri-calendar\inc\eventostri-analytics.php`
- `eventostri.org\eventostri-calendar\inc\eventostri-recurring.php`

If no extraction is done, keep changes in existing files to match the current codebase convention.

---

## 7. Detailed Design by Requirement Area

## 7.1 Phase 4.1 - Configurable Background Image and Default Event Image

### Scope
- configurable calendar branding image
- configurable fallback event image for Public Calendar when `Imagen` is empty

### Current state
- branding image setting already exists in `admin\eventostri-settings.php`
- public event modal hides image when `Imagen` is empty

### Design

#### Backend
- Keep `eventostri_calendar_background_image` for calendar branding/logo use.
- Add `eventostri_calendar_default_event_image` for event-card/modal image fallback.
- Add helper functions:
  - `eventostri_calendar_default_event_image_url()`
  - `eventostri_calendar_get_default_event_image_url()`
  - `eventostri_calendar_resolve_event_image_url($raw_image)`
- Update `eventostri_map_post_to_array()` to include either:
  - `ResolvedImage`, or
  - keep `Imagen` raw and resolve in frontend config helper

#### Admin settings UI
- Reuse the media picker pattern already present for branding image.
- Add:
  - URL field
  - "Seleccionar imagen" button
  - preview
  - help text with recommended size and file weight

#### Public calendar frontend
- In event modal rendering, use the resolved image URL.
- If event `Imagen` is empty, still render the image block using the configurable fallback.
- Do not hide the image block when fallback exists.

### Files
- `admin\eventostri-settings.php`
- `functions.php`
- `assets\calendario\eventostri-calendario.js`

### Developer checklist
- [ ] add new option registration and sanitization
- [ ] add admin settings field + media picker + preview
- [ ] expose resolved value to frontend
- [ ] update public modal rendering to always show fallback image
- [ ] verify empty `Imagen` no longer collapses the image area

---

## 7.2 Phase 4.2 - Customizable Color Scheme and Tipo-based Event Colors

### Scope
- general branding colors
- configurable event background colors by `Tipos`
- max 5 configured tipo values + 1 default

### Current state
- general brand colors already exist as settings
- event colors by tipo are hardcoded in JS
  - public JS hardcodes MTB / Running / default
  - admin JS also applies colors in `eventDidMount`

### Design

#### Backend settings
- Keep `eventostri_calendar_colors` for theme-level colors.
- Add `eventostri_calendar_tipo_colors` for event category colors.
- Sanitize as structured array/json:
  - `items[0..4].tipo`
  - `items[0..4].background`
  - `default_background`

#### Shared resolution rule
- Parse `Tipos` into array
- Compare event tipos against configured items in admin-defined order
- First matching configured tipo wins
- If no match, use `default_background`
- Derive border/text color from background using a helper

#### Frontend implementation
- Pass `tipoColors` config to both scripts via `wp_localize_script`
- Replace hardcoded `obtenerColorPorTipos()` logic in both JS apps with config-driven logic
- Keep the same style application points (`eventDidMount` / modal badges if added later)

#### Admin settings UI
- Add 5 rows for:
  - tipo name text input
  - color picker
- Add one default color picker
- Add live preview chips if time allows

### Files
- `admin\eventostri-settings.php`
- `functions.php`
- `assets\calendario\eventostri-calendario.js`
- `assets\admin-v2\admin-eventTri-v2.js`

### Developer checklist
- [ ] register new tipo color option
- [ ] create 5 tipo rows + default row in settings page
- [ ] localize tipo color config to both calendars
- [ ] remove hardcoded MTB / Running / default branches
- [ ] confirm unknown tipo uses default color
- [ ] confirm matching is case-insensitive

---

## 7.3 Phase 4.3 - Configurable Labels and Text

### Scope
- configurable admin labels
- prepare localization-friendly string handling

### Current state
- `new_event` already localized to admin JS
- other labels remain hardcoded in template/JS

### Design
- Extend `eventostri_calendar_labels` to include all admin action labels now shown in UI.
- Expose labels to templates and JS through localized config.
- Keep textdomain usage for defaults.
- Do not store every string in options; store only strings explicitly requested as configurable.

Recommended label keys:
- `new_event`
- `import_csv`
- `export_csv`
- `delete_past`
- `verify_session`
- `save_event`
- `delete_event`
- `cancel`

### Files
- `admin\eventostri-settings.php`
- `functions.php`
- `assets\admin-v2\admin-eventTri-v2-template.php`
- `assets\admin-v2\admin-eventTri-v2.js`

### Developer checklist
- [ ] expand label option schema
- [ ] replace hardcoded button text with configured values where requested
- [ ] preserve translation defaults when option is empty

---

## 7.4 Shared Refactor - Granular CRUD and No Full Event Reload for Single Admin Actions

### Scope
- required to satisfy the new performance requirement for admin insert/update/delete
- required foundation for future phases

### Current state
- admin single save/delete mutates the `eventos` array
- then calls `/eventos/sync`
- server deletes all posts and recreates all posts
- client re-renders the calendar with `removeAllEvents()` + `addEventSource()`

### Target behavior
- create one event -> one backend create call -> add one calendar event
- update one event -> one backend update call -> patch one calendar event
- delete one event -> one backend delete call -> remove one calendar event
- bulk import/delete-past can still be batched, but should use dedicated batch endpoints instead of full destructive sync

### Backend design
Add REST handlers:
- `eventostri_rest_create_evento(WP_REST_Request $request)`
- `eventostri_rest_update_evento(WP_REST_Request $request)`
- `eventostri_rest_delete_evento(WP_REST_Request $request)`
- `eventostri_rest_import_eventos(WP_REST_Request $request)`
- `eventostri_rest_delete_past_eventos(WP_REST_Request $request)`

Response payload for create/update should include the canonical saved event.

### Frontend design
In admin JS:
- replace `sincronizarEnWordPressAPI()` for single-item actions with dedicated helpers:
  - `crearEventoWordPressAPI(evento)`
  - `actualizarEventoWordPressAPI(evento)`
  - `eliminarEventoWordPressAPI(id)`
- maintain a local event index by `Id`
- add DOM patch helpers:
  - `agregarEventoAlCalendario(evento)`
  - `actualizarEventoEnCalendario(evento)`
  - `eliminarEventoDelCalendario(id)`
- avoid `removeAllEvents()` for single-item actions
- only regenerate filters if the affected event changes `Tipos`, `Lugar`, or visibility scope

### Required payload changes
- `GET /eventos` must return `Id`
- create/update/delete endpoints must return `Id`
- admin local state must keep both `Id` and `_localId` until create succeeds

### Migration note
- Keep `/eventos/sync` temporarily only for backwards compatibility or special batch flows.
- Mark it internal / deprecated once granular CRUD is live.

### Files
- `functions.php`
- `assets\admin-v2\admin-eventTri-v2.js`

### Developer checklist
- [ ] add stable `Id` to event payload
- [ ] implement single create endpoint
- [ ] implement single update endpoint
- [ ] implement single delete endpoint
- [ ] switch admin modal save/delete to granular calls
- [ ] patch only affected calendar event(s)
- [ ] keep CSV import and delete-past as explicit batch operations

---

## 7.5 Phase 5.1 - Advanced Search Filters and Inline Event Search Navigation

### Scope
- align admin and public search behavior
- inline suggestions below `evento-search-input`
- double-click to open search modal
- advanced filters in modal

### Current state
- public calendar already has inline search and modal search groundwork
- admin calendar also has inline search work but not full parity

### Design
- Extract shared search concepts, even if implementation remains duplicated:
  - normalize term
  - debounce timing (150-250ms)
  - top 8-10 results
  - active option tracking
  - scroll-to-event behavior
- Add modal filter state object:
  - `dateStart`
  - `dateEnd`
  - `distanceRange`
  - `organizer`
  - `status`
  - `maxDistance`
- Persist filter state in `localStorage`
  - one key for public
  - one key for admin
- Add active filter count badge near search trigger or input

### Backend impact
No immediate new endpoint required if filters run client-side on loaded data. If event volume becomes too large later, server-side filtering can be introduced behind the same UI contract.

### Files
- `assets\calendario\eventostri-calendario.js`
- `assets\admin-v2\admin-eventTri-v2.js`
- related CSS files

### Developer checklist
- [ ] verify admin and public input behavior match
- [ ] support mouse + keyboard selection
- [ ] support double-click to open modal
- [ ] persist filter selections
- [ ] add active filter badge and clear-all control
- [ ] confirm no regression in existing search modal

---

## 7.6 Phase 5.2 - Mobile Gestures and Touch Navigation

### Current state
Back-gesture and swipe foundations already exist in both JS apps.

### Design
- Keep current `history.pushState` modal stack approach.
- Ensure every modal open/close path participates consistently in history stack management.
- Ensure swipe is disabled when gesture begins inside interactive elements that should keep horizontal scrolling / dragging.
- Use one threshold policy in both apps.

### Developer checklist
- [ ] search modal closes with mobile back gesture in both calendars
- [ ] public event detail modal closes with mobile back gesture
- [ ] swipe left/right maps exactly to prev/next actions
- [ ] vertical scrolling is not blocked accidentally

---

## 7.7 Phase 5.3 - Favorite Events

### Design
- Logged-out users: store favorites in `localStorage`
- Logged-in users: store in user meta `eventostri_favorite_events`
- On login, merge local favorites into server favorites once per session
- Expose favorite state in public calendar rendering and modal

### Backend
Add endpoints:
- `GET /eventostri/v1/favorites`
- `POST /eventostri/v1/favorites/toggle`
- optional `POST /eventostri/v1/favorites/sync`

### Frontend
- add favorite button on event cards and modal
- add favorites-only filter
- store event IDs, not title/date strings

### Developer checklist
- [ ] use event `Id` as favorite key
- [ ] support anonymous and authenticated flows
- [ ] avoid duplicate merge on login

---

## 7.8 Phase 5.4 - Calendar Integrations

### Design
- Add ICS generation endpoint per event and optionally for subscription feed
- Add buttons in event detail modal for:
  - Google Calendar
  - Outlook
  - Apple / generic ICS
- If recurring events are enabled, ICS export must serialize recurrence correctly

### Backend
Add endpoints:
- `GET /eventostri/v1/eventos/<id>/ics`
- `GET /eventostri/v1/calendar/feed.ics`

### Developer checklist
- [ ] validate datetime serialization
- [ ] escape ICS text fields correctly
- [ ] confirm recurring events serialize as RRULE when applicable

---

## 7.9 Phase 5.5 - Notifications

### Design
- Start with email notifications only
- keep push notifications optional / deferred
- provide preference center in public calendar for logged-in users
- reuse favorite events as a primary notification source

### Backend
Recommended scheduled jobs:
- daily cron for next-day reminders
- same-day cron for day-of reminders
- publish/update hook for admin notifications

### Developer checklist
- [ ] avoid duplicate sends
- [ ] make cron idempotent
- [ ] respect user opt-in settings

---

## 7.10 Phase 6 - Analytics

### 6.1 Event Performance Dashboard

#### Design
Create table:
- `wp_eventostri_event_stats`

Recommended columns:
- `id`
- `event_id`
- `event_type` (`view`, `registration_click`, `external_link_click`)
- `occurred_at`
- `session_hash`
- `metadata_json`

Log from public calendar when:
- event detail modal opens
- registration link clicked
- external info link clicked

Create admin dashboard REST endpoints for aggregates.

### 6.2 Search Analytics

#### Design
Create table:
- `wp_eventostri_search_stats`

Recommended columns:
- `id`
- `query_text`
- `result_count`
- `selected_event_id`
- `surface` (`public_inline`, `public_modal`, `admin_inline`, `admin_modal`)
- `occurred_at`

Public calendar already emits browser-side search analytics events; persist them server-side via a batched endpoint.

### Files
- `functions.php` or extracted analytics file
- `assets\calendario\eventostri-calendario.js`
- `assets\admin-v2\admin-eventTri-v2.js`
- admin dashboard UI files

### Developer checklist
- [ ] create tables with dbDelta
- [ ] avoid logging PII beyond what is necessary
- [ ] aggregate by event ID and search term efficiently
- [ ] add retention policy if data volume grows

---

## 7.11 Phase 7 - Enhanced Event Management

## 7.11.1 Recurring Events / Event Series

### Recommended decision
Use **pre-generated child event posts** linked by `series_id`.

### Why this approach fits the current codebase
- current calendar architecture already expects discrete event rows/posts
- admin editing, CSV export, analytics, favorites, and reporting all work more naturally with concrete instances
- simpler than teaching every UI and endpoint how to expand virtual recurrences on read

### Design
- Create a parent series record concept using meta on the master event
- Generate child events up to `recurring_end_date`
- Mark child events with:
  - `series_id`
  - `is_recurring_instance = 1`
- Support edit modes:
  - single occurrence
  - this and following occurrences
  - whole series

### Risks
- mass updates can touch many posts
- must prevent duplicates during regeneration

### Developer checklist
- [ ] define deterministic series generation rules
- [ ] prevent duplicate child generation
- [ ] ensure delete-series removes children
- [ ] ensure single-instance edit can detach when needed

## 7.11.2 Event Templating

### Design
Use event posts with `is_template = 1` or separate CPT if later needed. For now, keep same CPT plus meta flag to minimize scope.

### Developer checklist
- [ ] templates excluded from public calendar
- [ ] template clone clears date/time-specific fields

## 7.11.3 Bulk Event Operations

### Design
- add checkbox/select state in admin calendar list surfaces
- add explicit batch endpoints for publish/unpublish/type/location/delete actions
- return affected IDs so UI can patch local state

---

## 7.12 Phase 8 - Performance and Scale

## 7.12.1 Caching Strategy

### Design
- cache public event list query with transients
- invalidate on create/update/delete/import/delete-past/series regeneration
- add ETag or Last-Modified headers for public events endpoint
- do not cache admin write operations

## 7.12.2 Database Query Optimization

### Design
- keep ordering by `Fecha_Hora`
- if scale requires it, reduce expensive meta queries and consider denormalized date meta for sorting/filtering
- review heavy loops in event mapping and recurring generation

## 7.12.3 Frontend Performance

### Design
- lazy-load modal/event images
- defer non-critical JS if not already bottom-loaded
- avoid full re-render on single admin event CRUD
- measure search responsiveness with large local datasets

### Direct implementation note for the new requirement
For the requirement "in the admin calendar on every insert/delete/update avoid updating all the events":
- this is satisfied only when both backend and frontend change
- frontend alone is not enough if backend still deletes/recreates all posts
- backend alone is not enough if frontend still calls `removeAllEvents()` for a single change

---

## 7.13 Phase 9 - Localization and Multi-language

### Design
- move all PHP-visible strings to WordPress i18n functions
- move JS-visible strings into localized config and `wp_set_script_translations` where practical
- keep configurable labels separate from translations
- admin-selected language should influence displayed labels only if product wants an override; otherwise use site locale

### Developer checklist
- [ ] inventory all hardcoded JS strings
- [ ] extract them systematically
- [ ] keep Spanish and English translation files in sync

---

## 7.14 Phase 10 - Reporting and Compliance

### Design
- reporting depends on analytics and stable event IDs
- generate CSV first, PDF second
- expose report filters by date range, tipo, organizer, location
- use server-side generation for correctness and permission control

### Developer checklist
- [ ] permissions check for all report endpoints
- [ ] reuse existing CSV export rules where possible
- [ ] ensure recurring child events are represented correctly in reports

---

## 8. Recommended REST API Additions

Add these routes under `eventostri/v1`:

- `GET /eventos`
- `POST /eventos`
- `GET /eventos/<id>`
- `PUT /eventos/<id>`
- `DELETE /eventos/<id>`
- `POST /eventos/import`
- `POST /eventos/delete-past`
- `GET /favorites`
- `POST /favorites/toggle`
- `POST /analytics/event`
- `POST /analytics/search`
- `GET /analytics/dashboard`
- `GET /eventos/<id>/ics`
- `GET /calendar/feed.ics`

Keep existing:
- `POST /auth-status`
- `POST /eventos/sync` only temporarily if needed for compatibility

---

## 9. Testing Strategy

## 9.1 Manual regression checklist

### Public calendar
- [ ] loads only visible current/future events
- [ ] empty `Imagen` uses configurable fallback image
- [ ] tipo-based color mapping reflects admin configuration
- [ ] inline search suggestions work with keyboard and mouse
- [ ] double-click search input opens advanced modal
- [ ] back gesture closes search and detail modals
- [ ] calendar integration links open correctly

### Admin calendar
- [ ] settings page saves new branding and tipo color settings
- [ ] single create adds only one event without full refresh
- [ ] single update patches only the edited event
- [ ] single delete removes only the selected event
- [ ] import still works for batch creation
- [ ] delete past still works as batch operation
- [ ] auth verification still works

### Data integrity
- [ ] event `Id` is present in REST payloads
- [ ] favorites use stable IDs
- [ ] analytics rows link to valid event IDs
- [ ] recurring generation does not duplicate child events

## 9.2 Performance checks

- [ ] admin save/update/delete does not trigger full delete/recreate of all posts
- [ ] admin UI does not call `removeAllEvents()` for single-item actions
- [ ] inline search remains responsive with 1000+ events
- [ ] public events endpoint benefits from cache after warm-up

## 9.3 Accessibility checks

- [ ] combobox semantics remain valid
- [ ] modal focus restore still works
- [ ] color changes preserve readable contrast
- [ ] keyboard-only search flow still works in both calendars

---

## 10. Rollout Notes

### Safe implementation slices

Recommended merge sequence:
1. stable event IDs in payloads
2. new granular CRUD endpoints
3. admin JS switch from full sync to granular CRUD
4. default public event image setting + rendering
5. tipo color settings + shared color resolution
6. label expansion
7. remaining UX features
8. analytics
9. recurring events
10. reporting

### Backward compatibility
- keep `eventos/sync` until admin JS no longer depends on it
- once granular CRUD is verified, restrict sync usage to controlled batch jobs or remove it later

---

## 11. Open Technical Decisions Still Requiring Confirmation

These can be implemented with the recommendations above, but should be explicitly confirmed before coding if stakeholders want a different behavior:

1. **Recurring event generation model**  
   Recommended: pre-generate child posts.
2. **Analytics scope**  
   Recommended: log event modal opens, external link clicks, registration clicks, and search activity.
3. **Language selection behavior**  
   Recommended: use site locale by default; admin language selector only if a real override is needed.
4. **Push notifications**  
   Recommended: defer until email notification flow is stable.

---

## 12. Definition of Done for Antelope

Antelope should be considered implementation-ready only when:
- settings-driven branding and default images exist
- tipo colors are configurable instead of hardcoded
- admin single-item CRUD no longer rewrites all events
- REST payloads use stable IDs
- public and admin search behavior stay aligned
- analytics, recurring events, and reporting are built on top of the stable CRUD foundation
- regression, performance, and accessibility checks pass

---

## 13. Short Summary for the Developer

If you only read one section, read this:

1. **Do Phase 4 first**, but while doing it, add shared config plumbing.
2. **Before advanced features, refactor admin CRUD** so one create/update/delete does not sync and rebuild all events.
3. **Add stable event IDs everywhere**.
4. **Use settings for default public images and tipo colors**.
5. **Build later phases on top of granular CRUD, not the current full sync model**.

That refactor is the critical path for the rest of Antelope.
