-- facilities 테이블에 지도용 좌표 컬럼을 추가해요. (Supabase SQL Editor에서 실행)
-- 백엔드 엔티티는 ddl-auto: validate 라서 DB에 컬럼이 더 있어도 문제없어요.
alter table public.facilities
  add column if not exists lat double precision,
  add column if not exists lng double precision;
