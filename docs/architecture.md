# CURI:T 모바일 구조

## 선택한 환경

- Expo SDK 58 / React Native 0.88 / React 19
- Expo Router: 네이티브와 웹의 동일한 라우팅·딥링크 기반
- TypeScript strict: Figma Make 내보내기본의 암묵적 타입 오류를 제거
- Pretendard 로컬 번들: 플랫폼과 네트워크 상태에 상관없이 동일한 한글 조판
- AsyncStorage: 프로토타입 역할·세션 유지
- SecureStore: 실제 인증 토큰 도입 시 암호화 저장 경계
- `react-native-qrcode-svg`: 상품별 웹 주소를 실제 QR로 표현
- `expo-web-browser`: 방문객 구매 화면을 앱 외부의 안전한 브라우저 세션으로 실행

## 런타임 경계

```text
CURI:T Mobile
  ├─ 역할별 앱 UI·프로토타입 상태
  ├─ GET /api/v1/qr/{opaqueToken} ──> curit-api
  └─ /?qr={opaqueToken} 열기 ──────> curit-qr-web
                                      └─ 결제·재고는 API 재조회
```

앱은 가격이나 재고를 QR URL에 넣지 않는다. QR에는 추측하기 어려운 토큰만 담고, 구매 가격·재고·수령 방식은 API 응답을 기준으로 한다. 이는 앱과 QR 웹의 표시가 달라지는 문제와 클라이언트 가격 변조를 막기 위한 구조다.

## 상태 소유권

- 창작자: 원본 작품·굿즈, 가격, 작품 설명
- 매장: 협의된 공급 수량, 판매 일시정지·재개, 현장 수령 상태
- 서버: 주문 당시 가격·재고 스냅샷과 정산 기준
- QR 웹: 방문객 탐색·본인확인·결제·주문 확인

현재 앱용 회원·작품·협업 CRUD API는 별도 구현되지 않았다. 그 전까지 관련 화면은 사용자 흐름을 검증하는 로컬 프로토타입이며, QR 조회만 실제 연동이다.
