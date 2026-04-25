import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useShop } from "../hooks/useShop";

const NAV_LINKS = [
  { to: "/",          label: "Home",      primary: true  },
  { to: "/analytics", label: "Analytics"               },
  { to: "/products",  label: "Products"                },
  { to: "/customers", label: "Customers"               },
  { to: "/orders",    label: "Orders"                  },
];

export default function Layout({ children }) {
  const location = useLocation();
  const shop = useShop();
  const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

  // Auto-auth check: redirect to OAuth if app is not installed for this shop
  useEffect(() => {
    if (!shop) return;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/check-auth?shop=${shop}`);
        const { authenticated } = await res.json();
        if (!authenticated) {
          window.top.location.href = `${API_BASE}/auth?shop=${shop}`;
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      }
    })();
  }, [shop, API_BASE]);

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
          <div className="section-title">Quick navigation</div>
          <p className="small">Choose what you want to view for this store.</p>

          <div className="btn-row">
            {NAV_LINKS.map(({ to, label, primary }) => {
              const isActive = location.pathname === to;
              const cls = ["btn", primary ? "" : "secondary", isActive ? "active" : ""]
                .filter(Boolean)
                .join(" ");
              return (
                <Link key={to} className={cls} to={`${to}?shop=${encodeURIComponent(shop)}`}>
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        <main style={{ marginTop: 16 }}>{children}</main>
      </div>
    </div>
  );
}
