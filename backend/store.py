"""Database-backed repository for ChessDesk application data."""

from __future__ import annotations

import calendar
import hashlib
import os
import threading
import time
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from .database import (
    Base,
    AuthRateLimitORM,
    ClientORM,
    CoachingSessionORM,
    CoachORM,
    ExpenseORM,
    IdCounterORM,
    IndividualDetailsORM,
    InvoiceORM,
    InvoiceSessionORM,
    NotificationORM,
    SchoolDetailsORM,
    TokenORM,
    UserORM,
    create_database_engine,
    create_session_factory,
    database_url_from_env,
    migrate_auth_tokens,
    session_scope,
)

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


TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7


@dataclass(frozen=True)
class UserRecord:
    user: AuthUser
    password_hash: str


def _value(value: Any) -> Any:
    return value.value if hasattr(value, "value") else value


def _env_enabled(name: str, *, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _sample_date(
    today: date, months_ago: int, day: int, *, before_today: bool = False,
) -> date:
    """Place demo records in a rolling six-month window, including today-relative examples."""

    month_index = today.year * 12 + today.month - 1 - months_ago
    year, month_zero_based = divmod(month_index, 12)
    month = month_zero_based + 1
    sample_day = min(day, calendar.monthrange(year, month)[1])
    if before_today and months_ago == 0:
        sample_day = min(sample_day, max(1, today.day - 1))
    return date(year, month, sample_day)


class Store:
    """Repository that keeps the API models independent from the database vendor."""

    def __init__(self, database_url: str | None = None) -> None:
        self.database_url = database_url or database_url_from_env()
        self.engine = create_database_engine(self.database_url)
        self.session_factory = create_session_factory(self.engine)
        Base.metadata.create_all(self.engine)
        migrate_auth_tokens(self.engine)
        if _env_enabled("CHESSDESK_SEED_DEMO", default=True):
            self._seed_if_empty()

    def close(self) -> None:
        self.engine.dispose()

    def reset(self) -> None:
        """Reset the configured database and restore the demo dataset."""

        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self._seed_if_empty()

    def today(self) -> date:
        return date.today()

    def next_id(self, prefix: str) -> str:
        insert = sqlite_insert if self.engine.dialect.name == "sqlite" else postgres_insert
        with session_scope(self.session_factory) as db:
            statement = insert(IdCounterORM).values(prefix=prefix, value=1)
            statement = statement.on_conflict_do_update(
                index_elements=[IdCounterORM.prefix],
                set_={"value": IdCounterORM.value + 1},
            ).returning(IdCounterORM.value)
            return f"{prefix}-{db.scalar(statement):03d}"

    # Authentication and profile operations -----------------------------

    def user_by_email(self, email: str) -> UserRecord | None:
        with session_scope(self.session_factory) as db:
            row = db.scalar(select(UserORM).where(func.lower(UserORM.email) == email.casefold()))
            return self._user_record(row) if row is not None else None

    def user_by_id(self, user_id: str | None) -> UserRecord | None:
        if user_id is None:
            return None
        with session_scope(self.session_factory) as db:
            row = db.get(UserORM, user_id)
            return self._user_record(row) if row is not None else None

    def add_user(self, user: AuthUser, password_hash: str) -> None:
        with session_scope(self.session_factory) as db:
            db.add(UserORM(
                id=user.id,
                email=str(user.email),
                name=user.name,
                password_hash=password_hash,
            ))
            db.add(CoachORM(
                id=user.id,
                name=user.name,
                email=str(user.email),
                phone="",
                business_name="",
                currency="ZAR",
            ))

    def get_coach(self, coach_id: str) -> Coach | None:
        with session_scope(self.session_factory) as db:
            row = db.get(CoachORM, coach_id)
            return self._coach(row) if row is not None else None

    def update_coach(self, coach: Coach) -> None:
        with session_scope(self.session_factory) as db:
            coach_row = db.get(CoachORM, coach.id)
            if coach_row is None:
                raise KeyError(coach.id)
            coach_row.name = coach.name
            coach_row.email = str(coach.email)
            coach_row.phone = coach.phone
            coach_row.business_name = coach.business_name
            coach_row.currency = coach.currency

            user_row = db.get(UserORM, coach.id)
            if user_row is not None:
                user_row.name = coach.name
                user_row.email = str(coach.email)

    def issue_token(self, token: str, user_id: str) -> None:
        with session_scope(self.session_factory) as db:
            now = int(time.time())
            db.execute(delete(TokenORM).where(TokenORM.expires_at <= now))
            db.add(TokenORM(
                token=hashlib.sha256(token.encode()).hexdigest(),
                user_id=user_id,
                expires_at=now + TOKEN_TTL_SECONDS,
            ))

    def revoke_token(self, token: str | None) -> None:
        if token is None:
            return
        with session_scope(self.session_factory) as db:
            db.execute(delete(TokenORM).where(
                TokenORM.token == hashlib.sha256(token.encode()).hexdigest(),
            ))

    def user_id_for_token(self, token: str) -> str | None:
        with session_scope(self.session_factory) as db:
            return db.scalar(select(TokenORM.user_id).where(
                TokenORM.token == hashlib.sha256(token.encode()).hexdigest(),
                TokenORM.expires_at > int(time.time()),
            ))

    def consume_auth_limit(self, key: str, limit: int, expires_at: int) -> bool:
        """Atomically reserve an attempt across workers and server restarts."""

        insert = sqlite_insert if self.engine.dialect.name == "sqlite" else postgres_insert
        with session_scope(self.session_factory) as db:
            db.execute(delete(AuthRateLimitORM).where(AuthRateLimitORM.expires_at <= int(time.time())))
            statement = insert(AuthRateLimitORM).values(key=key, attempts=1, expires_at=expires_at)
            statement = statement.on_conflict_do_update(
                index_elements=[AuthRateLimitORM.key],
                set_={"attempts": AuthRateLimitORM.attempts + 1},
                where=AuthRateLimitORM.attempts < limit,
            ).returning(AuthRateLimitORM.attempts)
            return db.scalar(statement) is not None

    # Client operations ---------------------------------------------------

    def list_clients(self, coach_id: str) -> list[Client]:
        with session_scope(self.session_factory) as db:
            rows = db.scalars(
                select(ClientORM).where(ClientORM.coach_id == coach_id).order_by(ClientORM.id),
            ).all()
            return [self._client(row) for row in rows]

    def get_client(self, client_id: str) -> Client | None:
        with session_scope(self.session_factory) as db:
            row = db.get(ClientORM, client_id)
            return self._client(row) if row is not None else None

    def get_individual_details(self, client_id: str) -> IndividualStudentDetails | None:
        with session_scope(self.session_factory) as db:
            row = db.get(IndividualDetailsORM, client_id)
            return self._individual_details(row) if row is not None else None

    def get_school_details(self, client_id: str) -> SchoolDetails | None:
        with session_scope(self.session_factory) as db:
            row = db.get(SchoolDetailsORM, client_id)
            return self._school_details(row) if row is not None else None

    def save_client(
        self,
        client: Client,
        *,
        individual_details: IndividualStudentDetails | None = None,
        school_details: SchoolDetails | None = None,
    ) -> None:
        with session_scope(self.session_factory) as db:
            row = db.get(ClientORM, client.id)
            if row is None:
                row = ClientORM(id=client.id)
                db.add(row)
            row.coach_id = client.coach_id
            row.client_type = _value(client.client_type)
            row.display_name = client.display_name
            row.email = str(client.email)
            row.whatsapp = client.whatsapp
            row.preferred_communication = _value(client.preferred_communication)
            row.notifications_enabled = client.notifications_enabled
            row.notes = client.notes
            row.active = client.active

            if individual_details is not None:
                detail_row = db.get(IndividualDetailsORM, client.id)
                if detail_row is None:
                    detail_row = IndividualDetailsORM(client_id=client.id)
                    db.add(detail_row)
                detail_row.student_name = individual_details.student_name
                detail_row.school_name = individual_details.school_name
                detail_row.parent_name = individual_details.parent_name
            if school_details is not None:
                detail_row = db.get(SchoolDetailsORM, client.id)
                if detail_row is None:
                    detail_row = SchoolDetailsORM(client_id=client.id)
                    db.add(detail_row)
                detail_row.school_name = school_details.school_name
                detail_row.contact_person = school_details.contact_person
                detail_row.learner_range = _value(school_details.learner_range)

    def delete_client(self, client_id: str) -> None:
        with session_scope(self.session_factory) as db:
            session_ids = db.scalars(
                select(CoachingSessionORM.id).where(CoachingSessionORM.client_id == client_id),
            ).all()
            invoice_ids = db.scalars(
                select(InvoiceORM.id).where(InvoiceORM.client_id == client_id),
            ).all()
            if session_ids:
                db.execute(delete(InvoiceSessionORM).where(InvoiceSessionORM.session_id.in_(session_ids)))
                db.execute(delete(NotificationORM).where(NotificationORM.session_id.in_(session_ids)))
                db.execute(delete(CoachingSessionORM).where(CoachingSessionORM.id.in_(session_ids)))
            if invoice_ids:
                db.execute(delete(InvoiceSessionORM).where(InvoiceSessionORM.invoice_id.in_(invoice_ids)))
                db.execute(delete(InvoiceORM).where(InvoiceORM.id.in_(invoice_ids)))
            db.execute(delete(IndividualDetailsORM).where(IndividualDetailsORM.client_id == client_id))
            db.execute(delete(SchoolDetailsORM).where(SchoolDetailsORM.client_id == client_id))
            db.execute(delete(NotificationORM).where(NotificationORM.client_id == client_id))
            db.execute(delete(ClientORM).where(ClientORM.id == client_id))

    # Session operations --------------------------------------------------

    def list_sessions(self, coach_id: str) -> list[Session]:
        with session_scope(self.session_factory) as db:
            rows = db.scalars(
                select(CoachingSessionORM)
                .where(CoachingSessionORM.coach_id == coach_id)
                .order_by(CoachingSessionORM.date, CoachingSessionORM.start_time),
            ).all()
            return [self._session(row) for row in rows]

    def sessions_for_client(self, client_id: str) -> list[Session]:
        with session_scope(self.session_factory) as db:
            rows = db.scalars(
                select(CoachingSessionORM)
                .where(CoachingSessionORM.client_id == client_id)
                .order_by(CoachingSessionORM.date, CoachingSessionORM.start_time),
            ).all()
            return [self._session(row) for row in rows]

    def get_session(self, session_id: str) -> Session | None:
        with session_scope(self.session_factory) as db:
            row = db.get(CoachingSessionORM, session_id)
            return self._session(row) if row is not None else None

    def save_session(self, coaching_session: Session) -> None:
        with session_scope(self.session_factory) as db:
            row = db.get(CoachingSessionORM, coaching_session.id)
            if row is None:
                row = CoachingSessionORM(id=coaching_session.id)
                db.add(row)
            row.coach_id = coaching_session.coach_id
            row.client_id = coaching_session.client_id
            row.date = coaching_session.date
            row.start_time = coaching_session.start_time
            row.planned_duration = coaching_session.planned_duration
            row.actual_duration = coaching_session.actual_duration
            row.session_type = _value(coaching_session.session_type)
            row.location = coaching_session.location
            row.status = _value(coaching_session.status)
            row.notes = coaching_session.notes

    def delete_session(self, session_id: str) -> None:
        with session_scope(self.session_factory) as db:
            db.execute(delete(InvoiceSessionORM).where(InvoiceSessionORM.session_id == session_id))
            db.execute(delete(NotificationORM).where(NotificationORM.session_id == session_id))
            db.execute(delete(CoachingSessionORM).where(CoachingSessionORM.id == session_id))

    # Invoice operations --------------------------------------------------

    def list_invoices(self, coach_id: str) -> list[Invoice]:
        with session_scope(self.session_factory) as db:
            rows = db.scalars(
                select(InvoiceORM).where(InvoiceORM.coach_id == coach_id).order_by(InvoiceORM.invoice_date, InvoiceORM.id),
            ).all()
            return [self._invoice(row) for row in rows]

    def invoices_for_client(self, client_id: str) -> list[Invoice]:
        with session_scope(self.session_factory) as db:
            rows = db.scalars(
                select(InvoiceORM).where(InvoiceORM.client_id == client_id).order_by(InvoiceORM.invoice_date, InvoiceORM.id),
            ).all()
            return [self._invoice(row) for row in rows]

    def get_invoice(self, invoice_id: str) -> Invoice | None:
        with session_scope(self.session_factory) as db:
            row = db.get(InvoiceORM, invoice_id)
            return self._invoice(row) if row is not None else None

    def invoice_session_ids(self, invoice_id: str) -> list[str]:
        with session_scope(self.session_factory) as db:
            return list(db.scalars(
                select(InvoiceSessionORM.session_id)
                .where(InvoiceSessionORM.invoice_id == invoice_id)
                .order_by(InvoiceSessionORM.session_id),
            ).all())

    def save_invoice(self, invoice: Invoice, session_ids: list[str]) -> None:
        with session_scope(self.session_factory) as db:
            row = db.get(InvoiceORM, invoice.id)
            if row is None:
                row = InvoiceORM(id=invoice.id)
                db.add(row)
            row.coach_id = invoice.coach_id
            row.client_id = invoice.client_id
            row.invoice_date = invoice.invoice_date
            row.due_date = invoice.due_date
            row.amount = invoice.amount
            row.description = invoice.description
            row.status = _value(invoice.status)
            row.paid_date = invoice.paid_date
            row.payment_method = _value(invoice.payment_method) if invoice.payment_method is not None else None
            row.payment_reference = invoice.payment_reference
            row.notes = invoice.notes
            db.execute(delete(InvoiceSessionORM).where(InvoiceSessionORM.invoice_id == invoice.id))
            db.add_all([
                InvoiceSessionORM(invoice_id=invoice.id, session_id=session_id)
                for session_id in session_ids
            ])

    def delete_invoice(self, invoice_id: str) -> None:
        with session_scope(self.session_factory) as db:
            db.execute(delete(InvoiceSessionORM).where(InvoiceSessionORM.invoice_id == invoice_id))
            db.execute(delete(InvoiceORM).where(InvoiceORM.id == invoice_id))

    # Expense operations --------------------------------------------------

    def list_expenses(self, coach_id: str) -> list[Expense]:
        with session_scope(self.session_factory) as db:
            rows = db.scalars(
                select(ExpenseORM).where(ExpenseORM.coach_id == coach_id).order_by(ExpenseORM.date, ExpenseORM.id),
            ).all()
            return [self._expense(row) for row in rows]

    def get_expense(self, expense_id: str) -> Expense | None:
        with session_scope(self.session_factory) as db:
            row = db.get(ExpenseORM, expense_id)
            return self._expense(row) if row is not None else None

    def save_expense(self, expense: Expense) -> None:
        with session_scope(self.session_factory) as db:
            row = db.get(ExpenseORM, expense.id)
            if row is None:
                row = ExpenseORM(id=expense.id)
                db.add(row)
            row.coach_id = expense.coach_id
            row.date = expense.date
            row.amount = expense.amount
            row.category = _value(expense.category)
            row.description = expense.description

    def delete_expense(self, expense_id: str) -> None:
        with session_scope(self.session_factory) as db:
            db.execute(delete(ExpenseORM).where(ExpenseORM.id == expense_id))

    # Notification and compatibility read views -------------------------

    def record_notification(self, payload: Any, *, honor_preference: bool = True) -> bool:
        """Record a notification that would be sent by a real provider."""

        with session_scope(self.session_factory) as db:
            client = db.get(ClientORM, payload.client_id)
            if client is None or (honor_preference and not client.notifications_enabled):
                return False

            session = payload.session
            location = f"\nLocation: {session.location}" if session.location else ""
            duration = session.actual_duration or session.planned_duration
            notification_type = _value(payload.type)
            if notification_type == "scheduled":
                message = (
                    f"Chess session scheduled for {payload.client_name}.\n\n"
                    f"Date: {session.date}\nTime: {session.start_time}\n"
                    f"Duration: {session.planned_duration} min\n"
                    f"Format: {_value(session.session_type)}{location}"
                )
            elif notification_type == "updated":
                message = (
                    "Your chess session details have been updated.\n\n"
                    f"Date: {session.date}\nTime: {session.start_time}\n"
                    f"Duration: {session.planned_duration} min\n"
                    f"Format: {_value(session.session_type)}{location}"
                )
            elif notification_type == "cancelled":
                message = f"The chess session scheduled for {session.date} at {session.start_time} has been cancelled."
            else:
                message = (
                    "Chess session completed.\n\n"
                    f"Student/School: {payload.client_name}\nDate: {session.date}\n"
                    f"Duration: {duration} min\nFormat: {_value(session.session_type)}{location}"
                )
            db.add(NotificationORM(
                client_id=payload.client_id,
                type=notification_type,
                session_id=session.id,
                client_name=payload.client_name,
                channel=_value(client.preferred_communication),
                message=message,
            ))
            return True

    @property
    def users(self) -> dict[str, UserRecord]:
        """Read-only compatibility view for existing tests and local tooling."""

        with session_scope(self.session_factory) as db:
            rows = db.scalars(select(UserORM)).all()
            return {row.id: self._user_record(row) for row in rows}

    @property
    def notifications(self) -> list[dict[str, Any]]:
        """Read-only compatibility view of recorded notifications."""

        with session_scope(self.session_factory) as db:
            rows = db.scalars(select(NotificationORM).order_by(NotificationORM.id)).all()
            return [
                {
                    "client_id": row.client_id,
                    "type": row.type,
                    "session_id": row.session_id,
                    "client_name": row.client_name,
                    "channel": row.channel,
                    "message": row.message,
                }
                for row in rows
            ]

    # Mapping helpers -----------------------------------------------------

    @staticmethod
    def _user_record(row: UserORM) -> UserRecord:
        return UserRecord(
            user=AuthUser(id=row.id, email=row.email, name=row.name),
            password_hash=row.password_hash,
        )

    @staticmethod
    def _coach(row: CoachORM) -> Coach:
        return Coach(
            id=row.id,
            name=row.name,
            email=row.email,
            phone=row.phone,
            business_name=row.business_name,
            currency=row.currency,
        )

    @staticmethod
    def _client(row: ClientORM) -> Client:
        return Client(
            id=row.id,
            coach_id=row.coach_id,
            client_type=row.client_type,
            display_name=row.display_name,
            email=row.email,
            whatsapp=row.whatsapp,
            preferred_communication=row.preferred_communication,
            notifications_enabled=row.notifications_enabled,
            notes=row.notes,
            active=row.active,
        )

    @staticmethod
    def _individual_details(row: IndividualDetailsORM) -> IndividualStudentDetails:
        return IndividualStudentDetails(
            client_id=row.client_id,
            student_name=row.student_name,
            school_name=row.school_name,
            parent_name=row.parent_name,
        )

    @staticmethod
    def _school_details(row: SchoolDetailsORM) -> SchoolDetails:
        return SchoolDetails(
            client_id=row.client_id,
            school_name=row.school_name,
            contact_person=row.contact_person,
            learner_range=row.learner_range,
        )

    @staticmethod
    def _session(row: CoachingSessionORM) -> Session:
        return Session(
            id=row.id,
            coach_id=row.coach_id,
            client_id=row.client_id,
            date=row.date,
            start_time=row.start_time,
            planned_duration=row.planned_duration,
            actual_duration=row.actual_duration,
            session_type=row.session_type,
            location=row.location,
            status=row.status,
            notes=row.notes,
        )

    @staticmethod
    def _invoice(row: InvoiceORM) -> Invoice:
        return Invoice(
            id=row.id,
            coach_id=row.coach_id,
            client_id=row.client_id,
            invoice_date=row.invoice_date,
            due_date=row.due_date,
            amount=row.amount,
            description=row.description,
            status=row.status,
            paid_date=row.paid_date,
            payment_method=row.payment_method,
            payment_reference=row.payment_reference,
            notes=row.notes,
        )

    @staticmethod
    def _expense(row: ExpenseORM) -> Expense:
        return Expense(
            id=row.id,
            coach_id=row.coach_id,
            date=row.date,
            amount=row.amount,
            category=row.category,
            description=row.description,
        )

    def _seed_if_empty(self) -> None:
        # Import lazily to keep password hashing in auth.py while avoiding a module cycle.
        from .auth import hash_password

        with session_scope(self.session_factory) as db:
            if db.scalar(select(CoachORM.id).limit(1)) is not None:
                return

            today = self.today()

            db.add(CoachORM(
                id="coach-001", name="Thabo Nkosi", email="thabo@chessops.co.za",
                phone="+27 82 345 6789", business_name="Nkosi Chess Academy", currency="ZAR",
            ))
            db.add(UserORM(
                id="coach-001", email="thabo@chessops.co.za", name="Thabo Nkosi",
                password_hash=hash_password("chess2026!"),
            ))
            db.flush()

            clients = [
                ("client-001", "individual", "Amahle Dlamini", "parent.dlamini@gmail.com", "+27 73 112 3344", "whatsapp", True, "Keen learner, preparing for U14 provincials.", True),
                ("client-002", "individual", "Liam van der Berg", "cvanderberg@outlook.com", "+27 61 998 7766", "both", True, "Intermediate level. Sessions on Tuesdays and Thursdays.", True),
                ("client-003", "individual", "Sipho Mokoena", "nmokoena@webmail.co.za", "+27 84 567 8901", "email", False, "Beginner. Parent prefers email only.", True),
                ("client-004", "individual", "Priya Naidoo", "snaidoo@gmail.com", "+27 79 234 5678", "whatsapp", True, "Advanced. Targeting national qualifiers.", False),
                ("client-005", "school", "Greenfields Primary", "admin@greenfieldsprimary.co.za", "+27 11 456 7890", "email", True, "Wednesday afternoons, school hall. 25 learners.", True),
                ("client-006", "school", "Sunridge High School", "chess@sunridgehigh.co.za", "+27 21 789 0123", "both", True, "Friday mornings. 15 learners in the chess club.", True),
            ]
            for client_id, client_type, name, email, whatsapp, preference, enabled, notes, active in clients:
                db.add(ClientORM(
                    id=client_id, coach_id="coach-001", client_type=client_type,
                    display_name=name, email=email, whatsapp=whatsapp,
                    preferred_communication=preference, notifications_enabled=enabled,
                    notes=notes, active=active,
                ))
            db.flush()

            for client_id, student_name, school_name, parent_name in [
                ("client-001", "Amahle Dlamini", "Rosebank College Prep", "Zanele Dlamini"),
                ("client-002", "Liam van der Berg", "St. Andrew's School", "Christiaan van der Berg"),
                ("client-003", "Sipho Mokoena", "", "Ntombi Mokoena"),
                ("client-004", "Priya Naidoo", "Westville Girls' High", "Suresh Naidoo"),
            ]:
                db.add(IndividualDetailsORM(
                    client_id=client_id, student_name=student_name,
                    school_name=school_name, parent_name=parent_name,
                ))
            for client_id, school_name, contact_person, learner_range in [
                ("client-005", "Greenfields Primary", "Mrs. Karen Botha", "20-30"),
                ("client-006", "Sunridge High School", "Mr. David Pietersen", "10-20"),
            ]:
                db.add(SchoolDetailsORM(
                    client_id=client_id, school_name=school_name,
                    contact_person=contact_person, learner_range=learner_range,
                ))

            sessions = [
                ("session-001", "client-001", today + timedelta(days=2), "14:00", 60, None, "in-person", "Rosebank Library", "scheduled", ""),
                ("session-002", "client-002", today + timedelta(days=3), "16:00", 60, None, "online", "", "scheduled", "Tactics session — forks and pins."),
                ("session-003", "client-005", today + timedelta(days=4), "14:30", 90, None, "in-person", "School Hall", "scheduled", ""),
                ("session-004", "client-006", today + timedelta(days=6), "08:00", 60, None, "in-person", "Library Room B", "scheduled", ""),
                ("session-005", "client-001", _sample_date(today, 0, 12, before_today=True), "14:00", 60, 55, "in-person", "Rosebank Library", "completed", "Covered endgame rook techniques."),
                ("session-006", "client-002", _sample_date(today, 1, 20), "16:00", 60, 60, "online", "", "completed", ""),
                ("session-007", "client-003", _sample_date(today, 2, 18), "10:00", 45, 45, "in-person", "Client home", "completed", "Basics of piece movement."),
                ("session-008", "client-005", _sample_date(today, 3, 23), "14:30", 90, 85, "in-person", "School Hall", "completed", "Group opening theory."),
                ("session-009", "client-006", _sample_date(today, 4, 20), "08:00", 60, 60, "in-person", "Library Room B", "completed", ""),
                ("session-010", "client-001", _sample_date(today, 1, 12), "14:00", 60, None, "in-person", "Rosebank Library", "cancelled", "Student unwell."),
                ("session-011", "client-002", _sample_date(today, 5, 24), "16:00", 60, 60, "online", "", "completed", ""),
                ("session-012", "client-003", _sample_date(today, 5, 10), "10:00", 45, 40, "in-person", "Client home", "completed", ""),
            ]
            for session_id, client_id, session_date, start_time, planned, actual, session_type, location, status, notes in sessions:
                db.add(CoachingSessionORM(
                    id=session_id, coach_id="coach-001", client_id=client_id,
                    date=session_date, start_time=start_time,
                    planned_duration=planned, actual_duration=actual,
                    session_type=session_type, location=location, status=status, notes=notes,
                ))
            db.flush()

            current_invoice_date = _sample_date(today, 0, 12, before_today=True)
            current_paid_date = min(today, current_invoice_date + timedelta(days=4))
            invoices = [
                ("inv-001", "client-001", current_invoice_date, current_invoice_date + timedelta(days=14), 800, "Coaching sessions — Amahle Dlamini", "unpaid", None, None, "", ""),
                ("inv-002", "client-002", current_invoice_date, current_invoice_date + timedelta(days=14), 900, "Coaching sessions — Liam van der Berg", "paid", current_paid_date, "eft", "EFT-LVB-DEMO", ""),
                ("inv-003", "client-005", _sample_date(today, 1, 26), _sample_date(today, 1, 26) + timedelta(days=14), 2800, "Group sessions — Greenfields Primary", "unpaid", None, None, "", "Awaiting school purchase order."),
                ("inv-004", "client-006", _sample_date(today, 2, 22), _sample_date(today, 2, 22) + timedelta(days=14), 1800, "Sessions — Sunridge High School", "paid", _sample_date(today, 2, 22) + timedelta(days=5), "eft", "SHS-DEMO", ""),
                ("inv-005", "client-003", _sample_date(today, 3, 18), _sample_date(today, 3, 18) + timedelta(days=14), 350, "Session — Sipho Mokoena", "paid", _sample_date(today, 3, 18) + timedelta(days=3), "cash", "", ""),
                ("inv-006", "client-001", _sample_date(today, 4, 12), _sample_date(today, 4, 12) + timedelta(days=14), 400, "Sessions — Amahle Dlamini", "paid", _sample_date(today, 4, 12) + timedelta(days=2), "eft", "", ""),
                ("inv-007", "client-002", _sample_date(today, 5, 24), _sample_date(today, 5, 24) + timedelta(days=14), 450, "Sessions — Liam van der Berg", "paid", _sample_date(today, 5, 24) + timedelta(days=3), "eft", "", ""),
            ]
            for invoice_id, client_id, invoice_date, due_date, amount, description, status, paid_date, payment_method, reference, notes in invoices:
                db.add(InvoiceORM(
                    id=invoice_id, coach_id="coach-001", client_id=client_id,
                    invoice_date=invoice_date, due_date=due_date,
                    amount=amount, description=description, status=status,
                    paid_date=paid_date,
                    payment_method=payment_method, payment_reference=reference, notes=notes,
                ))
            db.flush()
            for invoice_id, session_ids in {
                "inv-001": ["session-005", "session-010"],
                "inv-002": ["session-006", "session-011"],
                "inv-003": ["session-008"],
                "inv-004": ["session-009"],
                "inv-005": ["session-007"],
                "inv-006": ["session-012"],
                "inv-007": ["session-011"],
            }.items():
                db.add_all([
                    InvoiceSessionORM(invoice_id=invoice_id, session_id=session_id)
                    for session_id in session_ids
                ])

            for expense_id, expense_date, amount, category, description in [
                ("exp-001", _sample_date(today, 0, 6, before_today=True), 420, "transport", "Fuel — Rosebank + Greenfields trips"),
                ("exp-002", _sample_date(today, 0, 17, before_today=True), 199, "internet", "Mobile data bundle"),
                ("exp-003", _sample_date(today, 1, 28), 650, "chess_materials", "Chess sets for Greenfields Primary"),
                ("exp-004", _sample_date(today, 2, 22), 180, "transport", "Fuel — school visits"),
                ("exp-005", _sample_date(today, 3, 15), 95, "food", "Lunch during a long session day"),
                ("exp-006", _sample_date(today, 4, 20), 1200, "equipment", "Digital chess clock"),
                ("exp-007", _sample_date(today, 5, 18), 320, "transport", "Fuel — coaching visits"),
            ]:
                db.add(ExpenseORM(
                    id=expense_id, coach_id="coach-001", date=expense_date,
                    amount=amount, category=category, description=description,
                ))
            db.add_all([
                IdCounterORM(prefix="client", value=6),
                IdCounterORM(prefix="session", value=12),
                IdCounterORM(prefix="inv", value=7),
                IdCounterORM(prefix="exp", value=7),
                IdCounterORM(prefix="coach", value=1),
            ])


_default_store: Store | None = None
_store_lock = threading.Lock()


def get_store() -> Store:
    global _default_store
    configured_url = database_url_from_env()
    with _store_lock:
        if _default_store is None or _default_store.database_url != configured_url:
            if _default_store is not None:
                _default_store.close()
            _default_store = Store(configured_url)
    return _default_store


def reset_store() -> Store:
    """Reset the process-wide demo database; useful for tests and local development."""

    global _default_store
    configured_url = database_url_from_env()
    if _default_store is None or _default_store.database_url != configured_url:
        if _default_store is not None:
            _default_store.close()
        _default_store = Store(configured_url)
    else:
        _default_store.reset()
    return _default_store
