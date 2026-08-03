# PAWU PROJECT STATUS

## 현재 버전
V9.8.1 클라이언트 세션·홈 진입 최적화

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
- V9.8.0 주요 경로 사전 로딩, 전역 스켈레톤, 홈 60초 세션 캐시 적용
- 공용 Supabase 세션 조회 캐시 및 진행 중 요청 공유 추가
- 홈 역할 판정 결과를 사용자별 5분 세션 캐시로 저장
- 홈의 돌봄 요약·자주 가는 병원·하단 채팅 배지가 동일 세션 조회를 공유하도록 변경
- 네트워크 절약 모드·2G 환경에서 경로 사전 로딩을 중지하도록 변경
- 주요 경로와 보조 경로 사전 로딩을 단계적으로 분리

## 지금 진행 중인 작업
- V9.8.1을 실제 보호자 휴대폰 PWA와 PC Chrome에서 테스트
- 첫 홈 진입과 홈 재진입 속도 비교

## 발견된 오류와 미해결 문제
- Android 제조사 절전 정책이나 Chrome 알림 차단은 앱 외부 설정에 영향을 받음
- 병원 검색 지도는 위치·네트워크 상태에 따라 첫 로딩 시간이 달라질 수 있음
- 전체 프로젝트 의존성 설치 환경에서 최종 build/typecheck 확인 필요

## 다음에 진행할 정확한 작업
1. V9.8.1 변경 파일을 프로젝트에 덮어쓰기
2. `npm run typecheck`와 `npm run dev` 실행
3. 로그인 후 첫 홈 진입 시간을 확인
4. 다른 화면에서 홈으로 돌아왔을 때 계정 확인 오버레이 지속 시간을 확인
5. 하단 메뉴 이동과 채팅 배지 정상 표시 확인
6. 병원·슈퍼관리자 계정이 기존 관리자 화면으로 정상 이동하는지 확인
7. 채팅 및 앱 종료 푸시가 유지되는지 확인
8. 정상이라면 Git 커밋·푸시 및 Vercel 배포

## 마지막으로 수정한 파일 목록
- `lib/client-auth-session-cache.ts`
- `components/HomeRoleRedirect.tsx`
- `components/home/HomeCareSummary.tsx`
- `components/guardian/MyHospitalHomeCard.tsx`
- `components/GuardianBottomNav.tsx`
- `components/navigation/RoutePrefetcher.tsx`
- `PAWU_MASTER.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `README-V9.8.1-PERFORMANCE.txt`

## 사용자 테스트가 필요한 항목
- 보호자 첫 홈 진입 및 재진입 속도
- 병원/슈퍼관리자 계정 자동 이동
- 홈 돌봄 요약과 자주 가는 병원 표시
- 채팅 읽지 않음 배지 표시·갱신
- 주요 하단 메뉴 첫 이동과 두 번째 이동 속도
- 보호자/병원 채팅 송수신
- 앱 종료·백그라운드 상태 소리·진동 푸시
