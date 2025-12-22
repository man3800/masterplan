-- 000_roles.sql
-- 목적: 애플리케이션 계정(롤) 생성 (없으면 생성)
-- 실행: postgres(슈퍼유저)로

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hnkerp') THEN
    CREATE ROLE hnkerp LOGIN;
    -- 비밀번호를 쓰려면 아래 주석 해제 후 수정
    ALTER ROLE hnkerp WITH PASSWORD 'admin1234';
  END IF;
END
$$;
