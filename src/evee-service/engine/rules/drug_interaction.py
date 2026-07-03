from engine.utils import drug_in_meds, any_drug_in_class

RULES = [
    {
        "id": "DDI-001",
        "domain": "DRUG_INTERACTION",
        "severity": "CRITICAL",
        "condition": lambda ctx: (
            drug_in_meds("warfarin", ctx.currentMedications) and
            any_drug_in_class("NSAID", ctx.currentMedications)
        ),
        "message": lambda ctx: "Warfarin + NSAID combination detected — major bleeding risk.",
        "recommendation": "Avoid NSAIDs. Use paracetamol for pain. Monitor INR closely."
    },
    {
        "id": "DDI-002",
        "domain": "DRUG_INTERACTION",
        "severity": "CRITICAL",
        "condition": lambda ctx: (
            any_drug_in_class("MAOI", ctx.currentMedications) and
            any_drug_in_class("SSRI", ctx.currentMedications)
        ),
        "message": lambda ctx: "MAOI + SSRI combination detected — risk of serotonin syndrome.",
        "recommendation": "Combination is contraindicated. Discontinue one agent with appropriate washout period."
    },
    {
        "id": "DDI-003",
        "domain": "DRUG_INTERACTION",
        "severity": "HIGH",
        "condition": lambda ctx: (
            drug_in_meds("metformin", ctx.currentMedications) and
            any_drug_in_class("Nephrotoxic", ctx.currentMedications)
        ),
        "message": lambda ctx: "Metformin + nephrotoxic agent (e.g., gentamicin, vancomycin) — increased risk of lactic acidosis.",
        "recommendation": "Monitor renal function and consider temporary discontinuation of metformin."
    },
    {
        "id": "DDI-004",
        "domain": "DRUG_INTERACTION",
        "severity": "HIGH",
        "condition": lambda ctx: (
            any_drug_in_class("CCB", ctx.currentMedications) and
            any_drug_in_class("Statin", ctx.currentMedications)
        ),
        "message": lambda ctx: "CCB (e.g., amlodipine, verapamil) + Statin — CYP3A4 inhibition increases statin levels, risk of rhabdomyolysis.",
        "recommendation": "Use lower statin dose and monitor for muscle symptoms."
    },
    {
        "id": "DDI-005",
        "domain": "DRUG_INTERACTION",
        "severity": "HIGH",
        "condition": lambda ctx: (
            any_drug_in_class("ACEI", ctx.currentMedications) and
            any_drug_in_class("ARB", ctx.currentMedications)
        ),
        "message": lambda ctx: "Dual RAAS blockade (ACE inhibitor + ARB) detected — risk of hyperkalaemia and renal impairment.",
        "recommendation": "Avoid routine dual blockade. Use alternative antihypertensive combination."
    },
    {
        "id": "DDI-006",
        "domain": "DRUG_INTERACTION",
        "severity": "HIGH",
        "condition": lambda ctx: (
            drug_in_meds("digoxin", ctx.currentMedications) and
            drug_in_meds("amiodarone", ctx.currentMedications)
        ),
        "message": lambda ctx: "Digoxin + amiodarone — amiodarone increases digoxin levels, risk of toxicity.",
        "recommendation": "Reduce digoxin dose by 30-50% and monitor serum levels."
    },
    {
        "id": "DDI-007",
        "domain": "DRUG_INTERACTION",
        "severity": "MODERATE",
        "condition": lambda ctx: (
            any_drug_in_class("Fluoroquinolone", ctx.currentMedications) and
            any_drug_in_class("Antacid", ctx.currentMedications)
        ),
        "message": lambda ctx: "Fluoroquinolone + antacid/calcium — chelation reduces antibiotic absorption.",
        "recommendation": "Separate administration by at least 2 hours."
    },
    {
        "id": "DDI-008",
        "domain": "DRUG_INTERACTION",
        "severity": "HIGH",
        "condition": lambda ctx: _check_qt_antimalarials(ctx),
        "message": lambda ctx: "Multiple QT-prolonging antimalarials or combination with other QT-prolonging drugs — risk of torsades de pointes.",
        "recommendation": "Avoid combining QT-prolonging agents. Perform baseline and follow-up ECG. Monitor electrolytes."
    }
]


def _check_qt_antimalarials(ctx):
    """Check for combinations of antimalarials with known QT risk + other QT drugs."""
    qt_drugs = ["halofantrine", "quinine", "chloroquine", "mefloquine", "amodiaquine",
                "artemether", "lumefantrine", "piperaquine"]  # many antimalarials
    # Also common QT prolonging non-antimalarials: amiodarone, sotalol, macrolides, fluoroquinolones, etc.
    qt_all = qt_drugs + ["amiodarone", "sotalol", "erythromycin", "clarithromycin",
                         "ciprofloxacin", "levofloxacin", "moxifloxacin",
                         "ondansetron", "methadone", "haloperidol"]
    count = 0
    for med in ctx.currentMedications:
        for qtd in qt_all:
            if qtd in med.name.lower():
                count += 1
                break
    return count >= 2