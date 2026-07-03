from engine.schemas import PatientContext

RULES = [
    {
        "id": "VITALS-001",
        "domain": "VITALS",
        "severity": "CRITICAL",
        "condition": lambda ctx: (
            ctx.vitals is not None and (
                (ctx.vitals.systolicBP is not None and ctx.vitals.systolicBP >= 180) or
                (ctx.vitals.diastolicBP is not None and ctx.vitals.diastolicBP >= 120)
            )
        ),
        "message": lambda ctx: _vitals_001_msg(ctx),
        "recommendation": "Hypertensive crisis — initiate urgent antihypertensive therapy and admit."
    },
    {
        "id": "VITALS-002",
        "domain": "VITALS",
        "severity": "HIGH",
        "condition": lambda ctx: (
            ctx.vitals is not None and ctx.vitals.spO2 is not None and ctx.vitals.spO2 < 94
        ),
        "message": lambda ctx: f"SpO2 critically low: {ctx.vitals.spO2}%.",
        "recommendation": "Administer supplemental oxygen. Assess for respiratory distress or hypoxia."
    },
    {
        "id": "VITALS-003",
        "domain": "VITALS",
        "severity": "HIGH",
        "condition": lambda ctx: (
            ctx.vitals is not None and ctx.vitals.temperature is not None and
            (ctx.vitals.temperature >= 39.5 or ctx.vitals.temperature < 35.0)
        ),
        "message": lambda ctx: f"Critical temperature: {ctx.vitals.temperature}°C.",
        "recommendation": "Evaluate for sepsis/hypothermia. Initiate appropriate temperature management."
    },
    {
        "id": "VITALS-004",
        "domain": "VITALS",
        "severity": "HIGH",
        "condition": lambda ctx: (
            ctx.vitals is not None and ctx.vitals.heartRate is not None and
            (ctx.vitals.heartRate > 130 or ctx.vitals.heartRate < 40)
        ),
        "message": lambda ctx: f"Extreme heart rate: {ctx.vitals.heartRate} bpm.",
        "recommendation": "Urgent cardiac evaluation. Assess for arrhythmia, shock, or heart block."
    },
    {
        "id": "VITALS-005",
        "domain": "VITALS",
        "severity": "MODERATE",
        "condition": lambda ctx: (
            ctx.vitals is not None and ctx.vitals.respiratoryRate is not None and
            (ctx.vitals.respiratoryRate > 25 or ctx.vitals.respiratoryRate < 10)
        ),
        "message": lambda ctx: f"Abnormal respiratory rate: {ctx.vitals.respiratoryRate} breaths/min.",
        "recommendation": "Assess respiratory status. Consider ABG and monitoring."
    }
]


def _vitals_001_msg(ctx):
    sys_val = ctx.vitals.systolicBP or "?"
    dia_val = ctx.vitals.diastolicBP or "?"
    return f"Hypertensive crisis: BP {sys_val}/{dia_val} mmHg."