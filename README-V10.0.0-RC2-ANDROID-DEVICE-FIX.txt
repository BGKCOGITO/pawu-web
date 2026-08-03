PAWU V10.0.0 RC2 - Android 실기기 수정

변경 사항
- 건강 이벤트 첨부 테이블/Storage 정책 복구 SQL
- 첨부 실패 시 이미 저장된 건강 기록을 삭제하지 않음
- 건강 타임라인 상단 버튼과 카드 모바일 레이아웃 개선
- 최근 7회 체중을 가로 스크롤 없이 한 화면에 표시
- 최근 최저/현재/최고 체중 요약 추가
- 모바일 플로팅 채팅 버튼을 작은 원형 아이콘으로 축소
- /.well-known/assetlinks.json 동적 제공 경로 추가

필수 적용
1. supabase/migrations/20260803_pawu_v10_rc2_event_media_repair.sql 실행
2. Vercel ANDROID_TWA_SHA256 환경변수 등록
3. 새 Vercel 배포 후 assetlinks URL 확인
4. Bubblewrap APK/AAB 재빌드
