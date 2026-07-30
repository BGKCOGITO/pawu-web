# PAWU V9.0.0 Guardian UI Renewal

## 포함된 작업
- 모바일 홈 화면 구조 전면 개편
- 상단 헤더 단순화
- 하단 내비게이션 SVG 아이콘 적용
- 모바일 Safe Area 및 작은 화면 대응
- 앱 아이콘/마스커블 아이콘/Apple Touch Icon 교체
- 기존 예약·건강기록·복약·입원·AI 기능 링크 유지

## 적용 방법
이 ZIP은 전체 프로젝트 교체본입니다.
기존 프로젝트의 `.env.local`은 유지하고, `node_modules`, `.next`는 복사하지 마세요.

```powershell
npm install
npm run dev
```

설치형 앱 아이콘이 이전 이미지로 남아 있으면 기존 PAWU 앱을 삭제한 뒤 브라우저 캐시를 지우고 다시 설치하세요.
