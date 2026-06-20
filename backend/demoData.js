/**
 * Self-contained sample data for DEMO_MODE.
 *
 * When DEMO_MODE=true the server serves this data instead of querying MySQL or
 * the Shopify Admin API, so the app can be deployed as a zero-cost, zero-config
 * public showcase (no database, no Shopify credentials required).
 */

export const DEMO_SHOP = "demo-store.myshopify.com";

const CATALOG = [
  { product: "Wireless Earbuds Pro", price: 2499 },
  { product: "Smart Fitness Watch", price: 5999 },
  { product: "Organic Coffee Beans 1kg", price: 1299 },
  { product: "Eco Yoga Mat", price: 899 },
  { product: "LED Desk Lamp", price: 1799 },
  { product: "Stainless Steel Bottle", price: 749 },
  { product: "Bluetooth Speaker", price: 3299 },
  { product: "Mechanical Keyboard", price: 4599 },
];

const CUSTOMERS = [
  { name: "Asha Rao",      email: "asha@example.com" },
  { name: "Vikram Shah",   email: "vikram@example.com" },
  { name: "Priya Nair",    email: "priya@example.com" },
  { name: "Rahul Mehta",   email: "rahul@example.com" },
  { name: "Sneha Iyer",    email: "sneha@example.com" },
  { name: "Arjun Kapoor",  email: "arjun@example.com" },
];

const STATUSES = ["paid", "paid", "paid", "pending", "refunded"];

// Deterministic pseudo-random so the dataset is stable within a deploy.
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// MySQL DATETIME-style string (UTC) e.g. "2026-06-10 14:30:00"
function dateTimeStr(d) {
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`
  );
}

// Build ~22 orders spread across the last 28 days.
function buildOrders() {
  const rng = makeRng(20260620);
  const orders = [];
  const now = new Date();
  let n = 1000;

  for (let i = 0; i < 22; i++) {
    const cust = CUSTOMERS[Math.floor(rng() * CUSTOMERS.length)];
    const item = CATALOG[Math.floor(rng() * CATALOG.length)];
    const qty = 1 + Math.floor(rng() * 3);
    const daysAgo = Math.floor(rng() * 28);
    const hour = 8 + Math.floor(rng() * 12);

    const created = new Date(now);
    created.setUTCDate(created.getUTCDate() - daysAgo);
    created.setUTCHours(hour, Math.floor(rng() * 60), 0, 0);

    n += 1;
    orders.push({
      shop:           DEMO_SHOP,
      order_id:       String(n),
      order_name:     `#${n}`,
      product_name:   item.product,
      customer_name:  cust.name,
      customer_email: cust.email,
      total_price:    item.price * qty,
      created_at:     dateTimeStr(created),
      status:         STATUSES[Math.floor(rng() * STATUSES.length)],
    });
  }

  // Newest first (matches the SQL `ORDER BY created_at DESC`).
  return orders.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

const ORDERS = buildOrders();

export function getOrders() {
  return ORDERS;
}

export function getCustomers() {
  const byEmail = new Map();
  for (const o of ORDERS) {
    const c = byEmail.get(o.customer_email) || {
      customer_name:  o.customer_name,
      customer_email: o.customer_email,
      order_count:    0,
      total_spent:    0,
      orders:         [],
    };
    c.order_count += 1;
    c.total_spent += o.total_price;
    c.orders.push({
      order_id:     o.order_id,
      order_name:   o.order_name,
      product_name: o.product_name,
      total_price:  o.total_price,
      status:       o.status,
      created_at:   o.created_at,
    });
    byEmail.set(o.customer_email, c);
  }
  return [...byEmail.values()].sort((a, b) => b.total_spent - a.total_spent);
}

export function getAnalytics() {
  const customers = getCustomers();
  const perDay = new Map();
  for (const o of ORDERS) {
    const day = `${o.created_at.slice(0, 10)}T00:00:00.000Z`;
    perDay.set(day, (perDay.get(day) || 0) + 1);
  }
  const ordersPerDay = [...perDay.entries()]
    .map(([day, orders]) => ({ day, orders }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    total_orders:      ORDERS.length,
    total_customers:   customers.length,
    revenueByCustomer: customers.map((c) => ({
      customer_name:  c.customer_name,
      customer_email: c.customer_email,
      total_spent:    c.total_spent,
    })),
    ordersPerDay,
  };
}

// Shopify Admin GraphQL `products` shape expected by the frontend.
export function getProducts() {
  return CATALOG.map((item, idx) => ({
    node: {
      id:     `gid://shopify/Product/${idx + 1}`,
      title:  item.product,
      images: {
        edges: [
          { node: { transformedSrc: `https://picsum.photos/seed/xeno${idx + 1}/400/400` } },
        ],
      },
      variants: {
        edges: [{ node: { price: String(item.price) } }],
      },
    },
  }));
}
