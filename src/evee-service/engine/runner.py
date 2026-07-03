import logging
from typing import List, Optional
from engine.schemas import PatientContext, Alert, AlertDomainEnum, AlertSeverityEnum
from engine.rules.allergy import RULES as ALLERGY_RULES
from engine.rules.drug_interaction import RULES as DDI_RULES
from engine.rules.vitals import RULES as VITALS_RULES
from engine.rules.labs import RULES as LABS_RULES
from engine.rules.history import RULES as HISTORY_RULES

logger = logging.getLogger(__name__)

ALL_RULES = ALLERGY_RULES + DDI_RULES + VITALS_RULES + LABS_RULES + HISTORY_RULES

SEVERITY_ORDER = {
    AlertSeverityEnum.CRITICAL: 0,
    AlertSeverityEnum.HIGH: 1,
    AlertSeverityEnum.MODERATE: 2,
    AlertSeverityEnum.LOW: 3,
    AlertSeverityEnum.INFO: 4,
}


def run(patient: PatientContext) -> List[Alert]:
    """Run all clinical rules against the patient context and return sorted alerts."""
    alerts: List[Alert] = []

    for rule in ALL_RULES:
        try:
            if rule["condition"](patient):
                alert = Alert(
                    ruleId=rule["id"],
                    domain=AlertDomainEnum(rule["domain"]),
                    severity=AlertSeverityEnum(rule["severity"]),
                    message=rule["message"](patient) if callable(rule["message"]) else rule["message"],
                    recommendation=rule["recommendation"]
                )
                alerts.append(alert)
        except Exception as e:
            logger.error(f"Rule {rule['id']} failed: {e}", exc_info=True)
            # Continue to next rule

    # Sort by severity order
    alerts.sort(key=lambda a: SEVERITY_ORDER.get(a.severity, 99))
    return alerts