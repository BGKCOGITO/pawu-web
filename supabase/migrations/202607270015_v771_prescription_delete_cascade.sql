-- PAWU V7.7.1
-- 처방 삭제 시 복용시간과 복용기록 자동 삭제 보장

begin;

do $$
declare c text;
begin
  select tc.constraint_name into c
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'medical_prescription_schedules'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'medical_prescription_id'
  limit 1;

  if c is not null then
    execute format(
      'alter table public.medical_prescription_schedules drop constraint %I',
      c
    );
  end if;

  alter table public.medical_prescription_schedules
    add constraint medical_prescription_schedules_prescription_id_fkey
    foreign key (medical_prescription_id)
    references public.medical_prescriptions(id)
    on delete cascade;
end
$$;

do $$
declare c text;
begin
  select tc.constraint_name into c
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'medication_dose_logs'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'medical_prescription_id'
  limit 1;

  if c is not null then
    execute format(
      'alter table public.medication_dose_logs drop constraint %I',
      c
    );
  end if;

  alter table public.medication_dose_logs
    add constraint medication_dose_logs_prescription_id_fkey
    foreign key (medical_prescription_id)
    references public.medical_prescriptions(id)
    on delete cascade;
end
$$;

commit;
