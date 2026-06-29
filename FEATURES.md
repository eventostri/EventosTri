# EventosTri Calendar Features

Complete feature guide for the EventosTri event calendar platform.

---

## Public Calendar (`/calendario`)

The public-facing event calendar is designed for users to discover and explore upcoming sporting events.

### Features

#### 1. **Event Discovery**
- **Search Bar**: Type event names to filter the calendar in real-time
  - Debounced search (300ms) for performance
  - Clear button (×) to reset search
  - Works alongside type and location filters
  
- **Advanced Search Modal**: Press `Ctrl+K` or `Cmd+K` to open advanced search
  - Full-screen search dialog with keyboard shortcuts
  - Arrow keys to navigate results
  - Enter to select and navigate to event
  - Escape to close modal
  - Rich result cards with event name, date, location, and type

#### 2. **Event Filtering**
- **Type Filter**: Filter by event type (MTB, Running, etc.)
  - Smart ordering: prioritizes MTB and Running at the top
  - Count badges show how many events per type
  
- **Location Filter**: Filter by event location/state
  - Top 3 locations displayed first (by event count)
  - Remaining locations sorted alphabetically
  - Count badges for visibility

#### 3. **Event Details Modal**
- Click any event to view full details:
  - **Image**: Full-aspect-ratio preview with max-height constraint
  - **Title**: Event name
  - **Location**: City and state (e.g., "Merida, YUC")
  - **Date & Time**: Formatted with day of week, date, and time
  - **Types**: Event category badges (MTB, Running, etc.)
  - **Distances**: Available race distances
  - **Event Link**: Facebook or external website link
  - **Online Registration**: If available, clickable registration link
  - **WhatsApp**: Contact numbers as WhatsApp links
  - **Description**: Event details and important information
  
- **Accessibility**: 
  - Role=dialog, aria-modal=true
  - Close button (×) or Escape key to dismiss
  - Focus restored to previously focused element on close
  - Proper ARIA labels on all interactive elements

#### 4. **Date Filtering**
- Only **today and future events** appear on the public calendar
- Past events are automatically hidden
- Calendar dynamically adjusts available dates

#### 5. **Visibility Control**
- Only events with `VisibleEnCalendario = true` appear
- Draft events can be managed in Admin (hidden from public)
- Ensures control over which events are published

---

## Admin Panel (`/administrar-calendario-v2`)

The admin panel provides complete event management with advanced features.

### Features

#### 1. **Event Management**
- **Create Events**: Click "Nuevo evento" button
- **Edit Events**: Click any event in the calendar
- **Delete Events**: Delete button in edit form (one at a time)
- **Bulk Delete**: "Eliminar eventos pasados" to remove all past events at once

#### 2. **Event Editor Form**
Complete form with the following fields:

- **Título del evento** * (required)
- **Fecha y Hora** * (required)
- **Lugar / Ubicación**
- **Estado** (YUC / CAM / QROO)
- **Tipos** (comma-separated: MTB, Running, etc.)
- **Distancias** (comma-separated: 5km, 10km, etc.)
- **Enlace de información** (URL to Facebook or website)
- **Inscripciones en línea** (URL to registration form)
- **WhatsApp** (phone numbers separated by commas or newlines)
- **Descripción** (long-form event details)
- **URL de la imagen** (event preview image)
- **Mostrar en calendario público** (checkbox to publish/draft toggle)
- **Organizador** (organizer name/company)

Image preview shows full aspect ratio with max-height constraint.

#### 3. **Search & Filter**
- **Text Search**: Search bar at top filters by event title
  - Debounced 300ms for performance
  - Clear button (×) to reset
  - Works alongside type and location filters
  
- **Advanced Search Modal**: Press `Ctrl+K` or `Cmd+K`
  - Keyboard-navigable results
  - Click or Enter to navigate calendar to event and open editor
  
- **Type & Location Filters**: Same as public calendar
  - Applies to admin list as well

#### 4. **CSV Import**
- **Import File**: Click "Importar CSV" → select `.csv` file
- **Behavior**:
  - Creates only NEW events (no overwrite mode)
  - Skips duplicate rows (reports by CSV line number)
  - Reports summary: inserted, duplicated, and invalid row counts
  - New events default to `VisibleEnCalendario = false` (drafts)

- **CSV Column Format** (required for import):
  ```
  Titulo,Fecha_Hora,Lugar,Estado,Tipos,Distancias,Link,Imagen,Descripcion,Whatsapp,InscripcionOnLine,Organizador,VisibleEnCalendario
  ```
  - **Required**: `Titulo`, `Fecha_Hora`
  - **Optional**: all others (can be left blank)
  - **VisibleEnCalendario**: 1/true/yes/si/on (publish) or 0/false/no/off (draft)

#### 5. **CSV Export**
- **Export File**: Click "Exportar CSV"
- **Includes**:
  - ALL events (past, future, visible, hidden)
  - Full round-trip: exported CSV can be re-imported without data loss
  - Same column order as import format
  - Preserves `VisibleEnCalendario` flag

#### 6. **Session & Authorization**
- **Verify Session**: Click "Verificar sesión" button
  - Checks WordPress login status and edit permissions
  - Shows auth status pill:
    - 🟢 **Autorizado**: Logged in with edit permissions
    - 🟡 **Sin permisos**: Logged in but no edit permissions
    - 🔴 **No autenticado**: Not logged in
    - ⚪ **Sin verificar**: Pending verification
  - Displays nonce status (needed for API requests)

- **Automatic Load**: Events load from WordPress on page open

#### 7. **API Log**
- **Live Feedback**: Colored log shows all API operations
  - 🔵 Info (blue)
  - 🟢 Success (green)
  - 🟡 Warning (yellow)
  - 🔴 Error (red)
- **Clear Log**: Button to clean up old entries

#### 8. **Event Lifecycle**
- **View All**: Admin sees ALL events (past, future, visible, hidden)
- **Delete Past Events**: Bulk action removes only past events (< today)
- **Draft/Publish**: Use `VisibleEnCalendario` checkbox to control public visibility

---

## Event Data Fields

Each event stores the following information:

```json
{
  "Titulo": "Triatlón Riviera Maya",
  "Fecha_Hora": "2026-09-12T06:30",
  "Lugar": "Merida",
  "Estado": "YUC",
  "Tipos": "MTB, Running",
  "Distancias": "5 km, 10 km, 21 km",
  "Link": "https://facebook.com/evento",
  "Imagen": "https://example.com/image.jpg",
  "Descripcion": "Evento deportivo anual...",
  "Whatsapp": "529991234567, 529991112223",
  "InscripcionOnLine": "https://example.com/register",
  "Organizador": "EventosTri",
  "VisibleEnCalendario": true
}
```

---

## Keyboard Shortcuts

| Shortcut | Where | Action |
|----------|-------|--------|
| `Ctrl+K` / `Cmd+K` | Public Calendar | Open advanced search modal |
| `Ctrl+K` / `Cmd+K` | Admin Panel | Open advanced search modal |
| `↑` / `↓` | Search modals | Navigate results |
| `Enter` | Search modals | Select and navigate to event |
| `Escape` | Modals | Close modal and restore focus |
| `Escape` | Search bar | Clear search and reset calendar |

---

## Accessibility Features

- ✅ **ARIA Labels**: All inputs and buttons have descriptive labels
- ✅ **Keyboard Navigation**: Full keyboard support throughout
- ✅ **Focus Management**: Focus trapped in modals, restored on close
- ✅ **Screen Reader Support**: Live regions for search status and results
- ✅ **Semantic HTML**: Proper use of role="dialog", role="option", etc.
- ✅ **Color Contrast**: All text meets WCAG AA standards
- ✅ **Mobile Friendly**: Touch-friendly tap targets and responsive layout

---

## Mobile Experience

- **Responsive Search**: Search bar adapts to small screens
- **Full-Screen Calendar**: Calendar expands to fill viewport on mobile
- **Touch-Friendly**: Large tap targets (44px minimum)
- **Modal Optimization**: Modals scale to fit screen width
- **Landscape & Portrait**: Works in both orientations

---

## WordPress Integration

- **Post Type**: `eventostri_evento` (custom)
- **REST API Endpoints**:
  - `GET /wp-json/eventostri/v1/eventos` — List all published events
  - `POST /wp-json/eventostri/v1/eventos/sync` — Sync (admin only)
  - `POST /wp-json/eventostri/v1/auth-status` — Check auth status
  
- **Authentication**: WordPress nonce-based CSRF protection
- **Permissions**: Only users with `edit_posts` can manage events

---

## Troubleshooting

### Calendar not showing events
- Check "Verificar sesión" — must be logged in to see admin events
- For public calendar: verify events have `VisibleEnCalendario = true`
- Check browser console for API errors

### Search not working
- Ensure the WordPress REST API is accessible
- Check browser's Network tab for failed requests
- Clear browser cache and reload

### CSV Import failing
- Verify CSV has required columns: `Titulo`, `Fecha_Hora`
- Check file encoding (UTF-8 recommended)
- Ensure no duplicate events (same title + date + location)

### Session not persisting
- Log in via WordPress and reload the calendar
- Check WordPress login cookies are enabled
- Clear browser cookies and log in again

---

## Future Enhancements

- Advanced filtering (date range, distance range, organizer)
- Event series/recurring events
- User favorites and saved searches
- Analytics dashboard for event popularity
- Integration with calendar apps (iCal, Google Calendar)
- Multi-language support (currently Spanish)

---

**Version**: 3.0 (Phase 3)  
**Last Updated**: 2026-06-25  
**Maintenance**: EventosTri Team
