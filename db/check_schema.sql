-- ============================================================
-- 실제 스키마 구조 확인 쿼리
-- ============================================================
-- 이 쿼리들을 실행한 결과를 알려주세요

-- 1. projects 테이블 구조
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'projects'
ORDER BY ordinal_position;

-- 2. projects 테이블의 인덱스 및 제약조건
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.projects'::regclass
ORDER BY contype, conname;

-- 3. projects 테이블의 인덱스
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'projects'
ORDER BY indexname;

-- 4. classifications 테이블 구조
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'classifications'
ORDER BY ordinal_position;

-- 5. classifications 테이블의 인덱스 및 제약조건
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.classifications'::regclass
ORDER BY contype, conname;

-- 6. classifications 테이블의 인덱스
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'classifications'
ORDER BY indexname;

-- 7. tasks 테이블 구조
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'tasks'
ORDER BY ordinal_position;

-- 8. tasks 테이블의 인덱스 및 제약조건
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.tasks'::regclass
ORDER BY contype, conname;

-- 9. tasks 테이블의 인덱스
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'tasks'
ORDER BY indexname;

-- 10. ENUM 타입 확인 (project_status 등)
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'project_status'
ORDER BY e.enumsortorder;

-- ============================================================
-- 제한사항 해결을 위한 DB 업데이트
-- ============================================================
-- 별도 마이그레이션 파일을 사용하세요:
-- db/migrations/005_add_missing_columns.sql
--
-- 실행 방법:
-- psql -h 127.0.0.1 -U postgres -d masterplan -f db/migrations/005_add_missing_columns.sql
--
-- 추가되는 컬럼:
-- 1. classifications.owner_dept_id (TEXT)
-- 2. tasks.baseline_start (DATE)
-- 3. tasks.baseline_end (DATE)
-- 4. tasks.actual_start_date (DATE)
-- 5. tasks.actual_end_date (DATE)
--
-- 주의사항:
-- - 기존 데이터는 영향을 받지 않습니다 (NULL 허용 컬럼 추가)
-- - 백엔드 API 코드도 함께 업데이트해야 합니다

