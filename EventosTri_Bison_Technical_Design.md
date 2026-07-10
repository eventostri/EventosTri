# EventosTri Bison Technical Design

**Related requirements**: `D:\OneDrive\GitHub\EventosTri.worktrees\Bison-EventosTri\EventosTri_Bison_Requirements.md`  
**Purpose**: implementation guide / developer receipt  
**Audience**: developer implementing Favorites, Calendar Integrations, Notifications, and Performance/Scale  
**Status**: Draft  
**Last Updated**: 2026-07-08

---

## 1. Document Goal

This document converts the Bison requirements into a concrete implementation design for the current EventosTri codebase.

It is intended to answer:
- which existing files and backend surfaces must change
- which new REST endpoints, user meta entries, options, cron jobs, and cache helpers are required
- how the new Bison work should build on the Antelope refactor already in the branch
- what delivery order reduces risk while preserving current public and admin behavior
- what validation the developer should complete before closing each scope area

This is not a product requirements document. It is the engineering playbook for implementing the approved Bison requirements in the current WordPress theme architecture.

---

## 2. Current System Snapshot

The current implementation is a WordPress theme-based calendar with two JavaScript applications:

- **Public calendar**: `eventostri.org\eventostri-calendar\assets\calendario\eventostri-calendario.js`
- **Admin calendar v2**: `eventostri.org\eventostri-calendar\assets\admin-v2\admin-eventTri-v2.js`

Current backend surfaces:
- Custom post type: `eventostri_evento`
- Main bootstrap and REST handlers: `eventostri.org\eventostri-calendar\functions.php`
- Settings framework: `eventostri.org\eventostri-calendar\admin\eventostri-settings.php`

Current REST routes already available:
- `GET /wp-json/eventostri/v1/eventos`
- `POST /wp-json/eventostri/v1/eventos`
- `PUT /wp-json/eventostri/v1/eventos/<id>`
- `DELETE /wp-json/eventostri/v1/eventos/<id>`
- `POST /wp-json/eventostri/v1/eventos/import`
- `POST /wp-json/eventostri/v1/eventos/delete-past`
- `POST /wp-json/eventostri/v1/eventos/sync` (deprecated compatibility route)
- `GET|POST /wp-json/eventostri/v1/auth-status`

Relevant current strengths from Antelope work already in the branch:
- stable backend event identity already exists through `Id`
- public payload already includes `ResolvedImage`
- admin single-item CRUD no longer depends on destructive full-list rewrites
- public calendar already has inline search, advanced search modal, localStorage-backed filters, and back-gesture modal handling
- public calendar already emits browser-side search analytics events that can be reused by later analytics or performance work
- settings are already centralized and localized into both JavaScript apps

Current limitations still visible in the codebase:
- there is no favorites storage or favorites UI in the public calendar
- there is no ICS generation endpoint, subscription feed, Google Calendar link, or Outlook link support
- there is no notification settings model, no public preference center, and no scheduled notification processing
- `GET /eventos` is still a single shared read route for public and admin use, without transients caching, conditional response headers, or scale-aware query modes
- public modal images are resolved correctly but are not yet explicitly lazy-loading aware
- the current build script only creates a zip archive and does not minify or compress CSS/JS assets as part of a pipeline step

---

## 3. Bison Dependencies and Recommended Delivery Order

Bison should assume the Antelope shared refactor is already the baseline. The branch already has the two most important prerequisites:

1. stable event IDs
2. granular single-item admin CRUD

Recommended implementation order:

1. **Shared Bison foundation**
   - public read-context split and cache invalidation helpers
   - notification settings schema and persistence helpers
   - normalized event time helpers for integrations and reminders
2. **Favorites**
   - anonymous localStorage storage
   - authenticated user meta storage
   - login merge behavior
   - favorites filter and action controls
3. **Calendar integrations**
   - single-event ICS endpoint
   - subscription feed endpoint
   - Google / Outlook / Apple-generic action rendering in the public modal
4. **Notifications**
   - preference center
   - reminder jobs
   - admin edit/publish notifications
   - idempotent send log
5. **Performance and scale hardening**
   - transient caching
   - conditional GET support
   - normalized sort/query meta
   - frontend and build-pipeline optimizations
   - large-dataset validation

Practical note: parts of the performance work should begin before notifications are complete. Notifications and calendar exports both benefit from a normalized event datetime helper and cache invalidation strategy.

---

## 4. Cross-Cutting Design Decisions

### 4.1 Stable `Id` remains the canonical key for all new features

Favorites, reminder jobs, admin notifications, and calendar export actions must all use the existing stable event `Id`.

Do not introduce title/date string matching for any Bison feature.

### 4.2 Public reads and admin reads should diverge without changing the route family

The current `GET /eventos` route serves both public and admin usage. That is workable for now, but Bison needs different behavior:

- **public context**: cached, future-visible events only, conditional headers enabled
- **admin context**: uncached, full editable dataset, no conditional GET behavior

**Design decision**:
- keep the route path as `GET /eventostri/v1/eventos`
- add explicit query parameters such as `context=public|admin`
- localize the public script with a public-context URL and the admin script with an admin-context URL

This avoids route churn while allowing performance work without breaking the admin UI.

### 4.3 User-specific state belongs in user meta; anonymous state belongs in browser storage

The requirements already fix one major decision:
- anonymous favorites in `localStorage`
- authenticated favorites in user meta under `eventostri_favorite_events`

The same split should be preserved for notification preferences:
- global notification behavior and admin-recipient settings in WordPress options
- per-user notification opt-ins in user meta

### 4.4 Background jobs must be idempotent by design, not by hope

Reminder retries, cron overlaps, or manual reruns must not create duplicate sends.

**Design decision**:
- create a persistent notification log with a unique notification key
- every reminder/admin notification attempt must compute a deterministic key before sending
- if the key already exists in sent or in-progress state, skip the send

### 4.5 Bison will extract new stateful backend modules into `inc/` files

The current codebase still places most backend behavior in `functions.php`, which is acceptable for small additions. Bison adds enough new stateful logic that the implementation should extract the new modules instead of continuing to grow one file.

Confirmed extraction targets:
- `inc/eventostri-favorites.php`
- `inc/eventostri-calendar-integrations.php`
- `inc/eventostri-notifications.php`
- `inc/eventostri-performance.php`

### 4.6 Accessibility must not regress when adding action controls

Favorites buttons, filter toggles, and calendar action buttons must preserve:
- keyboard reachability
- discernible labels
- modal focus behavior
- state announcement for toggle controls

---

## 5. Data Model and Configuration Design

### 5.1 Existing event post/meta model remains the base contract

Continue using the current event post type and existing meta keys already handled by `eventostri_map_post_to_array()`.

Important existing fields for Bison work:
- `Id`
- `Titulo`
- `Fecha_Hora`
- `Lugar`
- `Estado`
- `Tipos`
- `Distancias`
- `Link`
- `Imagen`
- `ResolvedImage`
- `Descripcion`
- `Whatsapp`
- `InscripcionOnLine`
- `Organizador`
- `VisibleEnCalendario`

### 5.2 New internal derived event meta for scale-sensitive reads

To support public-query performance, notification windows, and predictable sort/filter behavior, add internal normalized meta fields on every create/update/import path:

- `_eventostri_start_ts` -> integer Unix timestamp in site timezone normalization workflow
- `_eventostri_start_date` -> `YYYY-MM-DD` string for day-window filters

These fields are implementation details and do not replace `Fecha_Hora` in the public payload.

### 5.3 User meta

Use these user meta keys:

- `eventostri_favorite_events`
  - array of unique integer event IDs
- `eventostri_notification_preferences`
  - associative array, recommended initial shape:

```json
{
  "favorite_day_before": true,
  "favorite_day_of": true,
  "new_event_favorite_locations": false,
  "new_event_favorite_types": false,
  "updated_at": "2026-07-08T00:00:00Z"
}
```

Notes:
- keep future alert fields present but disabled until product approval if implementation wants forward-compatible schema
- sanitize unknown keys out of the stored payload

### 5.4 WordPress options

Keep current options already used by the theme.

Add these new options:

- `eventostri_notification_settings`
- `eventostri_calendar_integration_settings`
- `eventostri_public_events_last_changed`

Recommended `eventostri_notification_settings` shape:

```json
{
  "favorite_day_before_enabled": true,
  "favorite_day_of_enabled": true,
  "send_hour_day_before": 18,
  "send_hour_day_of": 6,
  "batch_size": 100,
  "admin_recipients": ["admin@example.com"],
  "admin_notify_on_publish": true,
  "admin_notify_on_edit": true
}
```

Recommended `eventostri_calendar_integration_settings` shape:

```json
{
  "default_duration_minutes": 120,
  "feed_title": "EventosTri Calendar",
  "feed_description": "Suscripcion de eventos publicados en EventosTri"
}
```

Why the integration settings option is needed:
- Google and Outlook links need a deterministic end time or duration
- ICS generation is cleaner when feed title and default duration are centralized

### 5.5 Browser storage

Recommended browser keys:

- `__eventostriFavoriteEventIds`
- `__eventostriFavoriteMergeState`

Recommended merge-state shape:

```json
{
  "userId": 25,
  "lastMergedAt": "2026-07-08T00:00:00Z"
}
```

This prevents repeating the same local-to-server merge on every page load for the same authenticated user.

### 5.6 Notification log table

Create table:
- `wp_eventostri_notification_log`

Recommended columns:
- `id`
- `notification_key` (unique)
- `notification_type` (`favorite_day_before`, `favorite_day_of`, `admin_event_published`, `admin_event_updated`)
- `user_id` (nullable for admin recipient rows if email-only)
- `event_id`
- `recipient_email`
- `target_date`
- `status` (`pending`, `sending`, `sent`, `failed`, `skipped`)
- `payload_json`
- `created_at`
- `updated_at`
- `sent_at`

This table is the idempotency anchor for cron-driven notifications.

---

## 6. Shared File Map

Primary existing files likely to change:

- `eventostri.org\eventostri-calendar\functions.php`
- `eventostri.org\eventostri-calendar\admin\eventostri-settings.php`
- `eventostri.org\eventostri-calendar\style.css`
- `eventostri.org\eventostri-calendar\assets\calendario\eventostri-calendario.js`
- `eventostri.org\eventostri-calendar\assets\admin-v2\admin-eventTri-v2.js`
- `scripts\build-theme.ps1`

Confirmed new files for Bison extraction:

- `eventostri.org\eventostri-calendar\inc\eventostri-favorites.php`
- `eventostri.org\eventostri-calendar\inc\eventostri-calendar-integrations.php`
- `eventostri.org\eventostri-calendar\inc\eventostri-notifications.php`
- `eventostri.org\eventostri-calendar\inc\eventostri-performance.php`

Possible future test/fixture artifacts if the repository starts carrying them:

- large-event JSON or CSV fixture for 1000+ event performance validation
- notification log migration helper

---

## 7. Detailed Design by Requirement Area

## 7.1 Favorites

### Scope
- favorite action on public calendar event cards
- favorite action in public event details modal
- anonymous favorites in `localStorage`
- authenticated favorites in user meta
- favorites-only filter
- login merge without duplicate event IDs

### Current state
- public calendar already renders event entries and a detail modal
- public calendar already has filter state and `localStorage` helper utilities
- there is no favorite button, favorite endpoint, or user-meta favorite storage yet

### Design

#### Backend
Add favorites REST handlers:
- `GET /eventostri/v1/favorites`
- `POST /eventostri/v1/favorites/toggle`
- `POST /eventostri/v1/favorites/merge`

Behavior:
- `GET /favorites` returns the authenticated user favorites array and normalized user info summary
- `POST /favorites/toggle` adds or removes one `Id` from `eventostri_favorite_events`
- `POST /favorites/merge` accepts a local array of IDs, sanitizes it, merges with server favorites, de-duplicates, and stores the result
- all server-side favorite IDs must be validated against existing `eventostri_evento` posts before saving

Permission model:
- anonymous users never hit favorites write routes
- authenticated favorites routes require the same WordPress auth/nonce model already used elsewhere

#### Frontend
Public JS should manage favorites through a two-layer state model:

1. **local favorites store**
   - always available
   - used immediately for fast UI toggles
2. **authenticated server favorites store**
   - hydrated after auth check
   - canonical when logged in

Recommended flow:
- read local favorite IDs at startup
- render favorite state immediately from local storage
- call existing `/auth-status`
- if logged in:
  - request `GET /favorites`
  - if local favorites exist and were not yet merged for the authenticated user, call `POST /favorites/merge`
  - update local storage to mirror the merged canonical set

UI insertion points:
- add a star or bookmark toggle to each public event card/event chip render path
- add a favorite toggle near the modal title or action region in the public detail modal
- add a `Solo favoritos` filter control near the existing public filters

Data handling rule:
- store only integer event `Id` values, never title/date composite keys

Confirmed badge decision:
- favorite count badge is deferred from baseline Bison delivery
- if implemented later, gate it behind a UI-spec-approved flag instead of making it a default behavior

### Files
- `functions.php` or extracted favorites file
- `assets/calendario/eventostri-calendario.js`
- `style.css`

### Developer checklist
- [ ] add favorite storage helpers in PHP for user meta read/write
- [ ] implement `GET /favorites`
- [ ] implement `POST /favorites/toggle`
- [ ] implement `POST /favorites/merge`
- [ ] add localStorage helpers for anonymous favorites
- [ ] add event-card and modal favorite buttons
- [ ] add favorites-only filter
- [ ] confirm login merge does not create duplicate IDs

---

## 7.2 Calendar Integrations

### Scope
- single-event ICS download
- subscription ICS feed
- Google Calendar link
- Outlook link
- Apple/generic ICS action
- public modal action rendering
- recurrence-aware serialization when recurrence data exists

### Current state
- the public modal already exposes link, registration, WhatsApp, and description blocks
- there are no calendar action buttons today
- there is no ICS feed or export helper in PHP

### Design

#### Backend
Add calendar integration helpers that build a normalized export payload from an event post:
- title
- description
- location
- start timestamp
- derived end timestamp using configured default duration when no explicit end field exists
- timezone
- URL
- recurrence metadata when present

Add REST routes:
- `GET /eventostri/v1/eventos/<id>/ics`
- `GET /eventostri/v1/calendar/feed.ics`

Recommended helper responsibilities:
- `eventostri_calendar_get_integration_settings()`
- `eventostri_calendar_build_export_payload($post_id)`
- `eventostri_calendar_build_google_url($payload)`
- `eventostri_calendar_build_outlook_url($payload)`
- `eventostri_calendar_render_ics_event($payload)`
- `eventostri_calendar_render_ics_feed($events)`

ICS rules:
- emit CRLF line endings
- escape commas, semicolons, and newlines correctly
- include deterministic `UID`
- include `DTSTAMP`
- use site timezone consistently
- include `RRULE` only when recurrence meta exists

Feed rules:
- include visible public events only
- default to current and future events
- reuse the public cache invalidation version so feed changes track event mutations

#### Public payload and modal rendering
To keep the modal logic simple, extend the public event payload with a `CalendarActions` object when `context=public` is used.

Recommended shape:

```json
{
  "CalendarActions": {
    "google_url": "https://calendar.google.com/...",
    "outlook_url": "https://outlook.live.com/...",
    "ics_url": "/wp-json/eventostri/v1/eventos/123/ics"
  }
}
```

Also localize one feed-level URL in `eventostriCalendarioConfig`:
- `calendarFeedUrl`

Frontend modal design:
- add a calendar action row beneath the existing event action blocks
- render buttons for Google, Outlook, and Apple/ICS download
- optionally render a `Suscribirse` action for the ICS feed URL

### Files
- `functions.php` or extracted integrations file
- `assets/calendario/eventostri-calendario.js`
- `style.css`

### Developer checklist
- [ ] add integration settings option and sanitization
- [ ] implement single-event ICS route
- [ ] implement subscription feed route
- [ ] add export payload helper with deterministic duration handling
- [ ] add `CalendarActions` to the public event payload
- [ ] render modal calendar action buttons
- [ ] confirm Google and Outlook open with correct title/date/location payloads
- [ ] confirm ICS import works in common calendar clients

---

## 7.3 Notifications

### Scope
- notification settings storage
- public notification preference center
- favorite-event reminders for day-before and day-of schedules
- admin notifications when an event is edited or published
- cron-driven processing
- duplicate-send protection

### Current state
- there is no notification option schema today
- there is no user notification preference center in the public calendar
- there are no scheduled jobs or notification log tables

### Design

#### Settings and storage
Use two levels of persistence:

1. **Global option**: `eventostri_notification_settings`
   - feature enablement
   - send hours
   - batch size
   - admin recipient list
2. **Per-user meta**: `eventostri_notification_preferences`
   - favorite reminder opt-ins
   - future preference flags if later enabled

#### Public preference center
Add a lightweight public preference center reachable from the calendar UI.

Confirmed baseline behavior:
- anonymous visitors can see favorites-only behavior locally but cannot enroll in email reminders
- authenticated users can manage reminder preferences
- if anonymous users open the preference center, show a login-required message for email delivery features

This keeps the first notification implementation aligned with the current authentication model and avoids introducing anonymous email subscription flows that were not required.

Add REST routes:
- `GET /eventostri/v1/notification-preferences`
- `PUT /eventostri/v1/notification-preferences`

#### Reminder scheduling
Use WP-Cron with explicit scheduled hooks.

Recommended hooks:
- `eventostri_process_favorite_day_before_notifications`
- `eventostri_process_favorite_day_of_notifications`

Scheduling model:
- register recurring hourly cron checks
- each run decides whether the current local hour matches the configured send hour
- when the hour matches, generate candidate notifications for that day window and enqueue/send idempotently

Reminder selection model:
- read all opted-in users with `eventostri_notification_preferences`
- read each user favorite ID list from `eventostri_favorite_events`
- intersect against events whose normalized `_eventostri_start_date` falls in the day-before or day-of target window

This is acceptable for the expected initial scale. If user volume grows enough for user-meta scans to become expensive, a later optimization can add a derived reverse index without changing the storage contract.

#### Admin notifications
Admin notifications should be queued off event lifecycle hooks, not sent inline during save.

Recommended source hooks:
- `save_post_eventostri_evento`
- `transition_post_status`

Behavior:
- determine whether the change is a publish or update event that should notify admins
- compute the recipient set from `eventostri_notification_settings`
- insert pending notification log rows using deterministic keys
- allow the cron processor to send them asynchronously

#### Idempotency
Every send attempt must compute a unique notification key. Recommended pattern:

- favorite reminder: `favorite_day_before:<user_id>:<event_id>:<target_date>`
- favorite reminder: `favorite_day_of:<user_id>:<event_id>:<target_date>`
- admin publish: `admin_event_published:<event_id>:<post_modified_gmt>`
- admin update: `admin_event_updated:<event_id>:<post_modified_gmt>`

If the key already exists with `sent`, `sending`, or `skipped`, do not resend.

### Files
- `functions.php` or extracted notifications file
- `admin/eventostri-settings.php`
- `assets/calendario/eventostri-calendario.js`
- `style.css`

### Developer checklist
- [ ] register notification settings option and sanitization
- [ ] register user preference endpoints
- [ ] add public notification preference center UI
- [ ] create notification log table via `dbDelta`
- [ ] register WP-Cron hooks
- [ ] implement day-before reminder processor
- [ ] implement day-of reminder processor
- [ ] queue admin edit/publish notifications
- [ ] confirm reruns and retries do not duplicate sends

---

## 7.4 Performance and Scale

## 7.4.1 Caching

### Current state
- the public and admin applications both read from the same `GET /eventos` surface
- there is no transient caching on public reads
- there are no `ETag` or `Last-Modified` headers
- cache invalidation helpers do not yet exist

### Design

Add public-read cache helpers:
- `eventostri_calendar_get_public_events_last_changed()`
- `eventostri_calendar_bump_public_events_last_changed()`
- `eventostri_calendar_get_public_events_cache_key()`
- `eventostri_calendar_get_public_events_cached_payload()`

Public-query rules:
- only visible events
- only today/future events
- ordered by normalized `_eventostri_start_ts`
- served from a transient-backed payload when `context=public`

Admin-query rules:
- no transient caching
- return the full editable dataset when `context=admin`

Invalidation triggers must run on:
- create
- update
- delete
- import
- delete-past
- deprecated full sync if retained
- future series regeneration once recurring work exists

Conditional GET:
- set `Last-Modified` from `eventostri_public_events_last_changed`
- compute `ETag` from the cached payload hash plus the last-changed token
- short-circuit with `304 Not Modified` when request headers match

## 7.4.2 Query Optimization

### Design

Use the derived normalized start meta fields from Section 5.2.

Benefits:
- numeric sort order becomes stable and faster than repeatedly parsing `Fecha_Hora`
- notification day-window queries become direct meta comparisons
- future-event-only public queries can avoid loading obviously expired rows

Additional recommendations:
- prime post meta caches before mapping large result sets
- keep public reads to `fields => ids` followed by controlled mapping when building cached payloads
- reduce repeated `get_post_meta()` work inside large loops where possible
- measure import and delete-past invalidation cost separately from public read cost

Pagination note:
- public FullCalendar behavior currently expects a local in-browser dataset for filters and search, so server pagination should not be introduced yet for the public calendar without a UI contract change
- admin list/calendar pagination can be evaluated later, but is not required for baseline Bison scope

## 7.4.3 Frontend Performance

### Current state
- public search already uses local filtering and advanced modal filters
- admin single-item CRUD already avoids full calendar rebuilds
- modal images are created on demand but do not yet use explicit lazy-loading semantics
- scripts are footer-loaded, but there is no minification or compression step in the current zip-only build pipeline

### Design

Public calendar:
- add `loading="lazy"` and `decoding="async"` where event images are rendered in DOM image tags
- keep modal creation lazy so markup is not created until needed
- debounce favorites filter and search recomputation if favorite toggles start triggering expensive rerenders on larger datasets

Admin calendar:
- preserve the current single-item patch behavior from Antelope
- ensure Bison additions do not reintroduce `removeAllEvents()` or broad dataset rewrites for one-item changes

Assets:
- keep cache-busting based on versioning, but prefer file-modified timestamps over theme version if asset changes need faster invalidation during active development
- extend `scripts/build-theme.ps1` with a pre-zip minify/compress step so FR-16.12 is satisfied in the repository-owned build pipeline
- continue expecting hosting-layer gzip/brotli compression as an additional deployment concern, but do not treat it as the only implementation for FR-16.12

Large dataset validation target:
- public search, filters, and month navigation must remain responsive with 1000 or more events loaded

### Files
- `functions.php` or extracted performance file
- `assets/calendario/eventostri-calendario.js`
- `style.css`
- `scripts/build-theme.ps1`

### Developer checklist
- [ ] split public and admin read contexts
- [ ] add transient caching for public reads
- [ ] add invalidation helpers and call them from every mutation path
- [ ] add `ETag` and `Last-Modified` support to public reads
- [ ] add normalized start timestamp/date meta on save/import
- [ ] confirm Bison UI additions do not reintroduce broad rerenders
- [ ] add the pre-zip minify/compress step to `scripts/build-theme.ps1`
- [ ] validate responsiveness with a 1000+ event dataset

---

## 8. Recommended REST API Additions

Add or extend these routes under `eventostri/v1`:

- `GET /eventos?context=public`
- `GET /eventos?context=admin`
- `GET /favorites`
- `POST /favorites/toggle`
- `POST /favorites/merge`
- `GET /eventos/<id>/ics`
- `GET /calendar/feed.ics`
- `GET /notification-preferences`
- `PUT /notification-preferences`

Keep existing routes:
- `POST /auth-status`
- `POST /eventos`
- `PUT /eventos/<id>`
- `DELETE /eventos/<id>`
- `POST /eventos/import`
- `POST /eventos/delete-past`
- `POST /eventos/sync` only while compatibility is still required

---

## 9. Testing Strategy

## 9.1 Manual regression checklist

### Favorites
- [ ] anonymous favorites persist across reloads
- [ ] authenticated favorites persist across sessions
- [ ] favorite buttons work from both event-card and modal surfaces
- [ ] favorites-only filter shows the expected subset
- [ ] login merge produces no duplicate IDs

### Calendar integrations
- [ ] Google Calendar link opens with correct title/date/location data
- [ ] Outlook link opens with correct payload data
- [ ] single-event ICS downloads import correctly in common calendar clients
- [ ] subscription feed is reachable and returns valid ICS text

### Notifications
- [ ] preference center saves only for authenticated users
- [ ] opted-out users do not receive reminders
- [ ] day-before reminders send only once for the same user/event/date
- [ ] day-of reminders send only once for the same user/event/date
- [ ] admin publish/update notifications respect configured recipients

### Performance and scale
- [ ] public reads benefit from warm-cache behavior
- [ ] public `ETag` or `Last-Modified` responses return `304` when unchanged
- [ ] admin single insert/update/delete still avoids full event rewrites
- [ ] public search remains responsive with 1000+ events
- [ ] Bison additions do not regress modal accessibility or keyboard behavior

## 9.2 Data integrity checks

- [ ] favorite stores contain only valid integer event IDs
- [ ] deleted events are removed from authenticated favorites during favorite reads or merge cleanup
- [ ] notification preference payload rejects unsupported keys
- [ ] notification log unique keys prevent duplicate sends
- [ ] normalized `_eventostri_start_ts` and `_eventostri_start_date` stay in sync with `Fecha_Hora`

## 9.3 Operational checks

- [ ] cron hooks are registered only once
- [ ] failed notification rows can be retried safely
- [ ] cache invalidation runs after create/update/delete/import/delete-past
- [ ] feed output changes after event mutations

---

## 10. Rollout Notes

### Safe implementation slices

Recommended merge sequence:

1. public/admin read-context split plus cache invalidation helper
2. normalized event datetime meta
3. favorites endpoints and localStorage flow
4. public favorites UI and filter
5. calendar integration helpers and modal actions
6. notification settings schema and preference endpoints
7. notification log table and cron processors
8. conditional GET headers and remaining performance tuning
9. build-pipeline compression/minification decision if still desired

### Backward compatibility

- keep the existing route family intact
- keep `/eventos/sync` isolated to compatibility-only behavior until it is safe to remove later
- do not break the existing public search/filter local dataset model during performance work unless the UI contract is intentionally changed

---

## 11. Confirmed Technical Decisions

1. **Default event duration for calendar exports**  
   Use `eventostri_calendar_integration_settings.default_duration_minutes` with a default of `120` minutes.

2. **Anonymous notification enrollment**  
   Baseline Bison will not support anonymous email subscriptions. Notification preferences require login.

3. **Favorites count badge**  
   Defer the badge from baseline Bison unless a later UI specification explicitly adds it.

4. **Backend extraction strategy**  
   Implement Bison backend helpers in dedicated `inc/` files for favorites, integrations, notifications, and performance.

5. **Asset minification location**  
   Implement asset minification/compression in `scripts/build-theme.ps1` as a pre-zip pipeline step, while still allowing hosting-layer compression as a deployment complement.

---

## 12. Definition of Done for Bison

Bison should be considered implementation-ready only when:
- favorites work for both anonymous and authenticated users using stable event IDs
- login merge is de-duplicated and reliable
- the public modal exposes working Google, Outlook, and ICS actions
- reminder preferences and reminder jobs exist with idempotent send protection
- admin event edit/publish notifications are queued safely
- public reads use cache-aware behavior and conditional headers
- large-dataset responsiveness is validated without reintroducing full-dataset rewrites for normal single-item CRUD