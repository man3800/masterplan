from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/status-counts")
async def get_status_counts(db: AsyncSession = Depends(get_db)):
    """
    프로젝트 상태별 카운트 조회
    projects 테이블의 status 컬럼을 집계하여 반환
    """
    q = text("""
        SELECT 
            ROW_NUMBER() OVER (ORDER BY status)::int as status_id,
            status::text as status_code,
            CASE 
                WHEN status = 'pending' THEN '대기'
                WHEN status = 'in_progress' THEN '진행중'
                WHEN status = 'paused' THEN '중단'
                WHEN status = 'done' THEN '완료'
                ELSE status::text
            END as status_name,
            CASE 
                WHEN status = 'pending' THEN 1
                WHEN status = 'in_progress' THEN 2
                WHEN status = 'paused' THEN 3
                WHEN status = 'done' THEN 4
                ELSE 99
            END::int as display_order,
            COUNT(*)::int as count
        FROM projects
        GROUP BY status
        ORDER BY display_order
    """)
    rows = (await db.execute(q)).mappings().all()
    return [dict(r) for r in rows]


@router.get("/projects")
async def get_dashboard_projects(
    status_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    대시보드 프로젝트 목록 조회
    projects 테이블의 status와 tasks 테이블을 기반으로 진행률 계산
    """
    # 프로젝트 목록 가져오기
    projects_q = text("SELECT id, code, name, status, due_at FROM projects ORDER BY name")
    projects = (await db.execute(projects_q)).mappings().all()
    
    result = []
    for proj in projects:
        # 각 프로젝트의 task 통계 계산
        stats_q = text("""
            SELECT 
                COUNT(*) FILTER (WHERE status = 'closed')::int as closed_count,
                COUNT(*)::int as total_count
            FROM tasks
            WHERE project_id = :project_id
        """)
        stats_result = await db.execute(stats_q, {"project_id": proj["id"]})
        stats = stats_result.first()
        
        closed_count = stats[0] if stats and stats[0] is not None else 0
        total_count = stats[1] if stats and stats[1] is not None else 0
        
        # 상태 매핑
        status_text = str(proj["status"])
        if status_text == 'pending':
            status_id = 1
            status_name = '대기'
        elif status_text == 'in_progress':
            status_id = 2
            status_name = '진행중'
        elif status_text == 'paused':
            status_id = 3
            status_name = '중단'
        elif status_text == 'done':
            status_id = 4
            status_name = '완료'
        else:
            status_id = 99
            status_name = status_text
        
        # 진행률 계산
        if total_count == 0:
            progress_pct = 0
        else:
            progress_pct = min(100, max(0, int((closed_count / total_count) * 100)))
        
        # status_id 필터링
        if status_id is not None and status_id != status_id:
            continue
        
        result.append({
            "erp_project_key": proj["code"],
            "project_name": proj["name"],
            "machine_type_code": None,
            "machine_type_name": None,
            "status_id": status_id,
            "status_name": status_name,
            "baseline_due_date": proj["due_at"].isoformat() if proj["due_at"] else None,
            "current_due_date": proj["due_at"].isoformat() if proj["due_at"] else None,
            "progress_pct": progress_pct
        })
    
    return result
