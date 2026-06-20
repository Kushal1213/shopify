import { useShop } from "../hooks/useShop";
import { useFetch } from "../hooks/useFetch";
import "./Orders.css";

const STATUS_LABELS = {
  paid: "Paid",
  pending: "Pending",
  refunded: "Refunded",
  voided: "Voided",
};

export default function Orders() {
  const shop = useShop();
  const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

  const { data: orders, loading, refetch } = useFetch(
    shop ? `${API_BASE}/api/orders?shop=${shop}` : null
  );

  return (
    <div className="orders-container">
      <div className="orders-header">
        <div>
          <span className="section-kicker">Order operations</span>
          <h2>Orders for {shop || "your store"}</h2>
        </div>
        <button className="btn refresh-btn" onClick={refetch} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading && <p className="loading">Loading...</p>}

      {!loading && !orders?.length && (
        <p className="no-orders">No orders yet. Orders will appear here after a Shopify webhook fires.</p>
      )}

      {!!orders?.length && (
        <div className="table-scroll">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Product</th>
                <th>Customer</th>
                <th>Email</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_id}>
                  <td>{o.order_name}</td>
                  <td>{o.product_name}</td>
                  <td>{o.customer_name}</td>
                  <td>{o.customer_email}</td>
                  <td>INR {Number(o.total_price).toFixed(2)}</td>
                  <td>
                    <span className={`status-badge ${o.status}`}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                  <td>{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
