"""
Projects CRUD API Router
Based on actual schema: projects table
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.project import ProjectCreate, ProjectUpdate, ProjectOut

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=List[ProjectOut])
async def list_projects(
    q: Optional[str] = Query(None, description="Search query (searches in name, code, customer_name, customer_code)"),
    status: Optional[str] = Query(None, description="Filter by status (pending, in_progress, paused, done)"),
    limit: int = Query(50, ge=1, le=200, description="Limit (max 200)"),
    offset: int = Query(0, ge=0, description="Offset"),
    sort: str = Query("updated_at desc", description="Sort order (default: updated_at desc)"),
    db: AsyncSession = Depends(get_db),
):
    """
    List projects with filtering, searching, and pagination
    """
    # Build WHERE clause
    conditions = []
    params = {}

    if q:
        conditions.append("""
            (name ILIKE :q OR code ILIKE :q OR customer_name ILIKE :q OR customer_code ILIKE :q)
        """)
        params["q"] = f"%{q}%"

    if status:
        # Validate status enum
        valid_statuses = ["pending", "in_progress", "paused", "done"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        conditions.append("status = :status")
        params["status"] = status

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    # Validate sort (prevent SQL injection)
    allowed_sort_columns = ["id", "code", "name", "status", "ordered_at", "paused_at", "completed_at", "due_at", "created_at", "updated_at"]
    sort_parts = sort.lower().split()
    if len(sort_parts) != 2 or sort_parts[0] not in allowed_sort_columns:
        sort = "updated_at desc"
    else:
        sort_dir = sort_parts[1] if sort_parts[1] in ["asc", "desc"] else "desc"
        sort = f"{sort_parts[0]} {sort_dir}"

    # Build query
    query = text(f"""
        SELECT 
            id, code, name, customer_code, customer_name, status,
            ordered_at, paused_at, completed_at, due_at,
            created_at, updated_at
        FROM projects
        WHERE {where_clause}
        ORDER BY {sort}
        LIMIT :limit OFFSET :offset
    """)
    params.update({"limit": limit, "offset": offset})

    result = await db.execute(query, params)
    rows = result.mappings().all()

    return [ProjectOut(**dict(row)) for row in rows]


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a single project by ID
    """
    query = text("""
        SELECT 
            id, code, name, customer_code, customer_name, status,
            ordered_at, paused_at, completed_at, due_at,
            created_at, updated_at
        FROM projects
        WHERE id = :project_id
    """)
    result = await db.execute(query, {"project_id": project_id})
    row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    return ProjectOut(**dict(row))


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(
    project: ProjectCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new project
    """
    # Check code uniqueness if provided
    if project.code:
        code_check = text("SELECT id FROM projects WHERE code = :code")
        code_result = await db.execute(code_check, {"code": project.code})
        if code_result.first():
            raise HTTPException(status_code=400, detail=f"Project code '{project.code}' already exists")

    # Insert project
    insert_query = text("""
        INSERT INTO projects (
            code, name, customer_code, customer_name, status,
            ordered_at, paused_at, completed_at, due_at,
            created_at, updated_at
        ) VALUES (
            :code, :name, :customer_code, :customer_name, :status,
            :ordered_at, :paused_at, :completed_at, :due_at,
            now(), now()
        ) RETURNING 
            id, code, name, customer_code, customer_name, status,
            ordered_at, paused_at, completed_at, due_at,
            created_at, updated_at
    """)
    result = await db.execute(insert_query, {
        "code": project.code,
        "name": project.name,
        "customer_code": project.customer_code,
        "customer_name": project.customer_name,
        "status": project.status,
        "ordered_at": project.ordered_at,
        "paused_at": project.paused_at,
        "completed_at": project.completed_at,
        "due_at": project.due_at,
    })
    await db.commit()

    row = result.mappings().first()
    return ProjectOut(**dict(row))


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update a project (partial update)
    """
    # Check if project exists
    project_check = text("SELECT id FROM projects WHERE id = :project_id")
    project_result = await db.execute(project_check, {"project_id": project_id})
    if not project_result.first():
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    # Check code uniqueness if updating code
    if project_update.code is not None:
        code_check = text("SELECT id FROM projects WHERE code = :code AND id != :project_id")
        code_result = await db.execute(code_check, {"code": project_update.code, "project_id": project_id})
        if code_result.first():
            raise HTTPException(status_code=400, detail=f"Project code '{project_update.code}' already exists")

    # Build UPDATE query dynamically
    update_fields = []
    params = {"project_id": project_id}

    if project_update.code is not None:
        update_fields.append("code = :code")
        params["code"] = project_update.code

    if project_update.name is not None:
        update_fields.append("name = :name")
        params["name"] = project_update.name

    if project_update.customer_code is not None:
        update_fields.append("customer_code = :customer_code")
        params["customer_code"] = project_update.customer_code

    if project_update.customer_name is not None:
        update_fields.append("customer_name = :customer_name")
        params["customer_name"] = project_update.customer_name

    if project_update.status is not None:
        update_fields.append("status = :status")
        params["status"] = project_update.status

    if project_update.ordered_at is not None:
        update_fields.append("ordered_at = :ordered_at")
        params["ordered_at"] = project_update.ordered_at

    if project_update.paused_at is not None:
        update_fields.append("paused_at = :paused_at")
        params["paused_at"] = project_update.paused_at

    if project_update.completed_at is not None:
        update_fields.append("completed_at = :completed_at")
        params["completed_at"] = project_update.completed_at

    if project_update.due_at is not None:
        update_fields.append("due_at = :due_at")
        params["due_at"] = project_update.due_at

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields.append("updated_at = now()")

    update_query = text(f"""
        UPDATE projects
        SET {', '.join(update_fields)}
        WHERE id = :project_id
        RETURNING 
            id, code, name, customer_code, customer_name, status,
            ordered_at, paused_at, completed_at, due_at,
            created_at, updated_at
    """)

    result = await db.execute(update_query, params)
    await db.commit()

    row = result.mappings().first()
    return ProjectOut(**dict(row))


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a project (hard delete)
    Note: Will fail if tasks or classifications reference this project (ON DELETE CASCADE)
    """
    # Check if project exists
    project_check = text("SELECT id FROM projects WHERE id = :project_id")
    project_result = await db.execute(project_check, {"project_id": project_id})
    if not project_result.first():
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    # Delete project
    delete_query = text("DELETE FROM projects WHERE id = :project_id")
    await db.execute(delete_query, {"project_id": project_id})
    await db.commit()

    return None
