"""Dashboard aggregate route."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..models import (
    DashboardActivity,
    DashboardData,
    DashboardFinancials,
    RevenueChartPoint,
    SessionsChartPoint,
    TimeFilter,
    UpcomingSession,
)
from ..store import UserRecord, get_store
from .common import ensure_coach

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _shift_month(value: date, months: int) -> date:
    month_index = value.year * 12 + value.month - 1 + months
    year, month_zero_based = divmod(month_index, 12)
    return date(year, month_zero_based + 1, 1)


def _period(value: TimeFilter, today: date) -> tuple[date, date]:
    current_start = date(today.year, today.month, 1)
    if value is TimeFilter.this_month:
        return current_start, _shift_month(current_start, 1)
    if value is TimeFilter.previous_month:
        return _shift_month(current_start, -1), current_start
    return date.min, date.max


@router.get("", response_model=DashboardData, operation_id="getDashboardData")
async def get_dashboard_data(
    coach_id: str,
    filter: TimeFilter,
    current_user: UserRecord = Depends(get_current_user),
) -> DashboardData:
    ensure_coach(coach_id, current_user)
    store = get_store()
    today = store.today()
    period_start, period_end = _period(filter, today)

    clients = store.list_clients(coach_id)
    sessions = store.list_sessions(coach_id)
    invoices = store.list_invoices(coach_id)
    expenses = store.list_expenses(coach_id)
    clients_by_id = {client.id: client for client in clients}

    invoices_in_period = [period_invoice for period_invoice in invoices if period_start <= period_invoice.invoice_date < period_end]
    paid_in_period = [
        invoice for invoice in invoices
        if invoice.paid_date is not None and period_start <= invoice.paid_date < period_end
    ]
    expenses_in_period = [expense for expense in expenses if period_start <= expense.date < period_end]
    sessions_in_period = [session for session in sessions if period_start <= session.date < period_end]
    upcoming = sorted(
        [session for session in sessions if session.status.value == "scheduled" and session.date >= today],
        key=lambda session: (session.date, session.start_time),
    )

    revenue_earned = sum(invoice.amount for invoice in invoices_in_period)
    payments_received = sum(invoice.amount for invoice in paid_in_period)
    outstanding = sum(invoice.amount for invoice in invoices if invoice.status.value == "unpaid")
    expense_total = sum(expense.amount for expense in expenses_in_period)
    upcoming_view = [
        UpcomingSession(
            session_id=session.id,
            client_name=clients_by_id[session.client_id].display_name,
            date=session.date,
            start_time=session.start_time,
            session_type=session.session_type,
            location=session.location,
        )
        for session in upcoming[:6]
        if session.client_id in clients_by_id
    ]

    revenue_chart: list[RevenueChartPoint] = []
    sessions_chart: list[SessionsChartPoint] = []
    for month_start in [_shift_month(date(today.year, today.month, 1), offset) for offset in range(-5, 1)]:
        month_end = _shift_month(month_start, 1)
        month_invoices = [invoice for invoice in invoices if month_start <= invoice.invoice_date < month_end]
        month_payments = [
            invoice for invoice in invoices
            if invoice.paid_date is not None and month_start <= invoice.paid_date < month_end
        ]
        month_expenses = [expense for expense in expenses if month_start <= expense.date < month_end]
        month_sessions = [session for session in sessions if month_start <= session.date < month_end]
        revenue_chart.append(RevenueChartPoint(
            month=month_start.strftime("%b"),
            revenue=sum(invoice.amount for invoice in month_invoices),
            expenses=sum(expense.amount for expense in month_expenses),
            payments=sum(invoice.amount for invoice in month_payments),
        ))
        sessions_chart.append(SessionsChartPoint(
            month=month_start.strftime("%b"),
            completed=sum(session.status.value == "completed" for session in month_sessions),
            scheduled=sum(session.status.value == "scheduled" for session in month_sessions),
            cancelled=sum(session.status.value == "cancelled" for session in month_sessions),
        ))

    return DashboardData(
        financials=DashboardFinancials(
            revenue_earned=revenue_earned,
            payments_received=payments_received,
            outstanding=outstanding,
            expenses=expense_total,
            net_income=payments_received - expense_total,
        ),
        activity=DashboardActivity(
            active_individual_students=sum(client.client_type.value == "individual" and client.active for client in clients),
            active_schools=sum(client.client_type.value == "school" and client.active for client in clients),
            sessions_completed=sum(session.status.value == "completed" for session in sessions_in_period),
            upcoming_sessions=len(upcoming),
            unpaid_invoices=sum(invoice.status.value == "unpaid" for invoice in invoices),
        ),
        upcoming_sessions=upcoming_view,
        revenue_chart=revenue_chart,
        sessions_chart=sessions_chart,
    )
