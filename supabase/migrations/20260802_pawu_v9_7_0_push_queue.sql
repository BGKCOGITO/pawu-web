-- PAWU V9.7.0: 채팅 API와 분리된 내구성 있는 FCM 발송 큐
-- 운영 DB에서 한 번만 실행한다.

create extension if not exists pgcrypto;

create table if not exists public.push_jobs (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id bigint not null,
  user_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','processing','retry','sent','skipped','dead')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id, user_id)
);

create index if not exists push_jobs_pending_idx
  on public.push_jobs (status, next_attempt_at, created_at)
  where status in ('pending','retry');

alter table public.push_jobs enable row level security;
-- 브라우저에서 직접 읽거나 쓰지 않는다. service_role 및 SECURITY DEFINER 함수만 사용한다.

create or replace function public.enqueue_guardian_chat_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_guardian uuid;
  target_hospital_id bigint;
  chat_allowed boolean;
begin
  if new.sender_type <> 'hospital' then
    return new;
  end if;

  select c.guardian_user_id, c.hospital_id
    into target_guardian, target_hospital_id
  from public.chat_conversations c
  where c.id = new.conversation_id;

  if target_guardian is null then
    return new;
  end if;

  select coalesce(p.chat_messages, true)
    into chat_allowed
  from public.notification_preferences p
  where p.user_id = target_guardian;

  if coalesce(chat_allowed, true) = false then
    return new;
  end if;

  insert into public.push_jobs (
    source_type,
    source_id,
    user_id,
    payload
  ) values (
    'chat_message',
    new.id,
    target_guardian,
    jsonb_build_object(
      'title', 'PAWU 새 병원 메시지',
      'body', '병원에서 새 메시지가 도착했습니다.',
      'url', '/chat/' || new.conversation_id::text,
      'tag', 'pawu-chat-' || new.conversation_id::text,
      'conversation_id', new.conversation_id,
      'hospital_id', target_hospital_id
    )
  )
  on conflict (source_type, source_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_enqueue_guardian_chat_push on public.chat_messages;
create trigger trg_enqueue_guardian_chat_push
after insert on public.chat_messages
for each row
execute function public.enqueue_guardian_chat_push();

create or replace function public.claim_push_jobs(p_job_id uuid default null, p_limit integer default 20)
returns setof public.push_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select j.id
    from public.push_jobs j
    where
      (
        p_job_id is not null
        and j.id = p_job_id
        and j.status in ('pending','retry')
      )
      or
      (
        p_job_id is null
        and j.status in ('pending','retry')
        and j.next_attempt_at <= now()
      )
    order by j.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update public.push_jobs j
  set
    status = 'processing',
    attempts = j.attempts + 1,
    locked_at = now(),
    updated_at = now()
  from candidates c
  where j.id = c.id
  returning j.*;
end;
$$;

create or replace function public.finish_push_job(
  p_job_id uuid,
  p_status text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_attempts integer;
  current_max integer;
  final_status text;
begin
  select attempts, max_attempts
    into current_attempts, current_max
  from public.push_jobs
  where id = p_job_id
  for update;

  if not found then return; end if;

  if p_status = 'sent' then
    update public.push_jobs
      set status='sent', sent_at=now(), locked_at=null, last_error=null, updated_at=now()
      where id=p_job_id;
  elsif p_status = 'skipped' then
    update public.push_jobs
      set status='skipped', locked_at=null, last_error=left(p_error, 1000), updated_at=now()
      where id=p_job_id;
  else
    final_status := case when current_attempts >= current_max then 'dead' else 'retry' end;
    update public.push_jobs
      set
        status=final_status,
        next_attempt_at=case
          when final_status='retry' then now() + make_interval(secs => least(300, (2 ^ greatest(0,current_attempts-1)) * 10))
          else next_attempt_at
        end,
        locked_at=null,
        last_error=left(p_error, 1000),
        updated_at=now()
      where id=p_job_id;
  end if;
end;
$$;

-- 함수 호출 권한은 service_role에만 부여한다.
revoke all on function public.claim_push_jobs(uuid, integer) from public, anon, authenticated;
revoke all on function public.finish_push_job(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_push_jobs(uuid, integer) to service_role;
grant execute on function public.finish_push_job(uuid, text, text) to service_role;
