import { useShop } from "../hooks/useShop";
import { useFetch } from "../hooks/useFetch";
import "./Customers.css";

export default function Customers() {
  const shop = useShop();
  const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

  const { data: customers, loading } = useFetch(
    shop ? `${API_BASE}/api/customers?shop=${shop}` : null
  );

  if (loading) return <p className="small">Loading customers...</p>;

  return (
    <div className="customers-container">
      <div className="customers-header">
        <span className="section-kicker">Customer intelligence</span>
        <h2>Customers and orders</h2>
        <p className="customers-subtitle">Shop: {shop || "your Shopify store"}</p>
      </div>

      {!customers?.length && <p className="customers-empty">No customers yet.</p>}

      {(customers ?? []).map((c) => {
        const orders = typeof c.orders === "string" ? JSON.parse(c.orders) : c.orders;
        return (
          <div key={c.customer_email} className="customer-card">
            <div className="customer-card-header">
              <div>
                <h3 className="customer-name">{c.customer_name || "Unknown"}</h3>
                <p className="customer-email">{c.customer_email || "No email"}</p>
              </div>
              <div className="customer-meta">
                <span className="meta-pill">Orders: {orders.length}</span>
                <span className="meta-pill">
                  Total: INR {Number(c.total_spent ?? 0).toFixed(2)}
                </span>
              </div>
            </div>

            <ul className="order-list">
              {orders.map((o) => (
                <li key={o.order_id} className="order-item">
                  <div className="order-main">
                    <span className="order-name">{o.order_name}</span>
                    <span className="order-product">{o.product_name}</span>
                  </div>
                  <div className="order-meta">
                    <span className="order-amount">INR {o.total_price}</span>
                    <span className={`order-status status-${(o.status || "").toLowerCase()}`}>
                      {o.status || "Unknown"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
