from engine.schemas import PatientContext

def extract_features(patient: PatientContext) -> dict:
    """Extract flat feature vector for XGBoost model."""
    demo = patient.demographics
    vitals = patient.vitals

    # Demographics
    age = demo.age
    sex_encoded = 1 if demo.sex == "MALE" else 0  # binary male/female, OTHER encoded as 0

    # Vitals
    systolic_bp = vitals.systolicBP if vitals else None
    diastolic_bp = vitals.diastolicBP if vitals else None
    heart_rate = vitals.heartRate if vitals else None
    temperature = vitals.temperature if vitals else None
    spo2 = vitals.spO2 if vitals else None
    respiratory_rate = vitals.respiratoryRate if vitals else None
    gcs = vitals.gcs if vitals else None

    # Counts
    med_count = len(patient.currentMedications)
    allergy_count = len(patient.allergies)
    diagnosis_count = len(patient.medicalHistory)

    # Comorbidities from medical history
    has_diabetes = _has_condition(patient.medicalHistory, ["diabetes", "type 2 diabetes", "type 1 diabetes"])
    has_hypertension = _has_condition(patient.medicalHistory, ["hypertension", "elevated blood pressure"])
    has_heart_failure = _has_condition(patient.medicalHistory, ["heart failure", "congestive heart failure"])
    has_ckd = _has_condition(patient.medicalHistory, ["chronic kidney disease", "ckd", "renal failure"])
    has_malaria = _has_condition(patient.medicalHistory, ["malaria", "plasmodium"])

    features = {
        "age": age,
        "sex_encoded": sex_encoded,
        "systolic_bp": systolic_bp,
        "diastolic_bp": diastolic_bp,
        "heart_rate": heart_rate,
        "temperature": temperature,
        "spo2": spo2,
        "respiratory_rate": respiratory_rate,
        "gcs": gcs,
        "med_count": med_count,
        "allergy_count": allergy_count,
        "diagnosis_count": diagnosis_count,
        "has_diabetes": int(has_diabetes),
        "has_hypertension": int(has_hypertension),
        "has_heart_failure": int(has_heart_failure),
        "has_ckd": int(has_ckd),
        "has_malaria": int(has_malaria),
    }
    return features


def _has_condition(history, keywords):
    for h in history:
        name_lower = h.name.lower()
        if any(kw in name_lower for kw in keywords):
            return True
    return False