PAWU V9.7.0 내구성 있는 푸시 발송 구조 적용 안내
====================================================

목표
----
병원 메시지 저장과 FCM 발송을 분리합니다.
DB trigger가 push_jobs를 만들고 Supabase Edge Function이 발송합니다.
실패하면 최대 5회 재시도하며 성공/실패 상태를 DB에 기록합니다.

패치 파일 덮어쓰기
------------------
ZIP 내부 구조 그대로 다음 폴더에 덮어씁니다.
C:\Users\USER\pawu-web

1. 운영 DB migration
--------------------
Supabase Dashboard > SQL Editor > New query에서 다음 파일 전체를 실행합니다.

supabase/migrations/20260802_pawu_v9_7_0_push_queue.sql

실행 후 Table Editor에 push_jobs 테이블이 생겨야 합니다.

2. 임의의 worker secret 만들기
------------------------------
PowerShell:

$pushSecret = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
$pushSecret | Set-Clipboard
$pushSecret

출력된 값을 안전한 곳에 잠시 보관합니다. 이 값을 채팅에 올리지 마세요.

3. Supabase CLI 연결
--------------------
프로젝트 폴더에서:

cd C:\Users\USER\pawu-web
npx supabase login
npx supabase link --project-ref 여기에_프로젝트_REF

프로젝트 REF는 Supabase Dashboard URL 또는 Settings > General에서 확인합니다.

4. Edge Function secrets 등록
-----------------------------
먼저 PC의 .env.local에 있는 FIREBASE_SERVICE_ACCOUNT_JSON 값 전체를 클립보드로 복사합니다.
그 다음 아래 명령을 실행합니다. 명령창 기록에 비밀키가 남지 않게 임시 파일 방식을 권장합니다.

메모장으로 다음 파일을 만듭니다:
C:\Users\USER\pawu-web\supabase\.env.push-worker

내용:
FIREBASE_SERVICE_ACCOUNT_JSON={...서비스 계정 JSON 한 줄 전체...}
PUSH_WORKER_SECRET=위에서 만든 임의 문자열
PAWU_PUBLIC_URL=https://pawu-web.vercel.app

저장 후:

cd C:\Users\USER\pawu-web
npx supabase secrets set --env-file supabase/.env.push-worker

등록이 끝나면 비밀 파일을 즉시 삭제합니다:

Remove-Item .\supabase\.env.push-worker

이 파일은 절대 Git에 올리지 마세요.

5. Edge Function 배포
---------------------

cd C:\Users\USER\pawu-web
npx supabase functions deploy process-push-jobs --no-verify-jwt

배포 성공 후 Function URL:
https://프로젝트_REF.supabase.co/functions/v1/process-push-jobs

6. Database Webhook 생성
------------------------
Supabase Dashboard에서:
Database > Webhooks > Create a new hook

Name: pawu-push-jobs-insert
Table: public.push_jobs
Events: INSERT만 선택
Type: HTTP Request
Method: POST
URL: https://프로젝트_REF.supabase.co/functions/v1/process-push-jobs
HTTP Headers:
x-pawu-push-secret = 2단계에서 만든 PUSH_WORKER_SECRET

저장합니다.

7. 실패 작업 재시도 스케줄
---------------------------
Supabase Dashboard에서 Cron 또는 Integrations > Cron을 엽니다.
1분마다 Edge Function을 POST 호출하도록 설정합니다.

Schedule: * * * * *
Method: POST
URL: https://프로젝트_REF.supabase.co/functions/v1/process-push-jobs
Header:
x-pawu-push-secret = PUSH_WORKER_SECRET
Body: {}

Webhook이 순간 실패해도 Cron이 pending/retry 작업을 다시 처리합니다.

8. 로컬 테스트
-------------

cd C:\Users\USER\pawu-web
npm run dev

기존 채팅 송수신과 화면 진입을 먼저 확인합니다.

9. Git/Vercel 배포
------------------

cd C:\Users\USER\pawu-web
git add .
git commit -m "PAWU V9.7.0 durable push queue"
git push origin main

Vercel Production이 Ready가 될 때까지 기다립니다.

10. 최종 확인
------------
병원에서 보호자에게 메시지를 보낸 직후 Supabase Table Editor > push_jobs를 확인합니다.

정상 흐름:
pending 또는 processing -> sent

오류 시:
retry -> 재시도
5회 실패 -> dead
last_error에 원인이 기록됨

네 가지 상태를 모두 테스트합니다.
1) 보호자가 채팅방을 보고 있음
2) 보호자가 앱의 다른 화면을 보고 있음
3) 앱을 백그라운드로 내림
4) 앱을 완전히 닫고 화면 잠금

주의
----
- Vercel의 Firebase 환경변수는 삭제하지 않습니다.
- Supabase Edge Function secrets에도 Firebase 서비스 계정 JSON이 별도로 필요합니다.
- 서비스 계정 JSON, PUSH_WORKER_SECRET, service_role key를 Git에 올리지 않습니다.
- 새 Supabase SQL은 운영 DB에서 한 번만 실행합니다.
