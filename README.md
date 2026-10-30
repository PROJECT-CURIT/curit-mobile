# CURI:T Mobile

독립 크리에이터와 오프라인 매장의 전시 협업을 연결하는 CURI:T 네이티브 앱입니다. Figma Make 시안을 React Native로 다시 구현했으며 Supabase Auth·PostgreSQL RLS·Storage로 계정, 프로젝트, 매장, 이미지를 여러 기기에서 영구 저장합니다.

## 실행

```bash
cp .env.example .env
pnpm install
pnpm start
```

- iOS 시뮬레이터: `pnpm ios`
- Android 에뮬레이터: `.env`의 호스트를 `10.0.2.2`로 변경 후 `pnpm android`
- 반응형 웹 확인: `pnpm web`

QR 연결을 확인하려면 `curit-api`를 4100번, `curit-qr-web`을 5173번 포트에서 실행합니다. 설정과 경계는 [QR 연동 문서](docs/qr-integration.md)를 참고하세요.

`.env`에는 Supabase Project URL과 Publishable Key만 넣습니다. Service Role Key와 결제 시크릿 키는 앱에 넣으면 안 됩니다. 매장 가입은 기본 정보→취향→사진→전시 구역→확인의 5단계이며 각 단계 완료 시 서버에 임시 저장되고, 중단 후 로그인해도 저장된 단계부터 이어집니다.

승인된 협업에는 서버가 상품별 무작위 QR을 발급합니다. 앱의 QR 상품 관리 화면은 Supabase JWT로 참여자 권한을 확인한 뒤 실제 발급 목록과 미발급 후보를 조회합니다.

## 배포

Expo 프로젝트 `@ah_young/curit-mobile`과 연결되어 있습니다. `eas.json`의 `preview`는 Android APK/iOS Simulator 검증용이고 `production`은 스토어 제출용입니다. 실제 스토어 제출에는 Apple Developer·Google Play Console 자격증명이 별도로 필요합니다.

## 검증

```bash
pnpm typecheck
pnpm test
pnpm export:web
```

현재 구현 범위와 Figma 36개 기준 화면의 상태는 [화면 매트릭스](docs/screen-matrix.md)에 명시되어 있습니다.
큐릿의 메인 앱 개발 레포지토리입니다.
