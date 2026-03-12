# Copilot Instructions

## Project Overview

**Prenotazioni** is a school computer room booking system. It allows teachers and staff to book computer rooms for specific time slots, manage recurring bookings, and provides an admin panel for room/slot management and approval of recurring requests.

## Tech Stack

- **Frontend**: React 19, React Router v7, Vite
- **Backend**: Netlify Functions (ES modules)
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Netlify

## Project Structure

```
src/
  App.jsx           # Root component with React Router routes
  main.jsx          # Entry point
  index.css         # Global styles
  lib/
    api.js          # API client functions (calls Netlify Functions)
    dates.js        # Date/time utility functions
    supabase.js     # Supabase client initialization
  pages/
    Home.jsx
    WeekView.jsx
    BookingForm.jsx
    RecurringForm.jsx
    AdminLogin.jsx
    AdminDashboard.jsx
    AdminRooms.jsx
    AdminSlots.jsx
    AdminRecurring.jsx
    AdminBookings.jsx
    AdminCalendar.jsx

netlify/functions/
  _supabase.js          # Shared Supabase admin client
  _auth.js              # Shared admin session auth helper
  _handler.js           # Shared response/error handler
  rooms.js              # GET /rooms
  room-slots.js         # GET /room-slots
  room-bookings.js      # GET /room-bookings
  room-blocked-slots.js # GET /room-blocked-slots
  bookings.js           # POST /bookings (create booking)
  recurring-requests.js # POST /recurring-requests
  admin-login.js        # POST /admin-login
  admin-logout.js       # POST /admin-logout
  admin-rooms.js        # Admin CRUD for rooms
  admin-slots.js        # Admin CRUD for room slots
  admin-recurring.js    # Admin approval of recurring requests
  admin-bookings.js     # Admin view/manage/export bookings
  admin-blocked-slots.js # Admin management of blocked slots

supabase/migrations/
  001_initial.sql       # Full database schema
```

## Database Schema

| Table | Description |
|-------|-------------|
| `rooms` | Computer rooms |
| `room_slots` | Time slots for each room |
| `bookings` | Single and recurring bookings |
| `recurring_requests` | Pending recurring booking requests |
| `blocked_slots` | Slots blocked by admin |

## Environment Variables

The project requires these environment variables (see `.env.example`):

```
VITE_SUPABASE_URL        # Supabase project URL (used by frontend)
VITE_SUPABASE_ANON_KEY   # Supabase anon key (used by frontend)
SUPABASE_URL             # Supabase project URL (used by Netlify Functions)
SUPABASE_SERVICE_ROLE_KEY # Supabase service role key (used by Netlify Functions)
ADMIN_CODE_HASH          # SHA-256 hash of the admin access code
SESSION_SIGNING_SECRET   # Random secret for signing admin sessions
```

## Development Workflow

1. Install dependencies: `npm install`
2. Install Netlify CLI: `npm install -g netlify-cli`
3. Start local dev server: `netlify dev` (runs on http://localhost:3000)
4. Build: `npm run build`

> **Note**: Netlify Functions are required for all API calls and admin operations. Running `vite` alone (without `netlify dev`) will not work properly as API calls will fail.

## Code Conventions

- **Language**: JavaScript (no TypeScript)
- **Module system**: ES modules (`import`/`export`)
- **Frontend components**: React functional components with hooks
- **API layer**: All backend calls go through `src/lib/api.js`, which calls `/.netlify/functions/<name>`
- **Netlify Functions**: Each function is an ES module exporting a `handler` async function; shared utilities are prefixed with `_` (e.g., `_auth.js`, `_supabase.js`, `_handler.js`)
- **Styling**: Plain CSS in `index.css` (no CSS framework)
- **Routing**: React Router v7 with client-side navigation

## Admin Access

The admin panel is accessible at `/admin`. Authentication is done by submitting an admin code that is verified server-side against `ADMIN_CODE_HASH`. Sessions are managed via signed cookies.
