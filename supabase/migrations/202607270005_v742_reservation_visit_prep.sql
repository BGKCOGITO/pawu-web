-- PAWU V7.4.2
-- 예약과 자동 진료 준비를 1:1로 연결하기 위한 보강

create unique index if not exists visit_preparations_reservation_unique_idx
  on public.visit_preparations(reservation_id)
  where reservation_id is not null;
