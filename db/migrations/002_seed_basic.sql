-- MasterPlan Seed Basic (v1.1, MVP 팀 버전)
-- - departments: 팀 단위(영업1, 생산1 등)
-- - users: 팀별 대표 1명 + 개발자 1명
-- - permissions_user: ADMIN 1명
-- - reason_code: 최소 세트 + ETC

-- 실행: psql -h 127.0.0.1 -U postgres -d masterplan -f db/migrations/002_seed_basic.sql

-- =========================
-- 1) Departments (Teams)
-- =========================
insert into departments (dept_id, dept_name, sort_order, is_active) values
  ('SALES1',  '영업1',  10, true),
  ('DESIGN1', '설계1',  20, true),
  ('PROD1',   '생산1',  30, true),
  ('BUY1',    '구매1',  40, true),
  ('ELEC1',   '전기1',  50, true),
  ('QA1',     '품질1',  60, true),
  ('FIELD1',  '현장1',  70, true)
on conflict (dept_id) do update
set dept_name = excluded.dept_name,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

-- =========================
-- 2) Users (MVP 샘플)
-- =========================
insert into users (user_id, user_name, dept_id, is_active) values
  ('dev',     '개발자',   'SALES1',  true),  -- MVP 편의상 임시 소속(원하면 DEV팀 만들어도 됨)
  ('sales1',  '영업1담당', 'SALES1',  true),
  ('design1', '설계1담당', 'DESIGN1', true),
  ('prod1',   '생산1담당', 'PROD1',   true),
  ('buy1',    '구매1담당', 'BUY1',    true),
  ('elec1',   '전기1담당', 'ELEC1',   true),
  ('qa1',     '품질1담당', 'QA1',     true),
  ('field1',  '현장1담당', 'FIELD1',  true)
on conflict (user_id) do update
set user_name = excluded.user_name,
    dept_id = excluded.dept_id,
    is_active = excluded.is_active;

-- =========================
-- 3) Permissions
-- =========================
insert into permissions_user (user_id, perm_key, is_active)
values ('dev', 'ADMIN', true)
on conflict do nothing;

-- =========================
-- 4) Reason Codes (최소 세트 + ETC)
-- =========================
insert into reason_code (reason_code, reason_name, reason_type, requires_note, is_active, sort_order) values
  ('CUST_REQ_CHANGE', '고객요구 변경', 'plan_change', false, true, 10),
  ('CONTRACT_CHANGE', '계약/스펙 변경', 'plan_change', false, true, 20),
  ('SCHEDULE_REALIGN','일정 재조정(내부 협의)', 'plan_change', false, true, 30),

  ('DESIGN_CHANGE', '설계 변경(ECR/도면)', 'delay', false, true, 110),
  ('PARTS_DELAY',   '부품 납기 지연(구매/외주)', 'delay', false, true, 120),
  ('QUALITY_ISSUE', '품질 이슈(불량/재작업)', 'delay', false, true, 130),
  ('RESOURCE_SHORT','리소스 부족(인력/설비)', 'delay', false, true, 140),
  ('FIELD_ISSUE',   '현장 이슈(설치/셋업)', 'delay', false, true, 150),

  ('ETC', '기타', 'etc', true, true, 999)
on conflict (reason_code) do update
set reason_name   = excluded.reason_name,
    reason_type   = excluded.reason_type,
    requires_note = excluded.requires_note,
    is_active     = excluded.is_active,
    sort_order    = excluded.sort_order;
