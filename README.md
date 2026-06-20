<div align="center">
  <h1>🛍️ Shopify Xeno Pro</h1>
  <p><strong>A full-stack Shopify embedded app</strong> — OAuth 2.0 authentication, real-time order webhooks, MySQL persistence, and an analytics dashboard built with React + Vite.</p>

  <p>
    <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" />
    <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" />
    <img src="https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white" />
    <img src="https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white" />
    <img src="https://img.shields.io/badge/Shopify-Partner%20App-96BF48?logo=shopify&logoColor=white" />
  </p>
</div>

-----

## 📸 Screenshots

> Dashboard · Orders · Analytics · Customers · Products
> <img width="1907" height="1017" alt="image" src="https://github.com/user-attachments/assets/bc989fdf-a529-4334-ada4-b3b0469c85d1" />

_________________________________________________________________________________________________________________________________________
<img width="1867" height="905" alt="image" src="https://github.com/user-attachments/assets/297e1e51-14dd-40b7-9537-4345c96c3bfb" />

__________________________________________________________________________________________________________________________________________
<img width="1881" height="916" alt="image" src="https://github.com/user-attachments/assets/5ea10794-fc28-4a80-9fdd-46bb6bde15c6" />


---

## ✨ Features

| Feature | Description |
|---|---|
| **OAuth 2.0** | Secure Shopify app installation flow with token exchange and storage |
| **Webhook Processing** | Real-time `orders/create` events with HMAC signature verification |
| **Orders Dashboard** | Live table of all synced orders per store |
| **Customer View** | Customers aggregated with full order history and total spend |
| **Analytics** | Revenue-per-customer bar chart + orders-per-day line chart via Chart.js |
| **Products** | Fetches live product catalogue via Shopify GraphQL Admin API |
| **MySQL Persistence** | Aiven-hosted MySQL with SSL; auto-creates tables on startup |
| **React + Vite SPA** | Fast, component-based frontend with custom hooks |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Shopify Admin                       │
│  install → /auth → OAuth → /auth/callback           │
│  orders/create webhook → /webhooks/orders/create    │
└───────────────────┬─────────────────────────────────┘
                    │ HTTP
┌───────────────────▼─────────────────────────────────┐
│              Express Backend (Node.js)               │
│                                                      │
│  /auth          OAuth initiation                    │
│  /auth/callback Token exchange + DB save            │
│  /api/products  GraphQL → Shopify                   │
│  /api/orders    MySQL SELECT                        │
│  /api/customers MySQL GROUP BY customer             │
│  /api/analytics MySQL aggregations                  │
│  /webhooks/*    HMAC-verified event ingestion       │
└───────────────────┬─────────────────────────────────┘
                    │ mysql2
┌───────────────────▼─────────────────────────────────┐
│           MySQL (Aiven Cloud) — SSL                  │
│                                                      │
│  shop_tokens  — per-store access tokens             │
│  shop_orders  — webhook-sourced order data          │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 18
- A [Shopify Partner](https://partners.shopify.com/) account with an app created
- A MySQL database (e.g. [Aiven](https://aiven.io/) free tier)
- A public HTTPS URL for local dev (use [ngrok](https://ngrok.com/) or deploy to Vercel)

### 1 — Clone & install

```bash
git clone https://github.com/your-username/shopify-xeno-pro.git
cd shopify-xeno-pro

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2 — Configure environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your Shopify credentials and DB connection
```

```bash
# Frontend (optional — only needed for local dev)
cp frontend/.env.example frontend/.env
# Set VITE_API_URL=http://localhost:3000
```

### 3 — Build the frontend

```bash
cd frontend && npm run build
```

### 4 — Start the backend

```bash
cd backend && npm run dev
```

Visit `http://localhost:3000?shop=your-store.myshopify.com` to install the app.

---

## 📁 Project Structure

```
shopify-xeno-pro/
├── backend/
│   ├── server.js          # Express app — auth, APIs, webhook handler
│   ├── package.json
│   └── .env.example       # Environment variable template
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.jsx       # Nav + auth guard
│   │   ├── hooks/
│   │   │   ├── useShop.js       # Read shop from URL params
│   │   │   └── useFetch.js      # Generic data-fetching hook
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx    # Landing with live KPIs
│   │   │   ├── Analytics.jsx    # Chart.js charts
│   │   │   ├── Products.jsx     # GraphQL product grid
│   │   │   ├── Orders.jsx       # Webhook-sourced order table
│   │   │   └── Customers.jsx    # Customer + order history
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── .env.example
│
├── docs/
│   └── DEPLOYMENT.md      # Vercel deployment guide
└── README.md
```

---

## 🌐 Deployment (Vercel)

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the step-by-step guide.

**Quick summary:**
1. Push this repo to GitHub
2. Import into [Vercel](https://vercel.com)
3. Set all environment variables from `.env.example` in the Vercel dashboard
4. Update your Shopify app's **App URL** and **Redirect URL** to the Vercel domain
5. Register the `orders/create` webhook pointing to `https://your-app.vercel.app/webhooks/orders/create`

---

## 🔐 Security

- **HMAC Verification** — Every inbound webhook is verified against the Shopify-signed HMAC header before being processed.
- **Token Storage** — Access tokens are stored server-side in MySQL; the frontend never sees them.
- **SSL** — All database connections use SSL certificates (Aiven CA).
- **Environment Variables** — No secrets are committed; `.env` is in `.gitignore`.

---

## 🛠️ Tech Stack

**Backend:** Node.js · Express · mysql2 · axios · dotenv · crypto (HMAC)  
**Frontend:** React 18 · React Router · Vite · Chart.js  
**Database:** MySQL 8 (Aiven Cloud with SSL)  
**Platform:** Shopify Partner App · GraphQL Admin API 2024-10 · Webhooks  

---

## 📄 License

MIT
