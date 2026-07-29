begin;

alter table public.medication_order_items
  add column if not exists central_medication_id bigint
    references public.central_medications(id) on delete set null,
  add column if not exists hospital_medication_id bigint
    references public.hospital_medications(id) on delete set null,
  add column if not exists product_strength_snapshot text,
  add column if not exists dosage_form_snapshot text,
  add column if not exists manufacturer_snapshot text;

create index if not exists medication_order_items_hospital_medication_idx
  on public.medication_order_items(hospital_medication_id);

commit;
