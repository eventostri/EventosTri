# EventosTri_Bison Requirements

Effort Name: EventosTri_Bison
Branch: Bison-EventosTri
Source Checklist: EventosTri_Antelope_Implementation_Checklist.md
Source Phases: 8 (Favorites), 9 (Calendar Integrations), 10 (Notifications), 16 (Performance and Scale)
Status: Planning
Last Updated: 2026-07-08

---

## Scope

This requirements document defines the Bison iteration scope by converting selected implementation phases into product and engineering requirements.

Included in scope:
- Favorites (Phase 8)
- Calendar Integrations (Phase 9)
- Notifications (Phase 10)
- Performance and Scale (Phase 16)

Out of scope:
- Features not listed above unless required as a dependency for these phases

---

## 1. Favorites

### 1.1 Goal
Allow users to save and manage favorite events across anonymous and authenticated sessions.

### 1.2 Functional Requirements
- FR-8.1: The public calendar shall provide a favorite action on event cards.
- FR-8.2: The public event details modal shall provide a favorite action.
- FR-8.3: The system shall store anonymous favorites in browser localStorage.
- FR-8.4: The system shall store authenticated favorites in WordPress user meta using key eventostri_favorite_events.
- FR-8.5: The system shall use stable event Id as the favorite identity key.
- FR-8.6: The public calendar shall provide a favorites filter.
- FR-8.7: The event details modal may display a favorite count badge when enabled by final UI specification.
- FR-8.8: On user login, the system shall merge local favorites into server favorites without creating duplicates.

### 1.3 Acceptance Criteria
- AC-8.1: Anonymous favorites persist across page reloads.
- AC-8.2: Logged-in favorites persist across sessions.
- AC-8.3: Favorite merge on login results in no duplicate Id entries.

---

## 2. Calendar Integrations

### 2.1 Goal
Support event export and subscription flows for common calendar ecosystems.

### 2.2 Functional Requirements
- FR-9.1: The backend shall provide an endpoint to generate single-event ICS files.
- FR-9.2: The backend shall provide a calendar subscription ICS feed endpoint.
- FR-9.3: The system shall generate Google Calendar links for events.
- FR-9.4: The system shall generate Outlook calendar links for events.
- FR-9.5: The system shall provide Apple or generic ICS actions.
- FR-9.6: Event details modal shall surface calendar integration actions.
- FR-9.7: ICS output shall support recurring event definitions when recurrence data exists.

### 2.3 Acceptance Criteria
- AC-9.1: ICS downloads open correctly in common calendar clients.
- AC-9.2: Google and Outlook links open with correct event payload data.

---

## 3. Notifications

### 3.1 Goal
Deliver email-first notification flows with clear user preferences and operational safety.

### 3.2 Functional Requirements
- FR-10.1: The system shall define and implement notification settings storage.
- FR-10.2: The public calendar shall provide a notification preference center.
- FR-10.3: The system shall send favorite-event reminder emails for day-before schedules.
- FR-10.4: The system shall send favorite-event reminder emails for day-of schedules.
- FR-10.5: The system may support new-event alerts for favorite locations and favorite types when product-approved.
- FR-10.6: The system shall notify admins when an event is edited or published.
- FR-10.7: The system shall use cron-driven jobs for notification processing.
- FR-10.8: Notification jobs shall be idempotent to prevent duplicate email sends.
- FR-10.9: Push notifications are deferred and optional unless reprioritized.

### 3.3 Acceptance Criteria
- AC-10.1: Emails are sent only to users who opted in.
- AC-10.2: Reruns and retries do not produce duplicate sends.

---

## 4. Performance and Scale

### 4.1 Goal
Improve responsiveness and throughput for large event datasets in public and admin experiences.

### 4.2 Functional Requirements

#### 4.2.1 Caching
- FR-16.1: Public event queries shall use transients-based caching.
- FR-16.2: Cache invalidation shall run on create, update, delete, import, delete-past, and series regeneration.
- FR-16.3: Static assets shall include cache headers where appropriate.
- FR-16.4: REST read endpoints should support ETag or Last-Modified when practical.
- FR-16.5: Cache monitoring support may be added for admin analytics when approved.

#### 4.2.2 Query Optimization
- FR-16.6: Event query ordering and meta usage shall be reviewed and optimized.
- FR-16.7: Query-performance monitoring hooks or logs may be added when approved.
- FR-16.8: N+1 style loops shall be reduced where possible.
- FR-16.9: Pagination strategy shall be evaluated for large datasets.

#### 4.2.3 Frontend Performance
- FR-16.10: Event images shall be lazy-loaded.
- FR-16.11: Non-critical JavaScript shall be deferred.
- FR-16.12: CSS and JS assets shall be minified or compressed through the existing pipeline.
- FR-16.13: Core Web Vitals shall be measured where supported.
- FR-16.14: Single-item admin CRUD shall continue avoiding full-calendar re-render behavior.

### 4.3 Acceptance Criteria
- AC-16.1: Public calendar remains responsive with datasets of 1000 or more events.
- AC-16.2: Admin single insert, update, and delete do not trigger full event rewrites.
- AC-16.3: Search remains responsive with debounce behavior enabled.

---

## 5. Cross-Cutting Constraints

- CC-1: Stable event Id is mandatory for favorites and integration actions.
- CC-2: Existing permissions and authentication model shall be preserved for new endpoints.
- CC-3: Accessibility behavior shall not regress in modal, filter, and action controls.
- CC-4: New features shall not reintroduce destructive full-list sync for normal single-item CRUD.

---

## 6. Delivery Milestones for Bison Scope

- M1: Favorites complete and validated.
- M2: Calendar integrations complete and validated.
- M3: Notifications baseline complete (email-first, idempotent jobs).
- M4: Performance and scale optimizations complete with validation dataset and responsiveness checks.
