import { Link } from "react-router-dom";
import { useShop } from "../hooks/useShop";
import { useFetch } from "../hooks/useFetch";

const MOMENTS = [
  { label: "Webhook health", value: "Real-time", detail: "Orders and products synced as events arrive" },
  { label: "ML layer", value: "Active", detail: "Forecasting and customer segmentation available" },
  { label: "Commerce stack", value: "Shopify", detail: "Purpose-built for Shopify merchants" },
];

export default function Dashboard() {
  const shop = useShop();
  const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

  const { data: analytics } = useFetch(
    shop ? `${API_BASE}/api/analytics?shop=${shop}` : null
  );

  const stats = [
    { label: "Total Orders", value: analytics?.total_orders ?? "--", accent: "green" },
    { label: "Customers", value: analytics?.total_customers ?? "--", accent: "lime" },
    { label: "Forecast Ready", value: "30d", accent: "blue" },
  ];

  const encodedShop = encodeURIComponent(shop || "");

  return (
    <div className="dashboard-page">
      <section className="metric-grid">
        {stats.map(({ label, value, accent }) => (
          <div key={label} className={`metric-card ${accent}`}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>Connected to {shop || "your Shopify store"}</small>
          </div>
        ))}
      </section>

      <section className="command-grid">
        <div className="card launch-card">
          <span className="section-kicker">Today in Xeno</span>
          <h2>Everything your Shopify team needs, one click away.</h2>
          <p>
            Track sales movement, inspect customer behavior, review catalog data, and activate
            prediction tools from a branded workspace designed for serious operators.
          </p>
          <div className="launch-actions">
            <Link className="btn" to={`/analytics?shop=${encodedShop}`}>View analytics</Link>
            <Link className="btn" to={`/orders?shop=${encodedShop}`}>Review orders</Link>
          </div>
        </div>

        <div className="activity-card">
          {MOMENTS.map((item, index) => (
            <div key={item.label} className="activity-item" style={{ "--delay": `${index * 120}ms` }}>
              <div className="activity-orb" />
              <div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
