begin;

-- 구매/생산 대분류 비활성화 (HB-130X는 X축/B축만 사용)
update category_l
set is_active = false
where cat_l_id in (1, 2);

-- 관련 중분류도 비활성화
update category_m
set is_active = false
where cat_l_id in (1, 2);

commit;

-- 확인: 활성화된 분류만 조회
select 
  l.cat_l_id as 대분류ID,
  l.name as 대분류,
  count(distinct m.cat_m_id) as 중분류개수,
  count(distinct s.cat_s_id) as 소분류개수
from category_l l
join category_m m on m.cat_l_id = l.cat_l_id and m.is_active = true
join category_s_map_m sm on sm.cat_m_id = m.cat_m_id
join category_s s on s.cat_s_id = sm.cat_s_id and s.is_active = true
where l.is_active = true
group by l.cat_l_id, l.name
order by l.sort_order, l.name;

