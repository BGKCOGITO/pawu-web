PAWU V12.2 채팅 Compact 레이아웃 교체본

적용 대상:
C:\Users\USER\pawu-web

교체 파일:
components\chat\ConversationRoom.tsx

변경 내용:
- 보호자/병원 채팅 화면 높이를 화면 안에 고정
- 메시지 목록만 내부 스크롤
- 입력창을 채팅 하단에 고정
- 병원 정보 패널 폭 380px → 320px
- 보호자/반려동물/예약 정보를 Compact 카드로 축소
- 기존 진료 및 건강 이벤트 최근 3건만 Compact 표시
- 병원 정보 패널 자체 스크롤
- 새 메시지 자동 하단 이동 유지
- 메시지 전송 즉시 화면에 표시하는 Optimistic UI 추가
- 전송 실패 시 임시 메시지 제거 및 입력 내용 복원
- 기존 Supabase Realtime 및 보조 동기화 로직 유지

적용:
1. ZIP 압축 해제
2. components 폴더를 아래 경로에 덮어쓰기
   C:\Users\USER\pawu-web

검사:
cd C:\Users\USER\pawu-web
npm run typecheck
npm run build
npm run dev

확인:
- 보호자 채팅방
- 병원 채팅방
- 메시지가 많아도 전체 페이지가 길어지지 않는지
- 메시지 영역만 스크롤되는지
- 입력창이 항상 아래에 보이는지
- 병원 우측 정보가 한 화면에 더 많이 보이는지
- 전송 버튼 클릭 즉시 메시지가 표시되는지

정상 확인 후 배포:
git add .
git commit -m "Optimize chat layout and message sending"
git push origin main
