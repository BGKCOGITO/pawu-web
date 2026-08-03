PAWU V9.7.1 FCM 토큰 등록 진단 패치

변경 파일:
- app/api/push/register/route.ts
- app/notifications/settings/page.tsx
- PAWU_MASTER.md
- PROJECT_STATUS.md
- CHANGELOG.md

목적:
알림 권한은 허용됐지만 fcm_tokens가 비어 있는 상황을 정확히 표시하고, 토큰 저장 성공 여부를 DB 기준으로 확인합니다.
