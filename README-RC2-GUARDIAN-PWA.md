# PAWU v1.0.0 RC2 - 보호자 설치형 앱 기반

- Next.js App Router manifest
- Android/iOS 앱 아이콘
- production 서비스 워커
- 오프라인 안내 화면
- Chrome `beforeinstallprompt` 기반 PAWU 앱 설치 버튼
- standalone 앱 모드에서 병원/관리자 경로 차단

## 배포 확인
1. `npm run release:check`
2. Git 커밋 및 Vercel Production 배포
3. `/manifest.webmanifest`, `/sw.js` 직접 접속 확인
4. Android Chrome에서 PAWU 접속 후 `PAWU 앱 설치` 버튼 확인
