from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from pathlib import Path
import json

router = APIRouter(prefix="/projects", tags=["projects-new"])

# SQL 파일 경로 (프로젝트 루트 기준)
SQL_DIR = Path(__file__).parent.parent.parent.parent / "db" / "sql" / "queries"

@router.get("")
async def list_projects(db: AsyncSession = Depends(get_db)):
    """프로젝트 목록 조회 (프론트엔드 호환: erp_project_key, project_name)"""
    q = text("""
        SELECT 
            code AS erp_project_key,
            name AS project_name
        FROM projects
        ORDER BY name;
    """)
    rows = (await db.execute(q)).mappings().all()
    return [{"erp_project_key": r["erp_project_key"], "project_name": r["project_name"]} for r in rows]


@router.get("/{project_code}/classifications/tree")
async def get_classification_tree(
    project_code: str,
    db: AsyncSession = Depends(get_db)
):
    """분류 트리 조회 (JSON 형태)"""
    # 프로젝트 코드 변환 (erp_project_key 형식 지원: "HB-130X(#1035)" -> "HB-130X-1035")
    # 프론트엔드에서 erp_project_key를 사용하므로 code로 변환 필요
    code = project_code.replace("(#", "-").replace(")", "")
    
    # 프로젝트 존재 확인
    project_check = text("SELECT id FROM projects WHERE code = :code")
    project_result = await db.execute(project_check, {"code": code})
    project = project_result.first()
    
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_code}' not found")
    
    # SQL 파일 읽기
    sql_file = SQL_DIR / "classification_tree_json.sql"
    if not sql_file.exists():
        raise HTTPException(status_code=500, detail="SQL file not found")
    
    sql_query = sql_file.read_text(encoding="utf-8")
    
    # 쿼리 실행 (변환된 code 사용)
    result = await db.execute(text(sql_query), {"project_code": code})
    rows = result.mappings().all()
    
    # 트리 구조로 변환
    tree = []
    l1_map = {}  # 대분류
    l2_map = {}  # 중분류
    
    for row in rows:
        depth = row["depth"]
        node_id = row["id"]
        node_name = row["name"]
        node_path = row["path"]
        parent_id = row["parent_id"]
        
        if depth == 0:  # 대분류
            node = {
                "id": node_id,
                "name": node_name,
                "path": node_path,
                "children": []
            }
            l1_map[node_id] = node
            tree.append(node)
        
        elif depth == 1:  # 중분류
            node = {
                "id": node_id,
                "name": node_name,
                "path": node_path,
                "children": []
            }
            l2_map[node_id] = node
            if parent_id in l1_map:
                l1_map[parent_id]["children"].append(node)
        
        elif depth == 2:  # 소분류
            # 프론트엔드가 owner_dept_id를 기대하므로 추가 필요 (현재는 null로 설정)
            node = {
                "id": node_id,
                "name": node_name,
                "path": node_path,
                "owner_dept_id": ""  # TODO: classifications 테이블에 owner_dept_id 필드 추가 필요
            }
            if parent_id in l2_map:
                l2_map[parent_id]["children"].append(node)
    
    return tree


@router.get("/{project_code}/classifications/flat")
async def get_classification_flat(
    project_code: str,
    db: AsyncSession = Depends(get_db)
):
    """분류 평면 리스트 조회"""
    # 프로젝트 코드 변환
    code = project_code.replace("(#", "-").replace(")", "")
    
    # 프로젝트 존재 확인
    project_check = text("SELECT id FROM projects WHERE code = :code")
    project_result = await db.execute(project_check, {"code": code})
    project = project_result.first()
    
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_code}' not found")
    
    # SQL 파일 읽기
    sql_file = SQL_DIR / "classification_flat_3levels.sql"
    if not sql_file.exists():
        raise HTTPException(status_code=500, detail="SQL file not found")
    
    sql_query = sql_file.read_text(encoding="utf-8")
    
    # 쿼리 실행 (변환된 code 사용)
    result = await db.execute(text(sql_query), {"project_code": code})
    rows = result.mappings().all()
    
    # API 계약서에 맞게 필드명 변경 (l1_name -> l1 등)
    return [
        {
            "l1": r["l1_name"],
            "l2": r["l2_name"],
            "l3": r["l3_name"],
            "path": r["l3_path"],
            "sort_no": r["l3_sort_no"]
        }
        for r in rows
    ]

