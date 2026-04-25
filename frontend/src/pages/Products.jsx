import { useShop } from "../hooks/useShop";
import { useFetch } from "../hooks/useFetch";
import "./Products.css";

export default function Products() {
  const shop = useShop();
  const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

  const { data: products, loading, error } = useFetch(
    shop ? `${API_BASE}/api/products?shop=${shop}` : null
  );

  if (!shop) return <p className="products-error">Open this app from inside Shopify admin.</p>;
  if (loading) return <p className="products-loading">⏳ Loading products…</p>;
  if (error)   return <p className="products-error">Error: {error}</p>;

  return (
    <div className="products-container">
      <h3 className="products-title">Products ({products?.length ?? 0})</h3>

      {!products?.length && <p className="products-empty">No products found.</p>}

      <div className="products-grid">
        {(products ?? []).map(({ node }) => {
          const image = node?.images?.edges?.[0]?.node?.transformedSrc ?? null;
          const price = node?.variants?.edges?.[0]?.node?.price ?? "N/A";

          return (
            <div key={node.id} className="product-card">
              {image && (
                <img className="product-image" src={image} alt={node.title} />
              )}
              <h4 className="product-title">{node.title}</h4>
              <p className="product-price">₹{price}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
