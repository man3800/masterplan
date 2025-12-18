from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("")
async def list_projects(db: AsyncSession = Depends(get_db)):
    q = text("""
        select
          p.erp_project_key,
          p.project_name,
          p.machine_type_name,
          d.baseline_due_date,
          d.current_due_date
        from erp_projects_cache p
        left join project_due d
          on d.erp_project_key = p.erp_project_key
        order by p.project_name;
    """)
    rows = (await db.execute(q)).mappings().all()
    return list(rows)
