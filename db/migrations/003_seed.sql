-- 003_seed.sql
-- 샘플 시드: 프로젝트 1개 + 대/중/소 분류 트리 생성
BEGIN;

-- 1) 프로젝트 생성
INSERT INTO projects (code, name)
VALUES ('HB-130X-1035', 'HB-130X(#1035)')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name;

-- 2) 분류 데이터 업서트(대/중/소)
WITH p AS (
  SELECT id AS project_id
  FROM projects
  WHERE code = 'HB-130X-1035'
),
rows AS (
  -- 대분류, 중분류, 소분류, sort_no(원본 순서)
  SELECT *
  FROM (VALUES
    ('X축','TABLE BED','설계',  1),
    ('X축','TABLE BED','소재',  2),
    ('X축','TABLE BED','가공',  3),
    ('X축','TABLE BED','도장',  4),
    ('X축','TABLE BED','BED 레벨링', 5),
    ('X축','TABLE BED','기어박스 스크레핑', 6),
    ('X축','단품','단일입고', 7),
    ('X축','구매품','Ball Screw 입고', 8),
    ('X축','구매품','Bearing 입고', 9),
    ('X축','구매품','Scale 입고', 10),
    ('X축','구매품','엔코더/볼스크류 조립', 11),

    ('B축','TABLE BASE','설계',  12),
    ('B축','TABLE BASE','소재',  13),
    ('B축','TABLE BASE','가공',  14),
    ('B축','TABLE BASE','스크래핑', 15),
    ('B축','TABLE BASE','도장',  16),
    ('B축','TABLE BASE','배관',  17),
    ('B축','TABLE BASE','측정조립/백래쉬보정', 18),
    ('B축','TABLE BASE','배관/B축 조립', 19),
    ('B축','ROTARY TABLE','설계', 20),
    ('B축','ROTARY TABLE','소재', 21),
    ('B축','ROTARY TABLE','가공', 22),
    ('B축','ROTARY TABLE','링기어조립', 23),
    ('B축','ROTARY TABLE','스크래핑', 24),
    ('B축','ROTARY TABLE','센터포스트조립', 25),
    ('B축','단품','단품입고', 26),
    ('B축','단품','단품 ASSY 조립', 27),
    ('B축','구매품','Ball Screw 입고', 28),
    ('B축','구매품','Bearing 입고', 29),
    ('B축','구매품','Scale 입고', 30)
  ) AS t(l1, l2, l3, sort_no)
),

-- 2-1) 대분류 생성 (depth=0): /X축, /B축
ins_l1 AS (
  INSERT INTO classifications (project_id, parent_id, name, depth, path, sort_no)
  SELECT DISTINCT
    p.project_id,
    NULL::bigint,
    r.l1,
    0,
    '/' || r.l1,
    0
  FROM p
  JOIN rows r ON TRUE
  ON CONFLICT (project_id, path) DO UPDATE
  SET name = EXCLUDED.name
  RETURNING id, project_id, name, path
),

-- 2-2) 중분류 생성 (depth=1): /X축/TABLE BED ...
ins_l2 AS (
  INSERT INTO classifications (project_id, parent_id, name, depth, path, sort_no)
  SELECT DISTINCT
    p.project_id,
    l1.id,
    r.l2,
    1,
    l1.path || '/' || r.l2,
    0
  FROM p
  JOIN rows r ON TRUE
  JOIN classifications l1
    ON l1.project_id = p.project_id
   AND l1.path = '/' || r.l1
  ON CONFLICT (project_id, path) DO UPDATE
  SET name = EXCLUDED.name,
      parent_id = EXCLUDED.parent_id
  RETURNING id, project_id, name, path
)

-- 2-3) 소분류 생성 (depth=2): /X축/TABLE BED/설계 ...
INSERT INTO classifications (project_id, parent_id, name, depth, path, sort_no)
SELECT
  p.project_id,
  l2.id,
  r.l3,
  2,
  l2.path || '/' || r.l3,
  r.sort_no
FROM p
JOIN rows r ON TRUE
JOIN classifications l2
  ON l2.project_id = p.project_id
 AND l2.path = '/' || r.l1 || '/' || r.l2
ON CONFLICT (project_id, path) DO UPDATE
SET name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    sort_no = EXCLUDED.sort_no;

COMMIT;
