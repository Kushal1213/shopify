# Deployment Guide — Vercel

This guide walks through deploying Shopify Xeno Pro on Vercel (free tier).

## Prerequisites

- Vercel account (free): https://vercel.com/signup
- GitHub repo with this project pushed
- Shopify Partner account with your app already created

---

## Step 1 — Build the frontend locally

```bash
cd frontend
npm install
npm run build
```

Commit the `frontend/dist/` folder — the backend serves it as static files.

> **Alternatively**, add a Vercel Build Command that runs `npm run build` inside `frontend/` before deploying.

---

## Step 2 — Import project into Vercel

1. Go to https://vercel.com/new
2. Click **Import Git Repository** and select this repo
3. Set the **Root Directory** to `backend`
4. Set **Build Command** to *(leave empty — Node.js server, no build)*
5. Set **Output Directory** to *(leave empty)*
6. Set **Install Command** to `npm install`

---

## Step 3 — Set environment variables

In the Vercel dashboard → **Settings → Environment Variables**, add everything from `backend/.env.example`:

| Key | Value |
|-----|-------|
| `SHOPIFY_API_KEY` | Your app's API key |
| `SHOPIFY_API_SECRET` | Your app's API secret |
| `SHOPIFY_WEBHOOK_SECRET` | Webhook signing secret (hex) |
| `SCOPES` | `read_products,read_orders` |
| `APP_URL` | `https://your-app.vercel.app` |
| `DB_HOST` | Aiven DB host |
| `DB_PORT` | Aiven DB port |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |
| `DB_NAME` | Database name |

> For `DB_SSL`: Upload your `ca.pem` file to Vercel and reference its path, or set `DB_SSL=` empty to disable SSL (not recommended for production).

---

## Step 4 — Update Shopify app settings

In your [Shopify Partner dashboard](https://partners.shopify.com):

1. **App URL**: `https://your-app.vercel.app/auth`
2. **Allowed redirect URLs**: `https://your-app.vercel.app/auth/callback`

---

## Step 5 — Register the webhook

In Shopify Partner dashboard → **Webhooks**:

- **Topic**: `orders/create`
- **URL**: `https://your-app.vercel.app/webhooks/orders/create`
- **Format**: JSON

Copy the **Signing Secret** into your `SHOPIFY_WEBHOOK_SECRET` environment variable.

---

## Step 6 — Install the app

Navigate to:
```
https://your-app.vercel.app/auth?shop=your-store.myshopify.com
```

You'll be redirected through Shopify OAuth. After approving, you'll land on the dashboard.

---

## Local Development

Use [ngrok](https://ngrok.com/) to expose localhost:

```bash
ngrok http 3000
```

Set `APP_URL=https://xxxx.ngrok.io` in your local `.env`, then install the app via:
```
https://xxxx.ngrok.io/auth?shop=your-dev-store.myshopify.com
```
