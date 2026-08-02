PAWU V9.6.3 성능 안정화 패치

[적용 위치]
압축 안의 폴더 구조를 유지한 채 아래 위치에 덮어씁니다.
C:\Users\USER\pawu-web

[변경 파일]
components\chat\ConversationRoom.tsx
components\GuardianBottomNav.tsx
app\api\chat\messages\route.ts
app\hospital-admin\chat\page.tsx
app\hospital-admin\reception\page.tsx
PAWU_MASTER.md
PROJECT_STATUS.md
CHANGELOG.md

[적용 후 로컬 확인]
cd C:\Users\USER\pawu-web
npm run dev

확인 항목:
1. 보호자 채팅방 진입
2. 병원→보호자 메시지 즉시 수신
3. 보호자→병원 메시지 즉시 수신
4. 메시지 중복 표시 없음
5. 앱 종료 상태 FCM 소리·진동 유지
6. 병원 채팅 목록 및 접수 화면 정상

[배포]
cd C:\Users\USER\pawu-web
git add .
git commit -m "PAWU V9.6.3 performance stabilization"
git push origin main

Vercel Production이 Ready가 된 뒤 휴대폰 Chrome에서 새로고침합니다.
기존 PWA가 예전 파일을 계속 사용하면 앱을 삭제한 뒤 Chrome에서 다시 설치합니다.

[중요]
Firebase 및 Supabase 환경변수는 변경하지 않습니다.
새 Supabase SQL도 필요하지 않습니다.
