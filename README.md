# Uma Micron ERP

Client-ready React + Vite ERP for Uma Micron — material receipts, processing, quotations, purchase orders, invoices, packing lists, delivery challans, and PDF print formats.

## Stack

- **Frontend:** React 19, Vite, React Router
- **Backend:** Express API (`server/`) with PostgreSQL
- **PDFs:** HTML templates → `html2canvas` / jsPDF (`src/utils/`)

## Quick start

```bash
# Frontend
npm install
npm run dev

# API (separate terminal)
npm run dev:server
# or: npm run start --prefix server
```

Default local frontend: `http://localhost:5173`

### Database (API)

```bash
cd server
cp .env.example .env   # set DATABASE_URL / JWT secret
npm run db:migrate
npm run db:seed        # optional demo data
npm start
```

## Production build

```bash
npm run build
npm run preview        # smoke-test dist/
```

Deploy `dist/` to static hosting (Vercel config included via `vercel.json`). Keep the API on a Node host with env vars configured.

## Client handover checklist

| Area | Status |
|------|--------|
| Login + role-based routes | Ready |
| Company Profile (logo, GST, address) | Ready — drives print headers |
| Material Receipt → PO / Processing Sheet | Ready |
| Quotation / PI / Tax Invoice PDFs | Ready |
| Packing List / Delivery Challan PDFs | Ready |
| Debit / Credit notes | Ready |
| Party Due / payments (received + TDS) | Ready |
| Purchase Order print | **UMA MICRON** format (not Jagdamba) |

### Before go-live

1. Set **System → Company Profile** (name, logo, GSTIN, address, phone, email, bank).
2. Configure numbering / serials under settings.
3. Create parties and products.
4. Smoke-test: create one MR → PO → Quotation → PI → TI → PL → DC and Preview/Download each PDF.
5. Confirm QR (`public/qr.png`) and factory image (`public/jet_mill.jpeg`) appear on quotation PDF.

## Important notes

- **Uma vs Jagdamba:** This repo is **Uma Micron ERP only**. Jagdamba Profile lives in a separate project (`D:\j`). Do not mix PO print templates.
- Print styles are scoped inside PDF HTML / iframe so they do not leak into the live app UI.
- Soft-delete is used for many documents; System Logs / admin can review history.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Frontend dev server |
| `npm run build` | Production bundle → `dist/` |
| `npm run lint` | ESLint |
| `npm run dev:server` | API with watch |

## Support

For issues after delivery, note: browser console errors, document type (PO/TI/DC…), and a sample PDF screenshot.
