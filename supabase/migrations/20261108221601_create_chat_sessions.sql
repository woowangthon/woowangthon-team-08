begin;

create table public.chat_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slot smallint not null check (slot between 1 and 5),
  focus text not null check (focus in ('situation', 'feelings', 'consultation')),
  messages jsonb not null check (jsonb_typeof(messages) = 'array' and jsonb_array_length(messages) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slot)
);

alter table public.chat_sessions enable row level security;

revoke all on public.chat_sessions from public, anon, authenticated;
grant select, delete on public.chat_sessions to authenticated;
grant insert (id, slot, focus, messages) on public.chat_sessions to authenticated;
grant update (focus, messages, updated_at) on public.chat_sessions to authenticated;

create policy "Read own chat sessions" on public.chat_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own chat sessions" on public.chat_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own chat sessions" on public.chat_sessions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Delete own chat sessions" on public.chat_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

create function public.create_chat_session(chat_id uuid, chat_focus text, chat_messages jsonb)
returns table (id uuid, created_at timestamptz, updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_slot smallint;
  saved record;
begin
  for next_slot in 1..5 loop
    insert into public.chat_sessions (id, slot, focus, messages)
    values (chat_id, next_slot, chat_focus, chat_messages)
    on conflict do nothing
    returning chat_sessions.id, chat_sessions.created_at, chat_sessions.updated_at into saved;

    if found then
      return query select saved.id, saved.created_at, saved.updated_at;
      return;
    end if;

    -- A retry after a lost response should find the same draft.
    update public.chat_sessions s
    set focus = chat_focus, messages = chat_messages, updated_at = now()
    where s.id = chat_id
    returning s.id, s.created_at, s.updated_at into saved;

    if found then
      return query select saved.id, saved.created_at, saved.updated_at;
      return;
    end if;
  end loop;

  raise exception using errcode = 'P0001', message = 'chat_session_limit';
end;
$$;

revoke execute on function public.create_chat_session(uuid, text, jsonb) from public, anon;
grant execute on function public.create_chat_session(uuid, text, jsonb) to authenticated;

commit;
