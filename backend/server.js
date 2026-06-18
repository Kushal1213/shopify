import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import path from "path";
import fs from "fs";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const { SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SCOPES, APP_URL } = process.env;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Middleware ────────────────────────────────────────────────────────────────
// Must come before express.json() so raw body is preserved for HMAC verification
app.use("/webhooks/orders/create", express.raw({ type: "application/json" }));
app.use(express.json());

// ─── Database Setup (MySQL / Aiven) ───────────────────────────────────────────
let sslConfig;

if (process.env.DB_SSL) {
  console.log("🔐 Loading SSL certificate:", process.env.DB_SSL);
  sslConfig = { ca: fs.readFileSync(process.env.DB_SSL) };
} else {
  console.warn("⚠  DB_SSL not set — SSL disabled. Not recommended in production.");
}

const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: sslConfig,
});

console.log("✅ Database connected");

// ─── Schema Migrations ────────────────────────────────────────────────────────
await db.execute(`
  CREATE TABLE IF NOT EXISTS shop_tokens (
    shop         VARCHAR(255) PRIMARY KEY,
    access_token TEXT         NOT NULL,
    created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`);

await db.execute(`
  CREATE TABLE IF NOT EXISTS shop_orders (
    shop           VARCHAR(255),
    order_id       VARCHAR(255) PRIMARY KEY,
    order_name     VARCHAR(255),
    product_name   VARCHAR(255),
    customer_name  VARCHAR(255),
    customer_email VARCHAR(255),
    total_price    DECIMAL(10, 2),
    created_at     DATETIME,
    status         VARCHAR(255),
    INDEX idx_shop (shop),
    INDEX idx_customer_email (customer_email)
  )
`);

// ─── Token Helpers ────────────────────────────────────────────────────────────
async function saveToken(shop, token) {
  await db.execute(
    `REPLACE INTO shop_tokens (shop, access_token) VALUES (?, ?)`,
    [shop, token]
  );
}

async function getToken(shop) {
  const [rows] = await db.execute(
    `SELECT access_token FROM shop_tokens WHERE shop = ?`,
    [shop]
  );
  return rows.length ? rows[0].access_token : null;
}

// ─── HMAC Verification Helper ─────────────────────────────────────────────────
function verifyWebhookHmac(rawBody, hmacHeader) {
  const webhookSecretHex = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!webhookSecretHex) return true; // skip in dev if not set

  const secretBuf = Buffer.from(webhookSecretHex, "hex");
  const generated = crypto
    .createHmac("sha256", secretBuf)
    .update(rawBody)
    .digest("base64");

  return generated === hmacHeader;
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────

/**
 * GET /auth
 * Initiates Shopify OAuth flow — redirects merchant to Shopify permission screen.
 */
app.get("/auth", (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).send("Missing shop parameter");

  const redirectUri = `${APP_URL}/auth/callback`;
  const installUrl =
    `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.redirect(installUrl);
});

/**
 * GET /auth/callback
 * Shopify redirects here with a temporary code — exchange it for an access token.
 */
app.get("/auth/callback", async (req, res) => {
  const { shop, code } = req.query;
  if (!shop || !code) return res.status(400).send("Invalid OAuth parameters");

  try {
    const { data } = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      { client_id: SHOPIFY_API_KEY, client_secret: SHOPIFY_API_SECRET, code }
    );

    await saveToken(shop, data.access_token);
    console.log("✔ Access token stored for:", shop);

    res.redirect(`/?shop=${shop}`);
  } catch (err) {
    console.error("OAuth error:", err.response?.data || err.message);
    res.status(500).send("Authentication failed");
  }
});

/**
 * GET /api/check-auth
 * Used by the frontend to verify whether the merchant has installed the app.
 */
app.get("/api/check-auth", async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.json({ authenticated: false });

  const token = await getToken(shop);
  res.json({ authenticated: !!token });
});

// ─── Products API ─────────────────────────────────────────────────────────────

/**
 * GET /api/products
 * Fetches up to 20 products from the Shopify GraphQL Admin API.
 */
app.get("/api/products", async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: "Missing shop parameter" });

  const token = await getToken(shop);
  if (!token) return res.status(403).json({ error: "App not installed — visit /auth" });

  const query = `
    {
      products(first: 20) {
        edges {
          node {
            id
            title
            images(first: 1) {
              edges { node { transformedSrc(maxWidth: 400) } }
            }
            variants(first: 1) {
              edges { node { price } }
            }
          }
        }
      }
    }
  `;

  try {
    const { data } = await axios.post(
      `https://${shop}/admin/api/2024-10/graphql.json`,
      { query },
      {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(data.data.products.edges);
  } catch (err) {
    console.error("Products API error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ─── Orders Webhook ───────────────────────────────────────────────────────────

/**
 * POST /webhooks/orders/create
 * Receives real-time order events from Shopify and persists them to the database.
 * HMAC signature is verified for security.
 */
app.post("/webhooks/orders/create", async (req, res) => {
  try {
    const shop = req.get("X-Shopify-Shop-Domain");
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
    const rawBody = req.body; // Buffer — kept raw for HMAC validation

    if (!verifyWebhookHmac(rawBody, hmacHeader)) {
      console.warn("⚠  HMAC mismatch — rejected webhook from:", shop);
      return res.status(401).send("Unauthorized");
    }

    const order = JSON.parse(rawBody.toString("utf8"));
    console.log(`🔔 Order webhook received: ${order.name} from ${shop}`);

    await db.execute(
      `INSERT INTO shop_orders
        (shop, order_id, order_name, product_name, customer_name, customer_email, total_price, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         order_name   = VALUES(order_name),
         product_name = VALUES(product_name),
         total_price  = VALUES(total_price),
         status       = VALUES(status)`,
      [
        shop,
        String(order.id),
        order.name,
        order.line_items?.[0]?.title || "Unknown Product",
        `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim(),
        order.customer?.email || "",
        order.total_price,
        order.created_at,
        order.financial_status,
      ]
    );

    console.log("✅ Order saved to database:", order.name);
    res.status(200).send("OK");
  } catch (err) {
    console.error("🔥 Webhook processing error:", err);
    res.status(500).send("Webhook Error");
  }
});

// ─── Orders API ───────────────────────────────────────────────────────────────

/**
 * GET /api/orders
 * Returns all persisted orders for a given shop, newest first.
 */
app.get("/api/orders", async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: "Missing shop parameter" });

  try {
    const [rows] = await db.execute(
      "SELECT * FROM shop_orders WHERE shop = ? ORDER BY created_at DESC",
      [shop]
    );
    res.json(rows);
  } catch (err) {
    console.error("Orders API error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Customers API ────────────────────────────────────────────────────────────

/**
 * GET /api/customers
 * Returns unique customers aggregated with their full order history.
 */
app.get("/api/customers", async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: "Missing shop parameter" });

  try {
    const [rows] = await db.execute(
      `SELECT
         customer_name,
         customer_email,
         COUNT(*) AS order_count,
         SUM(total_price) AS total_spent,
         JSON_ARRAYAGG(
           JSON_OBJECT(
             'order_id',    order_id,
             'order_name',  order_name,
             'product_name',product_name,
             'total_price', total_price,
             'status',      status,
             'created_at',  created_at
           )
         ) AS orders
       FROM shop_orders
       WHERE shop = ?
       GROUP BY customer_email, customer_name
       ORDER BY total_spent DESC`,
      [shop]
    );

    res.json(rows);
  } catch (err) {
    console.error("Customers API error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Analytics API ────────────────────────────────────────────────────────────

/**
 * GET /api/analytics
 * Returns aggregated stats: total orders, total customers, revenue per customer,
 * and order count per day — all scoped to the requesting shop.
 */
app.get("/api/analytics", async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: "Missing shop parameter" });

  try {
    const [[{ total_orders }]] = await db.execute(
      "SELECT COUNT(*) AS total_orders FROM shop_orders WHERE shop = ?",
      [shop]
    );

    const [[{ total_customers }]] = await db.execute(
      "SELECT COUNT(DISTINCT customer_email) AS total_customers FROM shop_orders WHERE shop = ?",
      [shop]
    );

    const [revenueByCustomer] = await db.execute(
      `SELECT
         customer_name,
         customer_email,
         SUM(total_price) AS total_spent
       FROM shop_orders
       WHERE shop = ?
       GROUP BY customer_email, customer_name
       ORDER BY total_spent DESC`,
      [shop]
    );

    const [ordersPerDay] = await db.execute(
      `SELECT
         DATE(created_at) AS day,
         COUNT(*)         AS orders
       FROM shop_orders
       WHERE shop = ?
       GROUP BY DATE(created_at)
       ORDER BY day ASC`,
      [shop]
    );

    res.json({ total_orders, total_customers, revenueByCustomer, ordersPerDay });
  } catch (err) {
    console.error("Analytics API error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// ─── ML Service Proxy ─────────────────────────────────────────────────────────
// Forwards /api/ml/* requests to the FastAPI ML microservice.
// ML_SERVICE_URL defaults to http://localhost:8000

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

app.use("/api/ml", async (req, res) => {
  const mlPath = req.url; // e.g. /predict/sales
  const targetUrl = `${ML_SERVICE_URL}${mlPath}`;

  try {
    const { data, status } = await axios({
      method: req.method,
      url:    targetUrl,
      data:   req.method !== "GET" ? req.body : undefined,
      headers: { "Content-Type": "application/json" },
    });
    res.status(status).json(data);
  } catch (err) {
    const status = err.response?.status || 502;
    const detail = err.response?.data  || { error: "ML service unavailable" };
    res.status(status).json(detail);
  }
});

// ─── Serve React Frontend ──────────────────────────────────────────────────────
const dist = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(dist));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/auth") || req.path.startsWith("/webhooks")) {
    return next();
  }
  res.sendFile(path.join(dist, "index.html"));
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () =>
  console.log(`🚀 Server running at ${APP_URL} (http://localhost:${PORT})`)
);
