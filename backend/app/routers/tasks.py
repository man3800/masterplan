"""
Tasks CRUD API Router
Based on actual schema: tasks table
"""
from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.task import TaskCreate, TaskUpdate, TaskOut

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=List[TaskOut])
async def list_tasks(
    q: Optional[str] = Query(None, description="Search query (searches in title and description)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    project_id: Optional[int] = Query(None, ge=1, description="Filter by project_id"),
    classification_id: Optional[int] = Query(None, ge=1, description="Filter by classification_id"),
    limit: int = Query(50, ge=1, le=200, description="Limit (max 200)"),
    offset: int = Query(0, ge=0, description="Offset"),
    sort: str = Query("updated_at desc", description="Sort order (default: updated_at desc)"),
    db: AsyncSession = Depends(get_db),
):
    """
    List tasks with filtering, searching, and pagination
    """
    # Build WHERE clause
    conditions = []
    params = {}

    if q:
        conditions.append("(t.title ILIKE :q OR t.description ILIKE :q)")
        params["q"] = f"%{q}%"

    if status:
        conditions.append("t.status = :status")
        params["status"] = status

    if project_id:
        conditions.append("t.project_id = :project_id")
        params["project_id"] = project_id

    if classification_id:
        conditions.append("t.classification_id = :classification_id")
        params["classification_id"] = classification_id

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    # Validate sort (prevent SQL injection)
    allowed_sort_columns = ["id", "title", "status", "created_at", "updated_at", "baseline_start", "baseline_end"]
    sort_parts = sort.lower().split()
    if len(sort_parts) != 2 or sort_parts[0] not in allowed_sort_columns:
        sort = "updated_at desc"
    else:
        sort_dir = sort_parts[1] if sort_parts[1] in ["asc", "desc"] else "desc"
        sort = f"{sort_parts[0]} {sort_dir}"

    # Build query
    query = text(f"""
        SELECT 
            t.id,
            t.project_id,
            t.classification_id,
            t.title,
            t.description,
            t.status,
            t.baseline_start,
            t.baseline_end,
            t.actual_start_date,
            t.actual_end_date,
            t.created_at,
            t.updated_at
        FROM tasks t
        WHERE {where_clause}
        ORDER BY t.{sort}
        LIMIT :limit OFFSET :offset
    """)
    params.update({"limit": limit, "offset": offset})

    result = await db.execute(query, params)
    rows = result.mappings().all()

    return [TaskOut(**dict(row)) for row in rows]


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a single task by ID
    """
    query = text("""
        SELECT 
            id, project_id, classification_id, title, description, status,
            baseline_start, baseline_end, actual_start_date, actual_end_date,
            created_at, updated_at
        FROM tasks
        WHERE id = :task_id
    """)
    result = await db.execute(query, {"task_id": task_id})
    row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    return TaskOut(**dict(row))


@router.post("", response_model=TaskOut, status_code=201)
async def create_task(
    task: TaskCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new task
    """
    # Verify project exists
    project_check = text("SELECT id FROM projects WHERE id = :project_id")
    project_result = await db.execute(project_check, {"project_id": task.project_id})
    if not project_result.first():
        raise HTTPException(status_code=404, detail=f"Project {task.project_id} not found")

    # Verify classification exists
    classification_check = text("""
        SELECT id FROM classifications 
        WHERE id = :classification_id AND project_id = :project_id AND is_active = TRUE
    """)
    classification_result = await db.execute(classification_check, {
        "classification_id": task.classification_id,
        "project_id": task.project_id
    })
    if not classification_result.first():
        raise HTTPException(
            status_code=404,
            detail=f"Classification {task.classification_id} not found or inactive for project {task.project_id}"
        )

    # Insert task
    insert_query = text("""
        INSERT INTO tasks (
            project_id, classification_id, title, description, status,
            baseline_start, baseline_end, actual_start_date, actual_end_date,
            created_at, updated_at
        ) VALUES (
            :project_id, :classification_id, :title, :description, :status,
            :baseline_start, :baseline_end, :actual_start_date, :actual_end_date,
            now(), now()
        ) RETURNING 
            id, project_id, classification_id, title, description, status,
            baseline_start, baseline_end, actual_start_date, actual_end_date,
            created_at, updated_at
    """)
    result = await db.execute(insert_query, {
        "project_id": task.project_id,
        "classification_id": task.classification_id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "baseline_start": task.baseline_start,
        "baseline_end": task.baseline_end,
        "actual_start_date": task.actual_start_date,
        "actual_end_date": task.actual_end_date,
    })
    await db.commit()

    row = result.mappings().first()
    return TaskOut(**dict(row))


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: int,
    task_update: TaskUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update a task (partial update)
    """
    # Check if task exists
    task_check = text("SELECT id FROM tasks WHERE id = :task_id")
    task_result = await db.execute(task_check, {"task_id": task_id})
    if not task_result.first():
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    # Build UPDATE query dynamically
    update_fields = []
    params = {"task_id": task_id}

    if task_update.title is not None:
        update_fields.append("title = :title")
        params["title"] = task_update.title

    if task_update.description is not None:
        update_fields.append("description = :description")
        params["description"] = task_update.description

    if task_update.status is not None:
        update_fields.append("status = :status")
        params["status"] = task_update.status

    if task_update.classification_id is not None:
        # Verify classification exists
        classification_check = text("""
            SELECT id FROM classifications 
            WHERE id = :classification_id AND is_active = TRUE
        """)
        classification_result = await db.execute(classification_check, {
            "classification_id": task_update.classification_id
        })
        if not classification_result.first():
            raise HTTPException(
                status_code=404,
                detail=f"Classification {task_update.classification_id} not found or inactive"
            )
        update_fields.append("classification_id = :classification_id")
        params["classification_id"] = task_update.classification_id

    if task_update.baseline_start is not None:
        update_fields.append("baseline_start = :baseline_start")
        params["baseline_start"] = task_update.baseline_start

    if task_update.baseline_end is not None:
        update_fields.append("baseline_end = :baseline_end")
        params["baseline_end"] = task_update.baseline_end

    if task_update.actual_start_date is not None:
        update_fields.append("actual_start_date = :actual_start_date")
        params["actual_start_date"] = task_update.actual_start_date

    if task_update.actual_end_date is not None:
        update_fields.append("actual_end_date = :actual_end_date")
        params["actual_end_date"] = task_update.actual_end_date

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields.append("updated_at = now()")

    update_query = text(f"""
        UPDATE tasks
        SET {', '.join(update_fields)}
        WHERE id = :task_id
        RETURNING 
            id, project_id, classification_id, title, description, status,
            baseline_start, baseline_end, actual_start_date, actual_end_date,
            created_at, updated_at
    """)

    result = await db.execute(update_query, params)
    await db.commit()

    row = result.mappings().first()
    return TaskOut(**dict(row))


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a task (hard delete)
    Note: No soft delete column (deleted_at) exists in schema
    """
    # Check if task exists
    task_check = text("SELECT id FROM tasks WHERE id = :task_id")
    task_result = await db.execute(task_check, {"task_id": task_id})
    if not task_result.first():
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    # Delete task
    delete_query = text("DELETE FROM tasks WHERE id = :task_id")
    await db.execute(delete_query, {"task_id": task_id})
    await db.commit()

    return None


@router.post("/{task_id}/complete", response_model=TaskOut)
async def complete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Mark task as complete (sets status to 'closed')
    """
    update_query = text("""
        UPDATE tasks
        SET status = 'closed', updated_at = now()
        WHERE id = :task_id
        RETURNING 
            id, project_id, classification_id, title, description, status,
            baseline_start, baseline_end, actual_start_date, actual_end_date,
            created_at, updated_at
    """)
    result = await db.execute(update_query, {"task_id": task_id})
    await db.commit()

    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    return TaskOut(**dict(row))


@router.post("/{task_id}/reopen", response_model=TaskOut)
async def reopen_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Reopen a task (sets status to 'open')
    """
    update_query = text("""
        UPDATE tasks
        SET status = 'open', updated_at = now()
        WHERE id = :task_id
        RETURNING 
            id, project_id, classification_id, title, description, status,
            baseline_start, baseline_end, actual_start_date, actual_end_date,
            created_at, updated_at
    """)
    result = await db.execute(update_query, {"task_id": task_id})
    await db.commit()

    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    return TaskOut(**dict(row))

