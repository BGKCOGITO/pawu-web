PAWU V9.7.2 푸시 운영 안정화 패치

1) 이 ZIP을 C:\Users\USER\pawu-web 에 폴더 구조 그대로 덮어쓴다.
2) SQL Editor에서 20260803_pawu_v9_7_2_push_operations.sql 실행.
3) process-push-jobs Edge Function 재배포.
4) 20260803_pawu_v9_7_2_push_worker_cron_TEMPLATE.sql의 PROJECT_REF와 SECRET을 교체 후 실행.
5) npm run dev로 /admin/push-operations 확인.
6) 정상 시 git add/commit/push.

주의: TEMPLATE SQL의 PUSH_WORKER_SECRET은 Edge Function secret과 반드시 동일해야 한다.
