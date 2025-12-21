begin;

-- 비활성화된 분류 확인
select '비활성화된 대분류' as 타입, cat_l_id, name, is_active
from category_l
where is_active = false;

select '비활성화된 중분류' as 타입, cat_m_id, name, cat_l_id, is_active
from category_m
where is_active = false;

-- 모든 분류 다시 활성화
update category_l
set is_active = true
where is_active = false;

update category_m
set is_active = true
where is_active = false;

commit;

-- 확인: 활성화된 분류 확인
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

