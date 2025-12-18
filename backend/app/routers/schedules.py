from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user_id

router = APIRouter(prefix="/projects", tags=["schedules"])


class CreateItemBody(BaseModel):
    cat_s_id: int = Field(..., ge=1)
    baseline_start: date
    baseline_end: date
    plan_note: Optional[str] = None

class UpdateActualBody(BaseModel):
    actual_start: date
    actual_end: date | None = None
    memo: Optional[str] = None    


@router.get("/{erp_project_key}/items")
async def list_project_items(erp_project_key: str, db: AsyncSession = Depends(get_db)):
    q = text("""
        select
          item_id,
          erp_project_key,
          cat_s_id,
          cat_s_name,
          owner_dept_id,
          baseline_start, baseline_end,
          current_start, current_end,
          due_end_basis,
          plan_shift,
          actual_start_date, actual_end_date,
          is_progress_delayed
        from v_schedule_item_status
        where erp_project_key = :k
        order by baseline_start nulls last, item_id;
    """)
    rows = (await db.execute(q, {"k": erp_project_key})).mappings().all()
    return list(rows)


@router.post("/{erp_project_key}/items")
async def create_item_with_baseline(
    erp_project_key: str,
    body: CreateItemBody,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # 0) 프로젝트 존재 확인
    exists = await db.execute(
        text("select 1 from erp_projects_cache where erp_project_key = :k"),
        {"k": erp_project_key},
    )
    if exists.first() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    # 1) cat_s 존재 확인 + 기본 owner_dept 가져오기
    srow = (await db.execute(
        text("""
            select cat_s_id, owner_dept_id
            from category_s
            where cat_s_id = :sid and is_active = true
        """),
        {"sid": body.cat_s_id},
    )).mappings().first()

    if not srow:
        raise HTTPException(status_code=404, detail="cat_s_id not found or inactive")

    # 2) schedule_item upsert (프로젝트+소분류 유니크)
    #    - owner_dept_id는 category_s 기본값을 복제 저장(권한 판단 편의)
    upsert_item = text("""
        insert into schedule_item (
          erp_project_key, cat_s_id, owner_dept_id, status, created_at, created_by
        ) values (
          :k, :sid, :owner_dept, 'not_started', now(), :user_id
        )
        on conflict (erp_project_key, cat_s_id) do update
        set owner_dept_id = excluded.owner_dept_id,
            updated_at = now(),
            updated_by = excluded.created_by
        returning item_id;
    """)

    # 3) baseline plan upsert
    upsert_baseline = text("""
        insert into schedule_plan (
        item_id, plan_kind, start_date, end_date, plan_note, created_at, created_by
        ) values (
        :item_id, 'baseline', :start_date, :end_date, :note, now(), :user_id
        )
        on conflict (item_id, plan_kind) do update
        set start_date = excluded.start_date,
            end_date   = excluded.end_date,
            plan_note  = excluded.plan_note,
            updated_at = now(),
            updated_by = excluded.created_by
        returning plan_id;
    """)

    # 트랜잭션 (중첩 begin() 방지: commit/rollback 수동 처리)
    try:
        item_id = (await db.execute(upsert_item, {
            "k": erp_project_key,
            "sid": body.cat_s_id,
            "owner_dept": srow["owner_dept_id"],
            "user_id": user_id,
        })).scalar_one()

        plan_id = (await db.execute(upsert_baseline, {
            "item_id": item_id,
            "start_date": body.baseline_start,
            "end_date": body.baseline_end,
            "note": body.plan_note,
            "user_id": user_id,
        })).scalar_one()

        await db.commit()

    except Exception:
        await db.rollback()
        raise

    return {
        "item_id": item_id,
        "baseline_plan_id": plan_id,
        "erp_project_key": erp_project_key,
        "cat_s_id": body.cat_s_id,
    }

@router.put("/items/{item_id}/actual")
async def upsert_actual(
    item_id: int,
    body: UpdateActualBody,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # 간단 검증: 종료일이 있으면 시작일보다 빠를 수 없음
    if body.actual_end is not None and body.actual_end < body.actual_start:
        raise HTTPException(status_code=400, detail="actual_end must be >= actual_start")

    # item 존재 확인
    row = (await db.execute(
        text("select item_id from schedule_item where item_id = :id and deleted_at is null"),
        {"id": item_id},
    )).first()
    if row is None:
        raise HTTPException(status_code=404, detail="item not found")

    upsert = text("""
        insert into schedule_actual (
        item_id, actual_start_date, actual_end_date, memo, created_at, created_by
        ) values (
        :item_id, :start_date, :end_date, :memo, now(), :user_id
        )
        on conflict (item_id) do update
        set actual_start_date = excluded.actual_start_date,
            actual_end_date   = excluded.actual_end_date,
            memo              = excluded.memo,
            updated_at        = now(),
            updated_by        = excluded.created_by
        returning actual_id;
    """)
    

    try:
        actual_id = (await db.execute(upsert, {
            "item_id": item_id,
            "start_date": body.actual_start,
            "end_date": body.actual_end,
            "memo": body.memo,
            "user_id": user_id,
        })).scalar_one()

        # 상태 자동 결정
        if body.actual_end is not None:
            new_status = "done"
        elif body.actual_start is not None:
            new_status = "in_progress"
        else:
            new_status = None

        if new_status:
            await db.execute(
                text("""
                    update schedule_item
                    set status = :status,
                        updated_at = now(),
                        updated_by = :user_id
                    where item_id = :item_id
                """),
                {
                    "status": new_status,
                    "user_id": user_id,
                    "item_id": item_id,
                },
            )

        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return {"item_id": item_id, "actual_id": actual_id}
