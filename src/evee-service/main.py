import os
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from engine.schemas import PatientContext, EvaluationResponse
from engine.runner import run as run_rules
from ml.features import extract_features
from ml.model import EVEEPredictor

# Configure structured logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("evee-service")

ml_predictor = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: load ML model
    global ml_predictor
    ml_predictor = EVEEPredictor()
    logger.info(f"EVEE service started. Rule set version: {os.getenv('EVEE_RULE_SET_VERSION', '1')}")
    yield
    # Shutdown (no-op)
    logger.info("EVEE service shutting down.")


app = FastAPI(
    title="EVEE - Evidence-based Virtual Evaluation Engine",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "ml_available": ml_predictor.available if ml_predictor else False
    }


@app.post("/evaluate", response_model=EvaluationResponse)
async def evaluate(patient: PatientContext):
    start_time = time.time()
    try:
        # 1. Run clinical rules
        alerts = run_rules(patient)

        # 2. Run ML prediction
        ml_score = None
        ml_label = None
        if ml_predictor and ml_predictor.available:
            features = extract_features(patient)
            ml_score, ml_label = ml_predictor.predict(features)

        elapsed = time.time() - start_time
        logger.info(
            f"Evaluation completed",
            extra={
                "patientId": patient.patientId,
                "alert_count": len(alerts),
                "ml_score": ml_score,
                "ml_label": ml_label,
                "elapsed_ms": round(elapsed * 1000)
            }
        )

        return EvaluationResponse(
            alerts=alerts,
            mlScore=ml_score,
            mlLabel=ml_label
        )
    except Exception as e:
        logger.error(f"Evaluation failed for patient {patient.patientId}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal evaluation engine error")