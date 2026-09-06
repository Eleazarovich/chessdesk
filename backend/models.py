"""Pydantic models for the ChessDesk API contract."""

from __future__ import annotations

from datetime import date as Date
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ClientType(str, Enum):
    individual = "individual"
    school = "school"


class CommunicationPreference(str, Enum):
    whatsapp = "whatsapp"
    email = "email"
    both = "both"


class LearnerRange(str, Enum):
    one_to_ten = "1-10"
    ten_to_twenty = "10-20"
    twenty_to_thirty = "20-30"
    thirty_to_forty = "30-40"
    forty_plus = "40+"


class SessionType(str, Enum):
    online = "online"
    in_person = "in-person"


class SessionStatus(str, Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"


class PaymentMethod(str, Enum):
    eft = "eft"
    cash = "cash"
    other = "other"


class InvoiceStatus(str, Enum):
    unpaid = "unpaid"
    paid = "paid"


class ExpenseCategory(str, Enum):
    transport = "transport"
    food = "food"
    equipment = "equipment"
    internet = "internet"
    venue = "venue"
    chess_materials = "chess_materials"
    other = "other"


class TimeFilter(str, Enum):
    this_month = "this_month"
    previous_month = "previous_month"
    all_time = "all_time"


class NotificationType(str, Enum):
    scheduled = "scheduled"
    updated = "updated"
    cancelled = "cancelled"
    completed = "completed"


class LoginRequest(APIModel):
    email: EmailStr
    password: str = Field(min_length=6)


class SignUpRequest(APIModel):
    name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=8)


class ResetPasswordRequest(APIModel):
    email: EmailStr


class AuthUser(APIModel):
    id: str
    email: EmailStr
    name: str


class AuthResponse(AuthUser):
    """AuthUser plus the bearer credential used by API clients.

    The three AuthUser fields remain present exactly as required by the contract;
    the optional token fields make bearer authentication convenient for clients.
    """

    access_token: str
    token_type: str = "bearer"


class Coach(APIModel):
    id: str
    name: str
    email: EmailStr
    phone: str
    business_name: str
    currency: str


class CoachUpdateRequest(APIModel):
    name: str | None = Field(default=None, min_length=1)
    email: EmailStr | None = None
    phone: str | None = None
    business_name: str | None = None
    currency: str | None = None

    @model_validator(mode="after")
    def require_one_field(self) -> "CoachUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("At least one profile field is required")
        return self


class IndividualStudentDetailsCreate(APIModel):
    student_name: str
    school_name: str
    parent_name: str


class SchoolDetailsCreate(APIModel):
    school_name: str
    contact_person: str
    learner_range: LearnerRange


class IndividualStudentDetails(IndividualStudentDetailsCreate):
    client_id: str


class SchoolDetails(SchoolDetailsCreate):
    client_id: str


class Client(APIModel):
    id: str
    coach_id: str
    client_type: ClientType
    display_name: str
    email: EmailStr
    whatsapp: str
    preferred_communication: CommunicationPreference
    notifications_enabled: bool
    notes: str
    active: bool


class ClientCreateRequest(APIModel):
    coach_id: str
    client_type: ClientType
    display_name: str
    email: EmailStr
    whatsapp: str
    preferred_communication: CommunicationPreference
    notifications_enabled: bool
    notes: str
    active: bool
    individual_details: IndividualStudentDetailsCreate | None = None
    school_details: SchoolDetailsCreate | None = None

    @model_validator(mode="after")
    def require_matching_details(self) -> "ClientCreateRequest":
        if self.client_type is ClientType.individual and self.individual_details is None:
            raise ValueError("individual_details is required for an individual client")
        if self.client_type is ClientType.school and self.school_details is None:
            raise ValueError("school_details is required for a school client")
        return self


class ClientUpdateRequest(APIModel):
    client_type: ClientType | None = None
    display_name: str | None = None
    email: EmailStr | None = None
    whatsapp: str | None = None
    preferred_communication: CommunicationPreference | None = None
    notifications_enabled: bool | None = None
    notes: str | None = None
    active: bool | None = None

    @model_validator(mode="after")
    def require_one_field(self) -> "ClientUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("At least one client field is required")
        return self


class ClientWithDetails(Client):
    individual_details: IndividualStudentDetails | None = None
    school_details: SchoolDetails | None = None
    upcoming_session: str | None = None
    outstanding_amount: float = Field(ge=0)


START_TIME_PATTERN = r"^([01][0-9]|2[0-3]):[0-5][0-9]$"


class Session(APIModel):
    id: str
    coach_id: str
    client_id: str
    date: Date
    start_time: str = Field(pattern=START_TIME_PATTERN)
    planned_duration: int = Field(ge=1)
    actual_duration: int | None = Field(ge=0)
    session_type: SessionType
    location: str
    status: SessionStatus
    notes: str


class SessionCreateRequest(APIModel):
    coach_id: str
    client_id: str
    date: Date
    start_time: str = Field(pattern=START_TIME_PATTERN)
    planned_duration: int = Field(ge=1)
    actual_duration: int | None = Field(ge=0)
    session_type: SessionType
    location: str
    status: SessionStatus
    notes: str


class SessionUpdateRequest(APIModel):
    client_id: str | None = None
    date: Date | None = None
    start_time: str | None = Field(default=None, pattern=START_TIME_PATTERN)
    planned_duration: int | None = Field(default=None, ge=1)
    actual_duration: int | None = Field(default=None, ge=0)
    session_type: SessionType | None = None
    location: str | None = None
    status: SessionStatus | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def require_one_field(self) -> "SessionUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("At least one session field is required")
        return self


class Invoice(APIModel):
    id: str
    coach_id: str
    client_id: str
    invoice_date: Date
    due_date: Date
    amount: float = Field(ge=0)
    description: str
    status: InvoiceStatus
    paid_date: Date | None
    payment_method: PaymentMethod | None
    payment_reference: str
    notes: str


class InvoiceCreateRequest(APIModel):
    coach_id: str
    client_id: str
    invoice_date: Date
    due_date: Date
    amount: float = Field(ge=0)
    description: str
    status: InvoiceStatus
    paid_date: Date | None
    payment_method: PaymentMethod | None
    payment_reference: str
    notes: str
    session_ids: list[str]


class InvoiceUpdateRequest(APIModel):
    client_id: str | None = None
    invoice_date: Date | None = None
    due_date: Date | None = None
    amount: float | None = Field(default=None, ge=0)
    description: str | None = None
    status: InvoiceStatus | None = None
    paid_date: Date | None = None
    payment_method: PaymentMethod | None = None
    payment_reference: str | None = None
    notes: str | None = None
    session_ids: list[str] | None = None

    @model_validator(mode="after")
    def require_one_field(self) -> "InvoiceUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("At least one invoice field is required")
        return self


class Expense(APIModel):
    id: str
    coach_id: str
    date: Date
    amount: float = Field(ge=0)
    category: ExpenseCategory
    description: str


class ExpenseCreateRequest(APIModel):
    coach_id: str
    date: Date
    amount: float = Field(ge=0)
    category: ExpenseCategory
    description: str


class ExpenseUpdateRequest(APIModel):
    date: Date | None = None
    amount: float | None = Field(default=None, ge=0)
    category: ExpenseCategory | None = None
    description: str | None = None

    @model_validator(mode="after")
    def require_one_field(self) -> "ExpenseUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("At least one expense field is required")
        return self


class DashboardFinancials(APIModel):
    revenue_earned: float
    payments_received: float
    outstanding: float
    expenses: float
    net_income: float


class DashboardActivity(APIModel):
    active_individual_students: int = Field(ge=0)
    active_schools: int = Field(ge=0)
    sessions_completed: int = Field(ge=0)
    upcoming_sessions: int = Field(ge=0)
    unpaid_invoices: int = Field(ge=0)


class UpcomingSession(APIModel):
    session_id: str
    client_name: str
    date: Date
    start_time: str = Field(pattern=START_TIME_PATTERN)
    session_type: SessionType
    location: str


class RevenueChartPoint(APIModel):
    month: str
    revenue: float
    expenses: float
    payments: float


class SessionsChartPoint(APIModel):
    month: str
    completed: int = Field(ge=0)
    scheduled: int = Field(ge=0)
    cancelled: int = Field(ge=0)


class DashboardData(APIModel):
    financials: DashboardFinancials
    activity: DashboardActivity
    upcoming_sessions: list[UpcomingSession]
    revenue_chart: list[RevenueChartPoint]
    sessions_chart: list[SessionsChartPoint]


class NotificationPayload(APIModel):
    client_id: str
    type: NotificationType
    session: Session
    client_name: str


class ErrorResponse(APIModel):
    message: str
    code: str | None = None
    field_errors: dict[str, list[str]] | None = None


def model_to_dict(model: BaseModel) -> dict[str, Any]:
    """Serialize a model for the in-memory store without leaking implementation details."""

    return model.model_dump(mode="python")
