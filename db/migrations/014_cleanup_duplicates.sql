begin;

-- 1. 기존 매핑 삭제 (X축, B축 관련)
delete from category_s_map_m
where cat_m_id in (
  select m.cat_m_id
  from category_m m
  join category_l l on l.cat_l_id = m.cat_l_id
  where l.name in ('X축', 'B축')
);

-- 2. 올바른 매핑 다시 생성
-- X축 / TABLE BED
insert into category_s_map_m (cat_m_id, cat_s_id, is_default)
select m.cat_m_id, s.cat_s_id, true
from category_m m
join category_l l on l.cat_l_id = m.cat_l_id
join category_s s on s.name in ('설계','소재','가공','도장','BED 레벨링','기어박스 스크레핑')
where l.name = 'X축' and m.name = 'TABLE BED';

-- X축 / 단품
insert into category_s_map_m (cat_m_id, cat_s_id, is_default)
select m.cat_m_id, s.cat_s_id, true
from category_m m
join category_l l on l.cat_l_id = m.cat_l_id
join category_s s on s.name = '단일입고'
where l.name = 'X축' and m.name = '단품';

-- X축 / 구매품
insert into category_s_map_m (cat_m_id, cat_s_id, is_default)
select m.cat_m_id, s.cat_s_id, true
from category_m m
join category_l l on l.cat_l_id = m.cat_l_id
join category_s s on s.name in ('Ball Screw 입고','Bearing 입고','Scale 입고','엔코더/볼스크류 조립')
where l.name = 'X축' and m.name = '구매품';

-- B축 / TABLE BASE
insert into category_s_map_m (cat_m_id, cat_s_id, is_default)
select m.cat_m_id, s.cat_s_id, true
from category_m m
join category_l l on l.cat_l_id = m.cat_l_id
join category_s s on s.name in ('설계','소재','가공','스크래핑','도장','배관','측정조립/백래쉬보정','배관/B축 조립')
where l.name = 'B축' and m.name = 'TABLE BASE';

-- B축 / ROTARY TABLE
insert into category_s_map_m (cat_m_id, cat_s_id, is_default)
select m.cat_m_id, s.cat_s_id, true
from category_m m
join category_l l on l.cat_l_id = m.cat_l_id
join category_s s on s.name in ('설계','소재','가공','링기어조립','스크래핑','센터포스트조립')
where l.name = 'B축' and m.name = 'ROTARY TABLE';

-- B축 / 단품
insert into category_s_map_m (cat_m_id, cat_s_id, is_default)
select m.cat_m_id, s.cat_s_id, true
from category_m m
join category_l l on l.cat_l_id = m.cat_l_id
join category_s s on s.name in ('단품입고','단품 ASSY 조립')
where l.name = 'B축' and m.name = '단품';

-- B축 / 구매품
insert into category_s_map_m (cat_m_id, cat_s_id, is_default)
select m.cat_m_id, s.cat_s_id, true
from category_m m
join category_l l on l.cat_l_id = m.cat_l_id
join category_s s on s.name in ('Ball Screw 입고','Bearing 입고','Scale 입고')
where l.name = 'B축' and m.name = '구매품';

commit;

-- 확인
select 
  l.name as 대분류,
  m.name as 중분류,
  count(distinct s.cat_s_id) as 소분류개수
from category_l l
join category_m m on m.cat_l_id = l.cat_l_id
join category_s_map_m sm on sm.cat_m_id = m.cat_m_id
join category_s s on s.cat_s_id = sm.cat_s_id
where l.name in ('X축', 'B축')
group by l.name, m.name, m.sort_order
order by 
  case l.name when 'X축' then 1 when 'B축' then 2 end,
  m.sort_order;

