import { useState, useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";
import { useShop } from "../hooks/useShop";
import { useFetch } from "../hooks/useFetch";
import "./MLSegment.css";

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

const SEGMENT_COLORS = {
  "High Value": { bg: "rgba(0,128,96,0.15)",   border: "#008060" },
  "Mid Value":  { bg: "rgba(255,165,0,0.15)",  border: "#ff8c00" },
  "Low Value":  { bg: "rgba(200,50,50,0.15)",  border: "#c83232" },
};

export default function MLSegment() {
  const shop = useShop();
  const chartRef  = useRef(null);
  const canvasRef = useRef(null);

  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [result, setResult]       = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [activeTab, setActiveTab] = useState("bulk");

  /* single-customer form */
  const [form, setForm] = useState({
    total_spent: 500,
    order_count: 3,
    days_since_last_order: 30,
    avg_order_value: 166,
    unique_products: 2,
    return_rate: 0.05,
  });

  /* load existing customers for bulk demo */
  const { data: customers } = useFetch(
    shop ? `${API_BASE}/api/customers?shop=${shop}` : null
  );

  /* model info */
  useEffect(() => {
    fetch(`${API_BASE}/api/ml/models/info`)
      .then(r => r.json())
      .then(setModelInfo)
      .catch(() => {});
  }, []);

  /* chart for segment distribution */
  useEffect(() => {
    if (!result?.segment_summary || !canvasRef.current) return;
    chartRef.current?.destroy();

    const labels = Object.keys(result.segment_summary);
    const counts = labels.map(l => result.segment_summary[l].count);
    const colors = labels.map(l => SEGMENT_COLORS[l]?.border || "#888");

    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: labels.map(l => SEGMENT_COLORS[l]?.bg || "rgba(0,0,0,0.1)"),
          borderColor: colors,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: ctx => {
                const lbl  = ctx.label;
                const pct  = result.segment_summary[lbl]?.percentage ?? 0;
                return `${lbl}: ${ctx.parsed} customers (${pct}%)`;
              },
            },
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [result]);

  /* ── Bulk segment from existing Shopify customers ── */
  async function runBulkSegment() {
    if (!customers?.length) return;
    setLoading(true); setError(null);
    try {
      const payload = {
        customers: customers.map(c => ({
          total_spent:            Number(c.total_spent ?? 0),
          order_count:            Number(c.order_count ?? 1),
          days_since_last_order:  30,  // approximated
          avg_order_value:        Number(c.total_spent ?? 0) / Math.max(Number(c.order_count ?? 1), 1),
          unique_products:        Math.min(Number(c.order_count ?? 1), 20),
          return_rate:            0.05,
        })),
      };
      const res = await fetch(`${API_BASE}/api/ml/segment/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "API error");
      const data = await res.json();
      // Attach customer names to results
      const enriched = {
        ...data,
        results: data.results.map((r, i) => ({
          ...r,
          customer_name:  customers[i]?.customer_name  || `Customer ${i+1}`,
          customer_email: customers[i]?.customer_email || "",
        })),
      };
      setResult(enriched);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  /* ── Single customer segment ── */
  async function runSingleSegment() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ml/segment/customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total_spent:            Number(form.total_spent),
          order_count:            Number(form.order_count),
          days_since_last_order:  Number(form.days_since_last_order),
          avg_order_value:        Number(form.avg_order_value),
          unique_products:        Number(form.unique_products),
          return_rate:            Number(form.return_rate),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "API error");
      const data = await res.json();
      setResult({ single: data });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const sm = modelInfo?.segmenter;

  return (
    <div className="seg-page">

      {sm && (
        <div className="model-badge seg-badge">
          <span>🧠</span>
          <span>
            <strong>KMeans Clustering</strong> · {sm.n_clusters} segments ·
            Silhouette {sm.silhouette}
          </span>
        </div>
      )}

      {/* Tab selector */}
      <div className="tab-bar">
        <button className={`tab ${activeTab === "bulk"   ? "active" : ""}`} onClick={() => { setActiveTab("bulk");   setResult(null); }}>
          Bulk — Shop Customers
        </button>
        <button className={`tab ${activeTab === "single" ? "active" : ""}`} onClick={() => { setActiveTab("single"); setResult(null); }}>
          Single Customer
        </button>
      </div>

      {/* Bulk mode */}
      {activeTab === "bulk" && (
        <div className="card">
          <div className="section-title">Segment All Store Customers</div>
          <p className="small">
            Sends your {customers?.length ?? 0} stored customers to the KMeans model and
            classifies each into High / Mid / Low Value.
          </p>
          <button className="btn run-btn" onClick={runBulkSegment}
            disabled={loading || !customers?.length}>
            {loading ? "Segmenting…" : `▶ Segment ${customers?.length ?? 0} Customers`}
          </button>
          {!customers?.length && <p className="ml-error">No customer data found. Add orders via webhook first.</p>}
        </div>
      )}

      {/* Single mode */}
      {activeTab === "single" && (
        <div className="card">
          <div className="section-title">Segment a Single Customer</div>
          <div className="controls-grid">
            {[
              ["Total Spent (₹)",          "total_spent",           "number"],
              ["Order Count",              "order_count",           "number"],
              ["Days Since Last Order",    "days_since_last_order", "number"],
              ["Avg Order Value (₹)",      "avg_order_value",       "number"],
              ["Unique Products Bought",   "unique_products",       "number"],
              ["Return Rate (0-1)",        "return_rate",           "number"],
            ].map(([label, key, type]) => (
              <label key={key}>
                {label}
                <input type={type} step="any"
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </label>
            ))}
          </div>
          <button className="btn run-btn" onClick={runSingleSegment} disabled={loading}>
            {loading ? "Predicting…" : "▶ Predict Segment"}
          </button>
        </div>
      )}

      {error && <p className="ml-error card" style={{ padding: "12px 20px" }}>⚠ {error}</p>}

      {/* Single result */}
      {result?.single && (
        <SingleResult r={result.single} />
      )}

      {/* Bulk results */}
      {result?.segment_summary && (
        <>
          {/* Summary cards */}
          <div className="kpi-row">
            {Object.entries(result.segment_summary).map(([lbl, s]) => (
              <div key={lbl} className="card kpi-card" style={{
                borderTop: `3px solid ${SEGMENT_COLORS[lbl]?.border || "#888"}`,
              }}>
                <p className="small">{lbl}</p>
                <p className="kpi-value" style={{ color: SEGMENT_COLORS[lbl]?.border }}>{s.count}</p>
                <p className="small">{s.percentage}% · conf {s.avg_confidence}</p>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div className="card" style={{ flex: "0 0 260px" }}>
              <div className="section-title">Segment Distribution</div>
              <canvas ref={canvasRef} />
            </div>

            <div className="card" style={{ flex: 1 }}>
              <div className="section-title">Customer List</div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>Customer</th><th>Segment</th><th>Confidence</th><th>Recommendations</th></tr>
                  </thead>
                  <tbody>
                    {result.results.map((r, i) => (
                      <tr key={i}>
                        <td>
                          <strong>{r.customer_name}</strong>
                          <br /><span className="small">{r.customer_email}</span>
                        </td>
                        <td>
                          <span className="seg-pill" style={{
                            background: SEGMENT_COLORS[r.segment_label]?.bg,
                            color: SEGMENT_COLORS[r.segment_label]?.border,
                          }}>
                            {r.segment_label}
                          </span>
                        </td>
                        <td>{(r.confidence * 100).toFixed(0)}%</td>
                        <td className="small">{r.recommendations[0]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="card empty-state">
          <p>👥 Use the tabs above to classify customers into behavioural segments
             using <strong>KMeans clustering</strong>. Each segment gets tailored
             marketing recommendations.</p>
        </div>
      )}
    </div>
  );
}

function SingleResult({ r }) {
  const col = SEGMENT_COLORS[r.segment_label] || { bg: "#eee", border: "#888" };
  return (
    <div className="card single-result" style={{ borderLeft: `4px solid ${col.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p className="small">Predicted Segment</p>
          <h2 style={{ margin: "4px 0", color: col.border }}>{r.segment_label}</h2>
          <p className="small">{r.description}</p>
        </div>
        <div className="conf-badge" style={{ background: col.bg, color: col.border }}>
          {(r.confidence * 100).toFixed(1)}%<br /><span style={{ fontSize: 10 }}>confidence</span>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 16 }}>Recommended Actions</div>
      <ul className="rec-list">
        {r.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
      </ul>

      <div className="section-title" style={{ marginTop: 16 }}>Features Used</div>
      <div className="feat-chips">
        {Object.entries(r.features_used).map(([k, v]) => (
          <span key={k} className="feat-chip">
            {k.replace(/_/g, " ")}: <strong>{typeof v === "number" ? v.toFixed(2) : v}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
