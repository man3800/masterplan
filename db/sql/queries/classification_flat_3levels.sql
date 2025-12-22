-- 분류 평면 리스트 조회 (대/중/소 컬럼)
-- 프로젝트 코드를 파라미터로 받아서 평면 리스트 반환
-- 컬럼: l1_name, l2_name, l3_name, l3_path, l3_sort_no

SELECT 
  l1.name AS l1_name,
  l2.name AS l2_name,
  l3.name AS l3_name,
  l3.path AS l3_path,
  l3.sort_no AS l3_sort_no
FROM classifications l3
INNER JOIN classifications l2 ON l3.parent_id = l2.id
INNER JOIN classifications l1 ON l2.parent_id = l1.id
INNER JOIN projects p ON l3.project_id = p.id
WHERE p.code = :project_code
  AND l3.depth = 2
  AND l3.is_active = TRUE
  AND l2.is_active = TRUE
  AND l1.is_active = TRUE
ORDER BY 
  l3.sort_no ASC,
  l1.name ASC,
  l2.name ASC,
  l3.name ASC;

