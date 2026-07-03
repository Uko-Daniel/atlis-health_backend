from engine.utils import drug_in_meds, any_drug_in_class, history_contains

RULES = [
    {
        "id": "HIST-001",
        "domain": "HISTORY",
        "severity": "HIGH",
        "condition": lambda ctx: (
            any_drug_in_class("NSAID", ctx.currentMedications) and
            history_contains("peptic ulcer", ctx.medicalHistory) or
            history_contains("GI bleed", ctx.medicalHistory)
        ),
        "message": lambda ctx: "NSAID prescribed in patient with history of peptic ulcer/GI bleed.",
        "recommendation": "Avoid NSAIDs. Use paracetamol or COX-2 inhibitor with PPI cover if absolutely necessary."
    },
    {
        "id": "HIST-002",
        "domain": "HISTORY",
        "severity": "HIGH",
        "condition": lambda ctx: (
            any_drug_in_class("NSAID", ctx.currentMedications) and
            history_contains("heart failure", ctx.medicalHistory)
        ),
        "message": lambda ctx: "NSAID prescribed in patient with heart failure — risk of fluid retention and decompensation.",
        "recommendation": "Avoid NSAIDs in heart failure. Use alternative analgesics."
    },
    {
        "id": "HIST-003",
        "domain": "HISTORY",
        "severity": "MODERATE",
        "condition": lambda ctx: (
            drug_in_meds("tramadol", ctx.currentMedications) and
            (history_contains("epilepsy", ctx.medicalHistory) or history_contains("seizure", ctx.medicalHistory))
        ),
        "message": lambda ctx: "Tramadol prescribed in patient with epilepsy/seizure history — lowers seizure threshold.",
        "recommendation": "Use alternative analgesic. If tramadol must be used, ensure anticonvulsant compliance."
    },
    {
        "id": "HIST-004",
        "domain": "HISTORY",
        "severity": "HIGH",
        "condition": lambda ctx: (
            any_drug_in_class("NonSelectiveBB", ctx.currentMedications) and
            history_contains("asthma", ctx.medicalHistory)
        ),
        "message": lambda ctx: "Non-selective beta-blocker prescribed in asthmatic patient — may precipitate bronchospasm.",
        "recommendation": "Use cardioselective beta-blocker (e.g., atenolol, bisoprolol) with caution or avoid."
    },
    {
        "id": "HIST-005",
        "domain": "HISTORY",
        "severity": "MODERATE",
        "condition": lambda ctx: (
            (any_drug_in_class("LoopDiuretic", ctx.currentMedications) or
             any_drug_in_class("ThiazideDiuretic", ctx.currentMedications)) and
            history_contains("gout", ctx.medicalHistory)
        ),
        "message": lambda ctx: "Loop/thiazide diuretic may exacerbate gout.",
        "recommendation": "Consider alternative antihypertensive. Ensure adequate hydration and urate-lowering therapy."
    }
]