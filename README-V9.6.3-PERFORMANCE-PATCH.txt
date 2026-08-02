PAWU V9.6.3 성능 안정화 패치

[적용 위치]
C:\Users\USER\pawu-web

[적용 방법]
1. 이 ZIP의 내용을 폴더 구조 그대로 위 프로젝트 폴더에 덮어씁니다.
2. .env.local은 수정하거나 삭제하지 않습니다.
3. 새 Supabase SQL과 새 환경변수는 없습니다.

[로컬 실행]
cd C:\Users\USER\pawu-web
npm run dev

[필수 테스트]
- 보호자/병원 양방향 채팅
- 메시지 즉시 표시 및 중복 미표시
- 보호자 하단 채팅 배지
- 병원 채팅 목록
- 병원 접수·대기 보드
- 앱 종료 상태 FCM 푸시, 소리, 진동

[배포]
cd C:\Users\USER\pawu-web
git add .
git commit -m "PAWU V9.6.3 performance stabilization"
git push origin main

[배포 후]
Vercel Production이 Ready가 된 뒤 휴대폰 PAWU 앱을 완전히 종료했다가 다시 실행합니다.
예전 동작이 남으면 앱 삭제 후 Chrome에서 pawu-web.vercel.app을 열어 다시 설치합니다.

[변경 파일]
components/chat/ConversationRoom.tsx
components/GuardianBottomNav.tsx
app/api/chat/messages/route.ts
app/hospital-admin/chat/page.tsx
app/hospital-admin/reception/page.tsx
PAWU_MASTER.md
PROJECT_STATUS.md
CHANGELOG.md
README-V9.6.3-PERFORMANCE-PATCH.txt
