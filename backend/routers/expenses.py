"""Business expense routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from ..auth import get_current_user
from ..models import Expense, ExpenseCreateRequest, ExpenseUpdateRequest
from ..store import UserRecord, get_store
from .common import ensure_coach, ensure_expense

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.get("", response_model=list[Expense], operation_id="getExpenses")
async def list_expenses(
    coach_id: str,
    current_user: UserRecord = Depends(get_current_user),
) -> list[Expense]:
    ensure_coach(coach_id, current_user)
    return [expense for expense in get_store().expenses.values() if expense.coach_id == coach_id]


@router.post("", response_model=Expense, status_code=status.HTTP_201_CREATED, operation_id="createExpense")
async def create_expense(
    payload: ExpenseCreateRequest,
    current_user: UserRecord = Depends(get_current_user),
) -> Expense:
    ensure_coach(payload.coach_id, current_user)
    store = get_store()
    expense = Expense(id=store.next_id("exp"), **payload.model_dump())
    store.expenses[expense.id] = expense
    return expense


@router.patch("/{expenseId}", response_model=Expense, operation_id="updateExpense")
async def update_expense(
    expenseId: str,
    payload: ExpenseUpdateRequest,
    current_user: UserRecord = Depends(get_current_user),
) -> Expense:
    old_expense = ensure_expense(expenseId, current_user)
    updated = Expense.model_validate({
        **old_expense.model_dump(),
        **payload.model_dump(exclude_unset=True),
    })
    get_store().expenses[expenseId] = updated
    return updated


@router.delete("/{expenseId}", status_code=status.HTTP_204_NO_CONTENT, operation_id="deleteExpense")
async def delete_expense(
    expenseId: str,
    response: Response,
    current_user: UserRecord = Depends(get_current_user),
) -> None:
    ensure_expense(expenseId, current_user)
    get_store().expenses.pop(expenseId, None)
    response.status_code = status.HTTP_204_NO_CONTENT
    return None
