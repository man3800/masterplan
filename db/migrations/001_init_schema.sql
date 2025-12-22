-- 001_init_schema.sql
BEGIN;

-- 프로젝트(있다면)
CREATE TABLE IF NOT EXISTS projects (
  id          BIGSERIAL PRIMARY KEY,
  code        TEXT UNIQUE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 분류(재귀)
CREATE TABLE IF NOT EXISTS classifications (
  id          BIGSERIAL PRIMARY KEY,
  project_id  BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id   BIGINT NULL REFERENCES classifications(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  depth       INT  NOT NULL DEFAULT 0,
  path        TEXT NOT NULL,              -- 예: /대분류/중분류/소분류
  sort_no     INT  NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 같은 부모 아래 같은 이름 중복 방지(원하면)
  CONSTRAINT uq_class_sibling UNIQUE (project_id, parent_id, name),

  -- 경로 유일(강추)
  CONSTRAINT uq_class_path UNIQUE (project_id, path)
);

CREATE INDEX IF NOT EXISTS ix_class_project_parent ON classifications(project_id, parent_id);
CREATE INDEX IF NOT EXISTS ix_class_project_path   ON classifications(project_id, path);

-- 작업(leaf)
CREATE TABLE IF NOT EXISTS tasks (
  id              BIGSERIAL PRIMARY KEY,
  project_id      BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  classification_id BIGINT NOT NULL REFERENCES classifications(id) ON DELETE RESTRICT,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_tasks_project_class ON tasks(project_id, classification_id);

-- 업데이트 v1.0.0
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
    CREATE TYPE project_status AS ENUM ('pending','in_progress','paused','done');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS projects (
  id              BIGSERIAL PRIMARY KEY,

  -- 내부/표시 식별자
  code            TEXT UNIQUE,
  name            TEXT NOT NULL,

  -- 수주처 (MVP: 컬럼 / 추후 customer 테이블로 분리 가능)
  customer_code   TEXT,
  customer_name   TEXT,

  -- 프로젝트 상태
  status          project_status NOT NULL DEFAULT 'pending',

  -- 주요 날짜
  ordered_at      DATE,   -- 수주일
  paused_at       DATE,   -- 중단일
  completed_at    DATE,   -- 완료일
  due_at          DATE,   -- 납기일

  -- 시스템 메타
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id              BIGSERIAL PRIMARY KEY,

  -- 내부/표시 식별자
  code            TEXT UNIQUE,
  name            TEXT NOT NULL,

  -- 수주처 (MVP: 컬럼 / 추후 customer 테이블로 분리 가능)
  customer_code   TEXT,
  customer_name   TEXT,

  -- 프로젝트 상태
  status          project_status NOT NULL DEFAULT 'pending',

  -- 주요 날짜
  ordered_at      DATE,   -- 수주일
  paused_at       DATE,   -- 중단일
  completed_at    DATE,   -- 완료일
  due_at          DATE,   -- 납기일

  -- 시스템 메타
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

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


COMMIT;
