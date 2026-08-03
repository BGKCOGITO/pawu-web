-- PAWU V9.7.2: 푸시 큐 운영 안정화
-- 선행 조건: V9.7.0 push_jobs migration 적용 완료

create index if not exists push_jobs_processing_locked_idx
  on public.push_jobs (locked_at)
  where status = 'processing';

create index if not exists push_jobs_cleanup_idx
  on public.push_jobs (status, created_at);

create or replace function public.recover_stale_push_jobs(
  p_stale_after interval default interval '5 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recovered_count integer;
begin
  update public.push_jobs
  set
    status = case when attempts >= max_attempts then 'dead' else 'retry' end,
    next_attempt_at = now(),
    locked_at = null,
    last_error = coalesce(last_error || ' | ', '') || 'stale-processing-recovered',
    updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - p_stale_after;

  get diagnostics recovered_count = row_count;
  return recovered_count;
end;
$$;

create or replace function public.cleanup_push_jobs(
  p_sent_retention interval default interval '30 days',
  p_failed_retention interval default interval '90 days'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.push_jobs
  where
    (status in ('sent', 'skipped') and created_at < now() - p_sent_retention)
    or
    (status = 'dead' and created_at < now() - p_failed_retention);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.retry_push_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.push_jobs
  set
    status = 'retry',
    next_attempt_at = now(),
    locked_at = null,
    last_error = null,
    updated_at = now()
  where id = p_job_id
    and status in ('processing', 'retry', 'dead', 'skipped');
end;
$$;

create or replace view public.push_queue_daily_stats
with (security_invoker = false)
as
select
  date_trunc('day', created_at) as day,
  count(*)::bigint as total,
  count(*) filter (where status = 'sent')::bigint as sent,
  count(*) filter (where status = 'pending')::bigint as pending,
  count(*) filter (where status = 'processing')::bigint as processing,
  count(*) filter (where status = 'retry')::bigint as retry,
  count(*) filter (where status = 'skipped')::bigint as skipped,
  count(*) filter (where status = 'dead')::bigint as dead
from public.push_jobs
group by 1;

revoke all on function public.recover_stale_push_jobs(interval) from public, anon, authenticated;
revoke all on function public.cleanup_push_jobs(interval, interval) from public, anon, authenticated;
revoke all on function public.retry_push_job(uuid) from public, anon, authenticated;
grant execute on function public.recover_stale_push_jobs(interval) to service_role;
grant execute on function public.cleanup_push_jobs(interval, interval) to service_role;
grant execute on function public.retry_push_job(uuid) to service_role;
revoke all on public.push_queue_daily_stats from anon, authenticated;
grant select on public.push_queue_daily_stats to service_role;
