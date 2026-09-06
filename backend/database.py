"""Database configuration and SQLAlchemy persistence models."""

from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String, create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

DEFAULT_DATABASE_URL = "sqlite:///./chessdesk.db"
DATABASE_URL_ENV = "DATABASE_URL"


class Base(DeclarativeBase):
    """Base class for all database tables."""


class UserORM(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(512))


class CoachORM(Base):
    __tablename__ = "coaches"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320))
    phone: Mapped[str] = mapped_column(String(64))
    business_name: Mapped[str] = mapped_column(String(200))
    currency: Mapped[str] = mapped_column(String(8))


class ClientORM(Base):
    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    coach_id: Mapped[str] = mapped_column(String(64), ForeignKey("coaches.id"), index=True)
    client_type: Mapped[str] = mapped_column(String(32))
    display_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320))
    whatsapp: Mapped[str] = mapped_column(String(64))
    preferred_communication: Mapped[str] = mapped_column(String(32))
    notifications_enabled: Mapped[bool] = mapped_column(Boolean)
    notes: Mapped[str] = mapped_column(String(2000))
    active: Mapped[bool] = mapped_column(Boolean)


class IndividualDetailsORM(Base):
    __tablename__ = "individual_student_details"

    client_id: Mapped[str] = mapped_column(String(64), ForeignKey("clients.id"), primary_key=True)
    student_name: Mapped[str] = mapped_column(String(200))
    school_name: Mapped[str] = mapped_column(String(200))
    parent_name: Mapped[str] = mapped_column(String(200))


class SchoolDetailsORM(Base):
    __tablename__ = "school_details"

    client_id: Mapped[str] = mapped_column(String(64), ForeignKey("clients.id"), primary_key=True)
    school_name: Mapped[str] = mapped_column(String(200))
    contact_person: Mapped[str] = mapped_column(String(200))
    learner_range: Mapped[str] = mapped_column(String(32))


class CoachingSessionORM(Base):
    __tablename__ = "coaching_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    coach_id: Mapped[str] = mapped_column(String(64), ForeignKey("coaches.id"), index=True)
    client_id: Mapped[str] = mapped_column(String(64), ForeignKey("clients.id"), index=True)
    date: Mapped[Any] = mapped_column(Date)
    start_time: Mapped[str] = mapped_column(String(5))
    planned_duration: Mapped[int] = mapped_column(Integer)
    actual_duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    session_type: Mapped[str] = mapped_column(String(32))
    location: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(32))
    notes: Mapped[str] = mapped_column(String(2000))


class InvoiceORM(Base):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    coach_id: Mapped[str] = mapped_column(String(64), ForeignKey("coaches.id"), index=True)
    client_id: Mapped[str] = mapped_column(String(64), ForeignKey("clients.id"), index=True)
    invoice_date: Mapped[Any] = mapped_column(Date)
    due_date: Mapped[Any] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Float)
    description: Mapped[str] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(32))
    paid_date: Mapped[Any | None] = mapped_column(Date, nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(32), nullable=True)
    payment_reference: Mapped[str] = mapped_column(String(200))
    notes: Mapped[str] = mapped_column(String(2000))


class InvoiceSessionORM(Base):
    __tablename__ = "invoice_sessions"

    invoice_id: Mapped[str] = mapped_column(String(64), ForeignKey("invoices.id"), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(64), ForeignKey("coaching_sessions.id"), primary_key=True)


class ExpenseORM(Base):
    __tablename__ = "expenses"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    coach_id: Mapped[str] = mapped_column(String(64), ForeignKey("coaches.id"), index=True)
    date: Mapped[Any] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Float)
    category: Mapped[str] = mapped_column(String(64))
    description: Mapped[str] = mapped_column(String(1000))


class TokenORM(Base):
    __tablename__ = "auth_tokens"

    token: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), index=True)


class NotificationORM(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_id: Mapped[str] = mapped_column(String(64), ForeignKey("clients.id"), index=True)
    type: Mapped[str] = mapped_column(String(32))
    session_id: Mapped[str] = mapped_column(String(64), ForeignKey("coaching_sessions.id"))
    client_name: Mapped[str] = mapped_column(String(200))
    channel: Mapped[str] = mapped_column(String(32))
    message: Mapped[str] = mapped_column(String(4000))


class IdCounterORM(Base):
    __tablename__ = "id_counters"

    prefix: Mapped[str] = mapped_column(String(32), primary_key=True)
    value: Mapped[int] = mapped_column(Integer)


def database_url_from_env() -> str:
    """Return the configured SQLAlchemy URL, defaulting to a local SQLite file."""

    return os.getenv(DATABASE_URL_ENV, DEFAULT_DATABASE_URL)


def create_database_engine(database_url: str | None = None) -> Engine:
    """Create an engine without coupling the repository to one database vendor."""

    url = database_url or database_url_from_env()
    engine_options: dict[str, Any] = {"future": True}
    if url.startswith("sqlite"):
        engine_options["connect_args"] = {"check_same_thread": False}
    return create_engine(url, **engine_options)


def create_session_factory(engine: Engine) -> sessionmaker[Any]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@contextmanager
def session_scope(factory: sessionmaker[Any]) -> Iterator[Any]:
    """Yield a transaction-scoped SQLAlchemy session."""

    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
