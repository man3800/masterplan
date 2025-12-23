BEGIN;

-- Function: set default classification to ROOT when NULL
CREATE OR REPLACE FUNCTION public.tasks_set_default_classification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  root_id BIGINT;
BEGIN
  -- Skip if classification already set
  IF NEW.classification_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- project_id is required
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find ROOT for the project
  SELECT c.id INTO root_id
  FROM public.classifications c
  WHERE c.project_id = NEW.project_id
    AND c.parent_id IS NULL
    AND c.name = 'ROOT'
  LIMIT 1;

  -- Create ROOT if missing
  IF root_id IS NULL THEN
    INSERT INTO public.classifications
      (project_id, parent_id, name, depth, path, sort_no, is_active)
    VALUES
      (NEW.project_id, NULL, 'ROOT', 0, '/ROOT', 0, TRUE)
    ON CONFLICT (project_id, path) DO NOTHING;

    SELECT c.id INTO root_id
    FROM public.classifications c
    WHERE c.project_id = NEW.project_id
      AND c.parent_id IS NULL
      AND c.name = 'ROOT'
    LIMIT 1;
  END IF;

  NEW.classification_id := root_id;
  RETURN NEW;
END $$;

-- Trigger: before insert on tasks
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='tasks'
      AND column_name='project_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'trg_tasks_set_default_classification'
    ) THEN
      CREATE TRIGGER trg_tasks_set_default_classification
      BEFORE INSERT ON public.tasks
      FOR EACH ROW
      EXECUTE FUNCTION public.tasks_set_default_classification();
    END IF;
  END IF;
END $$;

-- Optional but useful index
CREATE INDEX IF NOT EXISTS ix_tasks_project_classification
  ON public.tasks(project_id, classification_id);

COMMIT;