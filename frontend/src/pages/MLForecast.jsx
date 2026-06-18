import { useState, useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";
import { useShop } from "../hooks/useShop";
import "./MLForecast.css";

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

export default function MLForecast() {
  const shop = useShop();
  const chartRef  = useRef(null);
  const canvasRef = useRef(null);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [result, setResult]     = useState(null);
  const [modelInfo, setModelInfo] = useState(null);

  const [params, setParams] = useState({
    days: 30,
    marketing_spend: 500,
    prev_7d_avg: 500,
    prev_30d_avg: 500,
    start_date: new Date().toISOString().split("T")[0],
  });

  /* load model metadata once */
  useEffect(() => {
    fetch(`${API_BASE}/api/ml/models/info`)
      .then(r => r.json())
      .then(setModelInfo)
      .catch(() => {});
  }, []);

  /* render chart whenever result changes */
  useEffect(() => {
    if (!result || !canvasRef.current) return;
    chartRef.current?.destroy();

    const labels = result.forecast.map(p => p.date);
    const preds  = result.forecast.map(p => p.predicted_sales);
    const lower  = result.forecast.map(p => p.lower_bound);
    const upper  = result.forecast.map(p => p.upper_bound);

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Predicted Sales (₹)",
            data: preds,
            borderColor: "#008060",
            backgroundColor: "rgba(0,128,96,0.08)",
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 3,
          },
          {
            label: "Upper Bound",
            data: upper,
            borderColor: "rgba(0,128,96,0.3)",
            borderDash: [4, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
          {
            label: "Lower Bound",
            data: lower,
            borderColor: "rgba(0,128,96,0.3)",
            borderDash: [4, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: "1",
            backgroundColor: "rgba(0,128,96,0.05)",
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top" },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ₹${Number(ctx.parsed.y).toFixed(2)}`,
            },
          },
        },
        scales: {
          y: { title: { display: true, text: "Sales (₹)" } },
          x: { ticks: { maxTicksLimit: 12 } },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [result]);

  async function runForecast() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ml/predict/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days:            Number(params.days),
          marketing_spend: Number(params.marketing_spend),
          prev_7d_avg:     Number(params.prev_7d_avg),
          prev_30d_avg:    Number(params.prev_30d_avg),
          start_date:      params.start_date,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "API error");
      setResult(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const fm = modelInfo?.forecaster;

  return (
    <div className="ml-page">

      {/* Model info banner */}
      {fm && (
        <div className="model-badge">
          <span className="badge-icon">🤖</span>
          <span>
            <strong>Random Forest Regressor</strong> · {fm.n_estimators} trees ·
            R² {fm.r2} · MAE ₹{fm.mae}
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="card ml-controls">
        <div className="section-title">Forecast Parameters</div>
        <div className="controls-grid">
          <label>
            Start Date
            <input type="date" value={params.start_date}
              onChange={e => setParams(p => ({ ...p, start_date: e.target.value }))} />
          </label>
          <label>
            Forecast Days
            <input type="number" min={1} max={365} value={params.days}
              onChange={e => setParams(p => ({ ...p, days: e.target.value }))} />
          </label>
          <label>
            Marketing Spend (₹)
            <input type="number" min={0} value={params.marketing_spend}
              onChange={e => setParams(p => ({ ...p, marketing_spend: e.target.value }))} />
          </label>
          <label>
            Prev 7-day Avg Sales (₹)
            <input type="number" min={0} value={params.prev_7d_avg}
              onChange={e => setParams(p => ({ ...p, prev_7d_avg: e.target.value }))} />
          </label>
          <label>
            Prev 30-day Avg Sales (₹)
            <input type="number" min={0} value={params.prev_30d_avg}
              onChange={e => setParams(p => ({ ...p, prev_30d_avg: e.target.value }))} />
          </label>
        </div>
        <button className="btn run-btn" onClick={runForecast} disabled={loading}>
          {loading ? "Running forecast…" : "▶ Run Forecast"}
        </button>
        {error && <p className="ml-error">⚠ {error}</p>}
      </div>

      {/* Results */}
      {result && (
        <>
          <div className="kpi-row">
            {[
              { label: "Total Predicted",  value: `₹${Number(result.total_predicted).toLocaleString()}` },
              { label: "Daily Average",    value: `₹${Number(result.avg_daily).toLocaleString()}` },
              { label: "Peak Day",         value: result.peak_day },
              { label: "Peak Value",       value: `₹${Number(result.peak_value).toLocaleString()}` },
              { label: "Model R²",         value: result.model_r2 },
            ].map(({ label, value }) => (
              <div key={label} className="card kpi-card">
                <p className="small">{label}</p>
                <p className="kpi-value">{value}</p>
              </div>
            ))}
          </div>

          <div className="card chart-card">
            <div className="section-title">
              {params.days}-Day Sales Forecast with 95% Confidence Interval
            </div>
            <canvas ref={canvasRef} height={100} />
          </div>

          {/* Feature importances */}
          {fm?.top_features && (
            <div className="card">
              <div className="section-title">Top Predictive Features</div>
              <div className="feat-list">
                {fm.top_features.map(([name, imp]) => (
                  <div key={name} className="feat-row">
                    <span className="feat-name">{name.replace(/_/g, " ")}</span>
                    <div className="feat-bar-wrap">
                      <div className="feat-bar" style={{ width: `${(imp * 100).toFixed(1)}%` }} />
                    </div>
                    <span className="feat-pct">{(imp * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data table */}
          <div className="card">
            <div className="section-title">Day-by-Day Breakdown</div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Day</th><th>Weekend</th>
                    <th>Predicted (₹)</th><th>Lower (₹)</th><th>Upper (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.forecast.map(p => (
                    <tr key={p.date} className={p.is_weekend ? "weekend-row" : ""}>
                      <td>{p.date}</td>
                      <td>{p.day_of_week}</td>
                      <td>{p.is_weekend ? "🌅" : "—"}</td>
                      <td><strong>₹{p.predicted_sales.toLocaleString()}</strong></td>
                      <td className="bound-cell">₹{p.lower_bound.toLocaleString()}</td>
                      <td className="bound-cell">₹{p.upper_bound.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="card empty-state">
          <p>📈 Configure parameters above and click <strong>Run Forecast</strong> to generate a
             machine learning sales prediction powered by Random Forest regression.</p>
        </div>
      )}
    </div>
  );
}
