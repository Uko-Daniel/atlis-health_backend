from typing import List, Optional, Any

# Known drug class groupings for cross-reactivity checks
DRUG_CLASS_MAP = {
    "Penicillin": ["penicillin", "amoxicillin", "ampicillin", "flucloxacillin", "cloxacillin", "benzylpenicillin", "benzathine penicillin"],
    "Cephalosporin": ["cephalexin", "cefuroxime", "ceftriaxone", "cefotaxime", "cefixime", "cefepime", "cefadroxil"],
    "Sulfonamide": ["sulfamethoxazole", "sulfadiazine", "sulfasalazine", "cotrimoxazole", "trimethoprim-sulfamethoxazole"],
    "NSAID": ["ibuprofen", "diclofenac", "naproxen", "indomethacin", "piroxicam", "mefenamic acid", "aceclofenac", "ketoprofen", "aspirin"],
    "Fluoroquinolone": ["ciprofloxacin", "levofloxacin", "ofloxacin", "moxifloxacin", "norfloxacin"],
    "MAOI": ["phenelzine", "tranylcypromine", "isocarboxazid", "selegiline"],
    "SSRI": ["fluoxetine", "sertraline", "paroxetine", "citalopram", "escitalopram", "fluvoxamine"],
    "CCB": ["amlodipine", "nifedipine", "verapamil", "diltiazem", "felodipine", "nicardipine"],
    "Statin": ["atorvastatin", "simvastatin", "rosuvastatin", "pravastatin", "lovastatin"],
    "ACEI": ["lisinopril", "enalapril", "ramipril", "captopril", "perindopril", "quinapril"],
    "ARB": ["losartan", "valsartan", "candesartan", "irbesartan", "telmisartan", "olmesartan"],
    "LoopDiuretic": ["furosemide", "bumetanide", "torsemide"],
    "ThiazideDiuretic": ["hydrochlorothiazide", "chlorthalidone", "indapamide", "bendroflumethiazide"],
    "NonSelectiveBB": ["propranolol", "nadolol", "timolol", "sotalol", "carvedilol", "labetalol"],
    "Antimalarial": ["artemether", "lumefantrine", "artesunate", "amodiaquine", "mefloquine", "quinine", "chloroquine", "dihydroartemisinin", "piperaquine", "sulfadoxine-pyrimethamine"],
    "Nephrotoxic": ["gentamicin", "vancomycin", "amikacin", "tobramycin", "cisplatin", "cyclosporine", "tacrolimus", "amphotericin B"],
    "Antacid": ["aluminium hydroxide", "magnesium hydroxide", "calcium carbonate", "sodium bicarbonate", "simethicone"]
}


def fuzzy_match(a: str, b: str) -> bool:
    """Case-insensitive substring match in either direction."""
    a_lower = a.lower().strip()
    b_lower = b.lower().strip()
    return (a_lower in b_lower) or (b_lower in a_lower)


def drug_in_meds(drug_name: str, medications: List[Any]) -> bool:
    """Check if a drug name fuzzy-matches any medication in the list."""
    for med in medications:
        if fuzzy_match(drug_name, med.name):
            return True
    return False


def any_drug_in_class(drug_class: str, medications: List[Any]) -> bool:
    """Check if any medication belongs to a known drug class (case-insensitive)."""
    class_drugs = DRUG_CLASS_MAP.get(drug_class, [])
    if not class_drugs:
        return False
    for med in medications:
        for class_drug in class_drugs:
            if fuzzy_match(class_drug, med.name):
                return True
    return False


def history_contains(keyword: str, history: List[Any]) -> bool:
    """Check if any diagnosis name contains the keyword (case-insensitive)."""
    kw = keyword.lower()
    for h in history:
        if kw in h.name.lower():
            return True
    return False


def get_lab_value(key: str, recent_results: List[Any]) -> Optional[float]:
    """
    Extract a numeric lab value by field key from recentResults.
    Searches all results, returns the most recent value found.
    """
    best_value = None
    best_date = None
    for result in recent_results:
        data = result.data if isinstance(result.data, dict) else {}
        if key in data:
            try:
                val = float(data[key])
            except (TypeError, ValueError):
                continue
            if best_date is None or result.createdAt > best_date:
                best_value = val
                best_date = result.createdAt
    return best_value