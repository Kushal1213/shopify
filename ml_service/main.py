"""
main.py  –  FastAPI ML Microservice
====================================
Loads pre-trained models once at startup (no cold-load per request)
and exposes REST endpoints for:

  POST /predict/sales          → 30-day sales forecast
  POST /predict/sales/batch    → arbitrary window forecast
  POST /segment/customer       → single customer segment
  POST /segment/customers      → batch segmentation
  GET  /models/info            → model metadata & health
  GET  /health                 → simple liveness probe
"""

import os
import math
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, date, timedelta
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Paths ──────────────────────────────────────────────────────────────────────
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

def _load(filename: str):
    path = os.path.join(MODELS_DIR, filename)
    if not os.path.exists(path):
        raise RuntimeError(
            f"Model file not found: {path}\n"
            "Run  python ml_service/train_models.py  first."
        )
    return joblib.load(path)


# ── App + CORS ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Shopify ML Service",
    description="Random Forest sales forecasting & KMeans customer segmentation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Model registry (loaded once at startup) ────────────────────────────────────
class ModelRegistry:
    forecaster       = None
    forecaster_meta  = None
    segmenter        = None
    scaler           = None
    segmenter_meta   = None
    loaded_at: str   = ""


registry = ModelRegistry()


@app.on_event("startup")
def load_models():
    print("🔄  Loading ML models …")
    registry.forecaster       = _load("sales_forecaster.joblib")
    registry.forecaster_meta  = _load("sales_forecaster_meta.joblib")
    registry.segmenter        = _load("customer_segmenter.joblib")
    registry.scaler           = _load("customer_scaler.joblib")
    registry.segmenter_meta   = _load("customer_segmenter_meta.joblib")
    registry.loaded_at        = datetime.now().isoformat()
    print("✅  Models loaded and ready.")


# ── Helper: build feature row for forecaster ──────────────────────────────────
def _date_features(d: date, marketing_spend: float,
                   prev_7d_avg: float, prev_30d_avg: float) -> dict:
    return {
        "day_of_week":      d.weekday(),
        "day_of_month":     d.day,
        "month":            d.month,
        "quarter":          (d.month - 1) // 3 + 1,
        "week_of_year":     d.isocalendar()[1],
        "is_weekend":       1 if d.weekday() >= 5 else 0,
        "is_holiday":       0,
        "marketing_spend":  marketing_spend,
        "prev_7d_avg":      prev_7d_avg,
        "prev_30d_avg":     prev_30d_avg,
    }


# ── Schemas ────────────────────────────────────────────────────────────────────

class SalesForecastRequest(BaseModel):
    start_date:       Optional[str]   = Field(None,  description="YYYY-MM-DD; defaults to today")
    days:             int             = Field(30,    ge=1, le=365)
    marketing_spend:  float           = Field(500.0, ge=0)
    prev_7d_avg:      float           = Field(500.0, ge=0)
    prev_30d_avg:     float           = Field(500.0, ge=0)


class ForecastPoint(BaseModel):
    date:             str
    predicted_sales:  float
    lower_bound:      float
    upper_bound:      float
    day_of_week:      str
    is_weekend:       bool


class SalesForecastResponse(BaseModel):
    forecast:         List[ForecastPoint]
    total_predicted:  float
    avg_daily:        float
    peak_day:         str
    peak_value:       float
    model_r2:         float


class CustomerRequest(BaseModel):
    total_spent:            float = Field(..., ge=0)
    order_count:            int   = Field(..., ge=0)
    days_since_last_order:  int   = Field(..., ge=0)
    avg_order_value:        float = Field(..., ge=0)
    unique_products:        int   = Field(1,   ge=0)
    return_rate:            float = Field(0.0, ge=0, le=1)


class SegmentResult(BaseModel):
    segment_id:    int
    segment_label: str
    confidence:    float
    description:   str
    features_used: dict
    recommendations: List[str]


class BatchSegmentRequest(BaseModel):
    customers: List[CustomerRequest]


class BatchSegmentResponse(BaseModel):
    results:          List[SegmentResult]
    segment_summary:  dict


# ── Endpoint: health ───────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": registry.forecaster is not None,
        "loaded_at": registry.loaded_at,
    }


# ── Endpoint: model info ───────────────────────────────────────────────────────
@app.get("/models/info")
def models_info():
    fm = registry.forecaster_meta or {}
    sm = registry.segmenter_meta  or {}
    return {
        "forecaster": {
            "algorithm":    "Random Forest Regressor",
            "n_estimators": fm.get("n_estimators"),
            "features":     fm.get("features"),
            "mae":          round(fm.get("mae", 0), 2),
            "r2":           round(fm.get("r2",  0), 4),
            "trained_at":   fm.get("trained_at"),
            "top_features": sorted(
                fm.get("feature_importances", {}).items(),
                key=lambda x: x[1], reverse=True
            )[:5],
        },
        "segmenter": {
            "algorithm":   "KMeans Clustering",
            "n_clusters":  sm.get("n_clusters"),
            "features":    sm.get("features"),
            "silhouette":  round(sm.get("silhouette", 0), 4),
            "inertia":     round(sm.get("inertia",    0), 2),
            "trained_at":  sm.get("trained_at"),
            "label_map":   sm.get("label_map"),
        },
    }


# ── Endpoint: sales forecast ───────────────────────────────────────────────────
@app.post("/predict/sales", response_model=SalesForecastResponse)
def predict_sales(req: SalesForecastRequest):
    if registry.forecaster is None:
        raise HTTPException(503, "Models not loaded")

    start = (date.today() if req.start_date is None
             else date.fromisoformat(req.start_date))
    features  = registry.forecaster_meta["features"]
    day_names = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

    rows, predictions = [], []
    prev7  = req.prev_7d_avg
    prev30 = req.prev_30d_avg

    for i in range(req.days):
        d = start + timedelta(days=i)
        row = _date_features(d, req.marketing_spend, prev7, prev30)
        rows.append(row)

        df_row = pd.DataFrame([row])[features]
        pred = float(registry.forecaster.predict(df_row)[0])
        pred = max(pred, 0)

        # Approximate prediction interval from tree variance
        tree_preds = np.array([t.predict(df_row)[0] for t in registry.forecaster.estimators_])
        std = float(tree_preds.std())
        lower = max(pred - 1.96 * std, 0)
        upper = pred + 1.96 * std

        predictions.append(ForecastPoint(
            date             = d.isoformat(),
            predicted_sales  = round(pred,  2),
            lower_bound      = round(lower, 2),
            upper_bound      = round(upper, 2),
            day_of_week      = day_names[d.weekday()],
            is_weekend       = d.weekday() >= 5,
        ))

        # Rolling update for next iteration
        prev7  = (prev7  * 6 + pred) / 7
        prev30 = (prev30 * 29 + pred) / 30

    vals    = [p.predicted_sales for p in predictions]
    peak_i  = int(np.argmax(vals))

    return SalesForecastResponse(
        forecast         = predictions,
        total_predicted  = round(sum(vals), 2),
        avg_daily        = round(sum(vals) / len(vals), 2),
        peak_day         = predictions[peak_i].date,
        peak_value       = round(vals[peak_i], 2),
        model_r2         = round(registry.forecaster_meta.get("r2", 0), 4),
    )


# ── Endpoint: batch sales forecast ────────────────────────────────────────────
@app.post("/predict/sales/batch")
def predict_sales_batch(req: SalesForecastRequest):
    """Alias for /predict/sales; kept for semantic clarity."""
    return predict_sales(req)


# ── Shared segmentation logic ──────────────────────────────────────────────────
SEGMENT_DESCRIPTIONS = {
    "Low Value":  "Occasional, low-spending customers. High churn risk.",
    "Mid Value":  "Regular shoppers with moderate spend. Growth potential.",
    "High Value": "Loyal, high-spending customers. Retain at all costs.",
}

SEGMENT_RECOMMENDATIONS = {
    "Low Value": [
        "Send a re-engagement email campaign",
        "Offer a first-time discount on next purchase",
        "Showcase popular/trending products",
        "Add to a win-back automation sequence",
    ],
    "Mid Value": [
        "Enrol in a loyalty rewards programme",
        "Cross-sell complementary product categories",
        "Offer free shipping threshold incentives",
        "Send curated product recommendations",
    ],
    "High Value": [
        "Invite to a VIP or early-access programme",
        "Provide dedicated customer support",
        "Offer exclusive bundles or limited editions",
        "Request reviews / referrals with reward",
    ],
}


def _segment_one(customer: CustomerRequest) -> SegmentResult:
    features = registry.segmenter_meta["features"]
    label_map = registry.segmenter_meta["label_map"]

    row = np.array([[
        customer.total_spent,
        customer.order_count,
        customer.days_since_last_order,
        customer.avg_order_value,
        customer.unique_products,
        customer.return_rate,
    ]])

    scaled    = registry.scaler.transform(row)
    cluster   = int(registry.segmenter.predict(scaled)[0])
    distances = registry.segmenter.transform(scaled)[0]

    # Softmax confidence over negative distances
    neg_d  = -distances
    exp_d  = np.exp(neg_d - neg_d.max())
    conf   = float(exp_d[cluster] / exp_d.sum())

    label = label_map.get(cluster, f"Cluster {cluster}")

    return SegmentResult(
        segment_id    = cluster,
        segment_label = label,
        confidence    = round(conf, 4),
        description   = SEGMENT_DESCRIPTIONS.get(label, ""),
        features_used = {
            "total_spent":           customer.total_spent,
            "order_count":           customer.order_count,
            "days_since_last_order": customer.days_since_last_order,
            "avg_order_value":       customer.avg_order_value,
            "unique_products":       customer.unique_products,
            "return_rate":           customer.return_rate,
        },
        recommendations = SEGMENT_RECOMMENDATIONS.get(label, []),
    )


# ── Endpoint: single customer segmentation ────────────────────────────────────
@app.post("/segment/customer", response_model=SegmentResult)
def segment_customer(customer: CustomerRequest):
    if registry.segmenter is None:
        raise HTTPException(503, "Models not loaded")
    return _segment_one(customer)


# ── Endpoint: batch customer segmentation ─────────────────────────────────────
@app.post("/segment/customers", response_model=BatchSegmentResponse)
def segment_customers(req: BatchSegmentRequest):
    if registry.segmenter is None:
        raise HTTPException(503, "Models not loaded")
    if not req.customers:
        raise HTTPException(400, "customers list is empty")

    results = [_segment_one(c) for c in req.customers]

    summary: dict = {}
    for r in results:
        lbl = r.segment_label
        if lbl not in summary:
            summary[lbl] = {"count": 0, "avg_confidence": 0.0}
        summary[lbl]["count"]          += 1
        summary[lbl]["avg_confidence"] += r.confidence

    for lbl in summary:
        cnt = summary[lbl]["count"]
        summary[lbl]["avg_confidence"] = round(summary[lbl]["avg_confidence"] / cnt, 4)
        summary[lbl]["percentage"]     = round(cnt / len(results) * 100, 1)

    return BatchSegmentResponse(results=results, segment_summary=summary)


# ── Dev entry point ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
