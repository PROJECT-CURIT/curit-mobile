# QR 웹·API 연동

## 환경 변수

| 변수 | 역할 | 로컬 기본값 |
| --- | --- | --- |
| `EXPO_PUBLIC_CURIT_API_URL` | QR 토큰으로 상품을 조회하는 API | `http://localhost:4100` |
| `EXPO_PUBLIC_CURIT_QR_WEB_URL` | 방문객 구매 웹의 공개 주소 | `http://localhost:5173` |

Android 에뮬레이터에서는 localhost 대신 `10.0.2.2`를 사용한다. 실기기에서는 두 주소를 개발 PC의 LAN IP 또는 HTTPS 배포 주소로 설정해야 한다.

## 상품별 URL

```text
demo-mug-white-gray → /?qr=demo-mug-white-gray
demo-bowl-set-2026  → /?qr=demo-bowl-set-2026
demo-dessert-plate  → /?qr=demo-dessert-plate
```

앱은 `GET /api/v1/qr/{token}`으로 세 상품을 각각 조회한다. QR 상세 화면에서 생성되는 QR은 GitHub Pages 직접 접속도 HTTP 200을 유지하도록 `/?qr={token}`을 인코딩한다. 따라서 상품마다 QR은 다르지만 운영 환경만 바꾸면 토큰 계약은 유지된다.

## 배포 전 필수 조건

1. QR 웹과 API를 HTTPS로 배포하고 두 공개 URL을 빌드 환경 변수로 고정한다.
2. 앱에서 생성하는 URL과 API의 `returnUrl`이 같은 운영 도메인을 가리키는지 검증한다.
3. 신규 상품 QR 토큰은 서버에서 생성하며, 상품명이나 순번을 그대로 토큰으로 사용하지 않는다.
4. 가격·재고·수령 방식은 앱 입력값이 아니라 API 스냅샷을 신뢰한다.
5. 일시정지된 상품은 신규 결제를 막되 기존 주문·수령·정산 내역은 보존한다.
