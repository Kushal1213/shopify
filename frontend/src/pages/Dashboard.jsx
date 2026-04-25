import { useShop } from "../hooks/useShop";
import { useFetch } from "../hooks/useFetch";

export default function Dashboard() {
  const shop = useShop();
  const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

  const { data: analytics } = useFetch(
    shop ? `${API_BASE}/api/analytics?shop=${shop}` : null
  );

  const stats = [
    { label: "Total Orders",    value: analytics?.total_orders    ?? "—" },
    { label: "Total Customers", value: analytics?.total_customers ?? "—" },
  ];

  return (
    <div>
      {/* Summary row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        {stats.map(({ label, value }) => (
          <div key={label} className="card" style={{ flex: 1, textAlign: "center" }}>
            <p className="small">{label}</p>
            <p style={{ fontSize: 32, fontWeight: 700, margin: "8px 0 0" }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Welcome 👋</h3>
        <p>
          Viewing data for <strong>{shop || "your store"}</strong>.
        </p>
        <p className="small">
          Use the navigation above to explore analytics, products, customers, and orders synced in real-time from Shopify via webhooks.
        </p>
      </div>
    </div>
  );
}
