# EventosTri_Antelope: Enhancement Initiative

**Effort Name**: EventosTri_Antelope  
**Focus**: New features and system enhancements beyond Phase 3 polish  
**Status**: Planning  
**Last Updated**: 2026-06-25

---

## Executive Summary

EventosTri_Antelope is a dedicated effort to extend the EventosTri calendar platform with powerful new features and admin configuration options. Building on the solid foundation of Phases 1-3, this initiative focuses on:

- **Admin Customization**: Make the calendar fully branded via WordPress admin settings
- **Advanced Analytics**: Track event performance and user engagement
- **Enhanced Event Management**: Support recurring events, series, and bulk operations
- **User Experience**: Favorite events, advanced search filters, and calendar integrations
- **Performance & Scale**: Optimize for large event datasets and high traffic

---

## Phase 4: Admin Customization & Branding

### 4.1 Configurable Background Image

**Priority**: HIGH  
**Effort**: Small (2-3 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Create WordPress admin settings page under "Eventos" menu
- [ ] Add file upload control for calendar background image
- [ ] Display image preview in admin settings
- [ ] Store image URL in WordPress options (`eventostri_calendar_background_image`)
- [ ] Update CSS to load image from option instead of hardcoded URL
- [ ] Fallback to default EventosTri logo if no image configured
- [ ] Add help text explaining recommended image specifications (dimensions, file size)

#### Technical Details

```php
// Pseudo-code for WordPress admin setting
add_option_page(
  'eventostri_settings',
  'ConfiguraciÃ³n de Calendario',
  'manage_options',
  'eventostri_settings',
  'render_eventostri_settings_page'
);

// In template/CSS:
--calendar-logo: url('<?php echo esc_url(get_option("eventostri_calendar_background_image")); ?>');
```

#### Files to Modify/Create

- `eventostri.org/admin/eventostri-settings.php` (new)
- `style.css` (update CSS variable loading)
- `admin-v2/admin-eventTri-v2.css` (update CSS variable loading)

---

### 4.2 Customizable Color Scheme

**Priority**: MEDIUM  
**Effort**: Medium (4-5 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Add color picker controls to admin settings for:
  - Primary color (currently `#0b5fff`)
  - Accent color (currently `#00c2ff`)
  - Secondary color (currently `#ff7a59`)
  - Background color (currently `#eef6ff`)
- [ ] Store colors in WordPress options
- [ ] Generate dynamic `<style>` block with CSS variables
- [ ] Preview colors in real-time on settings page
- [ ] Reset to defaults option

#### Technical Details

- Use WordPress built-in color picker (WordPress 5.0+)
- Store as JSON in single option: `eventostri_calendar_colors`
- Generate CSS variables dynamically in footer (or enqueue as inline style)

---

### 4.3 Configurable Calendar Labels & Text

**Priority**: MEDIUM  
**Effort**: Small (2-3 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Make button labels configurable:
  - "Nuevo evento" â†’ customize
  - "Importar CSV" â†’ customize
  - "Exportar CSV" â†’ customize
  - "Eliminar eventos pasados" â†’ customize
- [ ] Add translation support for UI text
- [ ] Store labels in WordPress options
- [ ] Admin interface with text input fields

---

## Phase 5: User Experience Enhancements

### 5.1 Advanced Search Filters & Inline Event Search Navigation

**Priority**: MEDIUM  
**Effort**: Medium (5-6 hours)  
**Status**: Planned  
**Feedback**: Added requirement for inline search suggestions and direct event-card navigation

#### Requirements

- [ ] **Ensure Search Input consistency**: Make sure the Search Input field in Admin Calendar works exactly the same as the Search Input field in Public Calendar
- [ ] Make `evento-search-input` behave like `evento-search-modal-input` with live suggestions as the user types
- [ ] Display matching events in a list directly below `evento-search-input` (no modal required for this flow)
- [ ] On event selection (mouse or keyboard), navigate/scroll the user to the corresponding event card
- [ ] Apply visual focus/highlight to the targeted event card after navigation
- [ ] Open search modal dialog when user double-clicks `evento-search-input` (as replacement entry point for modal search)
- [ ] Add filters to search modal:
  - Date range (start/end date pickers)
  - Distance range (if distances field populated)
  - Organizer
  - Event status (upcoming, ongoing, past)
  - Max distance from user's location (if geolocation enabled)
- [ ] Persist filter selections
- [ ] Show active filter count badge
- [ ] Clear all filters button

#### Implementation Checklist (UI + Accessibility + Performance)

- [ ] UI behavior
  - [ ] Suggestions list opens after typing 1+ characters and closes on blur/Escape
  - [ ] Empty state is shown when there are no matching events
  - [ ] Selecting a suggestion scrolls to the event card and applies temporary highlight/focus state
  - [ ] Double-click on `evento-search-input` opens the search modal dialog without requiring `search-modal-trigger`
- [ ] Accessibility
  - [ ] Use combobox/listbox semantics (`aria-expanded`, `aria-controls`, `aria-activedescendant`)
  - [ ] Full keyboard support: Arrow Up/Down to navigate, Enter to select, Escape to close
  - [ ] Screen reader announces result count and active option changes
  - [ ] Focus is never trapped and returns to the input after closing results
- [ ] Performance
  - [ ] Debounce input queries (target: 150-250ms)
  - [ ] Limit visible suggestions (target: top 8-10)
  - [ ] Avoid full re-render of all event cards on each keystroke
  - [ ] Keep interaction responsive with large datasets (target: <=100ms perceived update after debounce)

#### Acceptance Criteria

- [ ] Typing in `evento-search-input` shows matching event suggestions in real time
- [ ] Mouse and keyboard selection both navigate to the correct event card
- [ ] Selected event card is visually identifiable for at least 2 seconds
- [ ] No regression in existing advanced filter behavior
- [ ] Double-clicking `evento-search-input` reliably opens the search modal dialog
---

### 5.2 Mobile Gestures & Touch Navigation

**Priority**: MEDIUM  
**Effort**: Small (3-4 hours)  
**Status**: Planned  
**Feedback**: Added mobile gesture requirements for modal dismissal and calendar navigation

#### Requirements

- [ ] In both Admin Calendar and Public Calendar, allow the mobile "back" gesture to close the search modal dialog (equivalent to Cancel/Escape)
- [ ] In Public Calendar, allow the mobile "back" gesture to close the event details modal dialog
- [ ] In calendar grid views, support horizontal swipe navigation:
  - [ ] Swipe right goes to NEXT period (same behavior as the Next arrow button)
  - [ ] Swipe left goes to PREVIOUS period (same behavior as the Previous arrow button)
- [ ] Keep arrow-button navigation and gesture navigation fully equivalent in result and state updates
- [ ] Prevent gesture conflicts with vertical page scrolling and interactive card content

#### Acceptance Criteria

- [ ] On mobile, "back" gesture closes search modal in Admin Calendar and Public Calendar
- [ ] On mobile, "back" gesture closes event details modal in Public Calendar
- [ ] Swipe right and swipe left navigate exactly like Next/Previous calendar arrows
- [ ] Gesture navigation does not break existing keyboard, mouse, or arrow-button behavior


### 5.3 Favorite Events

**Priority**: MEDIUM  
**Effort**: Medium (4-5 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Add heart/star icon to event cards
- [ ] Store favorites in browser localStorage (logged-out users)
- [ ] Store favorites in WordPress user meta (logged-in users)
- [ ] "Favorites" filter on public calendar
- [ ] Favorite count badge on event detail modal

#### Technical Details

- localStorage key: `eventostri_favorites_[site_id]`
- WordPress meta key: `eventostri_favorite_events`
- Call REST endpoint to sync on login

---


### 5.4 Calendar Integrations

**Priority**: LOW  
**Effort**: Large (8-10 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Export event to iCal (.ics) format
- [ ] Add "Subscribe to calendar" feature (iCal URL)
- [ ] Generate Google Calendar, Apple Calendar, Outlook links
- [ ] Add event to Outlook/Google Calendar buttons in event detail

#### Technical Details

- Generate .ics file dynamically via WordPress REST endpoint
- Use calendar protocol URLs: `webcal://`, `https://`, etc.
- Support recurring events in iCal export

---


### 5.5 Event Notifications

**Priority**: LOW  
**Effort**: Medium (5-6 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Email notifications for:
  - Favorite events (day-of reminder, day-before reminder)
  - New events in favorite locations/types
- [ ] Push notifications (optional)
- [ ] User preference center in public calendar
- [ ] Admin notification when event is edited/published

---

---

## Phase 6: Advanced Analytics

### 6.1 Event Performance Dashboard

**Priority**: MEDIUM  
**Effort**: Large (8-10 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Create admin dashboard with event statistics:
  - Total events (all-time, this month, this year)
  - Events by type (pie chart)
  - Events by location (bar chart)
  - Public vs. draft ratio
- [ ] Track view counts per event (requires tracking via WordPress)
- [ ] Display trending events (most-viewed)
- [ ] Event registration/link click tracking

#### Technical Details

- Add custom table `eventostri_event_stats` to track page views
- Log view when event modal opens on public calendar
- Aggregate stats via REST endpoint
- Use Chart.js or similar for visualization

---

### 6.2 Search Analytics

**Priority**: MEDIUM  
**Effort**: Medium (4-5 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Track popular search queries
- [ ] Log failed searches (terms with no results)
- [ ] Show admin dashboard of:
  - Most common search terms
  - Search â†’ result conversion rate
  - Queries with zero results
- [ ] Recommend new event types/locations based on search patterns

---


## Phase 7: Enhanced Event Management

### 7.1 Recurring Events / Event Series

**Priority**: HIGH  
**Effort**: Large (12-15 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Add "Recurring" field to event editor:
  - One-time event
  - Weekly (every X weeks)
  - Monthly (every X months)
  - Yearly
- [ ] Add recurrence end date
- [ ] Generate child events from series definition
- [ ] Edit series vs. edit single occurrence
- [ ] Delete series vs. delete single occurrence
- [ ] Sync to calendar without duplicates

#### Technical Details

- Add meta fields: `recurring_pattern`, `recurring_end_date`, `series_id`
- Generate instances via cron job or on-demand when fetching events
- Show series count in admin UI

---

### 7.2 Event Templating

**Priority**: MEDIUM  
**Effort**: Medium (5-6 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Save event as template (without date/time)
- [ ] Create new event from template
- [ ] Manage templates in admin UI
- [ ] Share templates across organizers

---

### 7.3 Bulk Event Operations

**Priority**: MEDIUM  
**Effort**: Small (3-4 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Bulk publish/unpublish events
- [ ] Bulk change event type or location
- [ ] Bulk delete (currently only past events)
- [ ] Select/deselect all in admin calendar

---

## Phase 8: Performance & Scale

### 8.1 Caching Strategy

**Priority**: HIGH  
**Effort**: Medium (4-5 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Implement WordPress transients for event queries
- [ ] Cache invalidation on event create/update/delete
- [ ] Server-side caching headers (Cache-Control)
- [ ] Browser caching for static assets
- [ ] Monitor cache hit rate in admin dashboard

#### Technical Details

- Event list transient: 1 hour TTL
- Invalidate on event changes
- Use ETags for REST API responses

---

### 8.2 Database Query Optimization

**Priority**: MEDIUM  
**Effort**: Small (2-3 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Index frequently-queried fields (`post_date`, `meta` filters)
- [ ] Add query performance monitoring
- [ ] Optimize N+1 queries in event fetch loops
- [ ] Consider pagination for large event lists

---

### 8.3 Frontend Performance

**Priority**: MEDIUM  
**Effort**: Small (2-3 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Lazy-load event images in calendar
- [ ] Defer non-critical JavaScript
- [ ] Minify/compress CSS and JS
- [ ] Monitor Core Web Vitals (LCP, FID, CLS)

---

## Phase 9: Localization & Multi-Language

### 9.1 Full Spanish/English Support

**Priority**: LOW  
**Effort**: Medium (4-5 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Extract all UI strings to WordPress i18n functions
- [ ] Create Spanish and English translation files (.mo/.po)
- [ ] Add language selector in admin settings
- [ ] Translate all documentation

---

## Phase 10: Reporting & Compliance

### 10.1 Event Reporting

**Priority**: LOW  
**Effort**: Small (2-3 hours)  
**Status**: Planned  
**Feedback**: None yet

#### Requirements

- [ ] Generate event reports (CSV/PDF):
  - All events with full details
  - Events by type/location
  - Events by organizer
  - Time-based reports (events this month, quarter, year)

---

## Implementation Roadmap

| Phase | Focus | Effort | Dependencies |
|-------|-------|--------|--------------|
| **4** | Admin Customization | 8-11 hrs | Phase 1-3 complete |
| **5** | UX Enhancements | 18-21 hrs | Phase 4 complete |
| **6** | Analytics | 9-12 hrs | Phase 4 complete |
| **7** | Event Management | 20-25 hrs | Phase 1-3 complete |
| **8** | Performance | 9-11 hrs | Phase 4 complete |
| **9** | Localization | 4-5 hrs | Phase 4 complete |
| **10** | Reporting | 2-3 hrs | Phase 6 complete |

**Total Effort**: ~70-90 hours  
**Recommended Timeline**: 8-12 weeks (with 1 developer)

---

## Success Metrics

- âœ… Calendar fully branded via WordPress admin settings
- âœ… Support for recurring events and event series
- âœ… 50%+ reduction in search time via advanced filters
- âœ… <2s page load time on public calendar
- âœ… 0 failed searches (all searches return at least one result or helpful message)
- âœ… 100% keyboard navigation support throughout
- âœ… Support for 1000+ events without performance degradation

---

## Open Questions

1. Should recurring events generate instances on-demand or pre-generate? (impacts DB size)
2. Should analytics track only event detail views or also calendar loads?
3. Should favorite events sync across devices for logged-in users?
4. Should search export results to Google Calendar directly?
5. Priority order: Which phases should we tackle first?

---

## Feedback Log

### 2026-06-25
- **Initial Requirements Created**: Compiled EventosTri_Antelope with 10 phases covering customization, analytics, event management, UX, performance, and localization.
- **Note**: Document moved to `D:\OneDrive\GitHub\EventosTri\` for separation from Phase 3 development work.
- **Search Input Requirement Added**: `evento-search-input` now requires live matching list behavior and direct navigation to selected event cards, allowing removal of `search-modal-trigger` after rollout validation.
- **Mobile Gesture Requirement Added**: Added mobile back-gesture modal dismissal and swipe-based NEXT/PREVIOUS calendar navigation requirements for Admin and Public calendars.

---

## Stakeholder Sign-Off

- [ ] Product Owner approval
- [ ] Development Lead approval
- [ ] UX/Accessibility review
- [ ] Security review (especially for admin settings)

---

**Document Owner**: EventosTri Team  
**Version**: 1.0 (Initial Planning)  
**Last Updated**: 2026-06-25  
**Next Review**: 2026-07-01  
**Repository**: Main EventosTri repo (separate from worktrees)











