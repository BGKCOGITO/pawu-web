PAWU V12.2.4 채팅 API 핵심 수정 교체본

확인된 실제 원인
1. ConversationRoom은 1초마다 아래 GET API를 호출하고 있었습니다.
   /api/chat/messages?conversationId=...&afterId=...

2. 하지만 app/api/chat/messages/route.ts에는 POST와 PATCH만 있고 GET이 없었습니다.
   따라서 증분 동기화 요청은 405 응답으로 실패했고,
   Supabase Realtime까지 끊기면 병원→보호자, 보호자→병원 모두 새 메시지를 받지 못했습니다.

3. POST API는 생성된 메시지 전체가 아니라 messageId만 반환하고 있었습니다.
   프런트는 result.message를 기대하므로 Optimistic UI가 제거된 뒤 다시 전체 조회를 기다리는 문제가 있었습니다.

이번 수정
- GET /api/chat/messages 증분 조회 API 추가
- conversationId 접근 권한 확인
- afterId보다 큰 메시지만 id 순서로 반환
- POST 응답에 생성된 message 전체 반환
- 모든 채팅 API 응답에 no-store 캐시 헤더 적용
- Realtime + 1초 API 증분 조회 이중화
- 전체 재조회는 15초 복구용으로 유지

적용 대상
C:\Users\USER\pawu-web

교체 파일
- app\api\chat\messages\route.ts
- components\chat\ConversationRoom.tsx
- PROJECT_STATUS.md / CHANGELOG.md (원본 프로젝트에 존재한 경우)

적용 순서
1. ZIP 압축 해제
2. ZIP 안의 app, components 및 문서 파일을 아래 경로에 덮어쓰기
   C:\Users\USER\pawu-web

3. 검사
cd C:\Users\USER\pawu-web
npm run typecheck
npm run build

4. 배포
git add .
git commit -m "Fix two-way chat message API"
git push origin main

5. Vercel 배포가 Ready가 된 후
- 보호자 앱 완전히 종료 후 다시 실행
- PAWU Hospital 완전히 종료 후 다시 실행

테스트
- 같은 채팅방을 양쪽에서 엽니다.
- 병원 → 보호자 메시지: 상대 화면에 약 1초 내 표시
- 보호자 → 병원 메시지: 상대 화면에 약 1초 내 표시
- 발신자 화면에는 전송 즉시 표시
- 병원 왼쪽 채팅 목록 최근 메시지 및 배지 갱신
- 보호자 → 병원 메시지 시 Windows 알림 확인

이번 수정은 추측 패치가 아니라 전체 프로젝트에서 실제 API와 프런트 호출을 비교해 확인한 원인 수정입니다.
