-- 분류 트리 조회 (JSON 형태)
-- 프로젝트 코드를 파라미터로 받아서 대/중/소 트리를 반환
-- 결과는 depth=0(대분류) -> depth=1(중분류) -> depth=2(소분류) 구조

WITH RECURSIVE tree AS (
  -- 루트 노드 (대분류, depth=0)
  SELECT 
    c.id,
    c.name,
    c.path,
    c.depth,
    c.sort_no,
    c.parent_id,
    ARRAY[c.id] AS path_ids,
    ARRAY[c.name] AS path_names
  FROM classifications c
  INNER JOIN projects p ON p.id = c.project_id
  WHERE p.code = :project_code
    AND c.depth = 0
    AND c.is_active = TRUE

  UNION ALL

  -- 자식 노드 (중분류, 소분류)
  SELECT 
    c.id,
    c.name,
    c.path,
    c.depth,
    c.sort_no,
    c.parent_id,
    t.path_ids || c.id,
    t.path_names || c.name
  FROM classifications c
  INNER JOIN tree t ON c.parent_id = t.id
  WHERE c.is_active = TRUE
    AND c.depth <= 2  -- MVP: 최대 3레벨
)
SELECT 
  id,
  name,
  path,
  depth,
  sort_no,
  parent_id
FROM tree
ORDER BY 
  CASE depth 
    WHEN 0 THEN 1 
    WHEN 1 THEN 2 
    WHEN 2 THEN 3 
  END,
  sort_no ASC,
  name ASC;

