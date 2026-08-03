# PAWU PROJECT STATUS

## 현재 버전
V9.8.0 출시 체감 속도 및 전환 UX 개선

## 현재 정상 작동하는 기능
- 보호자/병원 로그인
- 예약 및 예약관리
- 보호자/병원 채팅 송수신
- 보호자 채팅 실시간 수신과 보조 동기화
- 앱 종료·백그라운드 상태 병원 메시지 FCM 푸시
- 보호자 반려동물 관리
- 병원 검색 및 전국 병원 DB
- 전자차트·처방·입원 경과 공유
- 보호자 FCM 토큰 등록 및 push_jobs 기반 발송

## 최근 완료한 작업
- V9.7.0 push_jobs → Database trigger/webhook → Supabase Edge Function 푸시 구조 적용
- Firebase 서비스 계정 Secret 형식 수정
- 보호자 FCM 활성 토큰 등록 확인
- 앱 종료 상태 소리·진동 푸시 수신 확인
- 주요 보호자 경로 유휴 시간 사전 로딩 추가
- 전역 페이지 전환 스켈레톤 추가
- 홈의 자주 가는 병원 데이터 60초 세션 캐시 및 중복 요청 차단
- 홈 돌봄 요약 중복 요청 차단

## 지금 진행 중인 작업
- V9.8.0을 실제 휴대폰 PWA와 PC Chrome에서 체감 속도 테스트
- 화면 전환과 첫 홈 재진입 속도 확인

## 발견된 오류와 미해결 문제
- Android 제조사 절전 정책이나 Chrome 알림 차단은 앱 외부 설정에 영향을 받음
- 전체 프로젝트 빌드는 사용자 PC에서 최종 확인 필요
- 병원 검색 지도는 위치·네트워크 상태에 따라 첫 로딩 시간이 달라질 수 있음

## 다음에 진행할 정확한 작업
1. V9.8.0 변경 파일을 프로젝트에 덮어쓰기
2. `npm run dev` 실행
3. 홈→병원→아이들→예약→내 정보 이동 속도 확인
4. 홈 복귀 시 자주 가는 병원과 돌봄 요약이 즉시 표시되는지 확인
5. 채팅 및 앱 종료 푸시가 기존처럼 유지되는지 확인
6. 정상이라면 Git 커밋·푸시 및 Vercel Production 배포
7. 출시 전 병원 관리자 핵심 화면 사용성 점검

## 마지막으로 수정한 파일 목록
- `app/loading.tsx`
- `app/globals.css`
- `components/AppShell.tsx`
- `components/navigation/RoutePrefetcher.tsx`
- `components/guardian/MyHospitalHomeCard.tsx`
- `components/home/HomeCareSummary.tsx`
- `PAWU_MASTER.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `README-V9.8.0-PERFORMANCE-UX.txt`

## 사용자 테스트가 필요한 항목
- 첫 실행 후 홈 표시
- 하단 메뉴 첫 이동 및 두 번째 이동 속도
- 홈으로 돌아왔을 때 데이터 즉시 표시
- 화면 전환 중 스켈레톤 표시 및 레이아웃 깨짐 여부
- 보호자/병원 채팅 송수신
- 앱 종료·백그라운드 상태 소리·진동 푸시
- 예약과 반려동물 목록 정상 표시
