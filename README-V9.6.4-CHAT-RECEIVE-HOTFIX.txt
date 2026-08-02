PAWU V9.6.4 보호자 채팅 수신 핫픽스

증상
- 보호자 → 병원 메시지는 빠르게 표시됨
- 병원 → 보호자 메시지는 보호자가 화면을 누르거나 이동하기 전까지 채팅방에 나타나지 않음

원인
- V9.6.3에서 5초 전체 재조회를 제거한 뒤, 일부 모바일/PWA 환경에서 Supabase Realtime INSERT 이벤트가 누락됨.
- 보호자 화면 조작 시 포커스 갱신이 실행되어 그때 메시지가 나타남.

수정
- Realtime 수신은 그대로 유지.
- 채팅방이 화면에 보이는 동안 2.5초마다 마지막 메시지 ID 이후의 새 메시지만 경량 확인.
- 전체 대화/환자정보/예약정보는 다시 조회하지 않음.
- 앱 백그라운드에서는 조회하지 않음.
- FCM 푸시 알림은 그대로 유지.

덮어쓰기 위치
C:\Users\USER\pawu-web

포함 파일
components/chat/ConversationRoom.tsx
app/api/chat/messages/route.ts
PAWU_MASTER.md
PROJECT_STATUS.md
CHANGELOG.md
README-V9.6.4-CHAT-RECEIVE-HOTFIX.txt

실행
cd C:\Users\USER\pawu-web
npm run dev

배포
cd C:\Users\USER\pawu-web
git add .
git commit -m "PAWU V9.6.4 fix guardian chat receive"
git push origin main

테스트
1. 보호자 채팅방을 열어 둔다.
2. 병원에서 메시지를 보낸다.
3. 보호자가 아무 조작을 하지 않아도 약 2.5초 안에 메시지가 나타나는지 확인한다.
4. 동일 메시지가 두 번 나타나지 않는지 확인한다.
5. 앱을 닫은 상태에서 FCM 소리·진동 알림도 확인한다.
