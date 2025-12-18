from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter(prefix="/categories", tags=["categories"])

@router.get("/tree")
async def get_category_tree(db: AsyncSession = Depends(get_db)):
    q = text("""
        select
          l.cat_l_id, l.name as l_name, l.sort_order as l_sort,
          m.cat_m_id, m.name as m_name, m.sort_order as m_sort,
          s.cat_s_id, s.name as s_name, s.sort_order as s_sort,
          s.owner_dept_id
        from category_l l
        join category_m m on m.cat_l_id = l.cat_l_id and m.is_active = true
        join category_s_map_m sm on sm.cat_m_id = m.cat_m_id
        join category_s s on s.cat_s_id = sm.cat_s_id and s.is_active = true
        where l.is_active = true
        order by l.sort_order, l.name, m.sort_order, m.name, s.sort_order, s.name;
    """)
    rows = (await db.execute(q)).mappings().all()

    tree: list[dict] = []
    l_map: dict[int, dict] = {}
    m_map: dict[int, dict] = {}

    for r in rows:
        l_id = r["cat_l_id"]
        m_id = r["cat_m_id"]

        if l_id not in l_map:
            node_l = {"id": l_id, "name": r["l_name"], "children": []}
            l_map[l_id] = node_l
            tree.append(node_l)

        if m_id not in m_map:
            node_m = {"id": m_id, "name": r["m_name"], "children": []}
            m_map[m_id] = node_m
            l_map[l_id]["children"].append(node_m)

        m_map[m_id]["children"].append({
            "id": r["cat_s_id"],
            "name": r["s_name"],
            "owner_dept_id": r["owner_dept_id"],
        })

    return tree
