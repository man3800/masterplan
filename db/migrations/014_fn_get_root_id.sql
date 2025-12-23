BEGIN;

CREATE OR REPLACE FUNCTION public.get_root_classification_id(p_project_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  rid BIGINT;
BEGIN
  SELECT c.id INTO rid
  FROM public.classifications c
  WHERE c.project_id = p_project_id
    AND c.parent_id IS NULL
    AND c.name = 'ROOT'
  LIMIT 1;

  RETURN rid;
END $$;

COMMIT;