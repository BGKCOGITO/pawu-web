-- PAWU V8.6.0
-- 입원 경과 실시간 화면 알림 + 비공개 사진 공유
-- 기존 데이터 삭제 없음 / 반복 실행 가능

begin;

alter table if exists public.hospitalization_guardian_updates
  add column if not exists image_storage_path text;

create index if not exists hospitalization_guardian_updates_guardian_realtime_idx
  on public.hospitalization_guardian_updates(guardian_user_id, published_at desc)
  where retracted_at is null;

alter table public.hospitalization_guardian_updates enable row level security;

drop policy if exists "guardian_select_own_hospitalization_updates" on public.hospitalization_guardian_updates;
create policy "guardian_select_own_hospitalization_updates"
  on public.hospitalization_guardian_updates
  for select
  to authenticated
  using (guardian_user_id = auth.uid() and retracted_at is null);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'hospitalization-guardian-media',
  'hospitalization-guardian-media',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif']::text[]
where not exists (
  select 1 from storage.buckets where id = 'hospitalization-guardian-media'
);

update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']::text[]
where id = 'hospitalization-guardian-media';

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'hospitalization_guardian_updates'
     ) then
    alter publication supabase_realtime add table public.hospitalization_guardian_updates;
  end if;
end $$;

commit;
