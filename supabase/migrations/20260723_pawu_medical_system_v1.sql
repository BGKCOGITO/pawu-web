-- PAWU Medical System V1
-- Supabase SQL Editor에서 한 번 실행하세요.

alter table public.medical_records
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists exam_results text,
  add column if not exists weight_kg numeric,
  add column if not exists temperature_c numeric,
  add column if not exists easy_explanation text;

create unique index if not exists medical_records_reservation_unique
  on public.medical_records(reservation_id);

alter table public.prescriptions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists pet_id bigint references public.pets(id) on delete set null;

alter table public.medication_schedules
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists pet_id bigint references public.pets(id) on delete set null,
  add column if not exists is_active boolean not null default true;

alter table public.vaccination_records
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists hospital_id bigint references public.hospitals(id) on delete set null;

alter table public.reminders
  add column if not exists reminder_type text not null default 'general',
  add column if not exists title text not null default '알림',
  add column if not exists message text,
  add column if not exists remind_date date,
  add column if not exists remind_time time,
  add column if not exists related_type text,
  add column if not exists related_id bigint,
  add column if not exists is_active boolean not null default true,
  add column if not exists is_completed boolean not null default false,
  add column if not exists completed_at timestamptz;

create index if not exists reminders_user_date_idx
  on public.reminders(user_id, remind_date);

create index if not exists prescriptions_user_pet_idx
  on public.prescriptions(user_id, pet_id);

create index if not exists vaccination_records_user_pet_idx
  on public.vaccination_records(user_id, pet_id);

alter table public.medical_records enable row level security;
alter table public.prescriptions enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.vaccination_records enable row level security;
alter table public.reminders enable row level security;

drop policy if exists "guardians read own medical records" on public.medical_records;
create policy "guardians read own medical records"
on public.medical_records for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.hospital_admins ha
    where ha.user_id = auth.uid()
      and ha.hospital_id = medical_records.hospital_id
  )
);

drop policy if exists "guardians read own prescriptions" on public.prescriptions;
create policy "guardians read own prescriptions"
on public.prescriptions for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.medical_records mr
    join public.hospital_admins ha on ha.hospital_id = mr.hospital_id
    where mr.id = prescriptions.medical_record_id
      and ha.user_id = auth.uid()
  )
);

drop policy if exists "guardians read own medication schedules" on public.medication_schedules;
create policy "guardians read own medication schedules"
on public.medication_schedules for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "guardians read own vaccinations" on public.vaccination_records;
create policy "guardians read own vaccinations"
on public.vaccination_records for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.hospital_admins ha
    where ha.user_id = auth.uid()
      and ha.hospital_id = vaccination_records.hospital_id
  )
);

drop policy if exists "guardians manage own reminders" on public.reminders;
create policy "guardians manage own reminders"
on public.reminders for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 기존 진료기록에 user_id가 비어 있으면 예약 보호자와 연결
update public.medical_records mr
set user_id = r.user_id
from public.reservations r
where r.id = mr.reservation_id
  and mr.user_id is null;
