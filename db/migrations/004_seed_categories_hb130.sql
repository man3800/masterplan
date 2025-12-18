begin;

-- =========================
-- 1) 대분류 (X축, B축)
-- =========================
insert into category_l (name, sort_order, is_active) values
  ('X축', 10, true),
  ('B축', 20, true)
on conflict do nothing;

-- =========================
-- 2) 중분류
-- =========================
-- X축
insert into category_m (cat_l_id, name, sort_order, is_active)
select l.cat_l_id, m.name, m.sort_order, true
from category_l l
cross join (values
  ('TABLE BED', 10),
  ('단품', 20),
  ('구매품', 30)
) as m(name, sort_order)
where l.name = 'X축'
on conflict do nothing;

-- B축
insert into category_m (cat_l_id, name, sort_order, is_active)
select l.cat_l_id, m.name, m.sort_order, true
from category_l l
cross join (values
  ('TABLE BASE', 10),
  ('ROTARY TABLE', 20),
  ('단품', 30),
  ('구매품', 40)
) as m(name, sort_order)
where l.name = 'B축'
on conflict do nothing;

-- =========================
-- 3) 소분류 (작업 = Row)
-- =========================
-- X축 / TABLE BED
insert into category_s (name, owner_dept_id, sort_order, is_active) values
  ('설계', 'DESIGN1', 10, true),
  ('소재', 'PROD1', 20, true),
  ('가공', 'PROD1', 30, true),
  ('도장', 'PROD1', 40, true),
  ('BED 레벨링', 'PROD1', 50, true),
  ('기어박스 스크레핑', 'PROD1', 60, true)
on conflict do nothing;

-- X축 / 단품
insert into category_s (name, owner_dept_id, sort_order, is_active) values
  ('단일입고', 'BUY1', 10, true)
on conflict do nothing;

-- X축 / 구매품
insert into category_s (name, owner_dept_id, sort_order, is_active) values
  ('Ball Screw 입고', 'BUY1', 10, true),
  ('Bearing 입고', 'BUY1', 20, true),
  ('Scale 입고', 'BUY1', 30, true),
  ('엔코더/볼스크류 조립', 'PROD1', 40, true)
on conflict do nothing;

-- B축 / TABLE BASE
insert into category_s (name, owner_dept_id, sort_order, is_active) values
  ('설계', 'DESIGN1', 10, true),
  ('소재', 'PROD1', 20, true),
  ('가공', 'PROD1', 30, true),
  ('스크래핑', 'PROD1', 40, true),
  ('도장', 'PROD1', 50, true),
  ('배관', 'PROD1', 60, true),
  ('측정조립/백래쉬보정', 'PROD1', 70, true),
  ('배관/B축 조립', 'PROD1', 80, true)
on conflict do nothing;

-- B축 / ROTARY TABLE
insert into category_s (name, owner_dept_id, sort_order, is_active) values
  ('링기어조립', 'PROD1', 40, true),
  ('센터포스트조립', 'PROD1', 60, true)
on conflict do nothing;

-- B축 / 단품
insert into category_s (name, owner_dept_id, sort_order, is_active) values
  ('단품입고', 'BUY1', 10, true),
  ('단품 ASSY 조립', 'PROD1', 20, true)
on conflict do nothing;

-- B축 / 구매품
-- (Ball Screw 입고 / Bearing 입고 / Scale 입고는 이미 존재 → 재사용)

-- =========================
-- 4) 소분류 ↔ 중분류 매핑 (UI 트리용)
-- =========================

-- 헬퍼: 매핑 함수 없이 INSERT SELECT 패턴
insert into category_s_map_m (cat_m_id, cat_s_id, is_default)
select m.cat_m_id, s.cat_s_id, true
from category_m m
join category_s s on (
  (m.name = 'TABLE BED' and s.name in ('설계','소재','가공','도장','BED 레벨링','기어박스 스크레핑'))
  or (m.name = '단품' and s.name in ('단일입고','단품입고','단품 ASSY 조립'))
  or (m.name = '구매품' and s.name in ('Ball Screw 입고','Bearing 입고','Scale 입고','엔코더/볼스크류 조립'))
  or (m.name = 'TABLE BASE' and s.name in ('설계','소재','가공','스크래핑','도장','배관','측정조립/백래쉬보정','배관/B축 조립'))
  or (m.name = 'ROTARY TABLE' and s.name in ('설계','소재','가공','링기어조립','스크래핑','센터포스트조립'))
)
on conflict (cat_m_id, cat_s_id) do update
set is_default = excluded.is_default;

commit;
