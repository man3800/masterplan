BEGIN;

CREATE TABLE IF NOT EXISTS public.classifications (
  id            BIGSERIAL PRIMARY KEY,
  project_id    BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id     BIGINT NULL REFERENCES public.classifications(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  depth         INT  NOT NULL DEFAULT 0,
  path          TEXT NOT NULL,
  sort_no       INT  NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  owner_dept_id BIGINT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_class_sibling UNIQUE (project_id, parent_id, name),
  CONSTRAINT uq_class_path    UNIQUE (project_id, path)
);

CREATE INDEX IF NOT EXISTS ix_class_project_parent
  ON public.classifications(project_id, parent_id);

CREATE INDEX IF NOT EXISTS ix_class_project_path
  ON public.classifications(project_id, path);

CREATE INDEX IF NOT EXISTS ix_class_project_parent_sort
  ON public.classifications(project_id, parent_id, sort_no, name);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_classifications_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_classifications_set_updated_at
    BEFORE UPDATE ON public.classifications
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

COMMIT;