-- MasterPlan Verify Script (v1.0)
-- 목적:
-- 1) seed/DDL 정상 여부 확인
-- 2) 테스트 프로젝트/분류/작업 Row/계획/실적/프로젝트 납기 데이터 넣기
-- 3) v_schedule_item_status 계산 결과 확인
--
-- 실행: psql -h 127.0.0.1 -U postgres -d masterplan -f db/migrations/003_verify.sql

begin;

-- =========================
-- 0) 테스트 키
-- =========================
-- 테스트 프로젝트 키(ERP 캐시용)
-- 실제 운영 데이터와 충돌 방지용 prefix 사용
-- =========================
-- TEST 프로젝트
insert into erp_projects_cache (
  erp_project_key, project_name, customer_name,
  machine_type_code, machine_type_name,
  contract_due_date, last_synced_at
) values (
  'TEST-PRJ-001', 'TEST 프로젝트 001', '테스트고객',
  'M01', 'TEST-MACHINE-01',
  current_date + 30, now()
)
on conflict (erp_project_key) do update
set project_name = excluded.project_name,
    customer_name = excluded.customer_name,
    machine_type_code = excluded.machine_type_code,
    machine_type_name = excluded.machine_type_name,
    contract_due_date = excluded.contract_due_date,
    last_synced_at = excluded.last_synced_at;

-- 프로젝트 최종 납기(영업)
insert into project_due (erp_project_key, baseline_due_date, current_due_date, created_by)
values ('TEST-PRJ-001', current_date + 30, current_date + 37, 'sales1')
on conflict (erp_project_key) do update
set baseline_due_date = excluded.baseline_due_date,
    current_due_date = excluded.current_due_date,
    updated_at = now(),
    updated_by = excluded.created_by;

-- =========================
-- 1) 분류 최소 샘플 생성 (대/중/소)
--    - 소분류가 Row(작업)이다.
-- =========================

-- L: 구매
insert into category_l (name, sort_order, is_active)
values ('구매', 10, true)
on conflict do nothing;

-- L: 생산
insert into category_l (name, sort_order, is_active)
values ('생산', 20, true)
on conflict do nothing;

-- M: 구매품
insert into category_m (cat_l_id, name, sort_order, is_active)
select l.cat_l_id, '구매품', 10, true
from category_l l
where l.name = '구매'
on conflict do nothing;

-- M: 가공
insert into category_m (cat_l_id, name, sort_order, is_active)
select l.cat_l_id, '가공', 20, true
from category_l l
where l.name = '생산'
on conflict do nothing;

-- S: 구매품 입고(구매팀)
insert into category_s (name, owner_dept_id, sort_order, is_active)
values ('구매품 입고', 'BUY1', 10, true)
on conflict do nothing;

-- S: 조립(생산팀)
insert into category_s (name, owner_dept_id, sort_order, is_active)
values ('조립', 'PROD1', 20, true)
on conflict do nothing;

-- S: 검수(품질팀)
insert into category_s (name, owner_dept_id, sort_order, is_active)
values ('검수', 'QA1', 30, true)
on conflict do nothing;

-- 소분류 ↔ 중분류 매핑(UI 계층 표시용)
-- 구매품 입고 -> 구매품
insert into category_s_map_m (cat_m_id, cat_s_id, is_default)
select m.cat_m_id, s.cat_s_id, true
from category_m m
join category_s s on s.name = '구매품 입고'
where m.name = '구매품'
on conflict (cat_m_id, cat_s_id) do update
set is_default = excluded.is_default;

-- 조립 -> 가공 (예시로 묶음)
insert into category_s_map_m (cat_m_id, cat_s_id, is_default)
select m.cat_m_id, s.cat_s_id, true
from category_m m
join category_s s on s.name = '조립'
where m.name = '가공'
on conflict (cat_m_id, cat_s_id) do update
set is_default = excluded.is_default;

-- 검수 -> 가공 (예시)
insert into category_s_map_m (cat_m_id, cat_s_id, is_default)
select m.cat_m_id, s.cat_s_id, false
from category_m m
join category_s s on s.name = '검수'
where m.name = '가공'
on conflict (cat_m_id, cat_s_id) do update
set is_default = excluded.is_default;

-- =========================
-- 2) 프로젝트에 Row(작업=소분류) 추가 + baseline 계획 필수
-- =========================

-- (A) 구매품 입고 Row 생성
insert into schedule_item (erp_project_key, cat_s_id, owner_dept_id, status, created_by)
select
  'TEST-PRJ-001',
  s.cat_s_id,
  s.owner_dept_id,
  'not_started',
  'buy1'
from category_s s
where s.name = '구매품 입고'
on conflict (erp_project_key, cat_s_id) do update
set owner_dept_id = excluded.owner_dept_id,
    updated_at = now(),
    updated_by = excluded.created_by;

-- baseline plan upsert: 구매품 입고
insert into schedule_plan (item_id, plan_kind, start_date, end_date, plan_note, created_by)
select
  si.item_id,
  'baseline',
  current_date + 1,
  current_date + 7,
  '테스트 baseline',
  'buy1'
from schedule_item si
join category_s s on s.cat_s_id = si.cat_s_id
where si.erp_project_key = 'TEST-PRJ-001'
  and s.name = '구매품 입고'
on conflict (item_id, plan_kind) do update
set start_date = excluded.start_date,
    end_date = excluded.end_date,
    plan_note = excluded.plan_note,
    updated_at = now(),
    updated_by = excluded.created_by;

-- current plan (앞당김/연장 테스트용: 여기서는 연장)
insert into schedule_plan (item_id, plan_kind, start_date, end_date, plan_note, created_by)
select
  si.item_id,
  'current',
  current_date + 1,
  current_date + 10,
  '테스트 current(연장)',
  'buy1'
from schedule_item si
join category_s s on s.cat_s_id = si.cat_s_id
where si.erp_project_key = 'TEST-PRJ-001'
  and s.name = '구매품 입고'
on conflict (item_id, plan_kind) do update
set start_date = excluded.start_date,
    end_date = excluded.end_date,
    plan_note = excluded.plan_note,
    updated_at = now(),
    updated_by = excluded.created_by;

-- (B) 조립 Row 생성
insert into schedule_item (erp_project_key, cat_s_id, owner_dept_id, status, created_by)
select
  'TEST-PRJ-001',
  s.cat_s_id,
  s.owner_dept_id,
  'not_started',
  'prod1'
from category_s s
where s.name = '조립'
on conflict (erp_project_key, cat_s_id) do update
set owner_dept_id = excluded.owner_dept_id,
    updated_at = now(),
    updated_by = excluded.created_by;

-- baseline plan: 조립 (짧게)
insert into schedule_plan (item_id, plan_kind, start_date, end_date, plan_note, created_by)
select
  si.item_id,
  'baseline',
  current_date + 8,
  current_date + 14,
  '조립 baseline',
  'prod1'
from schedule_item si
join category_s s on s.cat_s_id = si.cat_s_id
where si.erp_project_key = 'TEST-PRJ-001'
  and s.name = '조립'
on conflict (item_id, plan_kind) do update
set start_date = excluded.start_date,
    end_date = excluded.end_date,
    plan_note = excluded.plan_note,
    updated_at = now(),
    updated_by = excluded.created_by;

-- (C) 검수 Row 생성
insert into schedule_item (erp_project_key, cat_s_id, owner_dept_id, status, created_by)
select
  'TEST-PRJ-001',
  s.cat_s_id,
  s.owner_dept_id,
  'not_started',
  'qa1'
from category_s s
where s.name = '검수'
on conflict (erp_project_key, cat_s_id) do update
set owner_dept_id = excluded.owner_dept_id,
    updated_at = now(),
    updated_by = excluded.created_by;

-- baseline plan: 검수 (조립 다음)
insert into schedule_plan (item_id, plan_kind, start_date, end_date, plan_note, created_by)
select
  si.item_id,
  'baseline',
  current_date + 15,
  current_date + 18,
  '검수 baseline',
  'qa1'
from schedule_item si
join category_s s on s.cat_s_id = si.cat_s_id
where si.erp_project_key = 'TEST-PRJ-001'
  and s.name = '검수'
on conflict (item_id, plan_kind) do update
set start_date = excluded.start_date,
    end_date = excluded.end_date,
    plan_note = excluded.plan_note,
    updated_at = now(),
    updated_by = excluded.created_by;

-- =========================
-- 3) 실적 입력 테스트
--    - 구매품 입고: 아직 종료 없음 (진행지연 테스트는 날짜가 지나야 true)
-- =========================
insert into schedule_actual (item_id, actual_start_date, actual_end_date, memo, created_by)
select
  si.item_id,
  current_date + 2,
  null,
  '실적 테스트: 진행중',
  'buy1'
from schedule_item si
join category_s s on s.cat_s_id = si.cat_s_id
where si.erp_project_key = 'TEST-PRJ-001'
  and s.name = '구매품 입고'
on conflict (item_id) do update
set actual_start_date = excluded.actual_start_date,
    actual_end_date = excluded.actual_end_date,
    memo = excluded.memo,
    updated_at = now(),
    updated_by = excluded.created_by;

-- =========================
-- 4) 조회 검증
-- =========================

-- (1) 기본 테이블 건수 확인
select 'departments' as table_name, count(*) as cnt from departments;
select 'users' as table_name, count(*) as cnt from users;
select 'reason_code' as table_name, count(*) as cnt from reason_code;

-- (2) 테스트 프로젝트 확인
select * from erp_projects_cache where erp_project_key = 'TEST-PRJ-001';
select * from project_due where erp_project_key = 'TEST-PRJ-001';

-- (3) 테스트 분류 확인
select 'L' as lvl, cat_l_id, name from category_l where name in ('구매','생산') order by cat_l_id;
select 'M' as lvl, cat_m_id, name, cat_l_id from category_m where name in ('구매품','가공') order by cat_m_id;
select 'S' as lvl, cat_s_id, name, owner_dept_id from category_s
where name in ('구매품 입고','조립','검수') order by cat_s_id;

-- (4) 프로젝트 Row + 상태 뷰 확인 (핵심)
select
  item_id,
  erp_project_key,
  cat_s_id,
  cat_s_name,
  baseline_start, baseline_end,
  current_start, current_end,
  due_end_basis,
  plan_shift,
  actual_start_date, actual_end_date,
  is_progress_delayed
from v_schedule_item_status
where erp_project_key = 'TEST-PRJ-001'
order by baseline_start, item_id;

-- =========================
-- 5) (옵션) 테스트 데이터 정리
--    필요하면 아래를 실행하고 싶을 때만 주석 해제
-- =========================
/*
-- v_schedule_item_status는 view라서 삭제 없음

-- 테스트 프로젝트의 item_id 목록 기반으로 자식부터 삭제
delete from schedule_actual
where item_id in (select item_id from schedule_item where erp_project_key='TEST-PRJ-001');

delete from schedule_plan
where item_id in (select item_id from schedule_item where erp_project_key='TEST-PRJ-001');

delete from schedule_item
where erp_project_key='TEST-PRJ-001';

delete from project_due
where erp_project_key='TEST-PRJ-001';

delete from erp_projects_cache
where erp_project_key='TEST-PRJ-001';

-- 분류/매핑은 다른 테스트에도 재사용 가능해서 보통 남겨둠
*/

commit;
