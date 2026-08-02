PAWU V9.6.2 FCM 안정화 패치
================================

[패치 적용 위치]
이 ZIP 내부의 파일과 폴더를 모두 다음 폴더에 덮어씁니다.
C:\Users\USER\pawu-web

이 ZIP은 변경된 파일만 포함합니다.
.env.local은 포함하지 않으며 기존 파일을 삭제하지 않습니다.

[신규/교체 파일]
- lib/push/fcm-admin.ts
- app/api/push/config/route.ts
- app/firebase-messaging-sw.js/route.ts
- app/notifications/settings/page.tsx
- env.local.example
- PAWU_MASTER.md
- PROJECT_STATUS.md
- CHANGELOG.md

[1. FIREBASE_SERVICE_ACCOUNT_JSON 입력]
PowerShell에서 아래 명령을 실행합니다. 파일명은 실제 다운로드 파일명으로 변경합니다.

$path = "$env:USERPROFILE\Downloads\pawu-9f2e1-firebase-adminsdk-fbsvc-1a01622037.json"
$json = Get-Content $path -Raw | ConvertFrom-Json
$oneLine = $json | ConvertTo-Json -Compress
$oneLine | Set-Clipboard

그 다음 다음 파일을 엽니다.
notepad C:\Users\USER\pawu-web\.env.local

아래 줄의 = 바로 뒤에 Ctrl+V로 붙여넣습니다.
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

주의:
- 따옴표를 추가로 감싸지 않습니다.
- 서비스 계정 JSON이나 private_key를 채팅, GitHub, 화면 캡처로 공유하지 않습니다.
- 기존 Supabase/Firebase 환경변수를 삭제하지 않습니다.

[2. Supabase SQL]
Supabase SQL Editor에서 다음 migration을 한 번만 실행합니다.
supabase/migrations/20260802_pawu_v9_6_1_fcm_tokens.sql

이미 실행했다면 다시 실행해도 create table if not exists 구조이지만, 운영 기록상 중복 실행하지 않는 것을 권장합니다.

[3. 로컬 확인]
cd C:\Users\USER\pawu-web
npm install
npm run dev

브라우저:
http://localhost:3000/notifications/settings

보호자 계정으로 로그인 후 `푸시 알림 연결`을 누릅니다.
성공 문구:
휴대폰 푸시 알림이 연결되었습니다. 앱을 닫아도 병원 채팅 알림이 소리와 진동으로 표시됩니다.

[4. Git 배포]
cd C:\Users\USER\pawu-web
git add .
git commit -m "PAWU V9.6.2 stabilize FCM push"
git push origin main

[5. Vercel 환경변수]
Vercel > PAWU > Settings > Environment Variables에 아래 8개를 등록합니다.
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- NEXT_PUBLIC_FIREBASE_APP_ID
- NEXT_PUBLIC_FIREBASE_VAPID_KEY
- FIREBASE_SERVICE_ACCOUNT_JSON

등록 후 새 배포가 필요합니다.

git commit --allow-empty -m "Redeploy PAWU V9.6.2 with Firebase env"
git push origin main

[6. 휴대폰 최종 테스트]
1) 기존 PAWU PWA 삭제
2) Chrome에서 운영 주소 접속
3) 사이트 알림 권한 허용
4) 홈 화면에 PAWU 재설치
5) 보호자 로그인 > 알림센터 > 알림 설정 > 푸시 알림 연결
6) 앱을 완전히 종료하고 화면 잠금
7) 병원에서 보호자에게 메시지 발송
8) 소리, 진동, 잠금화면 알림, 알림 클릭 이동 확인

[중요]
현재 작업 환경의 npm 저장소에서 일부 패키지를 찾지 못해 전체 build/typecheck는 실행하지 못했습니다.
사용자 PC에서 npm run dev 확인 후 배포합니다.
