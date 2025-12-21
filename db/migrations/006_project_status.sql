-- =========================
-- 1. 프로젝트 상태 마스터
-- =========================
create table if not exists project_status (
  status_id       bigserial primary key,
  status_code     text not null unique,     -- WAIT, PROG, PAUSE, DONE
  status_name     text not null,             -- 대기(수주), 진행, 중단, 완료
  display_order   int not null default 0,
  is_active       boolean not null default true,

  created_at      timestamptz not null default now(),
  created_by      text,
  updated_at      timestamptz,
  updated_by      text
);

create index if not exists ix_project_status_active
  on project_status(is_active, display_order);
