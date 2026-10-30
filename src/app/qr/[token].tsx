import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import QRCode from 'react-native-qrcode-svg';
import { fetchQrProduct } from '../../api';
import { buildQrWebUrl } from '../../config';
import { images } from '../../data';
import { colors, radius } from '../../theme';
import type { QrProduct } from '../../types';
import { Button, Chip, CuritText, Header, ScreenFrame } from '../../ui';

const money = (value: number) => `${value.toLocaleString('ko-KR')}원`;

export default function QrProductDetail() {
  const params = useLocalSearchParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] ?? '' : params.token ?? '';
  const [item, setItem] = useState<QrProduct | null>(null);
  const [error, setError] = useState('');
  const url = buildQrWebUrl(token);
  const productImage = token === 'demo-bowl-set-2026' ? images.bowls : token === 'demo-dessert-plate' ? images.print : images.pottery;
  const openPurchasePage = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(url);
      return Promise.resolve();
    }
    return WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN });
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetchQrProduct(token, controller.signal).then(setItem).catch(reason => {
      if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message);
    });
    return () => controller.abort();
  }, [token]);

  return (
    <ScreenFrame>
      <Header title="QR 상품 상세" subtitle="방문객용 구매 링크 미리보기" back={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {!item && !error ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : null}
        {error ? <View style={styles.error}><CuritText weight="semibold" style={{ color: colors.danger }}>상품 데이터를 불러오지 못했습니다.</CuritText><CuritText style={{ color: colors.muted }}>{error}</CuritText></View> : null}
        {item ? <>
          <View style={styles.product}><Image source={productImage} style={styles.image} contentFit="cover" /><View style={{ flex: 1, gap: 5 }}><Chip label={item.status === 'ACTIVE' ? '판매 중' : '판매 일시정지'} /><CuritText weight="bold" style={{ fontSize: 19 }}>{item.name}</CuritText><CuritText style={{ color: colors.muted }}>{item.artistName ?? '김서연'} · 재고 {item.stock}개</CuritText><CuritText weight="bold" style={{ fontSize: 17 }}>{money(item.price)}</CuritText></View></View>
          <View style={styles.qrCard}><QRCode value={url} size={190} color={colors.ink} backgroundColor={colors.surface} /><CuritText weight="semibold" style={{ marginTop: 18 }}>상품별 고유 QR</CuritText><CuritText style={styles.url} numberOfLines={2}>{url}</CuritText></View>
          <View style={styles.info}><Info label="QR 토큰" value={item.token} /><Info label="상품 ID" value={item.productId} /><Info label="수령 방식" value={item.pickupMode === 'exhibition' ? '전시 종료 후 수령' : '결제 후 매장 즉시 수령'} /></View>
          <Button label="방문객 구매 화면 열기" onPress={() => { void openPurchasePage(); }} />
          <CuritText style={styles.notice}>앱은 가격을 전달하지 않습니다. 구매 화면은 QR 토큰으로 서버 상품을 다시 조회하므로, 결제 가격과 재고의 기준은 API입니다.</CuritText>
        </> : null}
      </ScrollView>
    </ScreenFrame>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><CuritText style={{ color: colors.muted }}>{label}</CuritText><CuritText weight="medium" style={styles.infoValue}>{value}</CuritText></View>; }

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 36 },
  product: { flexDirection: 'row', gap: 14, marginBottom: 24 }, image: { width: 116, height: 132, borderRadius: radius.md },
  qrCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 24, alignItems: 'center', marginBottom: 18, backgroundColor: colors.surface },
  url: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 7 },
  info: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginBottom: 20, paddingVertical: 4 }, infoRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18 }, infoValue: { flex: 1, textAlign: 'right' },
  notice: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 12 }, error: { backgroundColor: '#FFF2EF', padding: 16, borderRadius: radius.md, gap: 6 },
});
