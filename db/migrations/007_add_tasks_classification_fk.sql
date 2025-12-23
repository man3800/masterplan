BEGIN;

-- 1) add column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='tasks'
      AND column_name='classification_id'
  ) THEN
    ALTER TABLE public.tasks
      ADD COLUMN classification_id BIGINT;
  END IF;
END $$;

-- 2) index for joins/filtering
CREATE INDEX IF NOT EXISTS ix_tasks_classification_id
  ON public.tasks(classification_id);

-- 3) foreign key (create only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema='public'
      AND tc.table_name='tasks'
      AND tc.constraint_type='FOREIGN KEY'
      AND tc.constraint_name='fk_tasks_classification'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT fk_tasks_classification
      FOREIGN KEY (classification_id)
      REFERENCES public.classifications(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

COMMIT;