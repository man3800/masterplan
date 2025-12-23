BEGIN;

-- BEFORE trigger: compute depth/path and block cycles
CREATE OR REPLACE FUNCTION public.classifications_before_ins_upd()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  p_path  TEXT;
  p_depth INT;
  is_cycle BOOLEAN;
BEGIN
  -- Basic sanity: no self-parent
  IF TG_OP = 'UPDATE' THEN
    IF NEW.parent_id IS NOT NULL AND NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'parent_id cannot be self (id=%)', NEW.id;
    END IF;

    -- Block cycles: NEW.parent_id cannot be a descendant of NEW.id
    IF NEW.parent_id IS NOT NULL AND NEW.parent_id <> OLD.parent_id THEN
      WITH RECURSIVE up AS (
        SELECT c.id, c.parent_id
        FROM public.classifications c
        WHERE c.project_id = NEW.project_id AND c.id = NEW.parent_id
        UNION ALL
        SELECT c2.id, c2.parent_id
        FROM public.classifications c2
        JOIN up ON up.parent_id = c2.id
        WHERE c2.project_id = NEW.project_id
      )
      SELECT EXISTS (SELECT 1 FROM up WHERE id = NEW.id) INTO is_cycle;

      IF is_cycle THEN
        RAISE EXCEPTION 'cycle detected: cannot move node % under its descendant', NEW.id;
      END IF;
    END IF;
  END IF;

  -- Compute depth/path
  IF NEW.parent_id IS NULL THEN
    NEW.depth := 0;
    NEW.path  := '/' || NEW.name;
  ELSE
    SELECT c.path, c.depth
      INTO p_path, p_depth
    FROM public.classifications c
    WHERE c.project_id = NEW.project_id
      AND c.id = NEW.parent_id;

    IF p_path IS NULL THEN
      RAISE EXCEPTION 'parent not found (project_id=%, parent_id=%)', NEW.project_id, NEW.parent_id;
    END IF;

    NEW.depth := p_depth + 1;
    NEW.path  := p_path || '/' || NEW.name;
  END IF;

  -- keep updated_at
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- AFTER trigger: cascade update descendants when path/depth changed
CREATE OR REPLACE FUNCTION public.classifications_after_update_cascade()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_prefix TEXT := OLD.path;
  new_prefix TEXT := NEW.path;
  depth_delta INT := NEW.depth - OLD.depth;
BEGIN
  -- only when path/depth actually changed
  IF old_prefix = new_prefix AND depth_delta = 0 THEN
    RETURN NULL;
  END IF;

  -- Update descendants by prefix replacement
  UPDATE public.classifications d
  SET
    path = new_prefix || substr(d.path, length(old_prefix) + 1),
    depth = d.depth + depth_delta,
    updated_at = now()
  WHERE d.project_id = NEW.project_id
    AND d.path LIKE old_prefix || '/%';

  RETURN NULL;
END $$;

-- Attach triggers (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_classifications_biud') THEN
    CREATE TRIGGER trg_classifications_biud
    BEFORE INSERT OR UPDATE ON public.classifications
    FOR EACH ROW
    EXECUTE FUNCTION public.classifications_before_ins_upd();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_classifications_au_cascade') THEN
    CREATE TRIGGER trg_classifications_au_cascade
    AFTER UPDATE ON public.classifications
    FOR EACH ROW
    EXECUTE FUNCTION public.classifications_after_update_cascade();
  END IF;
END $$;

COMMIT;