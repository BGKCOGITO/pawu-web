-- PAWU V7.8.0
-- 카카오·네이버·Apple 소셜 로그인 프로필 기반
-- 기존 계정과 데이터 삭제 없음

begin;

alter table public.profiles
  add column if not exists account_type text default 'guardian',
  add column if not exists auth_provider text,
  add column if not exists profile_completed_at timestamptz;

-- 신규 Supabase Auth 사용자의 기본 프로필 자동 생성
create or replace function public.pawu_create_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider_name text;
  profile_name text;
begin
  provider_name := coalesce(
    new.raw_app_meta_data ->> 'provider',
    new.raw_user_meta_data ->> 'provider',
    'email'
  );

  profile_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'nickname', ''),
    nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  insert into public.profiles (
    id,
    email,
    display_name,
    account_type,
    auth_provider
  )
  values (
    new.id,
    new.email,
    profile_name,
    'guardian',
    provider_name
  )
  on conflict (id) do update
  set
    email = coalesce(public.profiles.email, excluded.email),
    display_name = coalesce(
      nullif(public.profiles.display_name, ''),
      excluded.display_name
    ),
    auth_provider = coalesce(
      public.profiles.auth_provider,
      excluded.auth_provider
    );

  return new;
end;
$$;

drop trigger if exists pawu_auth_user_profile_trigger
  on auth.users;

create trigger pawu_auth_user_profile_trigger
after insert or update of email, raw_user_meta_data, raw_app_meta_data
on auth.users
for each row
execute function public.pawu_create_auth_profile();

-- 기존 Auth 사용자 중 프로필이 없는 사용자 보완
insert into public.profiles (
  id,
  email,
  display_name,
  account_type,
  auth_provider
)
select
  u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    nullif(u.raw_user_meta_data ->> 'nickname', ''),
    split_part(coalesce(u.email, ''), '@', 1)
  ),
  'guardian',
  coalesce(
    u.raw_app_meta_data ->> 'provider',
    u.raw_user_meta_data ->> 'provider',
    'email'
  )
from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
);

alter table public.profiles enable row level security;

drop policy if exists "users_can_read_own_profile"
  on public.profiles;

create policy "users_can_read_own_profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "users_can_update_own_profile"
  on public.profiles;

create policy "users_can_update_own_profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

commit;
