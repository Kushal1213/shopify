"""
train_models.py
---------------
Generates synthetic Shopify-like sales data, trains:
  1. Random Forest Regressor  → sales forecasting
  2. KMeans Clustering        → customer segmentation
and serialises both to /models/*.joblib so the FastAPI service
can load them at startup.

Run once before starting the API server:
    python ml_service/train_models.py
"""

import os
import numpy as np
import pandas as pd
import joblib
from datetime import datetime, timedelta

from sklearn.ensemble import RandomForestRegressor
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score, silhouette_score

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

RANDOM_STATE = 42
np.random.seed(RANDOM_STATE)

# ── 1. Synthetic data generation ──────────────────────────────────────────────

def generate_sales_data(n_days: int = 730) -> pd.DataFrame:
    """Two years of daily sales with realistic seasonality + trends."""
    base_date = datetime(2023, 1, 1)
    dates = [base_date + timedelta(days=i) for i in range(n_days)]

    trend      = np.linspace(0, 200, n_days)
    weekly     = 80  * np.sin(2 * np.pi * np.arange(n_days) / 7)
    monthly    = 120 * np.sin(2 * np.pi * np.arange(n_days) / 30)
    quarterly  = 200 * np.sin(2 * np.pi * np.arange(n_days) / 90)
    noise      = np.random.normal(0, 50, n_days)

    sales = 500 + trend + weekly + monthly + quarterly + noise
    sales = np.maximum(sales, 50)   # floor at 50

    df = pd.DataFrame({
        "date":          dates,
        "day_of_week":   [d.weekday()       for d in dates],
        "day_of_month":  [d.day             for d in dates],
        "month":         [d.month           for d in dates],
        "quarter":       [(d.month - 1)//3 + 1 for d in dates],
        "week_of_year":  [d.isocalendar()[1] for d in dates],
        "is_weekend":    [1 if d.weekday() >= 5 else 0 for d in dates],
        "is_holiday":    np.random.choice([0, 1], n_days, p=[0.95, 0.05]),
        "marketing_spend": np.random.uniform(100, 1000, n_days),
        "prev_7d_avg":   pd.Series(sales).rolling(7,  min_periods=1).mean().values,
        "prev_30d_avg":  pd.Series(sales).rolling(30, min_periods=1).mean().values,
        "sales":         sales,
    })
    return df


def generate_customer_data(n_customers: int = 500) -> pd.DataFrame:
    """Customer purchase behaviour for segmentation."""
    # Three natural clusters: low, medium, high value
    groups = np.random.choice(["low", "mid", "high"], n_customers, p=[0.5, 0.35, 0.15])

    params = {
        "low":  dict(spend=(50,  200),  freq=(1, 5),   recency=(60, 365)),
        "mid":  dict(spend=(200, 800),  freq=(5, 15),  recency=(14, 90)),
        "high": dict(spend=(800, 3000), freq=(15, 50), recency=(1, 30)),
    }

    records = []
    for g in groups:
        p = params[g]
        records.append({
            "total_spent":    np.random.uniform(*p["spend"]),
            "order_count":    np.random.randint(*p["freq"]),
            "days_since_last_order": np.random.randint(*p["recency"]),
            "avg_order_value": np.random.uniform(p["spend"][0]/p["freq"][1],
                                                  p["spend"][1]/p["freq"][0]),
            "unique_products":    np.random.randint(1, 20),
            "return_rate":        np.random.uniform(0, 0.3),
            "true_group": g,  # for evaluation only
        })

    return pd.DataFrame(records)


# ── 2. Train Random Forest Regressor ──────────────────────────────────────────

def train_forecaster(df: pd.DataFrame):
    FEATURES = [
        "day_of_week", "day_of_month", "month", "quarter",
        "week_of_year", "is_weekend", "is_holiday",
        "marketing_spend", "prev_7d_avg", "prev_30d_avg",
    ]

    X, y = df[FEATURES], df["sales"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, shuffle=False)

    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=4,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(X_tr, y_tr)

    preds = model.predict(X_te)
    print(f"[Forecaster] MAE={mean_absolute_error(y_te, preds):.2f}  R²={r2_score(y_te, preds):.4f}")

    meta = {
        "features": FEATURES,
        "mae": float(mean_absolute_error(y_te, preds)),
        "r2":  float(r2_score(y_te, preds)),
        "trained_at": datetime.utcnow().isoformat(),
        "n_estimators": 200,
        "feature_importances": dict(zip(FEATURES, model.feature_importances_.tolist())),
    }

    joblib.dump(model, os.path.join(MODELS_DIR, "sales_forecaster.joblib"))
    joblib.dump(meta,  os.path.join(MODELS_DIR, "sales_forecaster_meta.joblib"))
    print("[Forecaster] Saved → models/sales_forecaster.joblib")
    return model, meta


# ── 3. Train KMeans Clustering ────────────────────────────────────────────────

N_CLUSTERS = 3

def train_segmenter(df: pd.DataFrame):
    FEATURES = [
        "total_spent", "order_count", "days_since_last_order",
        "avg_order_value", "unique_products", "return_rate",
    ]

    X = df[FEATURES]
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = KMeans(n_clusters=N_CLUSTERS, random_state=RANDOM_STATE, n_init=20)
    labels = model.fit_predict(X_scaled)

    sil = silhouette_score(X_scaled, labels)
    print(f"[Segmenter]  Silhouette={sil:.4f}  Inertia={model.inertia_:.2f}")

    # Label clusters semantically by mean total_spent
    cluster_means = pd.DataFrame(X).assign(cluster=labels).groupby("cluster")[FEATURES[0]].mean()
    rank = cluster_means.rank().astype(int)
    label_map = {idx: ["Low Value", "Mid Value", "High Value"][rank[idx]-1]
                 for idx in range(N_CLUSTERS)}

    meta = {
        "features":    FEATURES,
        "n_clusters":  N_CLUSTERS,
        "silhouette":  float(sil),
        "inertia":     float(model.inertia_),
        "label_map":   label_map,
        "trained_at":  datetime.utcnow().isoformat(),
        "cluster_centers": model.cluster_centers_.tolist(),
    }

    joblib.dump(model,  os.path.join(MODELS_DIR, "customer_segmenter.joblib"))
    joblib.dump(scaler, os.path.join(MODELS_DIR, "customer_scaler.joblib"))
    joblib.dump(meta,   os.path.join(MODELS_DIR, "customer_segmenter_meta.joblib"))
    print("[Segmenter]  Saved → models/customer_segmenter.joblib")
    return model, scaler, meta


# ── 4. Entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Generating synthetic training data …")
    sales_df    = generate_sales_data(730)
    customer_df = generate_customer_data(500)

    print("\nTraining Random Forest Regressor …")
    train_forecaster(sales_df)

    print("\nTraining KMeans Clusterer …")
    train_segmenter(customer_df)

    print("\n✅  All models trained and serialised to ml_service/models/")
