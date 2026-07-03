from pydantic import BaseModel, Field
from typing import List, Optional, Any
from enum import Enum


class SexEnum(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class AllergySeverityEnum(str, Enum):
    MILD = "MILD"
    MODERATE = "MODERATE"
    SEVERE = "SEVERE"
    LIFE_THREATENING = "LIFE_THREATENING"


class HistoryStatusEnum(str, Enum):
    ACTIVE = "ACTIVE"
    RESOLVED = "RESOLVED"
    CHRONIC = "CHRONIC"
    SUSPECTED = "SUSPECTED"


class AlertDomainEnum(str, Enum):
    ALLERGY = "ALLERGY"
    DRUG_INTERACTION = "DRUG_INTERACTION"
    DOSAGE = "DOSAGE"
    VITALS = "VITALS"
    LAB = "LAB"
    HISTORY = "HISTORY"
    COMORBIDITY = "COMORBIDITY"
    PREVENTIVE = "PREVENTIVE"
    PREGNANCY = "PREGNANCY"
    PAEDIATRIC = "PAEDIATRIC"


class AlertSeverityEnum(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    LOW = "LOW"
    INFO = "INFO"


class Demographics(BaseModel):
    firstName: str
    lastName: str
    age: int
    sex: SexEnum
    dob: str  # ISO datetime


class Allergy(BaseModel):
    substance: str
    reaction: str
    severity: AllergySeverityEnum
    drugClass: Optional[str] = None
    confirmed: bool


class CurrentMedication(BaseModel):
    name: str
    dosage: str
    route: str
    frequency: str
    prescribedBy: str
    startDate: str


class Vitals(BaseModel):
    systolicBP: Optional[int] = None
    diastolicBP: Optional[int] = None
    heartRate: Optional[int] = None
    temperature: Optional[float] = None  # Celsius
    spO2: Optional[float] = None  # percentage
    respiratoryRate: Optional[int] = None
    gcs: Optional[int] = None  # 3-15
    recordedAt: str


class MedicalHistory(BaseModel):
    name: str
    icdCode: Optional[str] = None
    status: HistoryStatusEnum
    isPrimary: bool
    diagnosedAt: str


class RecentResult(BaseModel):
    templateName: str
    data: Any  # decrypted result JSON from the editor
    createdAt: str


class PatientContext(BaseModel):
    patientId: str
    demographics: Demographics
    allergies: List[Allergy] = []
    currentMedications: List[CurrentMedication] = []
    vitals: Optional[Vitals] = None
    medicalHistory: List[MedicalHistory] = []
    recentResults: List[RecentResult] = []


class Alert(BaseModel):
    ruleId: str
    domain: AlertDomainEnum
    severity: AlertSeverityEnum
    message: str
    recommendation: str


class EvaluationResponse(BaseModel):
    alerts: List[Alert]
    mlScore: Optional[float] = None
    mlLabel: Optional[str] = None