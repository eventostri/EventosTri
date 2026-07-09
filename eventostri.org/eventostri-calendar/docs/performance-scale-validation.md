# EventosTri Performance and Scale Validation (Phase 5)

## Status
Bison Phase 5 implemented.

## Scope
This guide supports Bison Phase 5 validation for public-read performance, conditional responses, and large-dataset behavior.

## Implemented decisions
- Public reads remain a full in-browser dataset for current UI behavior (search, filters, and FullCalendar interactions).
- Server-side pagination is deferred for public calendar until a UI/API contract change is approved.
- Admin pagination is evaluative and deferred for this baseline.

## Public endpoint checks
Endpoint:
- `GET /wp-json/eventostri/v1/eventos?context=public`

Expected behavior:
- Returns only visible current/future events.
- Ordered by normalized `_eventostri_start_ts` ascending.
- Includes `ETag` and `Last-Modified` headers.
- Returns `304 Not Modified` when `If-None-Match` or `If-Modified-Since` matches server state.

Quick header validation (example):
1. Request once and capture `ETag` + `Last-Modified`.
2. Repeat request with `If-None-Match: <etag>` and confirm `304`.
3. Repeat request with `If-Modified-Since: <last-modified>` and confirm `304`.
4. Mutate event data (create/update/delete/import/delete-past) and request again to confirm cache invalidation and new validator values.

## Dataset preparation (1000+ events)
Use this approach to prepare a large validation dataset:
1. Export current events via admin CSV export.
2. Duplicate rows and increment date/title fields to generate at least 1000 records.
3. Import through Admin v2 CSV import endpoint.
4. Keep `VisibleEnCalendario` set to `1` for the validation subset.

Minimum dataset guidance:
- 1000 to 1500 total visible future events.
- Mixed `Tipos` and `Lugar` values to exercise filters.
- Include some past rows to verify exclusion in public context.

## Responsiveness checks
Public calendar:
- Initial load remains interactive quickly after first render.
- Search debounce remains responsive under repeated input.
- Tipo/Lugar filters update without UI lockups.

Admin calendar:
- Single create/update/delete operations keep single-item patch behavior.
- No destructive full-list rewrite during normal single-item CRUD.

## Build pipeline checks
Run:
- `scripts/build-theme.ps1`

Expected results:
- Existing zip backup behavior preserved.
- Pre-zip asset optimization runs against staging copy.
- Gzip-compressed `.css.gz` and `.js.gz` artifacts are included in staged zip payload.
- Deployable zip generated at `eventostri.org/dist/eventostri-calendar.zip`.

## Notes
- Runtime measurements (cold vs warm) should be captured in the target environment where WordPress + DB are available.
- This repository-only phase verifies code-path readiness and build artifact flow.
