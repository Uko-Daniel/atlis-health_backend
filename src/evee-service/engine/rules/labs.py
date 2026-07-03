from engine.utils import get_lab_value

RULES = [
    {
        "id": "LAB-001",
        "domain": "LAB",
        "severity": "CRITICAL",
        "condition": lambda ctx: _critical_potassium(ctx),
        "message": lambda ctx: f"Critical potassium: {get_lab_value('potassium', ctx.recentResults)} mmol/L.",
        "recommendation": "Immediate ECG and cardiac monitoring. Administer calcium gluconate if ECG changes present. Shift potassium."
    },
    {
        "id": "LAB-002",
        "domain": "LAB",
        "severity": "HIGH",
        "condition": lambda ctx: _severe_anaemia(ctx),
        "message": lambda ctx: f"Severe anaemia: Hb {get_lab_value('haemoglobin', ctx.recentResults)} g/dL.",
        "recommendation": "Consider transfusion if symptomatic. Investigate cause of anaemia."
    },
    {
        "id": "LAB-003",
        "domain": "LAB",
        "severity": "HIGH",
        "condition": lambda ctx: _critical_sodium(ctx),
        "message": lambda ctx: f"Critical sodium: {get_lab_value('sodium', ctx.recentResults)} mmol/L.",
        "recommendation": "Correct sodium cautiously to avoid osmotic demyelination. Assess fluid status."
    },
    {
        "id": "LAB-004",
        "domain": "LAB",
        "severity": "HIGH",
        "condition": lambda ctx: _critical_glucose(ctx),
        "message": lambda ctx: f"Critical glucose: {get_lab_value('glucose', ctx.recentResults)} mmol/L.",
        "recommendation": "Treat hypoglycaemia immediately with IV dextrose, or manage hyperglycaemia with insulin/fluids."
    },
    {
        "id": "LAB-005",
        "domain": "LAB",
        "severity": "MODERATE",
        "condition": lambda ctx: _elevated_creatinine(ctx),
        "message": lambda ctx: f"Elevated creatinine: {get_lab_value('creatinine', ctx.recentResults)} µmol/L.",
        "recommendation": "Review nephrotoxic medications. Assess renal function and hydration status."
    }
]


def _critical_potassium(ctx):
    val = get_lab_value('potassium', ctx.recentResults)
    return val is not None and (val > 6.5 or val < 2.5)


def _severe_anaemia(ctx):
    # Try 'haemoglobin' or 'hb' or 'hemoglobin'
    for key in ['haemoglobin', 'hb', 'hemoglobin']:
        val = get_lab_value(key, ctx.recentResults)
        if val is not None and val < 7:
            return True
    return False


def _critical_sodium(ctx):
    val = get_lab_value('sodium', ctx.recentResults)
    return val is not None and (val > 155 or val < 125)


def _critical_glucose(ctx):
    # glucose might be 'glucose' or 'blood glucose'
    for key in ['glucose', 'blood_glucose', 'blood glucose']:
        val = get_lab_value(key, ctx.recentResults)
        if val is not None and (val > 22 or val < 3.0):
            return True
    return False


def _elevated_creatinine(ctx):
    val = get_lab_value('creatinine', ctx.recentResults)
    return val is not None and val > 150