-- 프로젝트 상태 ENUM 타입 생성
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
    CREATE TYPE project_status AS ENUM ('pending','in_progress','paused','done');
  END IF;
END $$;

-- 기존 테이블에 컬럼 추가 (없는 경우만)
DO $$
BEGIN
  -- customer_code 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'projects' AND column_name = 'customer_code') THEN
    ALTER TABLE projects ADD COLUMN customer_code TEXT;
  END IF;

  -- customer_name 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'projects' AND column_name = 'customer_name') THEN
    ALTER TABLE projects ADD COLUMN customer_name TEXT;
  END IF;

  -- status 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'projects' AND column_name = 'status') THEN
    ALTER TABLE projects ADD COLUMN status project_status NOT NULL DEFAULT 'pending';
  END IF;

  -- ordered_at 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'projects' AND column_name = 'ordered_at') THEN
    ALTER TABLE projects ADD COLUMN ordered_at DATE;
  END IF;

  -- paused_at 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'projects' AND column_name = 'paused_at') THEN
    ALTER TABLE projects ADD COLUMN paused_at DATE;
  END IF;

  -- completed_at 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'projects' AND column_name = 'completed_at') THEN
    ALTER TABLE projects ADD COLUMN completed_at DATE;
  END IF;

  -- due_at 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'projects' AND column_name = 'due_at') THEN
    ALTER TABLE projects ADD COLUMN due_at DATE;
  END IF;

  -- updated_at 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'projects' AND column_name = 'updated_at') THEN
    ALTER TABLE projects ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

ALTER TABLE projects
ADD CONSTRAINT ck_projects_status_dates CHECK (
  (status <> 'paused' OR paused_at IS NOT NULL)
  AND
  (status <> 'done' OR completed_at IS NOT NULL)
  AND
  (completed_at IS NULL OR status = 'done')
);

CREATE INDEX IF NOT EXISTS ix_projects_status
  ON projects(status);

CREATE INDEX IF NOT EXISTS ix_projects_due_at
  ON projects(due_at);

CREATE INDEX IF NOT EXISTS ix_projects_customer
  ON projects(customer_code);