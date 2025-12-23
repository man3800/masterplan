BEGIN;

-- Create ROOT classification per project if missing.
-- Rules:
--  - project_id: from public.projects
--  - parent_id: NULL (root)
--  - name: ROOT
--  - depth: 0
--  - path: /ROOT
--  - sort_no: 0
--  - is_active: true

INSERT INTO public.classifications
  (project_id, parent_id, name, depth, path, sort_no, is_active)
SELECT
  p.id AS project_id,
  NULL::bigint AS parent_id,
  'ROOT' AS name,
  0 AS depth,
  '/ROOT' AS path,
  0 AS sort_no,
  TRUE AS is_active
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.classifications c
  WHERE c.project_id = p.id
    AND c.parent_id IS NULL
    AND c.name = 'ROOT'
);

COMMIT;