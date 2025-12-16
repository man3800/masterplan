-- =========================
-- ERP 조직/사원/직책 캐시 + MasterPlan 매핑 (MVP)
-- =========================

-- 실행: psql -h 127.0.0.1 -U postgres -d masterplan -f db/migrations/004_erp_identity_mapping.sql

-- 1) ERP 부서 캐시 + MasterPlan 부서 매핑
create table if not exists erp_departments_cache (
  erp_dept_code   text primary key,            -- ERP 부서코드
  dept_name       text not null,               -- ERP 부서명
  is_active       boolean not null default true,
  last_synced_at  timestamptz,

  mp_dept_id      text references departments(dept_id)  -- MasterPlan 부서코드(SALES 등)로 매핑
);

create index if not exists ix_erp_dept_mp on erp_departments_cache(mp_dept_id);


-- 2) ERP 직책 캐시 (선택이지만 권장)
create table if not exists erp_positions_cache (
  erp_position_code text primary key,          -- ERP 직책코드
  position_name     text not null,
  sort_order        int not null default 0,
  is_active         boolean not null default true,
  last_synced_at    timestamptz
);


-- 3) ERP 사원 캐시 + MasterPlan 사용자 매핑
create table if not exists erp_employees_cache (
  erp_emp_no        text primary key,          -- ERP 사원번호
  emp_name          text not null,
  erp_dept_code     text references erp_departments_cache(erp_dept_code),
  erp_position_code text references erp_positions_cache(erp_position_code),

  email             text,
  is_active         boolean not null default true,
  last_synced_at    timestamptz,

  mp_user_id        text references users(user_id)       -- MasterPlan user_id로 매핑(내부 PK)
);

create index if not exists ix_erp_emp_mp   on erp_employees_cache(mp_user_id);
create index if not exists ix_erp_emp_dept on erp_employees_cache(erp_dept_code);
