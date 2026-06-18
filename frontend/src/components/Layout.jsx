import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useShop } from "../hooks/useShop";

const NAV_LINKS = [
  { to: "/",             label: "Home",      primary: true },
  { to: "/analytics",   label: "Analytics"              },
  { to: "/products",    label: "Products"               },
  { to: "/customers",   label: "Customers"              },
  { to: "/orders",      label: "Orders"                 },
];

const ML_LINKS = [
  { to: "/ml/forecast", label: "📈 Sales Forecast" },
  { to: "/ml/segment",  label: "👥 Segmentation"   },
];

export default function Layout({ children }) {
  const location = useLocation();
  const shop = useShop();
  const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

  useEffect(() => {
    if (!shop) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/check-auth?shop=${shop}`);
        const { authenticated } = await res.json();
        if (!authenticated) window.top.location.href = `${API_BASE}/auth?shop=${shop}`;
      } catch (err) {
        console.error("Auth check failed:", err);
      }
    })();
  }, [shop, API_BASE]);

  const linkClass = (to) =>
    ["btn", "secondary", location.pathname === to ? "active" : ""].filter(Boolean).join(" ");

  return (
    <div className="app-body">
      <div className="container">
        <header className="app-header">
          <div>
            <h1>Xeno Pro Dashboard</h1>
            <h2>Store: {shop || "Unknown Store"}</h2>
          </div>
        </header>

        <div className="card">
          <div className="section-title">Navigation</div>
          <div className="btn-row">
            {NAV_LINKS.map(({ to, label, primary }) => (
              <Link key={to}
                className={["btn", primary ? "" : "secondary", location.pathname === to ? "active" : ""].filter(Boolean).join(" ")}
                to={`${to}?shop=${encodeURIComponent(shop)}`}>
                {label}
              </Link>
            ))}
          </div>

          <div className="section-title" style={{ marginTop: 14 }}>
            🤖 Machine Learning
          </div>
          <div className="btn-row">
            {ML_LINKS.map(({ to, label }) => (
              <Link key={to} className={linkClass(to)}
                to={`${to}?shop=${encodeURIComponent(shop)}`}
                style={location.pathname === to ? { borderColor: "#008060", color: "#008060" } : {}}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        <main style={{ marginTop: 16 }}>{children}</main>
      </div>
    </div>
  );
}
