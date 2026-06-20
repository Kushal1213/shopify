import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useShop } from "../hooks/useShop";

const NAV_LINKS = [
  { to: "/", label: "Command" },
  { to: "/analytics", label: "Analytics" },
  { to: "/products", label: "Products" },
  { to: "/customers", label: "Customers" },
  { to: "/orders", label: "Orders" },
];

const ML_LINKS = [
  { to: "/ml/forecast", label: "Forecast" },
  { to: "/ml/segment", label: "Segments" },
];

const PROVIDERS = [
  { name: "WooCommerce", tone: "violet", mark: "W" },
  { name: "BigCommerce", tone: "blue", mark: "B" },
  { name: "Wix Stores", tone: "black", mark: "W" },
  { name: "Squarespace", tone: "charcoal", mark: "S" },
  { name: "Magento", tone: "coral", mark: "M" },
];

function ShopifyMark({ className = "" }) {
  return (
    <span className={`shopify-mark ${className}`} aria-label="Shopify integration">
      <span className="bag-handle" />
      <span className="bag-body">S</span>
    </span>
  );
}

function ProviderLogo({ provider }) {
  return (
    <div className={`provider-logo ${provider.tone}`} aria-hidden="true">
      {provider.mark}
    </div>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const shop = useShop();
  const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

  useEffect(() => {
    if (!shop) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/check-auth?shop=${shop}`);
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok || !contentType.includes("application/json")) return;
        const { authenticated } = await res.json();
        if (!authenticated) window.top.location.href = `${API_BASE}/auth?shop=${shop}`;
      } catch (err) {
        console.error("Auth check failed:", err);
      }
    })();
  }, [shop, API_BASE]);

  const buildUrl = (to) => `${to}?shop=${encodeURIComponent(shop || "")}`;
  const linkClass = (to) =>
    ["nav-link", location.pathname === to ? "active" : ""].filter(Boolean).join(" ");

  return (
    <div className="app-body">
      <div className="ambient-grid" />
      <div className="container">
        <header className="brand-shell">
          <nav className="topbar" aria-label="Primary navigation">
            <Link className="brand-lockup" to={buildUrl("/")}>
              <ShopifyMark />
              <span>
                <strong>Xeno Commerce OS</strong>
                <small>Built for Shopify</small>
              </span>
            </Link>

            <div className="nav-pills">
              {NAV_LINKS.map(({ to, label }) => (
                <Link key={to} className={linkClass(to)} to={buildUrl(to)}>
                  {label}
                </Link>
              ))}
            </div>
          </nav>

          <section className="hero-panel">
            <div className="hero-copy">
              <div className="eyebrow">
                <ShopifyMark className="mini" />
                Shopify-native growth workspace
              </div>
              <h1>Run your Shopify store from one intelligent command center.</h1>
              <p>
                Xeno unifies orders, customers, products, revenue analytics, and ML-powered
                predictions into a polished operating layer for modern commerce teams.
              </p>
              <div className="hero-actions">
                {ML_LINKS.map(({ to, label }) => (
                  <Link key={to} className="btn" to={buildUrl(to)}>
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="integration-card" aria-label="Current store integration">
              <div className="pulse-ring">
                <ShopifyMark className="large" />
              </div>
              <div>
                <span className="status-dot">Live sync</span>
                <h2>{shop || "Shopify store"}</h2>
                <p>Orders, products, and customer activity connected through Shopify APIs.</p>
              </div>
              <div className="signal-bars" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </section>
        </header>

        <main className="page-surface">{children}</main>

        <section className="provider-band" aria-label="Upcoming commerce integrations">
          <div className="provider-copy">
            <span className="section-kicker">Multi-store roadmap</span>
            <h2>More store providers coming soon</h2>
            <p>Shopify is live today. These commerce platforms are next in the integration queue.</p>
          </div>
          <div className="provider-grid">
            {PROVIDERS.map((provider) => (
              <div key={provider.name} className="provider-card">
                <ProviderLogo provider={provider} />
                <span>{provider.name}</span>
                <small>Coming soon</small>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
