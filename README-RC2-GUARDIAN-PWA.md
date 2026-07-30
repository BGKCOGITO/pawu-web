# PAWU v1.0.0 RC2 - 보호자 앱(PWA/TWA) 기반

## 포함 내용

- Next.js App Router 웹 앱 매니페스트
- Android 설치용 192/512/maskable 아이콘
- iOS 홈 화면용 아이콘
- standalone 전체화면 및 세로 방향 설정
- 서비스 워커 등록과 오프라인 안내 화면
- 설치형 앱에서 병원·관리자 전용 경로 접근 차단
- TWA 패키지 식별자 기준: `kr.co.pawu.guardian`

## 배포 후 확인

1. `npm run release:check`
2. Git commit/push 후 Vercel Production 배포
3. Android Chrome에서 PAWU 주소 접속
4. Chrome 메뉴의 `앱 설치` 또는 `홈 화면에 추가` 확인
5. 설치 앱 실행 후 독립형 화면과 오프라인 안내 확인

## 다음 단계

Vercel Production 도메인의 `manifest.webmanifest`가 정상 응답하는 것을 확인한 뒤 Bubblewrap으로 Android TWA 프로젝트를 생성한다.
