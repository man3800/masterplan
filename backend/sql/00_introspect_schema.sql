-- 00_introspect_schema.sql
-- MasterPlan MVP Database Schema Introspection
-- Purpose: Extract actual schema structure from PostgreSQL
-- Usage: psql -h 127.0.0.1 -U postgres -d masterplan -f backend/sql/00_introspect_schema.sql

\echo '========================================'
\echo '1. TABLES LIST'
\echo '========================================'
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

\echo ''
\echo '========================================'
\echo '2. COLUMNS (by table)'
\echo '========================================'
SELECT 
    t.table_name,
    c.column_name,
    c.ordinal_position,
    c.data_type,
    c.character_maximum_length,
    c.is_nullable,
    c.column_default,
    CASE 
        WHEN c.udt_name = 'project_status' THEN 'ENUM: ' || (
            SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'project_status'
        )
        ELSE c.udt_name
    END AS type_detail
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND c.table_schema = 'public'
ORDER BY t.table_name, c.ordinal_position;

\echo ''
\echo '========================================'
\echo '3. PRIMARY KEYS'
\echo '========================================'
SELECT 
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'PRIMARY KEY'
ORDER BY tc.table_name, kcu.ordinal_position;

\echo ''
\echo '========================================'
\echo '4. FOREIGN KEYS'
\echo '========================================'
SELECT
    tc.table_name AS from_table,
    kcu.column_name AS from_column,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column,
    tc.constraint_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.ordinal_position;

\echo ''
\echo '========================================'
\echo '5. UNIQUE CONSTRAINTS'
\echo '========================================'
SELECT 
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'UNIQUE'
  AND tc.constraint_name NOT IN (
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'PRIMARY KEY'
  )
ORDER BY tc.table_name, kcu.ordinal_position;

\echo ''
\echo '========================================'
\echo '6. CHECK CONSTRAINTS'
\echo '========================================'
SELECT 
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;

\echo ''
\echo '========================================'
\echo '7. INDEXES'
\echo '========================================'
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

\echo ''
\echo '========================================'
\echo '8. ENUM TYPES'
\echo '========================================'
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value,
    e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname NOT LIKE 'pg_%'
ORDER BY t.typname, e.enumsortorder;

\echo ''
\echo '========================================'
\echo '9. VIEWS'
\echo '========================================'
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

\echo ''
\echo '========================================'
\echo 'SCHEMA INTROSPECTION COMPLETE'
\echo '========================================'

