-- 대/중/소 트리 확인
select l.name as 대분류, m.name as 중분류, s.name as 소분류
from category_l l
join category_m m on m.cat_l_id = l.cat_l_id
join category_s_map_m sm on sm.cat_m_id = m.cat_m_id
join category_s s on s.cat_s_id = sm.cat_s_id
order by l.name, m.name, s.sort_order;

