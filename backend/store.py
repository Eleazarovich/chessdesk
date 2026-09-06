"""Thread-safe in-memory persistence and demo data for ChessDesk."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from threading import RLock
from typing import Any

from .models import (
    AuthUser,
    Client,
    Coach,
    Expense,
    IndividualStudentDetails,
    Invoice,
    Session,
    SchoolDetails,
)


@dataclass
class UserRecord:
    user: AuthUser
    password_hash: str


class InMemoryStore:
    """A deliberately small persistence layer suitable for the MVP/demo backend."""

    def __init__(self) -> None:
        self.lock = RLock()
        self.coaches: dict[str, Coach] = {}
        self.users: dict[str, UserRecord] = {}
        self.clients: dict[str, Client] = {}
        self.individual_details: dict[str, IndividualStudentDetails] = {}
        self.school_details: dict[str, SchoolDetails] = {}
        self.sessions: dict[str, Session] = {}
        self.invoices: dict[str, Invoice] = {}
        self.invoice_sessions: dict[str, list[str]] = {}
        self.expenses: dict[str, Expense] = {}
        self.tokens: dict[str, str] = {}
        self.notifications: list[dict[str, Any]] = []
        self._counters: dict[str, int] = {}
        self._seed()

    def next_id(self, prefix: str) -> str:
        with self.lock:
            self._counters[prefix] = self._counters.get(prefix, 0) + 1
            return f"{prefix}-{self._counters[prefix]:03d}"

    def today(self) -> date:
        return date.today()

    def _seed(self) -> None:
        # Import lazily to keep password hashing in auth.py while avoiding a module cycle.
        from .auth import hash_password

        coach = Coach(
            id="coach-001",
            name="Thabo Nkosi",
            email="thabo@chessops.co.za",
            phone="+27 82 345 6789",
            business_name="Nkosi Chess Academy",
            currency="ZAR",
        )
        self.coaches[coach.id] = coach
        self.users[coach.id] = UserRecord(
            user=AuthUser(id=coach.id, email=str(coach.email), name=coach.name),
            password_hash=hash_password("chess2026!"),
        )

        clients = [
            Client(
                id="client-001", coach_id="coach-001", client_type="individual",
                display_name="Amahle Dlamini", email="parent.dlamini@gmail.com",
                whatsapp="+27 73 112 3344", preferred_communication="whatsapp",
                notifications_enabled=True, notes="Keen learner, preparing for U14 provincials.", active=True,
            ),
            Client(
                id="client-002", coach_id="coach-001", client_type="individual",
                display_name="Liam van der Berg", email="cvanderberg@outlook.com",
                whatsapp="+27 61 998 7766", preferred_communication="both",
                notifications_enabled=True, notes="Intermediate level. Sessions on Tuesdays and Thursdays.", active=True,
            ),
            Client(
                id="client-003", coach_id="coach-001", client_type="individual",
                display_name="Sipho Mokoena", email="nmokoena@webmail.co.za",
                whatsapp="+27 84 567 8901", preferred_communication="email",
                notifications_enabled=False, notes="Beginner. Parent prefers email only.", active=True,
            ),
            Client(
                id="client-004", coach_id="coach-001", client_type="individual",
                display_name="Priya Naidoo", email="snaidoo@gmail.com",
                whatsapp="+27 79 234 5678", preferred_communication="whatsapp",
                notifications_enabled=True, notes="Advanced. Targeting national qualifiers.", active=False,
            ),
            Client(
                id="client-005", coach_id="coach-001", client_type="school",
                display_name="Greenfields Primary", email="admin@greenfieldsprimary.co.za",
                whatsapp="+27 11 456 7890", preferred_communication="email",
                notifications_enabled=True, notes="Wednesday afternoons, school hall. 25 learners.", active=True,
            ),
            Client(
                id="client-006", coach_id="coach-001", client_type="school",
                display_name="Sunridge High School", email="chess@sunridgehigh.co.za",
                whatsapp="+27 21 789 0123", preferred_communication="both",
                notifications_enabled=True, notes="Friday mornings. 15 learners in the chess club.", active=True,
            ),
        ]
        for client in clients:
            self.clients[client.id] = client

        for details in [
            IndividualStudentDetails(
                client_id="client-001", student_name="Amahle Dlamini",
                school_name="Rosebank College Prep", parent_name="Zanele Dlamini",
            ),
            IndividualStudentDetails(
                client_id="client-002", student_name="Liam van der Berg",
                school_name="St. Andrew's School", parent_name="Christiaan van der Berg",
            ),
            IndividualStudentDetails(
                client_id="client-003", student_name="Sipho Mokoena",
                school_name="", parent_name="Ntombi Mokoena",
            ),
            IndividualStudentDetails(
                client_id="client-004", student_name="Priya Naidoo",
                school_name="Westville Girls' High", parent_name="Suresh Naidoo",
            ),
        ]:
            self.individual_details[details.client_id] = details

        for details in [
            SchoolDetails(
                client_id="client-005", school_name="Greenfields Primary",
                contact_person="Mrs. Karen Botha", learner_range="20-30",
            ),
            SchoolDetails(
                client_id="client-006", school_name="Sunridge High School",
                contact_person="Mr. David Pietersen", learner_range="10-20",
            ),
        ]:
            self.school_details[details.client_id] = details

        sessions = [
            Session(id="session-001", coach_id="coach-001", client_id="client-001", date="2026-09-08", start_time="14:00", planned_duration=60, actual_duration=None, session_type="in-person", location="Rosebank Library", status="scheduled", notes=""),
            Session(id="session-002", coach_id="coach-001", client_id="client-002", date="2026-09-09", start_time="16:00", planned_duration=60, actual_duration=None, session_type="online", location="", status="scheduled", notes="Tactics session — forks and pins."),
            Session(id="session-003", coach_id="coach-001", client_id="client-005", date="2026-09-10", start_time="14:30", planned_duration=90, actual_duration=None, session_type="in-person", location="School Hall", status="scheduled", notes=""),
            Session(id="session-004", coach_id="coach-001", client_id="client-006", date="2026-09-12", start_time="08:00", planned_duration=60, actual_duration=None, session_type="in-person", location="Library Room B", status="scheduled", notes=""),
            Session(id="session-005", coach_id="coach-001", client_id="client-001", date="2026-08-25", start_time="14:00", planned_duration=60, actual_duration=55, session_type="in-person", location="Rosebank Library", status="completed", notes="Covered endgame rook techniques."),
            Session(id="session-006", coach_id="coach-001", client_id="client-002", date="2026-08-26", start_time="16:00", planned_duration=60, actual_duration=60, session_type="online", location="", status="completed", notes=""),
            Session(id="session-007", coach_id="coach-001", client_id="client-003", date="2026-08-20", start_time="10:00", planned_duration=45, actual_duration=45, session_type="in-person", location="Client home", status="completed", notes="Basics of piece movement."),
            Session(id="session-008", coach_id="coach-001", client_id="client-005", date="2026-08-27", start_time="14:30", planned_duration=90, actual_duration=85, session_type="in-person", location="School Hall", status="completed", notes="Group opening theory."),
            Session(id="session-009", coach_id="coach-001", client_id="client-006", date="2026-08-29", start_time="08:00", planned_duration=60, actual_duration=60, session_type="in-person", location="Library Room B", status="completed", notes=""),
            Session(id="session-010", coach_id="coach-001", client_id="client-001", date="2026-08-15", start_time="14:00", planned_duration=60, actual_duration=None, session_type="in-person", location="Rosebank Library", status="cancelled", notes="Student unwell."),
            Session(id="session-011", coach_id="coach-001", client_id="client-002", date="2026-07-28", start_time="16:00", planned_duration=60, actual_duration=60, session_type="online", location="", status="completed", notes=""),
            Session(id="session-012", coach_id="coach-001", client_id="client-003", date="2026-07-22", start_time="10:00", planned_duration=45, actual_duration=40, session_type="in-person", location="Client home", status="completed", notes=""),
        ]
        for session in sessions:
            self.sessions[session.id] = session

        invoices = [
            Invoice(id="inv-001", coach_id="coach-001", client_id="client-001", invoice_date="2026-08-31", due_date="2026-09-07", amount=800, description="August sessions — Amahle Dlamini (2 sessions)", status="unpaid", paid_date=None, payment_method=None, payment_reference="", notes=""),
            Invoice(id="inv-002", coach_id="coach-001", client_id="client-002", invoice_date="2026-08-31", due_date="2026-09-07", amount=900, description="August sessions — Liam van der Berg (2 sessions)", status="paid", paid_date="2026-09-02", payment_method="eft", payment_reference="EFT-20260902-LVB", notes=""),
            Invoice(id="inv-003", coach_id="coach-001", client_id="client-005", invoice_date="2026-08-31", due_date="2026-09-14", amount=2800, description="August group sessions — Greenfields Primary (2 sessions)", status="unpaid", paid_date=None, payment_method=None, payment_reference="", notes="Awaiting school purchase order."),
            Invoice(id="inv-004", coach_id="coach-001", client_id="client-006", invoice_date="2026-08-31", due_date="2026-09-14", amount=1800, description="August sessions — Sunridge High School", status="paid", paid_date="2026-09-04", payment_method="eft", payment_reference="SHS-AUG26", notes=""),
            Invoice(id="inv-005", coach_id="coach-001", client_id="client-003", invoice_date="2026-08-31", due_date="2026-09-07", amount=350, description="August session — Sipho Mokoena", status="paid", paid_date="2026-09-01", payment_method="cash", payment_reference="", notes=""),
            Invoice(id="inv-006", coach_id="coach-001", client_id="client-001", invoice_date="2026-07-31", due_date="2026-08-07", amount=400, description="July session — Amahle Dlamini", status="paid", paid_date="2026-08-05", payment_method="eft", payment_reference="", notes=""),
            Invoice(id="inv-007", coach_id="coach-001", client_id="client-002", invoice_date="2026-07-31", due_date="2026-08-07", amount=450, description="July session — Liam van der Berg", status="paid", paid_date="2026-08-03", payment_method="eft", payment_reference="", notes=""),
        ]
        for invoice in invoices:
            self.invoices[invoice.id] = invoice

        self.invoice_sessions.update({
            "inv-001": ["session-005", "session-010"],
            "inv-002": ["session-006", "session-011"],
            "inv-003": ["session-008"],
            "inv-004": ["session-009"],
            "inv-005": ["session-007"],
            "inv-006": ["session-012"],
            "inv-007": ["session-011"],
        })

        expenses = [
            Expense(id="exp-001", coach_id="coach-001", date="2026-09-03", amount=420, category="transport", description="Fuel — Rosebank + Greenfields trips"),
            Expense(id="exp-002", coach_id="coach-001", date="2026-09-01", amount=199, category="internet", description="Mobile data bundle"),
            Expense(id="exp-003", coach_id="coach-001", date="2026-08-28", amount=650, category="chess_materials", description="Chess sets for Greenfields Primary"),
            Expense(id="exp-004", coach_id="coach-001", date="2026-08-22", amount=180, category="transport", description="Fuel — August school visits"),
            Expense(id="exp-005", coach_id="coach-001", date="2026-08-15", amount=95, category="food", description="Lunch during long session day"),
            Expense(id="exp-006", coach_id="coach-001", date="2026-07-30", amount=1200, category="equipment", description="Digital chess clock"),
            Expense(id="exp-007", coach_id="coach-001", date="2026-07-18", amount=320, category="transport", description="Fuel — July"),
        ]
        for expense in expenses:
            self.expenses[expense.id] = expense

        # Keep new ids above the seeded ids.
        self._counters.update({"client": 6, "session": 12, "inv": 7, "exp": 7, "coach": 1})

    def user_by_email(self, email: str) -> UserRecord | None:
        normalized = email.casefold()
        return next((record for record in self.users.values() if str(record.user.email).casefold() == normalized), None)

    def user_by_id(self, user_id: str) -> UserRecord | None:
        return self.users.get(user_id)

    def add_user(self, user: AuthUser, password_hash: str) -> None:
        with self.lock:
            self.users[user.id] = UserRecord(user=user, password_hash=password_hash)
            self.coaches[user.id] = Coach(
                id=user.id, name=user.name, email=user.email,
                phone="", business_name="", currency="ZAR",
            )

    def record_notification(self, payload: Any, *, honor_preference: bool = True) -> bool:
        """Record a notification that would be sent by a real provider."""

        with self.lock:
            client = self.clients.get(payload.client_id)
            if client is None:
                return False
            if honor_preference and not client.notifications_enabled:
                return False

            session = payload.session
            location = f"\nLocation: {session.location}" if session.location else ""
            duration = session.actual_duration or session.planned_duration
            if payload.type.value == "scheduled":
                message = (
                    f"Chess session scheduled for {payload.client_name}.\n\n"
                    f"Date: {session.date}\nTime: {session.start_time}\n"
                    f"Duration: {session.planned_duration} min\n"
                    f"Format: {session.session_type.value}{location}"
                )
            elif payload.type.value == "updated":
                message = (
                    "Your chess session details have been updated.\n\n"
                    f"Date: {session.date}\nTime: {session.start_time}\n"
                    f"Duration: {session.planned_duration} min\n"
                    f"Format: {session.session_type.value}{location}"
                )
            elif payload.type.value == "cancelled":
                message = f"The chess session scheduled for {session.date} at {session.start_time} has been cancelled."
            else:
                message = (
                    "Chess session completed.\n\n"
                    f"Student/School: {payload.client_name}\nDate: {session.date}\n"
                    f"Duration: {duration} min\nFormat: {session.session_type.value}{location}"
                )
            self.notifications.append({
                "client_id": payload.client_id,
                "type": payload.type.value,
                "session_id": session.id,
                "client_name": payload.client_name,
                "channel": client.preferred_communication.value,
                "message": message,
            })
            return True


_default_store: InMemoryStore | None = None


def get_store() -> InMemoryStore:
    global _default_store
    if _default_store is None:
        _default_store = InMemoryStore()
    return _default_store


def reset_store() -> InMemoryStore:
    """Reset the process-wide demo store; useful for tests and local development."""

    global _default_store
    _default_store = InMemoryStore()
    return _default_store
