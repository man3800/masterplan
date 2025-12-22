-- 002_grants.sql
-- 목적: 애플리케이션 롤(hnkerp)이 DB 접속/조회/쓰기 가능하도록 권한 부여
-- 전제: 이 파일은 postgres(또는 DB owner)로 실행

BEGIN;

-- 1) DB 접속 권한
GRANT CONNECT ON DATABASE masterplan TO hnkerp;

-- 2) public 스키마 사용 권한
GRANT USAGE ON SCHEMA public TO hnkerp;

-- 3) 현재 존재하는 테이블/시퀀스 권한
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hnkerp;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO hnkerp;

-- 4) 앞으로 생성될 테이블/시퀀스에 대한 기본 권한(중요)
-- ※ 이 "ALTER DEFAULT PRIVILEGES"는 '이 명령을 실행한 소유자'가 생성하는 객체에만 적용됨.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hnkerp;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO hnkerp;

COMMIT;
