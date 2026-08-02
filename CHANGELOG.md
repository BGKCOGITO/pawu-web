# CHANGELOG

## V9.6.2 - FCM 안정화 패치
### 추가
- 푸시 설정 API에서 Firebase 클라이언트 설정과 서버 서비스 계정 설정 상태를 분리해 진단
- Firebase 서비스 계정 JSON의 따옴표 중복, `\\n` 줄바꿈, base64 입력을 허용하는 안전 파서
- 동적 Firebase Service Worker에 기존 PAWU PWA 캐시와 오프라인 처리를 통합

### 수정
- FCM을 데이터 전용 메시지로 전송하고 Service Worker가 알림을 한 번만 표시하도록 변경
- 푸시 메시지의 우선순위와 TTL 설정
- 만료·해지된 FCM 토큰을 자동 비활성화
- 알림 클릭 URL을 현재 도메인 기준 절대 URL로 정규화
- 알림 설정 화면에서 `FIREBASE_SERVICE_ACCOUNT_JSON` 누락을 정확히 안내
- `env.local.example`에 Firebase 필수 환경변수 목록 추가

### 오류 수정
- Firebase 웹 설정만 완료된 상태에서 푸시 연결이 성공한 것처럼 보일 수 있던 문제 방지
- 기존 정적 `sw.js`와 Firebase Service Worker가 분리되어 PWA 캐시 기능이 사라질 수 있던 문제 수정
- notification payload와 background handler가 함께 알림을 표시해 중복 알림이 발생할 가능성 제거

### 기존 기능 영향
- 기존 채팅 저장, 채팅 목록, 앱 내부 알림 로직은 변경하지 않음
- Firebase 설정이 잘못되거나 푸시 발송이 실패해도 채팅 전송 자체는 유지
- 기존 `fcm_tokens` 테이블과 V9.6.1 migration을 그대로 사용

## V9.6.1 - FCM Push
### 추가
- Firebase Cloud Messaging 기반 웹 푸시 토큰 등록
- 보호자별 `fcm_tokens` 테이블
- 병원 채팅 발송 시 보호자 기기에 푸시 발송
- 백그라운드 Service Worker 알림
- 알림 클릭 시 해당 채팅방 이동

### 개인정보 보호
- 푸시 알림에는 채팅 내용 대신 `병원에서 새 메시지가 도착했습니다.`만 표시

### 기존 기능 영향
- 채팅 저장과 앱 내부 알림 구조 유지
- 푸시 실패가 채팅 전송 실패로 이어지지 않도록 예외 분리

## V9.6.0 Chat Hotfix
### 수정
- 채팅 진입 시 페이지 로드 실패 문제 복구
- 채팅 관련 변경을 정상 작동 버전으로 롤백

### 기존 기능 영향
- 채팅 송수신 정상화
- 종료 상태 시스템 푸시는 미지원
