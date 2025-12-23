BEGIN;

-- Helps prefix LIKE queries: path LIKE '/ROOT/%'
CREATE INDEX IF NOT EXISTS ix_class_project_path_prefix
  ON public.classifications (project_id, path text_pattern_ops);

COMMIT;