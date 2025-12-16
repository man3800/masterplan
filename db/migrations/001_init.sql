-- MasterPlan DB Init (v0.8, MVP)
-- - PK: bigserial
-- - schedule_item: project + cat_s(소분류) 1회만 허용
-- - project_due: 프로젝트 최종 납기(영업)
-- - schedule_plan: baseline 필수, current는 변경 시 사용
-- - schedule_actual: 시작/종료 1회
-- - audit_log.reason_code: NULL 허용 (중요 변경 사유 필수는 API에서 강제)

-- 실행: psql -h 127.0.0.1 -U postgres -d masterplan -f db/migrations/001_init.sql

-- =========================
-- 0) 부서/사용자/권한
-- =========================

create table if not exists departments (
  dept_id       text primary key,
  dept_name     text not null,
  sort_order    int  not null default 0,
  is_active     boolean not null default true
);

create table if not exists users (
  user_id       text primary key,
  user_name     text not null,
  dept_id       text not null references departments(dept_id),
  is_active     boolean not null default true
);

create table if not exists permissions_user (
  perm_id       bigserial primary key,
  user_id       text not null references users(user_id),
  perm_key      text not null,                 -- ADMIN 등
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists ix_permissions_user_user on permissions_user(user_id);
create index if not exists ix_permissions_user_key  on permissions_user(perm_key);


-- =========================
-- 1) ERP 프로젝트 캐시
-- =========================

create table if not exists erp_projects_cache (
  erp_project_key   text primary key,
  project_name      text not null,
  customer_name     text,
  machine_type_code text,
  machine_type_name text,
  contract_due_date date,
  last_synced_at    timestamptz
);

create index if not exists ix_erp_projects_cache_name on erp_projects_cache(project_name);


-- =========================
-- 2) 분류(대/중/소)
-- =========================

create table if not exists category_l (
  cat_l_id     bigserial primary key,
  name         text not null,
  sort_order   int  not null default 0,
  is_active    boolean not null default true
);

create table if not exists category_m (
  cat_m_id     bigserial primary key,
  cat_l_id     bigint not null references category_l(cat_l_id),
  name         text not null,
  sort_order   int  not null default 0,
  is_active    boolean not null default true
);

create table if not exists category_s (
  cat_s_id         bigserial primary key,
  name             text not null,                        -- 소분류명(=작업명)
  owner_dept_id    text references departments(dept_id), -- 담당부서(기본)
  sort_order       int  not null default 0,
  is_active        boolean not null default true
);

-- 소분류가 여러 중분류에 매핑될 수 있음 (UI 계층 표현용)
create table if not exists category_s_map_m (
  id          bigserial primary key,
  cat_m_id    bigint not null references category_m(cat_m_id),
  cat_s_id    bigint not null references category_s(cat_s_id),
  is_default  boolean not null default false,
  unique(cat_m_id, cat_s_id)
);

create index if not exists ix_category_s_owner_dept on category_s(owner_dept_id);


-- =========================
-- 3) 프로젝트별 작업 Row (소분류 1회만 선택 가능)
-- =========================

create table if not exists schedule_item (
  item_id         bigserial primary key,
  erp_project_key text not null references erp_projects_cache(erp_project_key),
  cat_s_id        bigint not null references category_s(cat_s_id),

  owner_dept_id   text references departments(dept_id), -- 권한 판단/담당(복제 저장 가능)
  status          text not null default 'not_started',

  created_at      timestamptz not null default now(),
  created_by      text,
  updated_at      timestamptz,
  updated_by      text,
  deleted_at      timestamptz,
  deleted_by      text,

  unique(erp_project_key, cat_s_id)
);

create index if not exists ix_schedule_item_project on schedule_item(erp_project_key);
create index if not exists ix_schedule_item_owner   on schedule_item(owner_dept_id);


-- =========================
-- 4) 계획 Plan (baseline/current)
-- =========================

create table if not exists schedule_plan (
  plan_id      bigserial primary key,
  item_id      bigint not null references schedule_item(item_id),

  plan_kind    text not null check (plan_kind in ('baseline','current')),
  start_date   date not null,
  end_date     date not null,
  plan_note    text,

  created_at   timestamptz not null default now(),
  created_by   text,
  updated_at   timestamptz,
  updated_by   text,
  deleted_at   timestamptz,
  deleted_by   text,

  unique(item_id, plan_kind),
  check (start_date <= end_date)
);

create index if not exists ix_schedule_plan_item_kind on schedule_plan(item_id, plan_kind);


-- =========================
-- 5) 실적 Actual (작업당 1회)
-- =========================

create table if not exists schedule_actual (
  actual_id          bigserial primary key,
  item_id            bigint not null references schedule_item(item_id),

  actual_start_date  date,
  actual_end_date    date,
  memo               text,

  created_at         timestamptz not null default now(),
  created_by         text,
  updated_at         timestamptz,
  updated_by         text,
  deleted_at         timestamptz,
  deleted_by         text,

  unique(item_id),
  check (
    actual_start_date is null
    or actual_end_date is null
    or actual_start_date <= actual_end_date
  )
);

create index if not exists ix_schedule_actual_item on schedule_actual(item_id);


-- =========================
-- 6) 프로젝트 최종 납기 (프로젝트당 1개)
-- =========================

create table if not exists project_due (
  due_id            bigserial primary key,
  erp_project_key   text not null unique references erp_projects_cache(erp_project_key),

  baseline_due_date date not null,
  current_due_date  date,

  created_at        timestamptz not null default now(),
  created_by        text,
  updated_at        timestamptz,
  updated_by        text,

  check (current_due_date is null or current_due_date <> baseline_due_date)
);

create index if not exists ix_project_due_project on project_due(erp_project_key);


-- =========================
-- 7) 사유 코드 + 감사 로그 (reason_code는 NULL 허용)
-- =========================

create table if not exists reason_code (
  reason_code    text primary key,
  reason_name    text not null,
  reason_type    text not null check (reason_type in ('plan_change','delay','etc')),
  requires_note  boolean not null default false,
  is_active      boolean not null default true,
  sort_order     int not null default 0
);

create table if not exists audit_log (
  audit_id      bigserial primary key,

  entity_type   text not null,        -- 'project_due','schedule_item','schedule_plan','schedule_actual'
  entity_id     bigint not null,
  action        text not null check (action in ('CREATE','UPDATE','DELETE')),

  changed_at    timestamptz not null default now(),
  changed_by    text not null references users(user_id),
  dept_id       text references departments(dept_id),

  reason_code   text references reason_code(reason_code),   -- NULL 허용 (중요 변경은 API에서 필수)
  reason_note   text,

  before_json   jsonb,
  after_json    jsonb
);

create index if not exists ix_audit_entity on audit_log(entity_type, entity_id, changed_at desc);
create index if not exists ix_audit_reason on audit_log(reason_code, changed_at desc);


-- =========================
-- 8) 조회용 뷰: 상태 계산 (기준 종료일 A 룰)
--    - 기준 종료일: current 있으면 current_end, 없으면 baseline_end
--    - plan_shift: current_end > baseline_end => extended, < => pulled_in
--    - is_progress_delayed: 오늘 > 기준종료일 && actual_end is null
-- =========================

create or replace view v_schedule_item_status as
select
  si.item_id,
  si.erp_project_key,
  si.cat_s_id,
  cs.name as cat_s_name,
  si.owner_dept_id,
  si.status,

  pb.start_date as baseline_start,
  pb.end_date   as baseline_end,
  pc.start_date as current_start,
  pc.end_date   as current_end,

  coalesce(pc.end_date, pb.end_date) as due_end_basis,

  case
    when pc.plan_id is null then null
    when pc.end_date > pb.end_date then 'extended'
    when pc.end_date < pb.end_date then 'pulled_in'
    else null
  end as plan_shift,

  sa.actual_start_date,
  sa.actual_end_date,

  case
    when sa.actual_end_date is null
     and coalesce(pc.end_date, pb.end_date) < current_date
      then true
    else false
  end as is_progress_delayed

from schedule_item si
join category_s cs
  on cs.cat_s_id = si.cat_s_id
join schedule_plan pb
  on pb.item_id = si.item_id
 and pb.plan_kind='baseline'
 and pb.deleted_at is null
left join schedule_plan pc
  on pc.item_id = si.item_id
 and pc.plan_kind='current'
 and pc.deleted_at is null
left join schedule_actual sa
  on sa.item_id = si.item_id
 and sa.deleted_at is null
where si.deleted_at is null;
