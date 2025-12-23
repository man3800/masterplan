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
    classification_id: int = Field(..., ge=1)  # cat_s_id -> classification_id
    baseline_start: date
    baseline_end: date
    plan_note: Optional[str] = None

class UpdateActualBody(BaseModel):
    actual_start: date
    actual_end: date | None = None
    memo: Optional[str] = None    


@router.get("/{project_code}/items")
async def list_project_items(project_code: str, db: AsyncSession = Depends(get_db)):
    """프로젝트의 작업 목록 조회 (새 스키마: projects, classifications, tasks)"""
    # 프로젝트 코드 변환 (erp_project_key 형식 지원: "HB-130X(#1035)" -> "HB-130X-1035")
    code = project_code.replace("(#", "-").replace(")", "")
    
    # 프로젝트 존재 확인
    project_check = text("SELECT id FROM projects WHERE code = :code")
    project_result = await db.execute(project_check, {"code": code})
    project_id = project_result.scalar_one_or_none()
    
    if not project_id:
        raise HTTPException(status_code=404, detail=f"Project '{project_code}' not found")
    
    # tasks 테이블에서 작업 조회
    # 현재 tasks 테이블에는 baseline_start, baseline_end, actual_start_date, actual_end_date 필드가 없음
    # TODO: tasks 테이블에 날짜 필드 추가 또는 별도 테이블 필요
    q = text("""
        SELECT
          t.id as item_id,
          p.code as erp_project_key,
          c.id as cat_s_id,
          c.name as cat_s_name,
          NULL::text as owner_dept_id,  -- classifications 테이블에 owner_dept_id가 없으므로 NULL
          NULL::date as baseline_start,  -- tasks 테이블에 baseline 정보가 없으므로 NULL
          NULL::date as baseline_end,    -- tasks 테이블에 baseline 정보가 없으므로 NULL
          NULL::date as current_start,   -- tasks 테이블에 current plan 정보가 없으므로 NULL
          NULL::date as current_end,     -- tasks 테이블에 current plan 정보가 없으므로 NULL
          NULL::date as due_end_basis,  -- tasks 테이블에 due date 정보가 없으므로 NULL
          NULL::text as plan_shift,     -- tasks 테이블에 plan shift 정보가 없으므로 NULL
          NULL::date as actual_start_date, -- tasks 테이블에 actual start date 정보가 없으므로 NULL
          NULL::date as actual_end_date,   -- tasks 테이블에 actual end date 정보가 없으므로 NULL
          FALSE as is_progress_delayed   -- tasks 테이블에 지연 정보가 없으므로 FALSE
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        JOIN classifications c ON c.id = t.classification_id
        WHERE p.id = :project_id
        ORDER BY t.created_at;
    """)
    rows = (await db.execute(q, {"project_id": project_id})).mappings().all()
    return list(rows)


@router.post("/{project_code}/items")
async def create_item_with_baseline(
    project_code: str,  # erp_project_key -> project_code
    body: CreateItemBody,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """작업 생성 (새 스키마: projects, classifications, tasks)"""
    # 프로젝트 코드 변환
    code = project_code.replace("(#", "-").replace(")", "")

    # 0) 프로젝트 존재 확인
    project_check = text("SELECT id FROM projects WHERE code = :code")
    project_result = await db.execute(project_check, {"code": code})
    project_id = project_result.scalar_one_or_none()
    
    if not project_id:
        raise HTTPException(status_code=404, detail=f"Project '{project_code}' not found")

    # 1) classification_id 존재 확인
    classification_check = text("""
        SELECT id FROM classifications 
        WHERE id = :classification_id 
          AND project_id = :project_id 
          AND is_active = TRUE
    """)
    classification_result = await db.execute(classification_check, {
        "classification_id": body.classification_id,
        "project_id": project_id
    })
    classification_exists = classification_result.scalar_one_or_none()

    if not classification_exists:
        raise HTTPException(
            status_code=404, 
            detail=f"Classification ID {body.classification_id} not found or inactive for project '{project_code}'"
        )

    # 2) tasks 테이블에 새 작업 생성
    # TODO: tasks 테이블에 baseline_start, baseline_end 필드 추가 필요
    # 현재는 title과 description만 저장
    insert_task = text("""
        INSERT INTO tasks (
            project_id,
            classification_id,
            title,
            description,
            status,
            created_at,
            updated_at
        ) VALUES (
            :project_id,
            :classification_id,
            :title,
            :description,
            'open',  -- 기본 상태
            now(),
            now()
        ) RETURNING id;
    """)
    
    # title은 classification name으로 임시 설정
    classification_name_q = text("SELECT name FROM classifications WHERE id = :classification_id")
    classification_name_result = await db.execute(classification_name_q, {"classification_id": body.classification_id})
    classification_name = classification_name_result.scalar_one_or_none()

    if not classification_name:
        raise HTTPException(status_code=500, detail="Could not retrieve classification name for new task")

    try:
        new_task_id = (await db.execute(insert_task, {
            "project_id": project_id,
            "classification_id": body.classification_id,
            "title": classification_name,  # 임시로 분류 이름을 title로 사용
            "description": body.plan_note,
        })).scalar_one()

        await db.commit()

    except Exception:
        await db.rollback()
        raise

    return {
        "item_id": new_task_id,
        "erp_project_key": code,
        "classification_id": body.classification_id,
        "message": "Task created successfully. Note: baseline_start and baseline_end are not yet stored in tasks table."
    }

@router.put("/items/{item_id}/actual")
async def upsert_actual(
    item_id: int,
    body: UpdateActualBody,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """작업 실제 일정 업데이트 (새 스키마: tasks)"""
    # 간단 검증: 종료일이 있으면 시작일보다 빠를 수 없음
    if body.actual_end is not None and body.actual_end < body.actual_start:
        raise HTTPException(status_code=400, detail="actual_end must be >= actual_start")

    # task 존재 확인
    task_check = text("SELECT id, status FROM tasks WHERE id = :item_id")
    task_result = await db.execute(task_check, {"item_id": item_id})
    task = task_result.first()
    
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    # TODO: tasks 테이블에 actual_start_date, actual_end_date 필드 추가 필요
    # 현재는 description에 메모만 저장하고 상태만 업데이트
    # 상태 자동 결정
    if body.actual_end is not None:
        new_status = "closed"  # tasks 테이블의 status는 'open', 'closed' 등
    elif body.actual_start is not None:
        new_status = "in_progress"
    else:
        new_status = task[1]  # 기존 상태 유지

    try:
        # tasks 테이블 업데이트 (description에 메모 저장, status 업데이트)
        update_task = text("""
            UPDATE tasks
            SET description = COALESCE(:memo, description),
                status = :status,
                updated_at = now()
            WHERE id = :item_id
            RETURNING id;
        """)
        
        result = await db.execute(update_task, {
            "item_id": item_id,
            "memo": body.memo,
            "status": new_status,
        })
        
        updated_task_id = result.scalar_one()
        await db.commit()

    except Exception:
        await db.rollback()
        raise

    return {
        "item_id": updated_task_id,
        "message": "Task actual dates updated. Note: actual_start_date and actual_end_date are not yet stored in tasks table."
    }
