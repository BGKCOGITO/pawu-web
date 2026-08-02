PAWU V9.6.1 FCM PUSH 적용 안내

1) 이 ZIP을 C:\Users\USER\pawu-web 에 덮어쓰기
   단, .env.local은 삭제하지 말 것

2) Supabase SQL Editor에서 실행
   supabase/migrations/20260802_pawu_v9_6_1_fcm_tokens.sql

3) Firebase Console에서 프로젝트 생성 후 Web App 추가
   Cloud Messaging > Web Push certificates에서 VAPID 키 생성
   프로젝트 설정 > 서비스 계정에서 새 비공개 키 생성

4) .env.local과 Vercel Environment Variables에 등록
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
FIREBASE_SERVICE_ACCOUNT_JSON={서비스계정JSON전체를한줄로}

5) PowerShell
cd C:\Users\USER\pawu-web
npm install
npm run dev

6) 로컬 확인 후 배포
cd C:\Users\USER\pawu-web
git add .
git commit -m "PAWU V9.6.1 FCM push notifications"
git push origin main

7) Vercel Ready 후 보호자 휴대폰
- 기존 PAWU 앱 삭제
- Chrome 사이트 설정에서 PAWU 알림 허용
- PAWU 재설치
- 로그인 > 알림센터 > 알림 설정 > 푸시 알림 연결

8) 테스트
- PAWU 앱 완전 종료
- 병원 계정에서 보호자에게 채팅 전송
- 잠금화면 알림, 소리, 진동 확인
- 알림을 눌러 해당 채팅방 이동 확인

배포가 갱신되지 않을 때만:
cd C:\Users\USER\pawu-web
git commit --allow-empty -m "Force redeploy PAWU V9.6.1"
git push origin main
