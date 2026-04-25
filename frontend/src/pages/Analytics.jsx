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
  const dailyChartRef    = useRef(null);
  const customerCanvas   = useRef(null);
  const dailyCanvas      = useRef(null);

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
            label: "Revenue (₹)",
            data: analytics.revenueByCustomer.map((c) => c.total_spent),
            backgroundColor: "rgba(75, 192, 255, 0.6)",
            borderColor: "rgba(75, 192, 255, 1)",
            borderWidth: 2,
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
            label: "Orders per Day",
            data: analytics.ordersPerDay.map((d) => d.orders),
            borderColor: "rgba(255, 99, 132, 1)",
            backgroundColor: "rgba(255, 99, 132, 0.1)",
            fill: true,
            tension: 0.3,
            borderWidth: 2,
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

  if (loading) return <p className="small">Loading analytics…</p>;
  if (!analytics) return <p className="small">No data yet. Start selling!</p>;

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Orders",    value: analytics.total_orders    },
          { label: "Total Customers", value: analytics.total_customers },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ flex: 1, textAlign: "center" }}>
            <p className="small">{label}</p>
            <p style={{ fontSize: 36, fontWeight: 700, margin: "8px 0 0" }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="section-title">Revenue per Customer</div>
        <canvas ref={customerCanvas} height="100" />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">Orders per Day</div>
        <canvas ref={dailyCanvas} height="100" />
      </div>
    </div>
  );
}
