PAWU V12.2.7 보호자 푸시 자동 등록·복구 교체본

이번에는 전체 app 폴더의 실제 푸시 흐름을 기준으로 수정했습니다.

확인된 실제 문제
1. FCM 토큰 생성과 DB 저장은 /notifications/settings 화면에서
   사용자가 직접 '푸시 알림 연결'을 눌러야만 실행되었습니다.
2. 보호자 앱에는 해당 화면으로 바로 들어가는 입력창이 없으므로,
   토큰을 삭제하거나 만료되면 앱을 다시 실행해도 fcm_tokens가 비어 있었습니다.
3. 브라우저 저장소에 만료된 토큰이 남아 있으면 getToken()이 같은 토큰을
   다시 반환할 수 있어 Firebase 404 후 is_active=false가 반복될 수 있었습니다.
4. 서버 코드는 모든 404를 토큰 만료로 간주해 is_active=false로 바꾸고 있어,
   Firebase 프로젝트 불일치 같은 설정 오류도 토큰 문제처럼 보였습니다.

이번 수정
- 보호자 로그인 후 전역에서 FCM 토큰 자동 등록
- 앱 실행, 로그인, 토큰 갱신, 포커스 복귀 시 자동 확인
- DB에 활성 토큰이 없으면 브라우저의 기존 토큰 삭제 후 새 토큰 강제 발급
- 새 토큰을 fcm_tokens에 is_active=true로 자동 저장
- chat_messages 및 browser_push 환경설정 자동 활성화
- 병원 관리자 화면에서는 보호자 토큰 등록 제외
- Firebase 웹 프로젝트와 서비스 계정 프로젝트 일치 여부 진단
- 일반적인 404만으로 토큰을 비활성화하지 않음
- Firebase가 명시적으로 UNREGISTERED라고 반환할 때만 is_active=false 처리
- 기존 수동 '푸시 알림 연결' 화면도 복구용으로 유지

교체 파일
- app/layout.tsx
- app/api/push/config/route.ts
- app/notifications/settings/page.tsx
- components/push/AutoPushRegistration.tsx
- lib/push/fcm-admin.ts

적용 대상
C:\Users\USER\pawu-web

적용 및 배포
1. ZIP 압축 해제
2. app, components, lib 폴더를 C:\Users\USER\pawu-web 에 덮어쓰기

cd C:\Users\USER\pawu-web
npm run typecheck
npm run build

git add .
git commit -m "Automatically register and recover guardian push token"
git push origin main

배포 후 테스트
1. Vercel Ready 확인
2. Supabase fcm_tokens의 기존 행은 삭제된 상태로 둡니다.
3. 보호자 앱을 완전히 종료한 뒤 다시 실행하고 로그인합니다.
4. 휴대폰의 PAWU 알림 권한은 허용 상태여야 합니다.
5. 앱 홈에서 5~10초 기다립니다.
6. Supabase fcm_tokens 새로고침
   - 새 행 생성
   - is_active=true
   - updated_at=방금 시간
7. 앱을 완전히 종료하고 병원에서 메시지를 전송합니다.
8. 소리·진동·알림 수신을 확인합니다.

진단
브라우저 또는 앱에서 아래 API를 열면 프로젝트 일치 여부를 확인할 수 있습니다.
https://pawu-web.vercel.app/api/push/config

정상 값
- clientReady: true
- serverReady: true
- projectMatch: true

projectMatch가 false라면
NEXT_PUBLIC_FIREBASE_PROJECT_ID와 FIREBASE_SERVICE_ACCOUNT_JSON의 project_id가
서로 다른 Firebase 프로젝트이므로 환경변수를 동일 프로젝트 기준으로 맞춰야 합니다.
