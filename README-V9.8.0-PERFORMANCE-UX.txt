PAWU V9.8.0 출시 체감 속도 및 전환 UX 패치

적용 위치
C:\Users\USER\pawu-web

포함 내용
- 주요 보호자 경로 유휴 시간 prefetch
- 전역 페이지 전환 스켈레톤
- 자주 가는 병원 60초 세션 캐시
- 홈 돌봄 요약 및 병원 카드 중복 요청 차단

새 SQL: 없음
새 환경변수: 없음
Firebase/Supabase 푸시 설정 변경: 없음

로컬 확인
cd C:\Users\USER\pawu-web
npm run dev

배포
cd C:\Users\USER\pawu-web
git add .
git commit -m "PAWU V9.8.0 performance and UX"
git push origin main

테스트
- 홈과 하단 메뉴 이동 속도
- 홈 복귀 시 즉시 표시
- 채팅 송수신
- 앱 종료 상태 푸시 소리·진동
