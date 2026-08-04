# PAWU PROJECT STATUS

## 현재 버전
V10.0.0 RC1 출시 후보

## 현재 정상 작동하는 기능
- 보호자/병원 로그인
- 예약 및 병원 예약관리
- 보호자/병원 채팅 송수신
- 보호자 채팅 Realtime 및 보조 동기화
- 앱 종료·백그라운드 상태 병원 메시지 FCM 푸시
- 보호자 FCM 토큰 등록과 `push_jobs` 기반 발송
- 보호자 반려동물 관리
- 병원 검색·지도 및 전국 병원 DB
- 전자차트·처방·입원 경과 공유
- 네트워크 단절·복구 안내, 오류 복구 화면, 전용 404 화면

## 최근 완료한 작업
- V9.8.0~V9.8.3 체감 속도, 세션·요청 캐시, 병원 지도 캐시 적용
- V9.9.0 네트워크·오류·404 예외 UX 적용
- V10.0.0 RC1 버전 정리
- RC 환경변수·서비스 계정 JSON 자동 점검 스크립트 추가
- 베타 배포·롤백 체크리스트 추가

## 지금 진행 중인 작업
- V10.0.0 RC1 로컬 release readiness, typecheck, production build 확인
- Vercel Production 배포 후 핵심 경로 최종 확인

## 발견된 오류와 미해결 문제
- Android 제조사 절전 정책이나 Chrome 알림 차단은 앱 외부 설정에 영향을 받음
- 병원 검색 지도 첫 로딩은 위치·네트워크 상태에 따라 달라질 수 있음
- 신규 휴대폰은 보호자가 알림 설정에서 FCM 토큰을 최초 1회 등록해야 함

## 다음에 진행할 정확한 작업
1. RC 패치 파일 덮어쓰기
2. `npm run release:ready` 실행
3. `npm run typecheck` 실행
4. `npm run build` 실행
5. 로컬 핵심 기능 확인
6. Git 커밋·푸시
7. Vercel Ready 확인
8. 운영 주소에서 채팅·예약·앱 종료 푸시 확인
9. 초기 베타 병원 배포 시작

## 마지막으로 수정한 파일 목록
- `package.json`
- `package-lock.json`
- `app/manifest.ts`
- `scripts/release-readiness.mjs`
- `RELEASE-CHECKLIST-V10-RC.md`
- `PAWU_MASTER.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `README-V10.0.0-RC1.txt`

## 사용자 테스트가 필요한 항목
- `npm run release:ready`, `typecheck`, `build` 통과
- 보호자↔병원 채팅
- 앱 종료·백그라운드 상태 푸시 소리·진동
- 예약 조회 및 병원 예약관리
- 병원 검색·지도
- 네트워크 끊김·복구 안내
- 존재하지 않는 주소의 PAWU 404 화면

## V10.0.0 RC3 현재 상태
- Android 실기기에서 확인된 건강 타임라인 레이아웃, 체중 그래프, 플로팅 채팅 버튼을 실제 렌더링 파일 기준으로 수정했습니다.
- 사진 첨부 실패 시 건강 이벤트 본문은 보존되며 편집 화면에서 다시 첨부할 수 있습니다.
- 적용 전 `20260803_pawu_v10_rc3_event_media_repair.sql` 실행이 필요합니다.
- 사용자 테스트 필요: 사진 첨부 저장, 건강 타임라인 3열 버튼, 반려동물/요약 2열, 체중 최근 7회, 건강 화면 채팅 버튼 숨김.


## V12.2.4 채팅 API 안정화
- `GET /api/chat/messages?conversationId=&afterId=` 증분 조회 API 추가
- 보호자↔병원 메시지 수신이 Realtime에만 의존하던 문제 수정
- 메시지 POST 응답에 생성된 메시지 전체 객체 반환
- 캐시 방지 헤더 적용
- 1초 증분 동기화 유지, 전체 재조회는 15초 복구용으로 축소


## V13.0.0 푸시 시스템 재구축
- Firebase CDN 동적 스크립트 방식 제거
- firebase npm SDK 10.14.1 기반으로 클라이언트 초기화 통일
- 서비스 워커 `/firebase-messaging-sw.js` 하나만 사용
- 기존 `/sw.js` 등 레거시 서비스 워커 자동 해제
- 알림 권한 → 설정 → 서비스 워커 → Firebase → 토큰 → DB 저장 단계 표시
- FCM 토큰 발급 25초 타임아웃 및 오류 화면 표시
- 정상 연결 후 알림 안내창 자동 닫힘
- 수동 토큰 초기화·재발급 기능 제공
- 서버 푸시는 notification + data payload로 앱 종료 상태 지원


## V13.0.1
- Fix: Firebase onMessage Unsubscribe 반환 타입과 cleanup 함수 타입 불일치 수정
- Build: PushNotificationManager cleanup을 optional function으로 안전하게 처리
