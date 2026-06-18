#!/usr/bin/env bash
# start_ml.sh – Train models (if needed) then start the FastAPI ML service
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ML_DIR="$SCRIPT_DIR/ml_service"
MODELS_DIR="$ML_DIR/models"

echo "=== Shopify ML Service Launcher ==="

# 1. Install Python deps
echo "→ Installing Python dependencies…"
pip install -r "$ML_DIR/requirements.txt" --break-system-packages -q

# 2. Train models if they don't exist yet
if [ ! -f "$MODELS_DIR/sales_forecaster.joblib" ]; then
  echo "→ Training ML models (first run)…"
  python "$ML_DIR/train_models.py"
else
  echo "→ Pre-trained models found — skipping training."
fi

# 3. Start FastAPI
echo "→ Starting FastAPI ML service on http://localhost:8000"
echo "→ API docs at http://localhost:8000/docs"
cd "$ML_DIR"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
