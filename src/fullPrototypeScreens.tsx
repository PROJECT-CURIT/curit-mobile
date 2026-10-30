import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { Button, Chip, CuritText, Empty, Field, Header, Icon, SectionTitle } from './ui';
import { colors, fonts, radius } from './theme';
import {
  addPostComment,
  createSocialPost,
  loadCreatorProfile,
  loadNotifications,
  loadSocialFeed,
  markNotificationRead,
  saveCreatorDna,
  saveCreatorProfile,
  toggleCreatorFollow,
  togglePostLike,
  type AppNotification,
  type CreatorProfileData,
  type SocialPost,
} from './fullPlatform';
import {
  friendlyError,
  cancelManagedOrder,
  loadManagedOrders,
  loadStoreOnboarding,
  mediaUrl,
  saveStoreOnboarding,
  updateManagedOrder,
  updateQrListing,
  type ManagedOrder,
  type StoreOnboarding,
} from './platform';
import type { QrProduct } from './types';
import { registerNativePush } from './pushNotifications';

const categoryOptions = ['도예·세라믹', '판화·프린트', '패브릭·섬유', '회화', '조각', '사진', '드로잉', '기타'];
const regionOptions = ['서울', '경기', '인천', '강원', '대전·세종·충청', '광주·전라', '대구·경북', '부산·울산·경남', '제주', '전국 / 온라인'];
const moodOptions = ['내추럴', '우드톤', '빈티지', '모던', '아트', '미니멀'];
const colorOptions = ['화이트', '아이보리', '베이지', '브라운', '블랙', '그레이'];
const spaceOptions = ['카페', '서점', '식당', '편집샵', '쇼룸', '라운지', '갤러리'];
const goalOptions = ['작품 홍보', '작품 판매', '둘 다'];

function toggle(value: string, values: string[], setValues: (value: string[]) => void) {
  setValues(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
}

function LoadingScreen({ title, onBack }: { title: string; onBack: () => void }) {
  return <View style={f.flex}><Header title={title} back={onBack} /><ActivityIndicator color={colors.brand} style={f.loader} /></View>;
}

export function CreatorDnaScreen({ onBack, onNext }: { onBack: () => void; onNext?: () => void }) {
  const [profile, setProfile] = useState<CreatorProfileData | null>(null);
  const [moods, setMoods] = useState<string[]>([]);
  const [colorsValue, setColors] = useState<string[]>([]);
  const [spaces, setSpaces] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [conditions, setConditions] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { void loadCreatorProfile().then(value => { setProfile(value); setMoods(value.dnaMoods); setColors(value.dnaColors); setSpaces(value.preferredSpaces); setGoals(value.collaborationGoals); setConditions(value.installConditions); }).catch(error => setNotice(friendlyError(error))); }, []);
  const save = async () => {
    if (!moods.length || !colorsValue.length || !spaces.length || !goals.length) { setNotice('작품 취향과 협업 방향을 모두 선택해 주세요.'); return; }
    setSaving(true); setNotice('');
    try { await saveCreatorDna({ dnaMoods: moods, dnaColors: colorsValue, preferredSpaces: spaces, collaborationGoals: goals, installConditions: conditions }); onNext?.(); if (!onNext) setNotice('크리에이터 DNA를 저장했습니다.'); }
    catch (error) { setNotice(friendlyError(error)); } finally { setSaving(false); }
  };
  if (!profile && !notice) return <LoadingScreen title="크리에이터 DNA" onBack={onBack} />;
  return <KeyboardAvoidingView style={f.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title="크리에이터 DNA" back={onBack} />
    <ScrollView contentContainerStyle={f.scroll} keyboardShouldPersistTaps="handled">
      <StepBars labels={['1 작품 DNA', '2 프로필']} current={1} />
      <CuritText weight="bold" style={f.pageTitle}>내 작품에 맞는 공간을 찾아요.</CuritText>
      <CuritText style={f.description}>공간 추천에 반영할 취향과 조건을 정해 주세요.</CuritText>
      <ChoiceCard title="핵심 분위기 *" options={moodOptions} selected={moods} onToggle={value => toggle(value, moods, setMoods)} />
      <ChoiceCard title="작품 색감 *" options={colorOptions} selected={colorsValue} onToggle={value => toggle(value, colorsValue, setColors)} />
      <ChoiceCard title="선호 공간 *" options={spaceOptions} selected={spaces} onToggle={value => toggle(value, spaces, setSpaces)} />
      <ChoiceCard title="협업 목적 *" options={goalOptions} selected={goals} onToggle={value => toggle(value, goals, setGoals)} />
      <Field label="설치 · 관리 조건" value={conditions} onChangeText={setConditions} placeholder="예: 습기가 많은 공간은 피하고 싶어요" multiline style={f.textarea} />
      {notice ? <Notice text={notice} /> : null}
    </ScrollView>
    <View style={f.sticky}><Button label={saving ? '저장 중…' : onNext ? '다음 · 프로필 설정' : '변경사항 저장'} disabled={saving} onPress={() => { void save(); }} /></View>
  </KeyboardAvoidingView>;
}

export function CreatorProfileScreen({ mode, onBack, onEdit, onSaved }: { mode: 'view' | 'edit'; onBack: () => void; onEdit?: () => void; onSaved?: (profile: CreatorProfileData) => void }) {
  const [profile, setProfile] = useState<CreatorProfileData | null>(null);
  const [avatarUri, setAvatarUri] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { void loadCreatorProfile().then(setProfile).catch(error => setNotice(friendlyError(error))); }, []);
  const patch = <K extends keyof CreatorProfileData>(key: K, value: CreatorProfileData[K]) => setProfile(current => current ? { ...current, [key]: value } : current);
  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .82 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset?.uri) setAvatarUri(asset.uri);
  };
  const save = async () => {
    if (!profile?.displayName.trim() || !profile.regions.length || !profile.categories.length) { setNotice('활동명, 활동 지역, 작업 분야를 입력해 주세요.'); return; }
    setSaving(true); setNotice('');
    try { const saved = await saveCreatorProfile({ ...profile, avatarUri }, true); setProfile(saved); onSaved?.(saved); if (!onSaved) setNotice('프로필을 저장했습니다.'); }
    catch (error) { setNotice(friendlyError(error)); } finally { setSaving(false); }
  };
  if (!profile && !notice) return <LoadingScreen title={mode === 'edit' ? '크리에이터 프로필 수정' : '크리에이터 프로필'} onBack={onBack} />;
  if (!profile) return <View style={f.flex}><Header title="크리에이터 프로필" back={onBack} /><Notice text={notice} /></View>;
  if (mode === 'view') return <View style={f.flex}>
    <Header title="크리에이터 프로필" back={onBack} action={<Pressable accessibilityRole="button" hitSlop={10} style={f.headerTextAction} onPress={onEdit}><CuritText weight="semibold" style={f.brand}>수정</CuritText></Pressable>} />
    <ScrollView contentContainerStyle={f.scroll}>
      <View style={f.profileHero}>{profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={f.avatarLarge} /> : <View style={f.avatarLarge}><CuritText weight="bold" style={f.avatarLetter}>{profile.displayName[0]}</CuritText></View>}<CuritText weight="bold" style={f.pageTitle}>{profile.displayName}</CuritText><CuritText style={f.handle}>@{profile.handle || 'creator'}</CuritText><CuritText style={f.description}>{profile.headline || profile.introduction || '작품과 이야기를 소개해 주세요.'}</CuritText>{profile.activityVerified ? <Chip label="활동 인증 완료" active /> : <Chip label="활동 인증 준비 중" />}</View>
      <SectionTitle title="작가 이야기" /><CuritText style={f.longText}>{profile.introduction || '등록된 작가 소개가 없습니다.'}</CuritText>
      <SectionTitle title="활동 지역" /><View style={f.wrap}>{profile.regions.map(value => <Chip key={value} label={value} />)}</View>
      <SectionTitle title="작업 분야" /><View style={f.wrap}>{profile.categories.map(value => <Chip key={value} label={value} active />)}</View>
      <SectionTitle title="작품 DNA" /><View style={f.wrap}>{[...profile.dnaMoods, ...profile.dnaColors, ...profile.preferredSpaces].map(value => <Chip key={value} label={value} />)}</View>
    </ScrollView>
  </View>;
  return <KeyboardAvoidingView style={f.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title="크리에이터 프로필 수정" back={onBack} />
    <ScrollView contentContainerStyle={f.scroll} keyboardShouldPersistTaps="handled">
      <CuritText weight="bold" style={f.pageTitle}>나를 소개할 준비</CuritText><CuritText style={f.description}>활동명·지역·분야만 입력하면 시작할 수 있어요.</CuritText>
      <View style={f.photoRow}><Pressable onPress={() => { void choosePhoto(); }}>{avatarUri || profile.avatarUrl ? <Image source={{ uri: avatarUri || profile.avatarUrl }} style={f.avatarLarge} /> : <View style={f.avatarLarge}><CuritText style={f.muted}>사진</CuritText></View>}</Pressable><View style={f.flex}><Button label="프로필 사진 선택" variant="secondary" onPress={() => { void choosePhoto(); }} /><CuritText style={f.hint}>1:1로 자동 정리됩니다.</CuritText></View></View>
      <Field label="활동명 / 브랜드명 *" value={profile.displayName} onChangeText={value => patch('displayName', value)} />
      <Field label="활동 아이디" value={profile.handle} onChangeText={value => patch('handle', value.replace(/[^a-zA-Z0-9_.]/g, ''))} placeholder="soyeon_craft" autoCapitalize="none" />
      <Field label="한 줄 소개 · 선택" value={profile.headline} onChangeText={value => patch('headline', value)} />
      <Field label="작업 이야기" value={profile.introduction} onChangeText={value => patch('introduction', value)} multiline style={f.textarea} />
      <ChoiceCard title="활동 지역 *" options={regionOptions} selected={profile.regions} onToggle={value => patch('regions', profile.regions.includes(value) ? profile.regions.filter(item => item !== value) : [...profile.regions, value])} />
      <ChoiceCard title="작업 분야 *" options={categoryOptions} selected={profile.categories} onToggle={value => patch('categories', profile.categories.includes(value) ? profile.categories.filter(item => item !== value) : [...profile.categories, value])} />
      <Field label="SNS" value={profile.snsUrl} onChangeText={value => patch('snsUrl', value)} placeholder="https://instagram.com/..." autoCapitalize="none" />
      <Field label="포트폴리오" value={profile.portfolioUrl} onChangeText={value => patch('portfolioUrl', value)} placeholder="https://..." autoCapitalize="none" />
      {notice ? <Notice text={notice} /> : null}
    </ScrollView>
    <View style={f.sticky}><Button label={saving ? '저장 중…' : '프로필 저장'} disabled={saving} onPress={() => { void save(); }} /></View>
  </KeyboardAvoidingView>;
}

export function StoreProfileScreen({ userId, onBack, onEdit, onPreferences }: { userId: string; onBack: () => void; onEdit: () => void; onPreferences: () => void }) {
  const [store, setStore] = useState<StoreOnboarding | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => { void loadStoreOnboarding(userId).then(setStore).catch(error => setNotice(friendlyError(error))); }, [userId]);
  if (!store && !notice) return <LoadingScreen title="매장 프로필" onBack={onBack} />;
  if (!store) return <View style={f.flex}><Header title="매장 프로필" back={onBack} /><Notice text={notice} /></View>;
  return <View style={f.flex}><Header title={store.name} back={onBack} action={<Pressable hitSlop={10} onPress={onEdit}><CuritText weight="semibold" style={f.brand}>수정</CuritText></Pressable>} /><ScrollView contentContainerStyle={f.scroll}>
    {store.photoPaths[0] ? <Image source={{ uri: store.photoPaths[0].startsWith('http') ? store.photoPaths[0] : mediaUrl(store.photoPaths[0]) }} style={f.storeCover} /> : <View style={[f.storeCover, f.placeholder]}><Icon name="store" size={36} color={colors.brand} /></View>}
    <CuritText weight="bold" style={f.pageTitle}>{store.name}</CuritText><CuritText style={f.description}>{store.category} · {store.address}</CuritText><CuritText style={f.longText}>{store.introduction}</CuritText>
    <View style={f.infoCard}><InfoRow label="주 고객층" value={store.targetAudience} /><InfoRow label="월 예산" value={`${(store.monthlyBudgetMin || 0).toLocaleString()}~${(store.monthlyBudgetMax || 0).toLocaleString()}원`} /><InfoRow label="전시 구역" value={store.exhibitionZones.map(zone => zone.type).join(' · ')} /></View>
    <SectionTitle title="공간 취향" action="수정" onPress={onPreferences} /><View style={f.wrap}>{[...store.moodTags, ...store.purposeTags].map(value => <Chip key={value} label={value} />)}</View>
  </ScrollView></View>;
}

export function StorePreferencesScreen({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [store, setStore] = useState<StoreOnboarding | null>(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { void loadStoreOnboarding(userId).then(setStore).catch(error => setNotice(friendlyError(error))); }, [userId]);
  if (!store && !notice) return <LoadingScreen title="공간 취향 · 전시 구역" onBack={onBack} />;
  if (!store) return <View style={f.flex}><Header title="공간 취향 · 전시 구역" back={onBack} /><Notice text={notice} /></View>;
  const zones = store.exhibitionZones.map(zone => zone.type);
  const save = async () => { setSaving(true); setNotice(''); try { await saveStoreOnboarding(store); setNotice('공간 취향과 전시 구역을 저장했습니다.'); } catch (error) { setNotice(friendlyError(error)); } finally { setSaving(false); } };
  return <KeyboardAvoidingView style={f.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Header title="공간 취향 · 전시 구역" back={onBack} /><ScrollView contentContainerStyle={f.scroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
    <ChoiceCard title="공간 분위기" options={moodOptions} selected={store.moodTags} onToggle={value => setStore({ ...store, moodTags: store.moodTags.includes(value) ? store.moodTags.filter(item => item !== value) : [...store.moodTags, value] })} />
    <ChoiceCard title="협업 목적" options={['분위기 전환', '공간 전시', '포토존 구성', '지역 크리에이터 소개', '상품 판매', '브랜드 표현']} selected={store.purposeTags} onToggle={value => setStore({ ...store, purposeTags: store.purposeTags.includes(value) ? store.purposeTags.filter(item => item !== value) : [...store.purposeTags, value] })} />
    <View style={f.two}><View style={f.flex}><Field label="최소 예산" value={String(store.monthlyBudgetMin || '')} onChangeText={value => setStore({ ...store, monthlyBudgetMin: Number(value.replace(/\D/g, '')) || null })} keyboardType="number-pad" /></View><View style={f.flex}><Field label="최대 예산" value={String(store.monthlyBudgetMax || '')} onChangeText={value => setStore({ ...store, monthlyBudgetMax: Number(value.replace(/\D/g, '')) || null })} keyboardType="number-pad" /></View></View>
    <ChoiceCard title="전시 구역" options={['벽면', '카운터', '테이블', '선반', '입구', '대기공간', '창가']} selected={zones} onToggle={value => { const next = zones.includes(value) ? store.exhibitionZones.filter(zone => zone.type !== value) : [...store.exhibitionZones, { type: value, widthCm: null, heightCm: null }]; setStore({ ...store, exhibitionZones: next }); }} />
    {notice ? <Notice text={notice} /> : null}<Button label={saving ? '저장 중…' : '변경사항 저장'} disabled={saving} onPress={() => { void save(); }} />
  </ScrollView></KeyboardAvoidingView>;
}

export function QrProductEditorScreen({ item: initial, onBack, onSaved }: { item: QrProduct; onBack: () => void; onSaved: (item: QrProduct) => void }) {
  const [item, setItem] = useState(initial);
  const [price, setPrice] = useState(String(initial.price));
  const [stock, setStock] = useState(String(initial.stock));
  const [pickupMode, setPickupMode] = useState<'immediate' | 'exhibition'>(initial.pickupMode === 'exhibition' ? 'exhibition' : 'immediate');
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const valuesValid = Number(price) > 0 && Number.isInteger(Number(stock)) && Number(stock) >= 0;
  const save = async (saleStatus?: 'active' | 'preparing') => {
    if (!item.id || !valuesValid) { setNotice('판매가는 1원 이상, 구매 가능 수량은 0개 이상의 정수로 입력해 주세요.'); return; }
    setSaving(true); setNotice('');
    try { const saved = await updateQrListing(item.id, { price: Number(price), stock: Number(stock), pickupMode, saleStatus }); setItem(saved); onSaved(saved); setNotice('판매 설정을 저장했습니다.'); }
    catch (error) { setNotice(friendlyError(error)); } finally { setSaving(false); }
  };
  const share = async (message: string) => { if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) { await navigator.clipboard.writeText(message); setNotice('클립보드에 복사했습니다.'); } else await Share.share({ message }); };
  return <KeyboardAvoidingView style={f.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Header title="QR 상품 정보 확인" back={onBack} /><ScrollView contentContainerStyle={f.scroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
    {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={f.qrProductImage} /> : null}<CuritText style={f.hint}>{item.artistName || '등록 작가'}</CuritText>
    <Field label="상품명" value={item.name} editable={false} />
    <View style={f.two}><View style={f.flex}><Field label="합의 판매가 (원)" value={price} onChangeText={value => setPrice(value.replace(/\D/g, ''))} keyboardType="number-pad" /></View><View style={f.flex}><Field label="구매 가능 수량 *" value={stock} onChangeText={value => setStock(value.replace(/\D/g, ''))} keyboardType="number-pad" /></View></View>
    <ChoiceCard title="수령 방식" options={['굿즈 · 결제 후 현장 수령', '전시 작품 · 종료 후 전달']} selected={[pickupMode === 'immediate' ? '굿즈 · 결제 후 현장 수령' : '전시 작품 · 종료 후 전달']} onToggle={value => setPickupMode(value.startsWith('굿즈') ? 'immediate' : 'exhibition')} />
    <View style={f.infoBanner}><CuritText weight="semibold">{pickupMode === 'immediate' ? '굿즈 · 결제 후 현장 수령' : '원화 · 전시 종료 후 전달'}</CuritText><CuritText style={f.hint}>상품 유형에 맞게 적용되는 수령 방식이에요.</CuritText></View>
    <Button label={saving ? '저장 중…' : '판매 설정 저장'} disabled={saving || !valuesValid} onPress={() => { void save(); }} />
    <View style={f.two}><View style={f.flex}><Button label="QR 정보 미리보기" variant="secondary" onPress={() => setPreview(value => !value)} /></View><View style={f.flex}><Button label="QR 데이터 내보내기" variant="secondary" onPress={() => { void share(JSON.stringify({ token: item.token, name: item.name, price: Number(price), stock: Number(stock), qrUrl: item.qrUrl }, null, 2)); }} /></View></View>
    {preview ? <View style={f.preview}><QRCode value={item.qrUrl || item.token || item.productId} size={140} color={colors.ink} backgroundColor={colors.surface} /><CuritText weight="bold">{item.name}</CuritText><CuritText>{Number(price).toLocaleString()}원 · 재고 {stock}개</CuritText><CuritText style={f.hint} numberOfLines={2}>{item.qrUrl}</CuritText></View> : null}
    <Button label={item.status === 'ACTIVE' ? 'QR 판매 중단' : 'QR 판매 시작'} variant="secondary" disabled={saving || !valuesValid} onPress={() => { void save(item.status === 'ACTIVE' ? 'preparing' : 'active'); }} />
    <Button label="구매 화면 열기 ↗" variant="secondary" disabled={!item.qrUrl} onPress={() => { if (item.qrUrl) void Linking.openURL(item.qrUrl); }} />
    <Button label="QR 주소 복사" variant="secondary" disabled={!item.qrUrl} onPress={() => { void share(item.qrUrl || ''); }} />
    {notice ? <Notice text={notice} /> : null}
  </ScrollView></KeyboardAvoidingView>;
}

export function PickupScreen({ demo, onBack, onOpenQr }: { demo?: boolean; onBack: () => void; onOpenQr: () => void }) {
  const [orders, setOrders] = useState<ManagedOrder[]>(demo ? [{ id: 'QR-DEMO-CT1001', listingId: 'demo', productName: '머그컵 (화이트·그레이)', imageUrl: '', customerName: '김민서', customerPhoneLast4: '1234', quantity: 1, amount: 35000, paymentMethod: '카드', pickupMode: 'immediate', pickupDate: '', fulfillmentStatus: 'awaiting_pickup', deliveredAt: null, createdAt: new Date().toISOString() }] : []);
  const [status, setStatus] = useState<ManagedOrder['fulfillmentStatus']>('awaiting_pickup');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(!demo);
  const [notice, setNotice] = useState('');
  const [cancellingId, setCancellingId] = useState('');
  const load = async () => { if (demo) return; setLoading(true); try { setOrders(await loadManagedOrders()); } catch (error) { setNotice(friendlyError(error)); } finally { setLoading(false); } };
  useEffect(() => {
    if (demo) return;
    let active = true;
    void loadManagedOrders().then(value => { if (active) setOrders(value); }).catch(error => { if (active) setNotice(friendlyError(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo]);
  const visible = orders.filter(order => order.fulfillmentStatus === status && `${order.id} ${order.productName} ${order.customerName}`.toLowerCase().includes(query.toLowerCase()));
  const change = async (order: ManagedOrder, next: ManagedOrder['fulfillmentStatus']) => { if (demo) { setOrders(current => current.map(item => item.id === order.id ? { ...item, fulfillmentStatus: next } : item)); return; } try { await updateManagedOrder(order.id, next); await load(); } catch (error) { setNotice(friendlyError(error)); } };
  const executeCancel = (order: ManagedOrder) => {
    setCancellingId(order.id); setNotice('');
    void cancelManagedOrder(order.id)
      .then(async result => { setNotice(result?.status === 'cancellation_pending' ? '취소 승인 결과를 기다리고 있습니다.' : '결제 취소와 재고 복구가 완료됐습니다.'); await load(); })
      .catch(error => setNotice(friendlyError(error)))
      .finally(() => setCancellingId(''));
  };
  const cancel = (order: ManagedOrder) => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${order.amount.toLocaleString()}원 결제를 전액 취소할까요?`)) executeCancel(order);
      return;
    }
    Alert.alert('결제를 전액 취소할까요?', `${order.amount.toLocaleString()}원이 토스를 통해 환불되고 재고와 정산 예정액이 되돌아갑니다.`, [
      { text: '아니요', style: 'cancel' },
      { text: '전액 취소', style: 'destructive', onPress: () => executeCancel(order) },
    ]);
  };
  const count = (value: ManagedOrder['fulfillmentStatus']) => orders.filter(order => order.fulfillmentStatus === value).length;
  return <View style={f.flex}><Header title="주문 · 현장 수령" back={onBack} action={<Pressable hitSlop={10} onPress={onOpenQr}><CuritText weight="semibold" style={f.brand}>QR 판매 설정</CuritText></Pressable>} /><ScrollView contentContainerStyle={f.scroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
    <Button label="결제 완료 주문 확인" variant="secondary" onPress={() => { void load(); }} /><Field placeholder="주문번호 또는 상품명 검색" value={query} onChangeText={setQuery} />
    <View style={f.tabs}>{([['awaiting_pickup', '수령 대기'], ['reserved', '예약 작품'], ['delivered', '전달 완료']] as const).map(([value, label]) => <Pressable key={value} style={[f.tab, status === value && f.tabActive]} onPress={() => setStatus(value)}><CuritText weight={status === value ? 'semibold' : 'regular'} style={status === value ? f.brand : f.muted}>{label} {count(value)}</CuritText></Pressable>)}</View>
    {loading ? <ActivityIndicator color={colors.brand} /> : visible.length ? visible.map(order => <View key={order.id} style={f.orderCard}><View style={f.row}><View style={f.flex}><CuritText style={f.hint}>{order.id.slice(-10)}</CuritText><CuritText weight="bold">{order.productName}</CuritText><CuritText style={f.description}>{order.quantity}개 · {order.amount.toLocaleString()}원</CuritText><CuritText style={f.hint}>{order.paymentMethod} · {order.customerName} · 전화번호 뒤 4자리 {order.customerPhoneLast4}</CuritText></View><Chip label={status === 'delivered' ? '전달 완료' : '결제 완료'} active={status !== 'delivered'} /></View>{status === 'awaiting_pickup' ? <Button label="상품 전달 확인" onPress={() => { void change(order, 'delivered'); }} /> : status === 'reserved' ? <Button label="수령 가능으로 전환" onPress={() => { void change(order, 'awaiting_pickup'); }} /> : null}{status !== 'delivered' ? <Button label={cancellingId === order.id ? '취소 처리 중…' : '결제 전액 취소'} variant="secondary" disabled={Boolean(cancellingId)} onPress={() => cancel(order)} /> : null}</View>) : <Empty title="해당 주문이 없습니다" description="결제가 승인된 주문이 상태별로 표시됩니다." />}
    <View style={f.accordion}><CuritText weight="semibold">고객에게 어떤 정보를 요청하나요?</CuritText><CuritText style={f.description}>현장에서는 주문번호와 구매자명, 휴대폰 번호 뒤 4자리만 확인합니다. 전체 전화번호는 노출하지 않습니다.</CuritText></View>{notice ? <Notice text={notice} /> : null}
  </ScrollView></View>;
}

export function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [pushSaving, setPushSaving] = useState(false);
  useEffect(() => {
    let active = true;
    void loadNotifications().then(value => { if (active) setItems(value); }).catch(error => { if (active) setNotice(friendlyError(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const open = async (item: AppNotification) => { if (!item.read) { await markNotificationRead(item.id); setItems(current => current.map(value => value.id === item.id ? { ...value, read: true } : value)); } };
  const connectPush = async () => {
    setPushSaving(true); setNotice('');
    try {
      const result = await registerNativePush();
      setNotice(result.status === 'registered' ? '이 기기에서 푸시 알림을 받을 수 있습니다.' : result.message);
    } catch (error) { setNotice(friendlyError(error)); }
    finally { setPushSaving(false); }
  };
  return <View style={f.flex}><Header title="내 소식" back={onBack} /><ScrollView contentContainerStyle={f.scroll}><View style={f.infoBanner}><CuritText weight="semibold">중요한 협업·주문 소식을 놓치지 마세요.</CuritText><CuritText style={f.description}>앱이 닫혀 있어도 새 협업 상태와 QR 주문·취소 결과를 알려드립니다.</CuritText><Button label={pushSaving ? '연결 중…' : '이 기기 푸시 알림 연결'} variant="secondary" disabled={pushSaving} onPress={() => { void connectPush(); }} /></View>{loading ? <ActivityIndicator color={colors.brand} /> : items.length ? items.map(item => <Pressable key={item.id} style={[f.notification, !item.read && f.notificationUnread]} onPress={() => { void open(item); }}><View style={[f.dot, item.read && f.dotRead]} /><View style={f.flex}><CuritText weight="semibold">{item.title}</CuritText><CuritText style={f.description}>{item.body}</CuritText><CuritText style={f.hint}>{new Date(item.createdAt).toLocaleString('ko-KR')}</CuritText></View></Pressable>) : <Empty title="새 소식이 없습니다" description="협업 제안과 상태 변경 소식이 여기에 표시됩니다." />}{notice ? <Notice text={notice} /> : null}</ScrollView></View>;
}

export function SocialFeedSection({ canPost = false }: { canPost?: boolean }) {
  const [items, setItems] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [compose, setCompose] = useState('');
  const [postImage, setPostImage] = useState('');
  const [commentFor, setCommentFor] = useState('');
  const [comment, setComment] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => { setLoading(true); try { setItems(await loadSocialFeed()); } catch (error) { setNotice(friendlyError(error)); } finally { setLoading(false); } };
  useEffect(() => {
    let active = true;
    void loadSocialFeed().then(value => { if (active) setItems(value); }).catch(error => { if (active) setNotice(friendlyError(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const choosePostImage = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .82 }); const asset = result.canceled ? undefined : result.assets[0]; if (asset?.uri) setPostImage(asset.uri); };
  const create = async () => { if (!compose.trim()) return; try { await createSocialPost(compose, postImage); setCompose(''); setPostImage(''); await load(); } catch (error) { setNotice(friendlyError(error)); } };
  if (loading) return <ActivityIndicator color={colors.brand} style={f.loader} />;
  return <View style={f.feed}>
    {canPost ? <View style={f.compose}>
      <TextInput value={compose} onChangeText={setCompose} placeholder="새 작품이나 전시 소식을 알려주세요" placeholderTextColor={colors.subtle} style={f.composeInput} multiline />
      {postImage ? <Image source={{ uri: postImage }} style={f.postImage} /> : null}
      <View style={f.two}><View style={f.flex}><Button label={postImage ? '사진 변경' : '사진 추가'} variant="secondary" onPress={() => { void choosePostImage(); }} /></View><View style={f.flex}><Button label="소식 올리기" disabled={!compose.trim()} onPress={() => { void create(); }} /></View></View>
    </View> : null}
    {items.length ? items.map(item => <View key={item.id} style={f.post}>
      <View style={f.row}>
        {item.avatarUrl ? <Image source={{ uri: item.avatarUrl }} style={f.avatarSmall} /> : <View style={f.avatarSmall}><CuritText weight="bold">{item.creatorName[0]}</CuritText></View>}
        <View style={f.flex}><CuritText weight="semibold">{item.creatorName}</CuritText><CuritText style={f.hint}>@{item.handle || 'creator'} · {new Date(item.createdAt).toLocaleDateString('ko-KR')}</CuritText></View>
        {!item.own ? <Chip label={item.followed ? '팔로잉' : '팔로우'} active={item.followed} onPress={() => { void toggleCreatorFollow(item.creatorId, item.followed).then(load); }} /> : <Chip label="내 소식" />}
      </View>
      <CuritText style={f.longText}>{item.content}</CuritText>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={f.postImage} /> : null}
      <View style={f.socialActions}>
        <Pressable accessibilityRole="button" hitSlop={8} style={f.socialAction} onPress={() => { void togglePostLike(item.id, item.liked).then(load); }}><CuritText style={item.liked ? f.brand : f.muted}>♥ {item.likes}</CuritText></Pressable>
        <Pressable accessibilityRole="button" hitSlop={8} style={f.socialAction} onPress={() => setCommentFor(commentFor === item.id ? '' : item.id)}><CuritText style={f.muted}>댓글 {item.comments}</CuritText></Pressable>
        <Pressable accessibilityRole="button" hitSlop={8} style={f.socialAction} onPress={() => { void Share.share({ message: item.content }); }}><CuritText style={f.muted}>공유</CuritText></Pressable>
      </View>
      {commentFor === item.id ? <View style={f.commentRow}>
        <TextInput value={comment} onChangeText={setComment} placeholder="응원 댓글을 남겨주세요" placeholderTextColor={colors.subtle} style={f.commentInput} />
        <Pressable accessibilityRole="button" disabled={!comment.trim()} style={f.commentSubmit} onPress={() => { if (comment.trim()) void addPostComment(item.id, comment).then(() => { setComment(''); setCommentFor(''); return load(); }); }}><CuritText weight="semibold" style={!comment.trim() ? f.muted : f.brand}>등록</CuritText></Pressable>
      </View> : null}
    </View>) : <Empty title="등록된 소식이 없습니다" description="크리에이터의 새 작품과 전시 소식이 여기에 표시됩니다." />}
    {notice ? <Notice text={notice} /> : null}
  </View>;
}

function StepBars({ labels, current }: { labels: string[]; current: number }) { return <View style={f.stepBars}>{labels.map((label, index) => <View key={label} style={f.flex}><View style={[f.stepLine, index + 1 <= current && f.stepLineActive]} /><CuritText style={index + 1 === current ? f.brand : f.muted}>{label}</CuritText></View>)}</View>; }
function ChoiceCard({ title, options, selected, onToggle }: { title: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) { return <View style={f.choiceCard}><CuritText weight="semibold">{title}</CuritText><View style={f.wrap}>{options.map(value => <Chip key={value} label={value} active={selected.includes(value)} onPress={() => onToggle(value)} />)}</View></View>; }
function Notice({ text }: { text: string }) { return <View style={f.notice}><CuritText style={text.includes('못') || text.includes('확인') ? f.danger : f.brand}>{text}</CuritText></View>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <View style={f.infoRow}><CuritText style={f.muted}>{label}</CuritText><CuritText weight="semibold" style={f.infoValue}>{value || '-'}</CuritText></View>; }

const f = StyleSheet.create({
  flex: { flex: 1 }, scroll: { padding: 20, paddingBottom: 36, gap: 20 }, loader: { marginTop: 80 }, pageTitle: { fontSize: 23, lineHeight: 31 }, description: { color: colors.muted, marginTop: 4 }, longText: { lineHeight: 23 }, brand: { color: colors.brand }, muted: { color: colors.muted }, danger: { color: colors.danger }, hint: { color: colors.muted, fontSize: 11, marginTop: 6 },
  sticky: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, padding: 14 }, stepBars: { flexDirection: 'row', gap: 8 }, stepLine: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: 7 }, stepLineActive: { backgroundColor: colors.brand },
  choiceCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, gap: 14 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, textarea: { minHeight: 96, textAlignVertical: 'top', paddingTop: 13 }, notice: { padding: 13, borderRadius: radius.sm, backgroundColor: colors.brandSoft },
  profileHero: { alignItems: 'center', gap: 8, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border }, avatarLarge: { width: 86, height: 86, borderRadius: 43, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, avatarLetter: { fontSize: 28, color: colors.brand }, handle: { color: colors.brand }, photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  storeCover: { width: '100%', height: 210, borderRadius: radius.lg }, placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPale }, infoCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14 }, infoRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, infoValue: { flex: 1, textAlign: 'right' },
  two: { flexDirection: 'row', gap: 10 }, infoBanner: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: 16, gap: 5 }, qrProductImage: { width: '100%', height: 180, borderRadius: radius.md }, preview: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 18, alignItems: 'center', gap: 9 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }, tab: { flex: 1, paddingVertical: 13, alignItems: 'center' }, tabActive: { borderBottomWidth: 2, borderBottomColor: colors.brand }, orderCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, gap: 15 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, accordion: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  notification: { flexDirection: 'row', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }, notificationUnread: { backgroundColor: colors.brandPale }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginTop: 7 }, dotRead: { backgroundColor: colors.border },
  headerTextAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  feed: { gap: 14 }, compose: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, gap: 10 }, composeInput: { minHeight: 76, fontFamily: fonts.regular, color: colors.ink, textAlignVertical: 'top' }, post: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, gap: 12 }, avatarSmall: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, postImage: { width: '100%', height: 220, borderRadius: radius.sm }, socialActions: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }, socialAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, commentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, commentInput: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 22, paddingHorizontal: 14, fontFamily: fonts.regular, color: colors.ink }, commentSubmit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
