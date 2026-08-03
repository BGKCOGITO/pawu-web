-- 실행 전 아래 두 값을 실제 값으로 교체한다.
-- YOUR_PROJECT_REF
-- YOUR_PUSH_WORKER_SECRET

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'pawu-process-push-jobs-every-minute';

select cron.schedule(
  'pawu-process-push-jobs-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://pzbmljfhxbmraboyauas.supabase.co/functions/v1/process-push-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-pawu-push-secret', 'hQvy4WFwdE2OGj7cIYJfHnKZRtbV8U9LSlu0gMkmoTCe1xzi'
    ),
    body := '{}'::jsonb
  );
  $$
);
