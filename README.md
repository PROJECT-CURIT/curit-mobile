# CURI:T Mobile

독립 크리에이터와 오프라인 매장의 전시 협업을 연결하는 CURI:T 네이티브 앱입니다. Figma Make 시안을 React Native로 다시 구현했으며, 매장 운영자는 기존 `curit-api`의 상품별 QR 토큰을 조회하고 `curit-qr-web` 구매 화면을 열 수 있습니다.

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

## 검증

```bash
pnpm typecheck
pnpm test
pnpm export:web
```

현재 구현 범위와 Figma 36개 기준 화면의 상태는 [화면 매트릭스](docs/screen-matrix.md)에 명시되어 있습니다.
큐릿의 메인 앱 개발 레포지토리입니다.
