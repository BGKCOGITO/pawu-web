-- PAWU V10.8.0 복약 알림 설정
begin;

create table if not exists public.medication_notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_enabled boolean not null default true,
  pre_alert_minutes integer not null default 10 check (pre_alert_minutes between 0 and 120),
  retry_alert_minutes integer not null default 30 check (retry_alert_minutes between 0 and 240),
  retry_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.medication_notification_settings enable row level security;

drop policy if exists "guardian_manage_own_medication_notification_settings" on public.medication_notification_settings;
create policy "guardian_manage_own_medication_notification_settings"
on public.medication_notification_settings
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

notify pgrst, 'reload schema';
commit;
