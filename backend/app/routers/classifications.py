"""
Classifications CRUD API Router
Based on actual schema: classifications table
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.classification import ClassificationCreate, ClassificationUpdate, ClassificationOut, ClassificationTreeNode

router = APIRouter(prefix="/classifications", tags=["classifications"])


@router.get("/tree", response_model=List[ClassificationTreeNode])
async def get_classification_tree(
    project_id: int = Query(..., ge=1, description="Project ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get classification tree for a project
    Uses v_classifications_under_root view if available, otherwise recursive CTE
    """
    # Check if project exists
    project_check = text("SELECT id FROM projects WHERE id = :project_id")
    project_result = await db.execute(project_check, {"project_id": project_id})
    if not project_result.first():
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    # Use view if available, otherwise use recursive CTE
    # 모든 분류를 가져오도록 is_active 조건 제거
    query = text("""
        WITH RECURSIVE tree AS (
            SELECT 
                id, project_id, parent_id, name, depth, path, sort_no, is_active,
                owner_dept_id, created_at, updated_at
            FROM classifications
            WHERE project_id = :project_id AND parent_id IS NULL
            UNION ALL
            SELECT 
                c.id, c.project_id, c.parent_id, c.name, c.depth, c.path, c.sort_no, c.is_active,
                c.owner_dept_id, c.created_at, c.updated_at
            FROM classifications c
            INNER JOIN tree t ON c.parent_id = t.id
            WHERE c.project_id = :project_id
        )
        SELECT 
            id, project_id, parent_id, name, depth, path, sort_no, is_active,
            owner_dept_id, created_at, updated_at
        FROM tree
        ORDER BY depth, sort_no, name
    """)
    result = await db.execute(query, {"project_id": project_id})
    rows = result.mappings().all()

    # Build tree structure
    # 모든 노드를 ClassificationTreeNode로 변환하여 저장
    node_map: dict[int, ClassificationTreeNode] = {}
    tree: list[ClassificationTreeNode] = []

    # 1단계: 모든 노드를 ClassificationTreeNode로 생성
    for row in rows:
        node_id = row["id"]
        node_map[node_id] = ClassificationTreeNode(**dict(row), children=[])

    # 2단계: 부모-자식 관계 연결
    for row in rows:
        node_id = row["id"]
        parent_id = row["parent_id"]
        
        if parent_id is None:
            # Root node - tree에 추가
            tree.append(node_map[node_id])
        else:
            # Child node - 부모의 children에 추가
            if parent_id in node_map:
                node_map[parent_id].children.append(node_map[node_id])

    return tree


@router.get("", response_model=List[ClassificationOut])
async def list_classifications(
    project_id: Optional[int] = Query(None, ge=1, description="Filter by project_id"),
    parent_id: Optional[int] = Query(None, description="Filter by parent_id (NULL for root)"),
    is_active: Optional[bool] = Query(None, description="Filter by is_active"),
    limit: int = Query(50, ge=1, le=200, description="Limit (max 200)"),
    offset: int = Query(0, ge=0, description="Offset"),
    sort: str = Query("sort_no asc, name asc", description="Sort order"),
    db: AsyncSession = Depends(get_db),
):
    """
    List classifications with filtering and pagination
    """
    conditions = []
    params = {}

    if project_id:
        conditions.append("project_id = :project_id")
        params["project_id"] = project_id

    if parent_id is not None:
        if parent_id == 0:  # Special case: 0 means NULL
            conditions.append("parent_id IS NULL")
        else:
            conditions.append("parent_id = :parent_id")
            params["parent_id"] = parent_id

    if is_active is not None:
        conditions.append("is_active = :is_active")
        params["is_active"] = is_active

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    # Validate sort (prevent SQL injection)
    allowed_sort_columns = ["id", "name", "depth", "path", "sort_no", "is_active", "created_at", "updated_at"]
    sort_parts = sort.lower().split()
    if len(sort_parts) < 2:
        sort = "sort_no asc, name asc"
    else:
        # Simple validation - allow multiple columns
        validated_parts = []
        for i in range(0, len(sort_parts), 2):
            if i < len(sort_parts):
                col = sort_parts[i]
                if col in allowed_sort_columns:
                    dir = sort_parts[i+1] if i+1 < len(sort_parts) and sort_parts[i+1] in ["asc", "desc"] else "asc"
                    validated_parts.append(f"{col} {dir}")
        sort = ", ".join(validated_parts) if validated_parts else "sort_no asc, name asc"

    query = text(f"""
        SELECT 
            id, project_id, parent_id, name, depth, path, sort_no, is_active,
            owner_dept_id, created_at, updated_at
        FROM classifications
        WHERE {where_clause}
        ORDER BY {sort}
        LIMIT :limit OFFSET :offset
    """)
    params.update({"limit": limit, "offset": offset})

    result = await db.execute(query, params)
    rows = result.mappings().all()

    return [ClassificationOut(**dict(row)) for row in rows]


@router.get("/{classification_id}", response_model=ClassificationOut)
async def get_classification(
    classification_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a single classification by ID
    """
    query = text("""
        SELECT 
            id, project_id, parent_id, name, depth, path, sort_no, is_active,
            owner_dept_id, created_at, updated_at
        FROM classifications
        WHERE id = :classification_id
    """)
    result = await db.execute(query, {"classification_id": classification_id})
    row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail=f"Classification {classification_id} not found")

    return ClassificationOut(**dict(row))


@router.post("", response_model=ClassificationOut, status_code=201)
async def create_classification(
    classification: ClassificationCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new classification
    Note: path and depth are auto-managed by DB triggers
    """
    # Verify project exists
    project_check = text("SELECT id FROM projects WHERE id = :project_id")
    project_result = await db.execute(project_check, {"project_id": classification.project_id})
    if not project_result.first():
        raise HTTPException(status_code=404, detail=f"Project {classification.project_id} not found")

    # ROOT 생성 전용 로직: parent_id가 NULL이고 name이 'ROOT'인 경우만 허용
    if classification.parent_id is None:
        if classification.name.upper() != "ROOT":
            raise HTTPException(
                status_code=400,
                detail="parent_id가 NULL인 분류는 ROOT만 허용됩니다. 모든 분류는 ROOT 아래에 생성되어야 합니다."
            )
        # ROOT 중복 체크: 프로젝트당 ROOT는 1개만 허용
        root_check = text("""
            SELECT id FROM classifications 
            WHERE project_id = :project_id AND parent_id IS NULL AND name = 'ROOT'
        """)
        root_result = await db.execute(root_check, {"project_id": classification.project_id})
        if root_result.first():
            raise HTTPException(
                status_code=409,
                detail="이 프로젝트에는 이미 ROOT 노드가 존재합니다. 프로젝트당 ROOT는 1개만 허용됩니다."
            )

    # Verify parent exists if provided
    if classification.parent_id:
        parent_check = text("""
            SELECT id FROM classifications 
            WHERE id = :parent_id AND project_id = :project_id AND is_active = TRUE
        """)
        parent_result = await db.execute(parent_check, {
            "parent_id": classification.parent_id,
            "project_id": classification.project_id
        })
        if not parent_result.first():
            raise HTTPException(
                status_code=404,
                detail=f"Parent classification {classification.parent_id} not found or inactive"
            )

    # Check for duplicate name under the same parent (uq_class_sibling constraint)
    duplicate_check = text("""
        SELECT id, name FROM classifications 
        WHERE project_id = :project_id 
          AND (parent_id = :parent_id OR (parent_id IS NULL AND :parent_id IS NULL))
          AND name = :name
    """)
    duplicate_result = await db.execute(duplicate_check, {
        "project_id": classification.project_id,
        "parent_id": classification.parent_id,
        "name": classification.name,
    })
    existing = duplicate_result.first()
    if existing:
        parent_info = f"부모 ID {classification.parent_id} 아래" if classification.parent_id else "최상위 레벨"
        raise HTTPException(
            status_code=409,
            detail=f"이미 존재하는 분류입니다: {parent_info}에 '{classification.name}' 이름이 이미 있습니다."
        )

    # Insert classification (path and depth will be auto-calculated by trigger)
    insert_query = text("""
        INSERT INTO classifications (
            project_id, parent_id, name, sort_no, is_active, owner_dept_id,
            created_at, updated_at
        ) VALUES (
            :project_id, :parent_id, :name, :sort_no, :is_active, :owner_dept_id,
            now(), now()
        ) RETURNING 
            id, project_id, parent_id, name, depth, path, sort_no, is_active,
            owner_dept_id, created_at, updated_at
    """)
    result = await db.execute(insert_query, {
        "project_id": classification.project_id,
        "parent_id": classification.parent_id,
        "name": classification.name,
        "sort_no": classification.sort_no,
        "is_active": classification.is_active,
        "owner_dept_id": classification.owner_dept_id,
    })
    await db.commit()

    row = result.mappings().first()
    return ClassificationOut(**dict(row))


@router.patch("/{classification_id}", response_model=ClassificationOut)
async def update_classification(
    classification_id: int,
    classification_update: ClassificationUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update a classification (partial update)
    Note: path and depth are auto-managed by DB triggers
    """
    # Check if classification exists
    classification_check = text("SELECT id FROM classifications WHERE id = :classification_id")
    classification_result = await db.execute(classification_check, {"classification_id": classification_id})
    if not classification_result.first():
        raise HTTPException(status_code=404, detail=f"Classification {classification_id} not found")

    # Build UPDATE query dynamically
    update_fields = []
    params = {"classification_id": classification_id}

    if classification_update.name is not None:
        update_fields.append("name = :name")
        params["name"] = classification_update.name

    if classification_update.parent_id is not None:
        # Verify new parent exists
        if classification_update.parent_id != 0:  # 0 means no change or special handling
            parent_check = text("""
                SELECT id FROM classifications 
                WHERE id = :parent_id AND is_active = TRUE
            """)
            parent_result = await db.execute(parent_check, {
                "parent_id": classification_update.parent_id
            })
            if not parent_result.first():
                raise HTTPException(
                    status_code=404,
                    detail=f"Parent classification {classification_update.parent_id} not found or inactive"
                )
        update_fields.append("parent_id = :parent_id")
        params["parent_id"] = classification_update.parent_id if classification_update.parent_id != 0 else None

    if classification_update.sort_no is not None:
        update_fields.append("sort_no = :sort_no")
        params["sort_no"] = classification_update.sort_no

    if classification_update.is_active is not None:
        update_fields.append("is_active = :is_active")
        params["is_active"] = classification_update.is_active

    if classification_update.owner_dept_id is not None:
        update_fields.append("owner_dept_id = :owner_dept_id")
        params["owner_dept_id"] = classification_update.owner_dept_id

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields.append("updated_at = now()")

    update_query = text(f"""
        UPDATE classifications
        SET {', '.join(update_fields)}
        WHERE id = :classification_id
        RETURNING 
            id, project_id, parent_id, name, depth, path, sort_no, is_active,
            owner_dept_id, created_at, updated_at
    """)

    result = await db.execute(update_query, params)
    await db.commit()

    row = result.mappings().first()
    return ClassificationOut(**dict(row))


@router.delete("/{classification_id}", status_code=204)
async def delete_classification(
    classification_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a classification
    Note: Will fail if children exist (ON DELETE RESTRICT)
    Recommendation: Use is_active=false instead
    """
    # Check if classification exists
    classification_check = text("SELECT id FROM classifications WHERE id = :classification_id")
    classification_result = await db.execute(classification_check, {"classification_id": classification_id})
    if not classification_result.first():
        raise HTTPException(status_code=404, detail=f"Classification {classification_id} not found")

    # Check if has children
    children_check = text("SELECT COUNT(*) FROM classifications WHERE parent_id = :classification_id")
    children_result = await db.execute(children_check, {"classification_id": classification_id})
    child_count = children_result.scalar()
    if child_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"자식 분류가 있어서 제거할 수 없습니다. 먼저 자식 분류를 제거하세요. (자식 분류 {child_count}개 존재)"
        )

    # Check if has connected tasks
    tasks_check = text("SELECT COUNT(*) FROM tasks WHERE classification_id = :classification_id")
    tasks_result = await db.execute(tasks_check, {"classification_id": classification_id})
    task_count = tasks_result.scalar()
    if task_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"연결된 작업이 있어서 제거할 수 없습니다. 먼저 해당 분류에 연결된 작업을 제거하세요. (연결된 작업 {task_count}개 존재)"
        )

    # Delete classification
    delete_query = text("DELETE FROM classifications WHERE id = :classification_id")
    await db.execute(delete_query, {"classification_id": classification_id})
    await db.commit()

    return None

