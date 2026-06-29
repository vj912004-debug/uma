# UMA ERP API (Node.js + PostgreSQL)

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Setup

1. Create the database:

```sql
CREATE DATABASE uma_erp;
```

2. Configure environment:

```bash
cd server
copy .env.example .env
```

Edit `.env` and set your PostgreSQL connection:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/uma_erp
JWT_SECRET=your-long-random-secret
```

3. Install dependencies and initialize:

```bash
npm install
npm run db:migrate
npm run db:seed
```

4. Start the API:

```bash
npm run dev
```

API runs at **http://localhost:3001**

## Default login

- Username: `admin`
- Password: `admin123`

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Login → `{ token, user, state }` |
| GET | `/api/auth/me` | Current user (Bearer token) |
| GET | `/api/state` | Full ERP state (Bearer token) |
| PUT | `/api/state` | Save ERP state (Bearer token) |
| POST | `/api/state/import` | Import state (Admin only) |

## Frontend

From project root:

```bash
npm run dev
```

Vite proxies `/api` to the backend. When the API is running, login uses PostgreSQL. If the API is offline, the app falls back to browser localStorage.

## Import existing localStorage data

1. Start API and log in as admin.
2. In browser console:

```javascript
const local = JSON.parse(localStorage.getItem('uma_erp_data'));
await fetch('/api/state/import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + localStorage.getItem('uma_auth_token')
  },
  body: JSON.stringify(local)
});
location.reload();
```
