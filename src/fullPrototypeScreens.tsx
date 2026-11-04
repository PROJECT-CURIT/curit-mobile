import { readImageUpload } from './mediaUpload';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  loadPostComments,
  loadSocialFeed,
  loadVerificationRequest,
  markNotificationRead,
  saveCreatorDna,
  saveCreatorProfile,
  submitVerificationRequest,
  toggleCreatorFollow,
  togglePostLike,
  type AppNotification,
  type CreatorProfileData,
  type SocialComment,
  type SocialPost,
  type VerificationKind,
  type VerificationRequest,
} from './fullPlatform';
import {
  friendlyError,
  cancelManagedOrder,
  loadManagedOrder,
  loadManagedOrders,
  loadStoreOnboarding,
  mediaUrl,
  saveStoreOnboarding,
  updateManagedOrder,
  updateQrListing,
  type CreatorProjectDetails,
  type ManagedOrder,
  type StoreOnboarding,
} from './platform';
import type { QrProduct } from './types';
import { demoCreatorProfile, demoSocialComments, demoSocialPosts, demoStoreOnboarding } from './demoContent';
import { images } from './data';

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

export function CreatorDnaScreen({ onBack, onNext, demo = false }: { onBack: () => void; onNext?: () => void; demo?: boolean }) {
  const [profile, setProfile] = useState<CreatorProfileData | null>(null);
  const [moods, setMoods] = useState<string[]>([]);
  const [colorsValue, setColors] = useState<string[]>([]);
  const [spaces, setSpaces] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [conditions, setConditions] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { const request = demo ? Promise.resolve(demoCreatorProfile) : loadCreatorProfile(); void request.then(value => { setProfile(value); setMoods(value.dnaMoods); setColors(value.dnaColors); setSpaces(value.preferredSpaces); setGoals(value.collaborationGoals); setConditions(value.installConditions); }).catch(error => setNotice(friendlyError(error))); }, [demo]);
  const save = async () => {
    if (!moods.length || !colorsValue.length || !spaces.length || !goals.length) { setNotice('작품 취향과 협업 방향을 모두 선택해 주세요.'); return; }
    setSaving(true); setNotice('');
    try { if (!demo) await saveCreatorDna({ dnaMoods: moods, dnaColors: colorsValue, preferredSpaces: spaces, collaborationGoals: goals, installConditions: conditions }); onNext?.(); if (!onNext) setNotice('크리에이터 DNA를 저장했습니다.'); }
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

export function CreatorProfileScreen({ mode, project, onBack, onEdit, onOpenProject, onSaved, demo = false }: { mode: 'view' | 'edit'; project?: CreatorProjectDetails; onBack: () => void; onEdit?: () => void; onOpenProject?: () => void; onSaved?: (profile: CreatorProfileData) => void; demo?: boolean }) {
  const [profile, setProfile] = useState<CreatorProfileData | null>(null);
  const [avatarUri, setAvatarUri] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { const request = demo ? Promise.resolve(demoCreatorProfile) : loadCreatorProfile(); void request.then(setProfile).catch(error => setNotice(friendlyError(error))); }, [demo]);
  const patch = <K extends keyof CreatorProfileData>(key: K, value: CreatorProfileData[K]) => setProfile(current => current ? { ...current, [key]: value } : current);
  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .82 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset?.uri) setAvatarUri(asset.uri);
  };
  const save = async () => {
    if (!profile?.displayName.trim() || !profile.regions.length || !profile.categories.length) { setNotice('활동명, 활동 지역, 작업 분야를 입력해 주세요.'); return; }
    setSaving(true); setNotice('');
    try { const saved = demo ? { ...profile, avatarUrl: avatarUri || profile.avatarUrl, onboardingComplete: true } : await saveCreatorProfile({ ...profile, avatarUri }, true); setProfile(saved); onSaved?.(saved); if (!onSaved) setNotice('프로필을 저장했습니다.'); }
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
      {project ? <><SectionTitle title="등록 프로젝트" /><Pressable accessibilityRole="button" accessibilityLabel={`${project.title || '전시 프로젝트'} 열기`} style={f.profileProject} onPress={onOpenProject}><View style={f.profileProjectIndex}><CuritText weight="bold" style={f.profileProjectIndexText}>01</CuritText></View><View style={f.flex}><CuritText style={f.profileProjectStatus}>{project.status === 'recruiting' ? '매칭 모집 중' : project.status === 'matched' ? '매칭 완료' : project.status === 'archived' ? '비공개' : '작성 중'}</CuritText><CuritText weight="bold">{project.title || '제목 없는 프로젝트'}</CuritText><CuritText numberOfLines={2} style={f.muted}>{project.concept || project.story || '프로젝트 이야기를 등록해 주세요.'}</CuritText></View><Icon name="chevron" size={16} color={colors.brand} /></Pressable></> : null}
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

export function StoreProfileScreen({ userId, onBack, onEdit, onPreferences, demo = false }: { userId: string; onBack: () => void; onEdit: () => void; onPreferences: () => void; demo?: boolean }) {
  const [store, setStore] = useState<StoreOnboarding | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => { const request = demo ? Promise.resolve(demoStoreOnboarding) : loadStoreOnboarding(userId); void request.then(setStore).catch(error => setNotice(friendlyError(error))); }, [demo, userId]);
  if (!store && !notice) return <LoadingScreen title="매장 프로필" onBack={onBack} />;
  if (!store) return <View style={f.flex}><Header title="매장 프로필" back={onBack} /><Notice text={notice} /></View>;
  return <View style={f.flex}><Header title={store.name} back={onBack} action={<Pressable accessibilityRole="button" style={f.headerTextAction} hitSlop={10} onPress={onEdit}><CuritText weight="semibold" style={f.brand}>수정</CuritText></Pressable>} /><ScrollView contentContainerStyle={f.scroll}>
    {demo ? <Image source={images.cafe} style={f.storeCover} contentFit="cover" /> : store.photoPaths[0] ? <Image source={{ uri: store.photoPaths[0].startsWith('http') ? store.photoPaths[0] : mediaUrl(store.photoPaths[0]) }} style={f.storeCover} contentFit="cover" /> : <View style={[f.storeCover, f.placeholder]}><Icon name="store" size={36} color={colors.brand} /></View>}
    <CuritText weight="bold" style={f.pageTitle}>{store.name}</CuritText><CuritText style={f.description}>{store.category} · {store.address}</CuritText><CuritText style={f.longText}>{store.introduction}</CuritText>
    <View style={f.infoCard}><InfoRow label="주 고객층" value={store.targetAudience} /><InfoRow label="월 예산" value={`${(store.monthlyBudgetMin || 0).toLocaleString()}~${(store.monthlyBudgetMax || 0).toLocaleString()}원`} /><InfoRow label="전시 구역" value={store.exhibitionZones.map(zone => zone.type).join(' · ')} /></View>
    <SectionTitle title="공간 취향" action="수정" onPress={onPreferences} /><View style={f.wrap}>{[...store.moodTags, ...store.purposeTags].map(value => <Chip key={value} label={value} />)}</View>
  </ScrollView></View>;
}

export function StorePreferencesScreen({ userId, onBack, demo = false }: { userId: string; onBack: () => void; demo?: boolean }) {
  const [store, setStore] = useState<StoreOnboarding | null>(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { const request = demo ? Promise.resolve(demoStoreOnboarding) : loadStoreOnboarding(userId); void request.then(setStore).catch(error => setNotice(friendlyError(error))); }, [demo, userId]);
  if (!store && !notice) return <LoadingScreen title="공간 취향 · 전시 구역" onBack={onBack} />;
  if (!store) return <View style={f.flex}><Header title="공간 취향 · 전시 구역" back={onBack} /><Notice text={notice} /></View>;
  const zones = store.exhibitionZones.map(zone => zone.type);
  const save = async () => { setSaving(true); setNotice(''); try { if (!demo) await saveStoreOnboarding(store); setNotice('공간 취향과 전시 구역을 저장했습니다.'); } catch (error) { setNotice(friendlyError(error)); } finally { setSaving(false); } };
  return <KeyboardAvoidingView style={f.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Header title="공간 취향 · 전시 구역" back={onBack} /><ScrollView contentContainerStyle={f.scroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
    <ChoiceCard title="공간 분위기" options={moodOptions} selected={store.moodTags} onToggle={value => setStore({ ...store, moodTags: store.moodTags.includes(value) ? store.moodTags.filter(item => item !== value) : [...store.moodTags, value] })} />
    <ChoiceCard title="협업 목적" options={['분위기 전환', '공간 전시', '포토존 구성', '지역 크리에이터 소개', '상품 판매', '브랜드 표현']} selected={store.purposeTags} onToggle={value => setStore({ ...store, purposeTags: store.purposeTags.includes(value) ? store.purposeTags.filter(item => item !== value) : [...store.purposeTags, value] })} />
    <View style={f.two}><View style={f.flex}><Field label="최소 예산" value={String(store.monthlyBudgetMin || '')} onChangeText={value => setStore({ ...store, monthlyBudgetMin: Number(value.replace(/\D/g, '')) || null })} keyboardType="number-pad" /></View><View style={f.flex}><Field label="최대 예산" value={String(store.monthlyBudgetMax || '')} onChangeText={value => setStore({ ...store, monthlyBudgetMax: Number(value.replace(/\D/g, '')) || null })} keyboardType="number-pad" /></View></View>
    <ChoiceCard title="전시 구역" options={['벽면', '카운터', '테이블', '선반', '입구', '대기공간', '창가']} selected={zones} onToggle={value => { const next = zones.includes(value) ? store.exhibitionZones.filter(zone => zone.type !== value) : [...store.exhibitionZones, { type: value, widthCm: null, heightCm: null }]; setStore({ ...store, exhibitionZones: next }); }} />
    {notice ? <Notice text={notice} /> : null}<Button label={saving ? '저장 중…' : '변경사항 저장'} disabled={saving} onPress={() => { void save(); }} />
  </ScrollView></KeyboardAvoidingView>;
}

export function QrProductEditorScreen({ item: initial, onBack, onSaved, demo = false }: { item: QrProduct; onBack: () => void; onSaved: (item: QrProduct) => void; demo?: boolean }) {
  const [item, setItem] = useState(initial);
  const [stock, setStock] = useState(String(initial.stock));
  const [preview, setPreview] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  if (item.source === 'field-sale') return <FieldSaleProductScreen item={item} onBack={onBack} />;
  const stockValue = Number(stock);
  const stockLimit = item.supplyLimit ?? 100_000;
  const valuesValid = stock.length > 0 && Number.isSafeInteger(stockValue) && stockValue >= 0 && stockValue <= stockLimit;
  const stockChanged = stockValue !== item.stock;
  const selling = item.status !== 'PAUSED';
  const save = async (saleStatus?: 'active' | 'preparing') => {
    if (!item.id || (saleStatus === undefined && !valuesValid)) return;
    setSaving(true); setNotice('');
    try {
      const changes = saleStatus === undefined ? { stock: stockValue, expectedStock: item.stock } : { saleStatus };
      const saved = demo ? {
        ...item,
        stock: changes.stock ?? item.stock,
        status: saleStatus === 'preparing' ? 'PAUSED' as const : saleStatus === 'active' ? item.stock > 0 ? 'ACTIVE' as const : 'SOLD_OUT' as const : item.status,
      } : await updateQrListing(item.id, changes);
      setItem(saved); setStock(String(saved.stock)); onSaved(saved);
      setNotice(saleStatus === 'preparing' ? 'QR 판매를 중단했습니다.' : saleStatus === 'active' ? 'QR 판매를 시작했습니다.' : '구매 가능 수량을 저장했습니다.');
    }
    catch (error) { setNotice(friendlyError(error)); } finally { setSaving(false); }
  };
  const share = async (message: string) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        setNotice('클립보드에 복사했습니다.');
      } else {
        await Share.share({ message });
      }
    } catch {
      setNotice('공유하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };
  return <KeyboardAvoidingView style={f.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Header title="QR 상품 정보 확인" back={onBack} /><ScrollView contentContainerStyle={f.scroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
    {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={f.qrProductImage} /> : null}<CuritText style={f.hint}>{item.artistName || '등록 작가'}</CuritText>
    <Field label="상품명" value={item.name} editable={false} />
    <View style={f.two}><View style={f.flex}><Field label="합의 판매가" value={`${item.price.toLocaleString('ko-KR')}원`} editable={false} /></View><View style={f.flex}><Field label="구매 가능 수량 *" value={stock} onChangeText={value => setStock(value.replace(/\D/g, ''))} keyboardType="number-pad" /></View></View>
    {item.supplyLimit !== undefined ? <CuritText style={f.hint}>확정 공급량 {item.supplyLimit}개 중 판매 완료 수량을 제외하고 설정할 수 있어요.</CuritText> : null}
    {!valuesValid ? <CuritText style={f.hint}>구매 가능 수량을 0~{stockLimit.toLocaleString('ko-KR')}개 사이로 입력해 주세요.</CuritText> : null}
    {item.description || item.material ? <View style={f.qrDetails}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} style={f.qrDetailsAction} onPress={() => setDetailsOpen(value => !value)}><CuritText weight="semibold">작가가 등록한 상품 정보</CuritText><CuritText>{detailsOpen ? '−' : '＋'}</CuritText></Pressable>
      {detailsOpen && item.description ? <CuritText style={f.description}>{item.description}</CuritText> : null}
      {detailsOpen && item.material ? <CuritText style={f.hint}>소재 · {item.material}</CuritText> : null}
    </View> : null}
    <View style={f.infoBanner}><CuritText weight="semibold">수령 방식</CuritText><CuritText style={f.hint}>{item.pickupMode === 'exhibition' ? '전시 종료 후 현장 수령' : '주문 후 현장 수령'}</CuritText></View>
    {notice ? <Notice text={notice} /> : null}
    <Button label={saving ? '저장 중…' : '수량 저장'} disabled={saving || !valuesValid || !stockChanged} onPress={() => { void save(); }} />
    <View style={f.two}><View style={f.flex}><Button label="QR 미리보기" variant="secondary" onPress={() => setPreview(value => !value)} /></View><View style={f.flex}><Button label="데이터 내보내기" variant="secondary" onPress={() => { void share(JSON.stringify({ token: item.token, name: item.name, price: item.price, stock: item.stock, qrUrl: item.qrUrl }, null, 2)); }} /></View></View>
    {preview ? <View style={f.preview}><QRCode value={item.qrUrl || item.token || item.productId} size={140} color={colors.ink} backgroundColor={colors.surface} /><CuritText weight="bold">{item.name}</CuritText><CuritText>{item.price.toLocaleString('ko-KR')}원 · 재고 {item.stock}개</CuritText><CuritText style={f.hint} numberOfLines={2}>{item.qrUrl}</CuritText></View> : null}
    {item.canStartSale !== false || selling ? <Button label={selling ? 'QR 판매 중단' : 'QR 판매 시작'} variant="secondary" disabled={saving} onPress={() => { void save(selling ? 'preparing' : 'active'); }} /> : <CuritText style={f.hint}>진행 중인 전시에서만 QR 판매를 시작할 수 있어요.</CuritText>}
    <Button label="구매 화면 열기 ↗" variant="secondary" disabled={!item.qrUrl} onPress={() => { if (item.qrUrl) void Linking.openURL(item.qrUrl).catch(() => setNotice('상품 페이지를 열지 못했어요. QR 링크를 다시 확인해 주세요.')); }} />
    <Button label={Platform.OS === 'web' ? 'QR 주소 복사' : 'QR 링크 공유'} variant="secondary" disabled={!item.qrUrl} onPress={() => { void share(item.qrUrl || ''); }} />
  </ScrollView></KeyboardAvoidingView>;
}

function FieldSaleProductScreen({ item, onBack }: { item: QrProduct; onBack: () => void }) {
  const url = item.qrUrl || '';
  const [notice, setNotice] = useState('');
  const open = async () => {
    if (!url) return;
    try { await Linking.openURL(url); } catch { setNotice('상품 페이지를 열지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
  };
  const shareLink = async () => {
    if (!url) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setNotice('QR 주소를 복사했습니다.');
      } else {
        await Share.share({ message: `${item.name} 상품 페이지\n${url}` });
      }
    } catch { setNotice('QR 주소를 공유하지 못했습니다.'); }
  };
  return <View style={f.flex}>
    <Header title="QR 상품 정보" back={onBack} />
    <ScrollView contentContainerStyle={f.scroll}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={f.qrProductImage} contentFit="cover" /> : null}
      <Chip label="현장 등록 상품" active />
      <CuritText weight="bold" style={{ fontSize: 22, marginTop: 10 }}>{item.name}</CuritText>
      <CuritText style={f.hint}>현장 판매 상품 · {item.status === 'SOLD_OUT' ? '품절' : item.status === 'ACTIVE' ? '구매 가능' : '구매 안내 준비 중'}</CuritText>
      <CuritText weight="bold" style={{ fontSize: 20, marginTop: 10 }}>{item.price.toLocaleString('ko-KR')}원</CuritText>
      <CuritText style={f.description}>{item.inventoryTracked === false ? '수량은 매장 재고를 확인해 주세요.' : `등록 수량 ${item.stock}개`}</CuritText>
      <View style={f.preview}>
        {url ? <QRCode value={url} size={180} color={colors.ink} backgroundColor={colors.surface} /> : null}
        <CuritText weight="semibold" style={{ marginTop: 14 }}>상품 전용 QR</CuritText>
        <CuritText style={f.hint} numberOfLines={2}>{url}</CuritText>
      </View>
      <CuritText style={f.description}>QR을 열면 현재 상품의 소개와 매장 수령·결제 안내 페이지로 이동합니다.</CuritText>
      <Button label="상품 페이지 열기" onPress={() => { void open(); }} />
      <Button label="QR 주소 공유" variant="secondary" onPress={() => { void shareLink(); }} />
      {notice ? <Notice text={notice} /> : null}
    </ScrollView>
  </View>;
}

const pickupTabs = [
  ['awaiting_pickup', '수령 대기'],
  ['reserved', '예약 작품'],
  ['delivered', '전달 완료'],
] as const;

export function PickupScreen({ demo, orderId, onBack, onOpenList, onOpenQr }: {
  demo?: boolean;
  orderId?: string;
  onBack: () => void;
  onOpenList: () => void;
  onOpenQr?: () => void;
}) {
  const [orders, setOrders] = useState<ManagedOrder[]>(demo ? [{ id: 'QR-DEMO-CT1001', listingId: 'demo', productName: '머그컵 (화이트·그레이)', imageUrl: '', customerName: '김민서', customerPhoneLast4: '1234', quantity: 1, amount: 35000, paymentMethod: '카드', paymentStatus: 'paid', pickupMode: 'immediate', pickupDate: '', fulfillmentStatus: 'awaiting_pickup', deliveredAt: null, createdAt: new Date().toISOString() }] : []);
  const [status, setStatus] = useState<ManagedOrder['fulfillmentStatus']>('awaiting_pickup');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(!demo);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [processingId, setProcessingId] = useState('');
  const mutation = useRef(false);
  const fetchOrders = useCallback(async () => orderId ? [await loadManagedOrder(orderId)] : loadManagedOrders(), [orderId]);
  useEffect(() => {
    if (demo) return;
    let active = true;
    void fetchOrders().then(value => { if (active) setOrders(value); })
      .catch(error => { if (active) setLoadError(friendlyError(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, fetchOrders]);
  const load = async () => {
    if (demo) return;
    setLoading(true); setLoadError('');
    try { setOrders(await fetchOrders()); }
    catch (error) { setLoadError(friendlyError(error)); }
    finally { setLoading(false); }
  };
  const search = query.trim().toLocaleLowerCase('ko-KR');
  const visible = orderId ? orders.filter(order => order.id === orderId) : orders.filter(order =>
    order.fulfillmentStatus === status && `${order.id} ${order.productName} ${order.customerName}`.toLocaleLowerCase('ko-KR').includes(search));
  const runAction = async (id: string, action: () => Promise<void>) => {
    if (mutation.current) return;
    mutation.current = true;
    setProcessingId(id); setNotice('');
    try { await action(); }
    catch (error) { setNotice(friendlyError(error)); }
    finally { mutation.current = false; setProcessingId(''); }
  };
  const change = (order: ManagedOrder, next: ManagedOrder['fulfillmentStatus']) =>
    runAction(order.id, async () => {
      if (demo) setOrders(current => current.map(item => item.id === order.id ? { ...item, fulfillmentStatus: next } : item));
      else { await updateManagedOrder(order.id, next); await load(); }
      setNotice(next === 'delivered' ? '상품 전달을 확인했어요.' : '수령 가능한 주문으로 변경했어요.');
    });
  const executeCancel = (order: ManagedOrder) => runAction(order.id, async () => {
    const result = await cancelManagedOrder(order.id);
    await load();
    setNotice(result?.status === 'cancellation_pending' ? '취소 승인 결과를 기다리고 있습니다.' : '결제 취소와 재고 복구가 완료됐습니다.');
  });
  const cancel = (order: ManagedOrder) => {
    if (mutation.current) return;
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${order.amount.toLocaleString('ko-KR')}원 결제를 전액 취소할까요?`)) void executeCancel(order);
      return;
    }
    Alert.alert('결제를 전액 취소할까요?', `${order.amount.toLocaleString('ko-KR')}원 주문의 결제가 취소되고 재고와 정산 예정액이 되돌아갑니다.`, [
      { text: '아니요', style: 'cancel' },
      { text: '전액 취소', style: 'destructive', onPress: () => { void executeCancel(order); } },
    ]);
  };
  return <View style={f.flex}>
    <Header title="주문 · 현장 수령" back={onBack} action={onOpenQr ? <Pressable style={f.pickupQrAction} accessibilityRole="button" accessibilityLabel="QR 판매 설정" onPress={onOpenQr}><Icon name="qr" size={21} color={colors.brand} /></Pressable> : undefined} />
    <ScrollView contentContainerStyle={f.scroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
      {orderId ? <Button label="전체 주문 보기" variant="secondary" onPress={onOpenList} /> : <>
        <Button label="결제 완료 주문 확인" variant="secondary" disabled={loading || Boolean(processingId)} onPress={() => { void load(); }} />
        <Field label="주문 찾기" placeholder="주문번호 또는 상품명 검색" value={query} onChangeText={setQuery} />
        <View style={f.tabs} accessibilityRole="tablist">{pickupTabs.map(([value, label]) => <Pressable key={value} style={[f.tab, status === value && f.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: status === value }} onPress={() => setStatus(value)}><CuritText weight={status === value ? 'semibold' : 'regular'} style={status === value ? f.brand : f.muted}>{label} {orders.filter(order => order.fulfillmentStatus === value).length}</CuritText></Pressable>)}</View>
      </>}
      {notice ? <Notice text={notice} /> : null}
      {loading ? <ActivityIndicator color={colors.brand} /> : loadError ? <>
        <Notice text={loadError} /><Button label="다시 불러오기" variant="secondary" onPress={() => { void load(); }} />
      </> : visible.length ? visible.map(order => {
        const cancelled = order.paymentStatus === 'cancelled';
        const delivered = order.fulfillmentStatus === 'delivered';
        const reserved = order.fulfillmentStatus === 'reserved';
        const stateLabel = cancelled ? '결제 취소' : delivered ? '전달 완료' : reserved ? '예약 작품' : '결제 완료';
        return <View key={order.id} style={f.orderCard}>
          <View style={f.row}><CuritText style={[f.flex, f.hint]} selectable>주문 {orderId || order.id.length <= 14 ? order.id : `…${order.id.slice(-12)}`}</CuritText><Chip label={stateLabel} active={!cancelled && !delivered} /></View>
          <View style={f.row}>
            {order.imageUrl ? <Image source={{ uri: order.imageUrl }} style={f.pickupPhoto} contentFit="cover" /> : null}
            <View style={f.flex}><CuritText weight="bold">{order.productName}</CuritText><CuritText style={f.description}>{order.quantity}개 · {order.amount.toLocaleString('ko-KR')}원</CuritText><CuritText style={f.hint}>{order.paymentMethod} · {order.customerName} · 전화번호 뒤 4자리 {order.customerPhoneLast4}</CuritText></View>
          </View>
          <CuritText style={cancelled ? f.muted : f.brand}>{cancelled ? '수령 취소' : order.pickupMode === 'exhibition' ? `전시 종료 후 현장 수령${order.pickupDate ? ` · ${order.pickupDate}` : ''}` : '결제 후 현장 수령'}</CuritText>
          {!cancelled && !delivered ? <>
            <Button label={processingId === order.id ? '처리 중…' : reserved ? '수령 가능으로 전환' : '상품 전달 확인'} disabled={Boolean(processingId)} onPress={() => { void change(order, reserved ? 'awaiting_pickup' : 'delivered'); }} />
            {!demo ? <Button label="결제 전액 취소" variant="secondary" disabled={Boolean(processingId)} onPress={() => cancel(order)} /> : null}
          </> : null}
        </View>;
      }) : <Empty title="해당 주문이 없습니다" description={orderId ? '전체 주문 목록에서 다시 확인해 주세요.' : search ? '주문번호나 검색어를 확인해 주세요.' : '결제가 승인된 주문이 상태별로 표시됩니다.'} />}
      <View style={f.accordion}>
        <Pressable style={f.pickupHelpAction} accessibilityRole="button" accessibilityState={{ expanded: helpOpen }} onPress={() => setHelpOpen(value => !value)}><Icon name="chevron" size={14} color={colors.brand} /><CuritText weight="semibold" style={f.flex}>고객에게 어떤 정보를 요청하나요?</CuritText></Pressable>
        {helpOpen ? <CuritText style={f.description}>현장에서는 주문번호와 구매자명, 휴대폰 번호 뒤 4자리만 확인합니다.</CuritText> : null}
      </View>
    </ScrollView>
  </View>;
}

export function VerificationScreen({ kind, demo = false, onBack }: { kind: VerificationKind; demo?: boolean; onBack: () => void }) {
  const creator = kind === 'creator_activity';
  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [imageUri, setImageUri] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (demo) return;
    let active = true;
    void loadVerificationRequest(kind)
      .then(value => { if (active) { setRequest(value); setNote(value?.note || ''); } })
      .catch(error => { if (active) setNotice(friendlyError(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, kind]);
  const chooseEvidence = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .82 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset?.uri) return;
    try { await readImageUpload(asset.uri); setImageUri(asset.uri); setNotice(''); }
    catch (error) { setNotice(friendlyError(error)); }
  };
  const submit = async () => {
    if (!imageUri) { setNotice('확인 가능한 증빙 이미지를 먼저 선택해 주세요.'); return; }
    setSaving(true); setNotice('');
    try {
      if (demo) {
        setRequest({ id: 'demo-verification', kind, status: 'pending', evidencePath: imageUri, evidenceUrl: imageUri, note: note.trim(), reviewNote: '', submittedAt: new Date().toISOString(), reviewedAt: '' });
        setNotice('검토 요청을 접수했습니다.');
      } else {
        setRequest(await submitVerificationRequest(kind, imageUri, note));
        setNotice('증빙을 안전하게 저장하고 검토 요청을 접수했습니다.');
      }
      setImageUri('');
    } catch (error) { setNotice(friendlyError(error)); }
    finally { setSaving(false); }
  };
  const statusLabel = request?.status === 'approved' ? '승인 완료' : request?.status === 'rejected' ? '보완 필요' : request ? '검토 중' : '제출 전';
  const preview = imageUri || request?.evidenceUrl || '';
  return <KeyboardAvoidingView style={f.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title={creator ? '활동 인증' : '매장 운영 인증'} back={onBack} />
    <ScrollView contentContainerStyle={f.scroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
      {loading ? <ActivityIndicator color={colors.brand} style={f.loader} /> : <>
        <View style={f.verificationStatus}><View style={f.flex}><CuritText weight="bold">{creator ? '크리에이터 활동 확인' : '오프라인 매장 운영 확인'}</CuritText><CuritText style={f.description}>{creator ? '포트폴리오·전시·판매 활동을 확인할 수 있는 자료를 제출해 주세요.' : '사업자등록증 또는 매장 운영 사실을 확인할 수 있는 자료를 제출해 주세요.'}</CuritText></View><Chip label={statusLabel} active={request?.status === 'approved'} /></View>
        {request?.reviewNote ? <View style={f.infoBanner}><CuritText weight="semibold">검토 의견</CuritText><CuritText style={f.description}>{request.reviewNote}</CuritText></View> : null}
        {preview ? <Image source={{ uri: preview }} style={f.evidenceImage} contentFit="cover" /> : <Pressable accessibilityRole="button" style={f.evidencePlaceholder} onPress={() => { void chooseEvidence(); }}><Icon name="store" size={30} color={colors.brand} /><CuritText weight="semibold">증빙 이미지 선택</CuritText><CuritText style={f.hint}>JPG, PNG, WEBP · 최대 5MB</CuritText></Pressable>}
        <Button label={preview ? '증빙 이미지 변경' : '증빙 이미지 선택'} variant="secondary" onPress={() => { void chooseEvidence(); }} />
        <Field label="검토 참고사항" value={note} onChangeText={setNote} placeholder={creator ? '활동 링크나 확인할 내용을 적어 주세요.' : '매장명과 확인할 내용을 적어 주세요.'} multiline style={f.textarea} />
        <View style={f.infoBanner}><CuritText weight="semibold">개인정보 안내</CuritText><CuritText style={f.description}>증빙 이미지는 공개 프로필에 노출되지 않으며 인증 검토 목적으로만 비공개 저장됩니다. 주민등록번호 등 불필요한 정보는 가린 뒤 제출해 주세요.</CuritText></View>
        <Button label={saving ? '제출 중…' : request ? '증빙 다시 제출' : '검토 요청하기'} disabled={saving || !imageUri} onPress={() => { void submit(); }} />
        {request ? <CuritText style={f.hint}>최근 제출: {new Date(request.submittedAt).toLocaleString('ko-KR')}</CuritText> : null}
        {notice ? <Notice text={notice} /> : null}
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}

export function NotificationsScreen({ onBack, onOpenOrder, onOpenCollaboration, demo = false }: { onBack: () => void; onOpenOrder?: (id: string) => void; onOpenCollaboration: (id: string) => void; demo?: boolean }) {
  const [items, setItems] = useState<AppNotification[]>(demo ? [
    { id: 'demo-notification-1', title: '유리 정원의 오후 제안이 도착했습니다', body: '권아영 작가가 전시 기간과 작품 구성을 제안했습니다.', kind: 'collaboration', entityId: 'demo-incoming', read: false, createdAt: '2026-11-02T02:20:00.000Z' },
    { id: 'demo-notification-2', title: '종이 위의 산책 판매가 승인되었습니다', body: '현장 수령 주문 1건의 상품 전달을 확인해 주세요.', kind: 'order', entityId: 'demo-order-paper', read: false, createdAt: '2026-11-01T08:40:00.000Z' },
    { id: 'demo-notification-3', title: '파란 식탁의 배치 조건이 변경되었습니다', body: '성수 독립서점이 선반 전시 수량을 수정했습니다.', kind: 'collaboration', entityId: 'demo-proposal', read: true, createdAt: '2026-10-31T05:10:00.000Z' },
  ] : []);
  const [loading, setLoading] = useState(!demo);
  const [notice, setNotice] = useState('');
  const opening = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (demo) return;
    let active = true;
    void loadNotifications().then(value => { if (active) setItems(value); }).catch(error => { if (active) setNotice(friendlyError(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo]);
  const open = async (item: AppNotification) => {
    if (opening.current) return;
    opening.current = true;
    setNotice('');
    try {
      if (!item.read) {
        if (!demo) await markNotificationRead(item.id);
        if (!mounted.current) return;
        setItems(current => current.map(value => value.id === item.id ? { ...value, read: true } : value));
      }
      if (item.orderId) onOpenOrder?.(item.orderId);
      else if (item.kind === 'collaboration' && item.entityId) onOpenCollaboration(item.entityId);
    } catch (error) { if (mounted.current) setNotice(friendlyError(error)); }
    finally { opening.current = false; }
  };
  return <View style={f.flex}>
    <Header title="내 소식" back={onBack} />
    <ScrollView contentContainerStyle={f.notificationList}>
      {notice ? <Notice text={notice} /> : null}
      {loading ? <ActivityIndicator color={colors.brand} /> : items.length ? items.map(item => {
        const destination = item.orderId && onOpenOrder ? '주문 상세 열기' : item.kind === 'collaboration' && item.entityId ? '협업 대화 열기' : undefined;
        return <Pressable key={item.id} accessibilityRole="button" accessibilityHint={destination} style={[f.notification, !item.read && f.notificationUnread]} onPress={() => { void open(item); }}>
          <View style={[f.dot, item.read && f.dotRead]} />
          <View style={f.flex}>
            <CuritText weight="semibold">{item.title}</CuritText>
            <CuritText style={f.description}>{item.body}</CuritText>
            <CuritText style={f.hint}>{new Date(item.createdAt).toLocaleString('ko-KR')}</CuritText>
          </View>
          {destination ? <View style={{ justifyContent: 'center' }}><Icon name="chevron" size={16} color={colors.muted} /></View> : null}
        </Pressable>;
      }) : !notice ? <Empty title="새 소식이 없습니다" description="협업 제안과 상태 변경 소식이 여기에 표시됩니다." /> : null}
    </ScrollView>
  </View>;
}

export function SocialFeedSection({ canPost = false, demo = false, currentUserName = '권아영' }: { canPost?: boolean; demo?: boolean; currentUserName?: string }) {
  const [items, setItems] = useState<SocialPost[]>(demo ? demoSocialPosts : []);
  const [loading, setLoading] = useState(!demo);
  const [compose, setCompose] = useState('');
  const [postImage, setPostImage] = useState('');
  const [commentFor, setCommentFor] = useState('');
  const [comment, setComment] = useState('');
  const [commentsByPost, setCommentsByPost] = useState<Record<string, SocialComment[]>>(demo ? demoSocialComments : {});
  const [commentsLoadingFor, setCommentsLoadingFor] = useState('');
  const [notice, setNotice] = useState('');
  const [savingPost, setSavingPost] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const postRequest = useRef(false);
  const commentRequest = useRef(false);
  const load = async () => { if (demo) return; setLoading(true); try { setItems(await loadSocialFeed()); } catch (error) { setNotice(friendlyError(error)); } finally { setLoading(false); } };
  useEffect(() => {
    if (demo) return;
    let active = true;
    void loadSocialFeed().then(value => { if (active) setItems(value); }).catch(error => { if (active) setNotice(friendlyError(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo]);
  const choosePostImage = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .82 }); const asset = result.canceled ? undefined : result.assets[0]; if (asset?.uri) setPostImage(asset.uri); };
  const create = async () => {
    if (!compose.trim() || postRequest.current) return;
    if (demo) {
      const id = `local-post-${Date.now()}`;
      setItems(current => [{ id, creatorId: 'demo-current-user', creatorName: currentUserName, handle: 'curit_user', avatarUrl: '', content: compose.trim(), imageUrl: postImage, likes: 0, comments: 0, liked: false, followed: true, own: true, createdAt: new Date().toISOString() }, ...current]);
      setCommentsByPost(current => ({ ...current, [id]: [] }));
      setCompose(''); setPostImage(''); setNotice(''); return;
    }
    postRequest.current = true;
    setSavingPost(true); setNotice('');
    try { await createSocialPost(compose, postImage); setCompose(''); setPostImage(''); await load(); }
    catch (error) { setNotice(friendlyError(error)); }
    finally { postRequest.current = false; setSavingPost(false); }
  };
  const toggleFollow = async (item: SocialPost) => {
    if (demo) { setItems(current => current.map(value => value.creatorId === item.creatorId ? { ...value, followed: !item.followed } : value)); return; }
    await toggleCreatorFollow(item.creatorId, item.followed); await load();
  };
  const toggleLike = async (item: SocialPost) => {
    if (demo) { setItems(current => current.map(value => value.id === item.id ? { ...value, liked: !item.liked, likes: Math.max(0, item.likes + (item.liked ? -1 : 1)) } : value)); return; }
    await togglePostLike(item.id, item.liked); await load();
  };
  const toggleComments = async (item: SocialPost) => {
    if (commentFor === item.id) { setCommentFor(''); return; }
    setCommentFor(item.id);
    setComment('');
    if (demo) {
      setCommentsByPost(current => ({ ...current, [item.id]: current[item.id] ?? [] }));
      return;
    }
    setCommentsLoadingFor(item.id);
    try {
      const comments = await loadPostComments(item.id);
      setCommentsByPost(current => ({ ...current, [item.id]: comments }));
      setItems(current => current.map(value => value.id === item.id ? { ...value, comments: comments.length } : value));
    } catch (error) { setNotice(friendlyError(error)); }
    finally { setCommentsLoadingFor(''); }
  };
  const addComment = async (item: SocialPost) => {
    const text = comment.trim();
    if (!text || text.length > 500 || commentRequest.current) return;
    if (demo) {
      const next: SocialComment = { id: `local-comment-${Date.now()}`, postId: item.id, userId: 'demo-current-user', displayName: currentUserName, avatarUrl: '', content: text, createdAt: new Date().toISOString() };
      setCommentsByPost(current => ({ ...current, [item.id]: [...(current[item.id] ?? []), next] }));
      setItems(current => current.map(value => value.id === item.id ? { ...value, comments: (commentsByPost[item.id] ?? []).length + 1 } : value));
      setComment(''); setNotice(''); return;
    }
    commentRequest.current = true;
    setSavingComment(true); setNotice('');
    try {
      await addPostComment(item.id, text);
      setComment('');
      const comments = await loadPostComments(item.id);
      setCommentsByPost(current => ({ ...current, [item.id]: comments }));
      setItems(current => current.map(value => value.id === item.id ? { ...value, comments: comments.length } : value));
    } finally {
      commentRequest.current = false;
      setSavingComment(false);
    }
  };
  if (loading) return <ActivityIndicator color={colors.brand} style={f.loader} />;
  return <View style={f.feed}>
    {canPost ? <View style={f.compose}>
      <TextInput value={compose} onChangeText={setCompose} placeholder="새 작품이나 전시 소식을 알려주세요" placeholderTextColor={colors.subtle} style={f.composeInput} maxLength={2000} editable={!savingPost} multiline />
      {postImage ? <Image source={{ uri: postImage }} style={f.postImage} /> : null}
      <View style={f.two}><View style={f.flex}><Button label={postImage ? '사진 변경' : '사진 추가'} variant="secondary" onPress={() => { void choosePostImage(); }} /></View><View style={f.flex}><Button label={savingPost ? '등록 중…' : '소식 올리기'} disabled={savingPost || !compose.trim()} onPress={() => { void create(); }} /></View></View>
    </View> : null}
    {items.length ? items.map((item, index) => <View key={item.id} style={f.post}>
      <View style={f.row}>
        {item.avatarUrl ? <Image source={{ uri: item.avatarUrl }} style={f.avatarSmall} /> : <View style={f.avatarSmall}><CuritText weight="bold">{item.creatorName[0]}</CuritText></View>}
        <View style={f.flex}><CuritText weight="semibold">{item.creatorName}</CuritText><CuritText style={f.hint}>@{item.handle || 'creator'} · {new Date(item.createdAt).toLocaleDateString('ko-KR')}</CuritText></View>
        {!item.own ? <Chip label={item.followed ? '팔로잉' : '팔로우'} active={item.followed} onPress={() => { void toggleFollow(item).catch(error => setNotice(friendlyError(error))); }} /> : <Chip label="내 소식" />}
      </View>
      <CuritText style={f.longText}>{item.content}</CuritText>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={f.postImage} contentFit="cover" /> : demo ? <Image source={[images.pouch, images.print, images.bowls, images.linen][index % 4]} style={f.postImage} contentFit="cover" /> : null}
      <View style={f.socialActions}>
        <Pressable accessibilityRole="button" hitSlop={8} style={f.socialAction} onPress={() => { void toggleLike(item).catch(error => setNotice(friendlyError(error))); }}><CuritText style={item.liked ? f.brand : f.muted}>♥ {item.likes}</CuritText></Pressable>
        <Pressable accessibilityRole="button" hitSlop={8} style={f.socialAction} accessibilityState={{ expanded: commentFor === item.id }} onPress={() => { void toggleComments(item); }}><CuritText style={f.muted}>댓글 {demo ? (commentsByPost[item.id] ?? []).length : item.comments}</CuritText></Pressable>
      </View>
      {commentFor === item.id ? <View style={f.commentPanel}>
        {commentsLoadingFor === item.id ? <ActivityIndicator color={colors.brand} /> : (commentsByPost[item.id] ?? []).length ? (commentsByPost[item.id] ?? []).map(value => <View key={value.id} style={f.commentItem}>
          <View style={f.commentMeta}><CuritText weight="semibold">{value.displayName}</CuritText><CuritText style={f.hint}>{new Date(value.createdAt).toLocaleDateString('ko-KR')}</CuritText></View>
          <CuritText style={f.commentText}>{value.content}</CuritText>
        </View>) : <CuritText style={f.emptyComment}>첫 댓글을 남겨보세요.</CuritText>}
        <View style={f.commentRow}>
          <TextInput value={comment} onChangeText={setComment} placeholder="응원 댓글을 남겨주세요" placeholderTextColor={colors.subtle} style={f.commentInput} maxLength={500} editable={!savingComment} returnKeyType="send" onSubmitEditing={() => { void addComment(item).catch(error => setNotice(friendlyError(error))); }} />
          <Pressable accessibilityRole="button" disabled={savingComment || !comment.trim() || comment.trim().length > 500} style={f.commentSubmit} onPress={() => { void addComment(item).catch(error => setNotice(friendlyError(error))); }}><CuritText weight="semibold" style={!comment.trim() ? f.muted : f.brand}>등록</CuritText></Pressable>
        </View>
      </View> : null}
    </View>) : <Empty title="등록된 소식이 없습니다" description="크리에이터의 새 작품과 전시 소식이 여기에 표시됩니다." />}
    {notice ? <Notice text={notice} /> : null}
  </View>;
}

function StepBars({ labels, current }: { labels: string[]; current: number }) { return <View style={f.stepBars}>{labels.map((label, index) => <View key={label} style={f.flex}><View style={[f.stepLine, index + 1 <= current && f.stepLineActive]} /><CuritText style={index + 1 === current ? f.brand : f.muted}>{label}</CuritText></View>)}</View>; }
function ChoiceCard({ title, options, selected, onToggle }: { title: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) { return <View style={f.choiceCard}><CuritText weight="semibold">{title}</CuritText><View style={f.wrap}>{options.map(value => <Chip key={value} label={value} active={selected.includes(value)} onPress={() => onToggle(value)} />)}</View></View>; }
function Notice({ text }: { text: string }) { return <View style={f.notice}><CuritText style={text.includes('못') || text.includes('확인') ? f.danger : f.brand}>{text}</CuritText></View>; }
function InfoRow({ label, value }: { label: string; value: string }) {
  const multiline = value.length > 22;
  return <View style={[f.infoRow, multiline && f.infoRowMultiline]}><CuritText style={f.muted}>{label}</CuritText><CuritText weight="semibold" style={[f.infoValue, multiline && f.infoValueMultiline]}>{value || '-'}</CuritText></View>;
}

const f = StyleSheet.create({
  flex: { flex: 1 }, scroll: { padding: 20, paddingBottom: 36, gap: 20 }, loader: { marginTop: 80 }, pageTitle: { fontSize: 23, lineHeight: 31 }, description: { color: colors.muted, marginTop: 4 }, longText: { lineHeight: 23 }, brand: { color: colors.brand }, muted: { color: colors.muted }, danger: { color: colors.danger }, hint: { color: colors.muted, fontSize: 11, marginTop: 6 },
  sticky: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, padding: 14 }, stepBars: { flexDirection: 'row', gap: 8 }, stepLine: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: 7 }, stepLineActive: { backgroundColor: colors.brand },
  choiceCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, gap: 14 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, textarea: { minHeight: 96, textAlignVertical: 'top', paddingTop: 13 }, notice: { padding: 13, borderRadius: radius.sm, backgroundColor: colors.brandSoft },
  profileHero: { alignItems: 'center', gap: 8, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border }, avatarLarge: { width: 86, height: 86, borderRadius: 43, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, avatarLetter: { fontSize: 28, color: colors.brand }, handle: { color: colors.brand }, photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  profileProject: { minHeight: 104, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface }, profileProjectIndex: { width: 58, height: 70, borderRadius: radius.sm, backgroundColor: colors.brandPale, alignItems: 'center', justifyContent: 'center' }, profileProjectIndexText: { color: colors.brand, fontSize: 18 }, profileProjectStatus: { color: colors.brand, fontSize: 11, marginBottom: 4 },
  storeCover: { width: '100%', height: 210, borderRadius: radius.lg }, placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPale }, infoCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14 }, infoRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, infoRowMultiline: { alignItems: 'flex-start', flexDirection: 'column', gap: 5, paddingVertical: 12 }, infoValue: { flex: 1, textAlign: 'right' }, infoValueMultiline: { flex: 0, width: '100%', textAlign: 'left', lineHeight: 21 },
  two: { flexDirection: 'row', gap: 10 }, infoBanner: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: 16, gap: 5 }, qrProductImage: { width: '100%', height: 180, borderRadius: radius.md }, preview: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 18, alignItems: 'center', gap: 9 },
  pickupQrAction: { minHeight: 44, width: 44, alignItems: 'center', justifyContent: 'center' },
  pickupPhoto: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.brandPale },
  pickupHelpAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }, tab: { flex: 1, paddingVertical: 13, alignItems: 'center' }, tabActive: { borderBottomWidth: 2, borderBottomColor: colors.brand }, orderCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, gap: 15 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, accordion: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  notificationList: { flexGrow: 1, paddingVertical: 8, paddingBottom: 36 }, notification: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }, notificationUnread: { backgroundColor: colors.brandPale }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginTop: 7 }, dotRead: { backgroundColor: colors.border },
  verificationStatus: { minHeight: 92, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16 }, evidenceImage: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.brandPale }, evidencePlaceholder: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.brand, borderRadius: radius.md, backgroundColor: colors.brandPale },
  headerTextAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  qrDetails: { gap: 6 },
  qrDetailsAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  feed: { gap: 14 }, compose: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, gap: 10 }, composeInput: { minHeight: 76, fontFamily: fonts.regular, color: colors.ink, textAlignVertical: 'top' }, post: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, gap: 12 }, avatarSmall: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, postImage: { width: '100%', height: 220, borderRadius: radius.sm }, socialActions: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }, socialAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, commentPanel: { gap: 10, paddingTop: 4 }, commentItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 4 }, commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 }, commentText: { color: colors.ink, fontSize: 13, lineHeight: 19 }, emptyComment: { color: colors.muted, fontSize: 12, paddingVertical: 8 }, commentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, commentInput: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 22, paddingHorizontal: 14, fontFamily: fonts.regular, color: colors.ink }, commentSubmit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
