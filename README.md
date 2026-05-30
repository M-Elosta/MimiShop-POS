# Mimi's Shop Manager 🎀

A private local web app for managing a small squishy-toy business — inventory,
orders, customers, expenses, and a dashboard with revenue/profit analytics.

## Stack

- Node.js + Express
- SQLite (`better-sqlite3`)
- Vanilla JS + Bootstrap 5 + Chart.js
- `multer` for item photo uploads (stored in `/public/uploads/`)
- Currency: QAR

## Setup

```bash
npm install
npm start
```

The app runs at <http://localhost:3000>.

### Access from another device on the same WiFi

Find your machine's local IP (`ip a` on Linux) and open
`http://192.168.x.x:3000` on the other device.

### Run in the background (Linux)

```bash
node server.js &
```

## Project structure

```
├── server.js          # Express app: mounts routes, serves static + receipt
├── db.js              # SQLite schema (items, customers, orders, order_items, expenses)
├── routes/            # REST API: items, orders, customers, expenses, dashboard
└── public/
    ├── index.html     # SPA shell (sidebar + hash router)
    ├── receipt.html   # Printable receipt page (/receipt/:id)
    ├── css/style.css  # Brand theme
    └── js/            # app, dashboard, inventory, orders, expenses views
```

## Notes

- No login — single-user app for the shop owner.
- `shop.db` and `public/uploads/*` are git-ignored.
