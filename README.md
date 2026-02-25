# Prenotazioni Aule Informatica

Sistema di prenotazione aule informatica scolastiche, costruito con React + Vite + Netlify Functions + Supabase.

## Funzionalità

- **Vista settimanale**: visualizza le prenotazioni della settimana corrente e di quella successiva
- **Prenotazione singola**: prenota un'aula per una specifica data e ora
- **Prenotazione ricorrente**: invia una richiesta di prenotazione periodica (soggetta ad approvazione admin)
- **Pannello amministratore**: gestisci aule, orari, approva richieste ricorrenti, visualizza ed esporta prenotazioni

## Stack tecnologico

- **Frontend**: React 19, React Router v7, Vite
- **Backend**: Netlify Functions (ES modules)
- **Database**: Supabase (PostgreSQL)
- **Deploy**: Netlify

## Setup

### 1. Clona il repository

```bash
git clone https://github.com/MattiaPiola/prenotazioni.git
cd prenotazioni
npm install
```

### 2. Configura Supabase

1. Crea un progetto su [supabase.com](https://supabase.com)
2. Esegui la migration SQL: `supabase/migrations/001_initial.sql` nell'editor SQL di Supabase
3. Copia `URL del progetto` e `anon key` dalle impostazioni API

### 3. Variabili d'ambiente

Crea un file `.env` nella root (vedi `.env.example`):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_CODE_HASH=your-sha256-hash
SESSION_SIGNING_SECRET=your-random-secret
```

#### Generare ADMIN_CODE_HASH (SHA-256 del codice admin)

```bash
echo -n "tuocodice" | sha256sum
# oppure in Node.js:
node -e "import('crypto').then(c=>console.log(c.default.createHash('sha256').update('tuocodice').digest('hex')))"
```

#### SESSION_SIGNING_SECRET

```bash
openssl rand -hex 32
```

### 4. Sviluppo locale

```bash
npm install -g netlify-cli
netlify dev   # http://localhost:3000
```

### 5. Deploy su Netlify

Collega il repository a Netlify, imposta le variabili d'ambiente nel pannello, il deploy avviene automaticamente.

## Struttura progetto

```
src/
  App.jsx, main.jsx, index.css
  lib/api.js, dates.js, supabase.js
  pages/ Home, WeekView, BookingForm, RecurringForm
         AdminLogin, AdminDashboard, AdminRooms, AdminSlots,
         AdminRecurring, AdminBookings
netlify/functions/
  _supabase.js, _auth.js
  rooms.js, room-slots.js, room-bookings.js
  bookings.js, recurring-requests.js
  admin-login.js, admin-logout.js, admin-rooms.js,
  admin-slots.js, admin-recurring.js, admin-bookings.js
supabase/migrations/001_initial.sql
```

## Schema database

| Tabella | Descrizione |
|---------|-------------|
| `rooms` | Aule informatiche |
| `room_slots` | Fasce orarie per ogni aula |
| `bookings` | Prenotazioni singole e ricorrenti |
| `recurring_requests` | Richieste di prenotazione periodica |

## Utilizzo admin

Accedi su `/admin` col codice. Dal dashboard gestisci aule e orari, approva richieste ricorrenti, filtra/esporta prenotazioni in CSV.
