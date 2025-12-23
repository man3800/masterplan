BEGIN;

CREATE OR REPLACE VIEW public.v_classifications_under_root AS
WITH RECURSIVE t AS (
  SELECT
    c.project_id, c.id, c.parent_id, c.name, c.depth, c.path, c.sort_no, c.is_active,
    c.id AS root_id, 0 AS level
  FROM public.classifications c
  WHERE c.parent_id IS NULL AND c.name = 'ROOT'
  UNION ALL
  SELECT
    c.project_id, c.id, c.parent_id, c.name, c.depth, c.path, c.sort_no, c.is_active,
    t.root_id, t.level + 1
  FROM public.classifications c
  JOIN t ON t.project_id = c.project_id AND t.id = c.parent_id
)
SELECT * FROM t;

CREATE OR REPLACE VIEW public.v_classifications_root_children AS
SELECT c.*
FROM public.classifications c
JOIN public.classifications r
  ON r.project_id = c.project_id
 AND r.parent_id IS NULL
 AND r.name = 'ROOT'
WHERE c.parent_id = r.id;

COMMIT;