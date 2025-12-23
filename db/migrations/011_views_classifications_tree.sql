BEGIN;

-- A) Full tree view per project (recursive)
CREATE OR REPLACE VIEW public.v_classifications_tree AS
WITH RECURSIVE t AS (
  -- roots
  SELECT
    c.project_id,
    c.id,
    c.parent_id,
    c.name,
    c.depth,
    c.path,
    c.sort_no,
    c.is_active,
    c.id AS root_id,
    0  AS level
  FROM public.classifications c
  WHERE c.parent_id IS NULL

  UNION ALL

  -- children
  SELECT
    c.project_id,
    c.id,
    c.parent_id,
    c.name,
    c.depth,
    c.path,
    c.sort_no,
    c.is_active,
    t.root_id,
    t.level + 1 AS level
  FROM public.classifications c
  JOIN t ON t.project_id = c.project_id AND t.id = c.parent_id
)
SELECT *
FROM t;

-- B) Children count view (useful to decide if deletable / show expand icon)
CREATE OR REPLACE VIEW public.v_classifications_children_count AS
SELECT
  c.project_id,
  c.id,
  COUNT(ch.id) AS child_count
FROM public.classifications c
LEFT JOIN public.classifications ch
  ON ch.project_id = c.project_id
 AND ch.parent_id  = c.id
GROUP BY c.project_id, c.id;

COMMIT;