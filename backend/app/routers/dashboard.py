from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/status-counts")
async def get_status_counts(db: AsyncSession = Depends(get_db)):
    # status master 기준으로 항상 모두 반환 + 프로젝트 count left join
    q = text("""
        select
          ps.status_id,
          ps.status_code,
          ps.status_name,
          ps.display_order,
          coalesce(cnt.cnt, 0) as count
        from project_status ps
        left join (
          select project_status_id, count(*)::int as cnt
          from erp_projects_cache
          group by project_status_id
        ) cnt
          on cnt.project_status_id = ps.status_id
        where ps.is_active = true
        order by ps.display_order asc, ps.status_id asc
    """)
    rows = (await db.execute(q)).mappings().all()
    return [dict(r) for r in rows]


@router.get("/projects")
async def get_dashboard_projects(
    status_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    # 진행률(단순):
    #  - total_days = (max(baseline_end) - min(baseline_start) + 1)
    #  - done_day = max(actual_end_date)
    #  - progress_pct = floor( (done_day - min_start +1) / total_days * 100 )
    #  - actual_end_date 없으면 0%
    #  - row 없으면 0%
    q = text("""
        with per_proj as (
          select
            i.erp_project_key,
            min(p.start_date) as min_start,
            max(p.end_date) as max_end,
            max(a.actual_end_date) as max_actual_end
          from schedule_item i
          left join schedule_plan p
            on p.item_id = i.item_id and p.plan_kind = 'baseline' and p.deleted_at is null
          left join schedule_actual a
            on a.item_id = i.item_id and a.deleted_at is null
          where i.deleted_at is null
          group by i.erp_project_key
        ),
        base as (
            select
                pr.erp_project_key,
                pr.project_name,
                pr.machine_type_code,
                pr.machine_type_name,
                pr.project_status_id as status_id,
                ps.status_name,
                ps.display_order,

                -- 프로젝트 기준/변경 납기 (Row 기준)
                max(case when p.plan_kind = 'baseline' then p.end_date end) as baseline_due_date,
                max(case when p.plan_kind = 'current'  then p.end_date end) as current_due_date,

                pp.min_start,
                pp.max_end,
                pp.max_actual_end,

                case
                when pp.min_start is null or pp.max_end is null then 0
                else greatest(1, (pp.max_end - pp.min_start + 1))
                end as total_days,

                case
                when pp.max_actual_end is null or pp.min_start is null then 0
                else greatest(0, (pp.max_actual_end - pp.min_start + 1))
                end as done_days

            from erp_projects_cache pr
            left join project_status ps on ps.status_id = pr.project_status_id
            left join schedule_item i on i.erp_project_key = pr.erp_project_key and i.deleted_at is null
            left join schedule_plan p on p.item_id = i.item_id and p.deleted_at is null
            left join per_proj pp on pp.erp_project_key = pr.erp_project_key
            group by
                pr.erp_project_key,
                pr.project_name,
                pr.machine_type_code,
                pr.machine_type_name,
                pr.project_status_id,
                ps.status_name,
                ps.display_order,
                pp.min_start,
                pp.max_end,
                pp.max_actual_end
            )
        select
          erp_project_key,
          project_name,
          machine_type_code,
          machine_type_name,
          status_id,
          status_name,
          baseline_due_date,
          current_due_date,
          case
            when total_days <= 0 then 0
            when done_days <= 0 then 0
            else least(100, floor((done_days::numeric / total_days::numeric) * 100))::int
          end as progress_pct
        from base
        where (cast(:status_id as bigint) is null or status_id = cast(:status_id as bigint))
        order by
          coalesce(display_order, 999) asc,
          erp_project_key asc
    """)
    rows = (await db.execute(q, {"status_id": status_id})).mappings().all()
    return [dict(r) for r in rows]
