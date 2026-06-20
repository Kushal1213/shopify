import { useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";
import { useShop } from "../hooks/useShop";
import { useFetch } from "../hooks/useFetch";

export default function Analytics() {
  const shop = useShop();
  const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

  const { data: analytics, loading } = useFetch(
    shop ? `${API_BASE}/api/analytics?shop=${shop}` : null
  );

  const customerChartRef = useRef(null);
  const dailyChartRef = useRef(null);
  const customerCanvas = useRef(null);
  const dailyCanvas = useRef(null);

  useEffect(() => {
    if (!analytics) return;

    customerChartRef.current?.destroy();
    dailyChartRef.current?.destroy();

    if (customerCanvas.current) {
      customerChartRef.current = new Chart(customerCanvas.current, {
        type: "bar",
        data: {
          labels: analytics.revenueByCustomer.map((c) => c.customer_name),
          datasets: [{
            label: "Revenue (INR)",
            data: analytics.revenueByCustomer.map((c) => c.total_spent),
            backgroundColor: "rgba(0, 128, 96, 0.18)",
            borderColor: "#008060",
            borderWidth: 2,
            borderRadius: 10,
          }],
        },
        options: { responsive: true, plugins: { legend: { position: "top" } } },
      });
    }

    if (dailyCanvas.current) {
      dailyChartRef.current = new Chart(dailyCanvas.current, {
        type: "line",
        data: {
          labels: analytics.ordersPerDay.map((d) => d.day),
          datasets: [{
            label: "Orders per day",
            data: analytics.ordersPerDay.map((d) => d.orders),
            borderColor: "#006c4f",
            backgroundColor: "rgba(149, 191, 71, 0.16)",
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 3,
          }],
        },
        options: { responsive: true, plugins: { legend: { position: "top" } } },
      });
    }

    return () => {
      customerChartRef.current?.destroy();
      dailyChartRef.current?.destroy();
    };
  }, [analytics]);

  if (loading) return <p className="small">Loading analytics...</p>;
  if (!analytics) return <p className="small">No data yet. Start selling!</p>;

  return (
    <div className="dashboard-page">
      <section className="metric-grid">
        {[
          { label: "Total Orders", value: analytics.total_orders, accent: "green" },
          { label: "Customers", value: analytics.total_customers, accent: "lime" },
          { label: "Revenue Views", value: analytics.revenueByCustomer?.length ?? 0, accent: "blue" },
        ].map(({ label, value, accent }) => (
          <div key={label} className={`metric-card ${accent}`}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>Live Shopify analytics</small>
          </div>
        ))}
      </section>

      <div className="card">
        <div className="section-title">Revenue per customer</div>
        <canvas ref={customerCanvas} height="100" />
      </div>

      <div className="card">
        <div className="section-title">Orders per day</div>
        <canvas ref={dailyCanvas} height="100" />
      </div>
    </div>
  );
}
