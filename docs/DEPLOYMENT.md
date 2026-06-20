# Deployment Guide — Render

This guide deploys the full stack on [Render](https://render.com) using the
[`render.yaml`](../render.yaml) Blueprint at the repo root. Two services are
created:

| Service | Type | What it does |
|---|---|---|
| `shopify-app` | Node web service | Express backend + the built React frontend |
| `shopify-ml-service` | Python web service | FastAPI ML microservice (forecasting + segmentation) |

The backend proxies `/api/ml/*` to the ML service, so the browser only ever
talks to `shopify-app`.

## Prerequisites

- A [Render](https://render.com) account
- A managed MySQL database — e.g. [Aiven](https://aiven.io/) free tier (Render
  does not offer managed MySQL)
- A [Shopify Partner](https://partners.shopify.com/) account with an app created

---

## Step 1 — Provision a MySQL database

Create a MySQL instance (Aiven free tier works). Note the host, port, user,
password, database name, and download the CA certificate.

---

## Step 2 — Create the Blueprint on Render

1. Go to <https://dashboard.render.com> → **New** → **Blueprint**
2. Connect this GitHub repo. Render reads `render.yaml` and proposes both
   services.
3. Click **Apply**. The ML service builds (and trains models), and the Node
   service builds the frontend and starts the backend. `ML_SERVICE_URL` is wired
   automatically from the ML service.

---

## Step 3 — Set environment variables (`shopify-app`)

In the Render dashboard → **shopify-app → Environment**, fill in the values
marked `sync: false`:

| Key | Value |
|-----|-------|
| `SHOPIFY_API_KEY` | Your app's API key |
| `SHOPIFY_API_SECRET` | Your app's API secret |
| `SHOPIFY_WEBHOOK_SECRET` | Webhook signing secret (hex) |
| `APP_URL` | `https://shopify-app-XXXX.onrender.com` (this service's URL) |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | From Step 1 |
| `DB_SSL_CA` | Paste the **contents** of the Aiven `ca.pem` (inline cert) |

> `SCOPES` and `ML_SERVICE_URL` are already set by `render.yaml`.

Save — Render redeploys automatically.

---

## Step 4 — Update Shopify app settings

In your [Shopify Partner dashboard](https://partners.shopify.com):

1. **App URL**: `https://shopify-app-XXXX.onrender.com/auth`
2. **Allowed redirect URLs**: `https://shopify-app-XXXX.onrender.com/auth/callback`

---

## Step 5 — Register the webhook

In the Shopify Partner dashboard → **Webhooks** (or via the Admin API):

- **Topic**: `orders/create`
- **URL**: `https://shopify-app-XXXX.onrender.com/webhooks/orders/create`
- **Format**: JSON

Copy the **Signing Secret** into the `SHOPIFY_WEBHOOK_SECRET` env var.

---

## Step 6 — Install the app

Navigate to:
```
https://shopify-app-XXXX.onrender.com/auth?shop=your-store.myshopify.com
```

Approve the OAuth prompt and you'll land on the dashboard.

---

## Health checks

- App: `GET /api/health` → `{ "status": "ok", "db": true }`
- ML service: `GET /health` → `{ "status": "ok", "models_loaded": true }`

---

## Local Development

```bash
# 1. MySQL (Docker)
docker run -d --name shopify-mysql -e MYSQL_ROOT_PASSWORD=rootpw \
  -e MYSQL_DATABASE=defaultdb -e MYSQL_USER=avnadmin \
  -e MYSQL_PASSWORD=devpassword -p 3306:3306 mysql:8

# 2. ML service
cd ml_service && pip install -r requirements.txt && python train_models.py
uvicorn main:app --host 0.0.0.0 --port 8000

# 3. Backend (configure backend/.env first — see backend/.env.example)
cd backend && npm install && npm run dev

# 4. Frontend build (served by the backend)
cd frontend && npm install && npm run build
```

Use [ngrok](https://ngrok.com/) (`ngrok http 3000`) to expose localhost for the
Shopify OAuth flow, setting `APP_URL` to the ngrok URL.
