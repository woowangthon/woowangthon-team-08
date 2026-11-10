-- 프론트(anon 키)가 facilities 를 "읽기만" 할 수 있게 해요.
-- ⚠ 실행 전에 백엔드 팀원과 확인하세요.
--   RLS가 꺼져 있으면 anon 키로 누구나 수정·삭제까지 가능한 상태일 수 있어요.
--   아래는 RLS를 켜고 SELECT만 허용합니다. 백엔드가 Supabase 직접 접속(service/DB 계정)이면 영향 없어요.
alter table public.facilities enable row level security;

drop policy if exists "facilities_read_all" on public.facilities;
create policy "facilities_read_all"
  on public.facilities for select
  to anon, authenticated
  using (true);
