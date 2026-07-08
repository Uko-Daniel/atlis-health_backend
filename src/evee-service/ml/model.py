import os
import logging
import pickle
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

FEATURE_ORDER = [
    "age", "sex_encoded", "systolic_bp", "diastolic_bp", "heart_rate",
    "temperature", "spo2", "respiratory_rate", "gcs",
    "med_count", "allergy_count", "diagnosis_count",
    "has_diabetes", "has_hypertension", "has_heart_failure",
    "has_ckd", "has_malaria"
]


class EVEEPredictor:
    def __init__(self, model_path: Optional[str] = None):
        self.model = None
        self.available = False
        self._xgb_loaded = False

        # Try importing xgboost — may not be installed on Python 3.13
        try:
            import xgboost as xgb  # noqa: F401
            import numpy as np     # noqa: F401
            self._xgb_loaded = True
        except ImportError:
            logger.warning("xgboost or numpy not installed. ML predictions will be unavailable.")
            return

        if model_path is None:
            model_path = os.getenv("MODEL_PATH", "/app/ml/evee_model.pkl")

        try:
            with open(model_path, "rb") as f:
                self.model = pickle.load(f)
            self.available = True
            logger.info("XGBoost model loaded successfully.")
        except FileNotFoundError:
            logger.warning(f"Model file not found at {model_path}. ML predictions will be unavailable.")
        except Exception as e:
            logger.error(f"Failed to load model: {e}. ML predictions will be unavailable.", exc_info=True)

    def predict(self, features: dict) -> Tuple[Optional[float], Optional[str]]:
        """Return (probability, risk_label) or (None, None) if unavailable."""
        if not self.available or self.model is None or not self._xgb_loaded:
            return None, None

        try:
            import numpy as np

            # Ensure feature vector in correct order, fill missing with 0
            X = np.array([[features.get(k, 0) or 0 for k in FEATURE_ORDER]])
            prob = self.model.predict_proba(X)[0, 1]
            label = "HIGH_RISK" if prob > 0.7 else ("MODERATE_RISK" if prob >= 0.4 else "LOW_RISK")
            return float(prob), label
        except Exception as e:
            logger.error(f"Prediction failed: {e}", exc_info=True)
            return None, None