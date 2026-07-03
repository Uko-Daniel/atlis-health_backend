from engine.utils import fuzzy_match, drug_in_meds, any_drug_in_class

RULES = [
    {
        "id": "ALLERGY-001",
        "domain": "ALLERGY",
        "severity": "CRITICAL",
        "condition": lambda ctx: any(
            any(drug_in_meds(allergy.substance, ctx.currentMedications) for allergy in ctx.allergies)
        ),
        "message": lambda ctx: _allergy_001_msg(ctx),
        "recommendation": "Stop the offending medication immediately. Choose alternative from a different drug class."
    },
    {
        "id": "ALLERGY-002",
        "domain": "ALLERGY",
        "severity": "HIGH",
        "condition": lambda ctx: (
            any("penicillin" in a.substance.lower() for a in ctx.allergies) and
            any_drug_in_class("Cephalosporin", ctx.currentMedications)
        ),
        "message": lambda ctx: _allergy_002_msg(ctx),
        "recommendation": "Cephalosporins carry ~1-2% cross-reactivity risk with penicillin allergy. Use with caution or choose non-beta-lactam alternative."
    },
    {
        "id": "ALLERGY-003",
        "domain": "ALLERGY",
        "severity": "HIGH",
        "condition": lambda ctx: (
            any("sulfonamide" in a.substance.lower() or "sulfa" in a.substance.lower() for a in ctx.allergies) and
            any_drug_in_class("Sulfonamide", ctx.currentMedications)
        ),
        "message": lambda ctx: _allergy_003_msg(ctx),
        "recommendation": "Avoid sulfonamide antibiotics in patients with documented sulfonamide allergy. Non-sulfa alternatives should be used."
    },
    {
        "id": "ALLERGY-004",
        "domain": "ALLERGY",
        "severity": "HIGH",
        "condition": lambda ctx: (
            any("nsaid" in a.substance.lower() or "aspirin" in a.substance.lower() for a in ctx.allergies) and
            any_drug_in_class("NSAID", ctx.currentMedications)
        ),
        "message": lambda ctx: _allergy_004_msg(ctx),
        "recommendation": "NSAIDs are contraindicated. Consider paracetamol or other non-NSAID analgesics."
    },
    {
        "id": "ALLERGY-005",
        "domain": "ALLERGY",
        "severity": "MODERATE",
        "condition": lambda ctx: _allergy_class_cross_reactive(ctx),
        "message": lambda ctx: _allergy_005_msg(ctx),
        "recommendation": "Avoid medications in the same drug class. Select a structurally unrelated alternative."
    }
]


def _allergy_001_msg(ctx):
    matched = []
    for allergy in ctx.allergies:
        for med in ctx.currentMedications:
            if fuzzy_match(allergy.substance, med.name):
                matched.append(med.name)
    return f"Patient has documented allergy to {', '.join(set(matched))} which is currently prescribed."


def _allergy_002_msg(ctx):
    return "Patient has penicillin allergy and is prescribed a cephalosporin — risk of cross-reactivity."


def _allergy_003_msg(ctx):
    return "Patient has sulfonamide allergy and is prescribed a sulfonamide antibiotic."


def _allergy_004_msg(ctx):
    return "Patient has NSAID/aspirin sensitivity and is currently prescribed an NSAID."


def _allergy_005_msg(ctx):
    return "Drug class cross-reactivity detected between allergy and current medication."


def _allergy_class_cross_reactive(ctx):
    """Check if any allergy drugClass matches a current medication class."""
    from engine.utils import DRUG_CLASS_MAP
    for allergy in ctx.allergies:
        if allergy.drugClass and allergy.drugClass in DRUG_CLASS_MAP:
            if any_drug_in_class(allergy.drugClass, ctx.currentMedications):
                return True
    return False