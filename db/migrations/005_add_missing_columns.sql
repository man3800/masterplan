-- 005_add_missing_columns.sql
-- 목적: 누락된 컬럼/인덱스 추가 (idempotent)

BEGIN;

-- ============================================================
-- 1) classifications: owner_dept_id 추가
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'classifications'
          AND column_name  = 'owner_dept_id'
    ) THEN
        ALTER TABLE public.classifications
            ADD COLUMN owner_dept_id bigint;

        RAISE NOTICE 'Added column classifications.owner_dept_id';
    ELSE
        RAISE NOTICE 'Column classifications.owner_dept_id already exists';
    END IF;
END $$;


-- ============================================================
-- 2) tasks: baseline/actual 날짜 컬럼 추가
--    - baseline_start, baseline_end (timestamp with time zone)
--    - actual_start_date, actual_end_date (date)
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'tasks'
          AND column_name  = 'baseline_start'
    ) THEN
        ALTER TABLE public.tasks
            ADD COLUMN baseline_start timestamptz;
        RAISE NOTICE 'Added column tasks.baseline_start';
    ELSE
        RAISE NOTICE 'Column tasks.baseline_start already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'tasks'
          AND column_name  = 'baseline_end'
    ) THEN
        ALTER TABLE public.tasks
            ADD COLUMN baseline_end timestamptz;
        RAISE NOTICE 'Added column tasks.baseline_end';
    ELSE
        RAISE NOTICE 'Column tasks.baseline_end already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'tasks'
          AND column_name  = 'actual_start_date'
    ) THEN
        ALTER TABLE public.tasks
            ADD COLUMN actual_start_date date;
        RAISE NOTICE 'Added column tasks.actual_start_date';
    ELSE
        RAISE NOTICE 'Column tasks.actual_start_date already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'tasks'
          AND column_name  = 'actual_end_date'
    ) THEN
        ALTER TABLE public.tasks
            ADD COLUMN actual_end_date date;
        RAISE NOTICE 'Added column tasks.actual_end_date';
    ELSE
        RAISE NOTICE 'Column tasks.actual_end_date already exists';
    END IF;
END $$;


-- ============================================================
-- 3) 부분 인덱스 생성 (날짜가 있는 데이터만 인덱싱)
-- ============================================================

CREATE INDEX IF NOT EXISTS ix_tasks_baseline_dates
    ON public.tasks (baseline_start, baseline_end)
    WHERE baseline_start IS NOT NULL OR baseline_end IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_tasks_actual_dates
    ON public.tasks (actual_start_date, actual_end_date)
    WHERE actual_start_date IS NOT NULL OR actual_end_date IS NOT NULL;

COMMIT;