import { usePhotoPicker } from './photoPicker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
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
  saveStorePreferences,
  updateManagedOrder,
  updateQrListing,
  type CreatorProjectDetails,
  type ManagedOrder,
  type StoreOnboarding,
} from './platform';
import type { QrProduct } from './types';
import { demoCreatorProfile, demoSocialComments, demoSocialPosts } from './demoContent';
import { images } from './data';
import { formatStoreBudget, storeBudgetError, storeChoices, storeColors, storeMoods, storePurposes, storeZones } from './storePreferences';

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

function LoadErrorScreen({ title, message, onBack, onRetry }: { title: string; message: string; onBack: () => void; onRetry: () => void }) {
  return <View style={f.flex}><Header title={title} back={onBack} /><Empty title="정보를 불러오지 못했어요" description={message} /><View style={f.sticky}><Button label="다시 불러오기" onPress={onRetry} /></View></View>;
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
  const [attempt, setAttempt] = useState(0);
  const saveLock = useRef(false);
  useEffect(() => {
    let active = true;
    const request = demo ? Promise.resolve(demoCreatorProfile) : loadCreatorProfile();
    void request.then(value => {
      if (!active) return;
      setProfile(value); setMoods(value.dnaMoods); setColors(value.dnaColors); setSpaces(value.preferredSpaces); setGoals(value.collaborationGoals); setConditions(value.installConditions);
    }).catch(error => { if (active) setNotice(friendlyError(error)); });
    return () => { active = false; };
  }, [demo, attempt]);
  const save = async () => {
    if (!profile || saveLock.current) return;
    if (!moods.length || !colorsValue.length || !spaces.length || !goals.length) { setNotice('작품 취향과 협업 방향을 모두 선택해 주세요.'); return; }
    saveLock.current = true;
    setSaving(true); setNotice('');
    try { if (!demo) await saveCreatorDna({ dnaMoods: moods, dnaColors: colorsValue, preferredSpaces: spaces, collaborationGoals: goals, installConditions: conditions }); onNext?.(); if (!onNext) setNotice('크리에이터 DNA를 저장했습니다.'); }
    catch (error) { setNotice(friendlyError(error)); } finally { saveLock.current = false; setSaving(false); }
  };
  if (!profile && !notice) return <LoadingScreen title="크리에이터 DNA" onBack={onBack} />;
  if (!profile) return <LoadErrorScreen title="크리에이터 DNA" message={notice} onBack={onBack} onRetry={() => { setNotice(''); setAttempt(value => value + 1); }} />;
  return <KeyboardAvoidingView style={f.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title="크리에이터 DNA" back={onBack} />
    <ScrollView contentContainerStyle={f.scroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
      <StepBars labels={['1 작품 DNA', '2 프로필']} current={1} />
      <CuritText weight="bold" style={f.pageTitle}>내 작품에 맞는 공간을 찾아요.</CuritText>
      <CuritText style={f.description}>공간 추천에 반영할 취향과 조건을 정해 주세요.</CuritText>
      <ChoiceCard title="핵심 분위기 *" options={storeChoices(moodOptions, profile.dnaMoods)} selected={moods} disabled={saving} onToggle={value => toggle(value, moods, setMoods)} />
      <ChoiceCard title="작품 색감 *" options={storeChoices(colorOptions, profile.dnaColors)} selected={colorsValue} disabled={saving} onToggle={value => toggle(value, colorsValue, setColors)} />
      <ChoiceCard title="선호 공간 *" options={storeChoices(spaceOptions, profile.preferredSpaces)} selected={spaces} disabled={saving} onToggle={value => toggle(value, spaces, setSpaces)} />
      <ChoiceCard title="협업 목적 *" options={storeChoices(goalOptions, profile.collaborationGoals)} selected={goals} disabled={saving} onToggle={value => toggle(value, goals, setGoals)} />
      <Field label="설치 · 관리 조건" value={conditions} onChangeText={setConditions} editable={!saving} placeholder="예: 습기가 많은 공간은 피하고 싶어요" multiline style={f.textarea} />
    </ScrollView>
    <View style={f.sticky}>{notice ? <Notice text={notice} /> : null}<Button label={saving ? '저장 중…' : onNext ? '다음 · 프로필 설정' : '변경사항 저장'} disabled={saving} onPress={() => { void save(); }} /></View>
  </KeyboardAvoidingView>;
}

export function CreatorProfileScreen({ mode, project, onBack, onEdit, onOpenProject, onSaved, demo = false }: { mode: 'view' | 'edit'; project?: CreatorProjectDetails; onBack: () => void; onEdit?: () => void; onOpenProject?: () => void; onSaved?: (profile: CreatorProfileData) => void; demo?: boolean }) {
  const [profile, setProfile] = useState<CreatorProfileData | null>(null);
  const [avatarUri, setAvatarUri] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const saveLock = useRef(false);
  const [savedOptions, setSavedOptions] = useState({ regions: [] as string[], categories: [] as string[] });
  const photo = usePhotoPicker();
  useEffect(() => {
    let active = true;
    const request = demo ? Promise.resolve(demoCreatorProfile) : loadCreatorProfile();
    void request.then(value => {
      if (!active) return;
      setSavedOptions({ regions: value.regions, categories: value.categories });
      setProfile(value);
    }).catch(error => { if (active) setNotice(friendlyError(error)); });
    return () => { active = false; };
  }, [demo, attempt]);
  const patch = <K extends keyof CreatorProfileData>(key: K, value: CreatorProfileData[K]) => { if (!saveLock.current) setProfile(current => current ? { ...current, [key]: value } : current); };
  const save = async () => {
    if (saveLock.current) return;
    if (!profile?.displayName.trim() || !profile.regions.length || !profile.categories.length) { setNotice('활동명, 활동 지역, 작업 분야를 입력해 주세요.'); return; }
    saveLock.current = true;
    setSaving(true); setNotice('');
    try { const saved = demo ? { ...profile, avatarUrl: avatarUri || profile.avatarUrl, onboardingComplete: true } : await saveCreatorProfile({ ...profile, avatarUri }, true); setProfile(saved); onSaved?.(saved); if (!onSaved) setNotice('프로필을 저장했습니다.'); }
    catch (error) { setNotice(friendlyError(error)); } finally { saveLock.current = false; setSaving(false); }
  };
  if (!profile && !notice) return <LoadingScreen title={mode === 'edit' ? '크리에이터 프로필 수정' : '크리에이터 프로필'} onBack={onBack} />;
  if (!profile) return <LoadErrorScreen title={mode === 'edit' ? '크리에이터 프로필 수정' : '크리에이터 프로필'} message={notice} onBack={onBack} onRetry={() => { setNotice(''); setAttempt(value => value + 1); }} />;
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
      <View style={f.photoRow}>{avatarUri || profile.avatarUrl ? <Image source={{ uri: avatarUri || profile.avatarUrl }} style={f.avatarLarge} /> : <View style={f.avatarLarge}><CuritText style={f.muted}>사진</CuritText></View>}<View style={f.flex}><Button label="프로필 사진 선택" variant="secondary" disabled={saving || photo.checking} onPress={() => { void photo.choose(setAvatarUri); }} /><CuritText style={f.hint}>JPG · PNG · WEBP, 최대 5MB</CuritText></View></View>
      {photo.error ? <CuritText accessibilityRole="alert" style={f.danger}>{photo.error}</CuritText> : null}
      <Field editable={!saving} label="활동명 / 브랜드명 *" value={profile.displayName} onChangeText={value => patch('displayName', value)} />
      <Field editable={!saving} label="활동 아이디" value={profile.handle} onChangeText={value => patch('handle', value.replace(/[^a-zA-Z0-9_.]/g, ''))} placeholder="soyeon_craft" autoCapitalize="none" />
      <Field editable={!saving} label="한 줄 소개 · 선택" value={profile.headline} onChangeText={value => patch('headline', value)} />
      <Field editable={!saving} label="작업 이야기" value={profile.introduction} onChangeText={value => patch('introduction', value)} multiline style={f.textarea} />
      <ChoiceCard title="활동 지역 *" options={storeChoices(regionOptions, savedOptions.regions)} selected={profile.regions} disabled={saving} onToggle={value => patch('regions', profile.regions.includes(value) ? profile.regions.filter(item => item !== value) : [...profile.regions, value])} />
      <ChoiceCard title="작업 분야 *" options={storeChoices(categoryOptions, savedOptions.categories)} selected={profile.categories} disabled={saving} onToggle={value => patch('categories', profile.categories.includes(value) ? profile.categories.filter(item => item !== value) : [...profile.categories, value])} />
      <Field editable={!saving} label="SNS" value={profile.snsUrl} onChangeText={value => patch('snsUrl', value)} placeholder="https://instagram.com/..." autoCapitalize="none" />
      <Field editable={!saving} label="포트폴리오" value={profile.portfolioUrl} onChangeText={value => patch('portfolioUrl', value)} placeholder="https://..." autoCapitalize="none" />
    </ScrollView>
    <View style={f.sticky}>{notice ? <Notice text={notice} /> : null}<Button label={saving ? '저장 중…' : '프로필 저장'} disabled={saving || photo.checking} onPress={() => { void save(); }} /></View>
  </KeyboardAvoidingView>;
}

export function StoreProfileScreen({ userId, onBack, onEdit, onEditPhotos, onPreferences, sample }: { userId: string; onBack: () => void; onEdit: (store: StoreOnboarding) => void; onEditPhotos: (store: StoreOnboarding) => void; onPreferences: () => void; sample?: StoreOnboarding }) {
  const [store, setStore] = useState<StoreOnboarding | null>(null);
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const request = sample ? Promise.resolve(sample) : loadStoreOnboarding(userId);
    void request.then(value => {
      if (!value) throw new Error('등록된 매장 정보를 찾지 못했어요.');
      if (active) setStore(value);
    }).catch(error => { if (active) setNotice(friendlyError(error)); });
    return () => { active = false; };
  }, [sample, userId, attempt]);
  if (!store && !notice) return <LoadingScreen title="매장 프로필" onBack={onBack} />;
  if (!store) return <LoadErrorScreen title="매장 프로필" message={notice} onBack={onBack} onRetry={() => { setNotice(''); setAttempt(value => value + 1); }} />;
  const cover = store.photoPaths[0];
  return <View style={f.flex}><Header title={store.name} back={onBack} action={<Pressable accessibilityRole="button" style={f.headerTextAction} hitSlop={10} onPress={() => onEdit(store)}><CuritText weight="semibold" style={f.brand}>수정</CuritText></Pressable>} /><ScrollView contentContainerStyle={f.scroll}>
    {cover ? <Image source={cover === 'demo-cafe' ? images.cafe : { uri: mediaUrl(cover) }} style={f.storeCover} contentFit="cover" /> : <View style={[f.storeCover, f.placeholder]}><Icon name="store" size={36} color={colors.brand} /><CuritText style={f.muted}>등록된 매장 사진이 없어요</CuritText></View>}
    <Button label={cover ? '매장 사진 수정' : '매장 사진 추가'} variant="secondary" onPress={() => onEditPhotos(store)} />
    <CuritText weight="bold" style={f.pageTitle}>{store.name}</CuritText><CuritText style={f.description}>{store.category} · {store.address}</CuritText><CuritText style={f.longText}>{store.introduction}</CuritText>
    <View style={f.infoCard}><InfoRow label="주 고객층" value={store.targetAudience} /><InfoRow label="월 예산" value={formatStoreBudget(store.monthlyBudgetMin, store.monthlyBudgetMax)} /><InfoRow label="전시 구역" value={store.exhibitionZones.map(zone => zone.label || zone.type).join(' · ')} /></View>
    <SectionTitle title="공간 취향" action="수정" onPress={onPreferences} /><View style={f.wrap}>{[...store.moodTags, ...store.purposeTags].map(value => <Chip key={value} label={value} />)}</View>
  </ScrollView></View>;
}

export function StorePreferencesScreen({ userId, onBack, onSaved, sample }: { userId: string; onBack: () => void; onSaved: (value: StoreOnboarding) => void; sample?: StoreOnboarding }) {
  const [store, setStore] = useState<StoreOnboarding | null>(null);
  const [saved, setSaved] = useState<StoreOnboarding | null>(null);
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const saveLock = useRef(false);
  useEffect(() => {
    let active = true;
    const request = sample ? Promise.resolve(sample) : loadStoreOnboarding(userId);
    void request.then(value => {
      if (!active) return;
      if (!value) throw new Error('매장 정보를 불러오지 못했어요.');
      setStore(value); setSaved(value);
      setMinBudget(String(value.monthlyBudgetMin ?? ''));
      setMaxBudget(String(value.monthlyBudgetMax ?? ''));
    }).catch(error => { if (active) setNotice(friendlyError(error)); });
    return () => { active = false; };
  }, [sample, userId, attempt]);
  if (!store && !notice) return <LoadingScreen title="공간 취향 · 전시 구역" onBack={onBack} />;
  if (!store || !saved) return <LoadErrorScreen title="공간 취향 · 전시 구역" message={notice} onBack={onBack} onRetry={() => { setNotice(''); setAttempt(value => value + 1); }} />;
  const zones = store.exhibitionZones.map(zone => zone.type);
  const budgetError = storeBudgetError(minBudget, maxBudget);
  const patch = (value: Partial<StoreOnboarding>) => { if (!saving) { setStore({ ...store, ...value }); setNotice(''); } };
  const toggleMood = (value: string) => toggle(value, store.moodTags, moodTags => patch({ moodTags }));
  const save = async () => {
    if (saveLock.current || budgetError || !zones.length) return;
    saveLock.current = true;
    setSaving(true); setNotice('');
    const updated = { ...store, monthlyBudgetMin: minBudget ? Number(minBudget) : null, monthlyBudgetMax: maxBudget ? Number(maxBudget) : null };
    try {
      if (!sample) await saveStorePreferences(updated);
      setStore(updated); setSaved(updated);
      onSaved(updated);
      setNotice('공간 취향과 전시 구역을 저장했습니다.');
    } catch (error) {
      setNotice(friendlyError(error));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };
  return <KeyboardAvoidingView style={f.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title="공간 취향 · 전시 구역" back={onBack} />
    <ScrollView style={f.flex} contentContainerStyle={f.scroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
      <CuritText style={f.description}>저장하면 매장 프로필과 공간 추천에 반영돼요.</CuritText>
      <ChoiceCard title="공간 분위기" options={storeChoices(storeMoods, saved.moodTags.filter(value => !storeColors.includes(value)))} selected={store.moodTags} onToggle={toggleMood} />
      <ChoiceCard title="공간 색감" options={storeColors} selected={store.moodTags} onToggle={toggleMood} />
      <ChoiceCard title="협업 목적" options={storeChoices(storePurposes, saved.purposeTags)} selected={store.purposeTags} onToggle={value => toggle(value, store.purposeTags, purposeTags => patch({ purposeTags }))} />
      <View style={f.two}>
        <View style={f.flex}><Field label="최소 예산(원)" value={minBudget} onChangeText={value => { setMinBudget(value.replace(/\D/g, '')); setNotice(''); }} keyboardType="number-pad" editable={!saving} /></View>
        <View style={f.flex}><Field label="최대 예산(원)" value={maxBudget} onChangeText={value => { setMaxBudget(value.replace(/\D/g, '')); setNotice(''); }} keyboardType="number-pad" editable={!saving} /></View>
      </View>
      {budgetError ? <CuritText accessibilityRole="alert" style={f.danger}>{budgetError}</CuritText> : null}
      <ChoiceCard title="전시 구역 *" options={storeChoices(storeZones, saved.exhibitionZones.map(zone => zone.type))} selected={zones} onToggle={value => {
        const original = saved.exhibitionZones.find(zone => zone.type === value);
        const exhibitionZones = zones.includes(value)
          ? store.exhibitionZones.filter(zone => zone.type !== value)
          : [...store.exhibitionZones, original ?? { type: value, widthCm: null, heightCm: null }];
        patch({ exhibitionZones });
      }} />
      {!zones.length ? <CuritText accessibilityRole="alert" style={f.danger}>전시 구역을 1곳 이상 선택해 주세요.</CuritText> : null}
    </ScrollView>
    <View style={f.sticky}>
      {notice ? <Notice text={notice} /> : null}
      <Button label={saving ? '저장 중…' : '변경사항 저장'} disabled={saving || Boolean(budgetError) || !zones.length} onPress={() => { void save(); }} />
    </View>
  </KeyboardAvoidingView>;
}

export function QrProductEditorScreen({ item: initial, onBack, onSaved, demo = false }: { item: QrProduct; onBack: () => void; onSaved: (item: QrProduct) => void; demo?: boolean }) {
  const [item, setItem] = useState(initial);
  const [stock, setStock] = useState(String(initial.stock));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [saleNotice, setSaleNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const saveLock = useRef(false);
  if (item.source === 'field-sale') return <FieldSaleProductScreen item={item} onBack={onBack} />;
  const stockValue = Number(stock);
  const stockLimit = item.supplyLimit ?? 100_000;
  const valuesValid = stock.length > 0 && Number.isSafeInteger(stockValue) && stockValue >= 0 && stockValue <= stockLimit;
  const stockChanged = stockValue !== item.stock;
  const selling = item.status !== 'PAUSED';
  const save = async (saleStatus?: 'active' | 'preparing') => {
    if (saveLock.current || !item.id || (saleStatus === undefined && !valuesValid)) return;
    if (saleStatus === 'active' && (!ready || stockChanged || !valuesValid || item.canStartSale === false)) return;
    saveLock.current = true;
    const setFeedback = saleStatus === undefined ? setNotice : setSaleNotice;
    setSaving(true); setFeedback('');
    try {
      const changes = saleStatus === undefined
        ? { stock: stockValue, expectedStock: item.stock }
        : saleStatus === 'active'
          ? { saleStatus, readinessConfirmed: true as const, expectedStock: item.stock }
          : { saleStatus };
      const saved = demo ? {
        ...item,
        stock: changes.stock ?? item.stock,
        status: saleStatus === 'preparing' ? 'PAUSED' as const : saleStatus === 'active' ? item.stock > 0 ? 'ACTIVE' as const : 'SOLD_OUT' as const : item.status,
      } : await updateQrListing(item.id, changes);
      setItem(saved); setStock(String(saved.stock)); setReady(false); onSaved(saved);
      if (saleStatus === 'preparing') setConfirmStop(false);
      setFeedback(saleStatus === 'preparing' ? 'QR 판매를 중단했습니다.' : saleStatus === 'active' ? 'QR 판매를 시작했습니다.' : '구매 가능 수량을 저장했습니다.');
      if (saleStatus === undefined && Platform.OS !== 'web') {
        Keyboard.dismiss();
        Alert.alert('구매 가능 수량을 저장했어요', `QR 구매 화면에 ${saved.stock.toLocaleString('ko-KR')}개가 표시됩니다.`);
      }
    }
    catch (error) { if (saleStatus === 'active') setReady(false); setFeedback(friendlyError(error)); }
    finally { saveLock.current = false; setSaving(false); }
  };
  return <KeyboardAvoidingView style={f.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Header title="QR 상품 정보 확인" back={onBack} /><ScrollView contentContainerStyle={f.scroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
    {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={f.qrProductImage} /> : null}<CuritText style={f.hint}>{item.artistName || '등록 작가'}</CuritText>
    <Field label="상품명" value={item.name} editable={false} />
    <View style={f.two}><View style={f.flex}><Field label="합의 판매가" value={`${item.price.toLocaleString('ko-KR')}원`} editable={false} /></View><View style={f.flex}><Field label="구매 가능 수량 *" value={stock} editable={!saving} onChangeText={value => { setStock(value.replace(/\D/g, '')); setReady(false); }} keyboardType="number-pad" /></View></View>
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
    <QrLinkCard item={item} allowExport />
    {saleNotice ? <Notice text={saleNotice} /> : null}
    {selling ? <View style={f.qrDanger}>
      {confirmStop ? <>
        <CuritText weight="semibold">새 주문 접수를 중단할까요?</CuritText>
        <CuritText style={f.description}>이미 접수된 주문은 수령 관리에서 계속 확인할 수 있어요.</CuritText>
        <Button label="계속 판매하기" variant="secondary" disabled={saving} onPress={() => setConfirmStop(false)} />
      </> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} style={f.qrStopAction} onPress={() => { if (confirmStop) void save('preparing'); else setConfirmStop(true); }}>
        <CuritText weight="semibold" style={f.danger}>{confirmStop ? '판매 중단 확인' : 'QR 판매 중단'}</CuritText>
      </Pressable>
    </View> : item.canStartSale !== false ? <View style={f.infoBanner}>
      <CuritText weight="semibold">판매 전 확인</CuritText>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ready, disabled: saving }} disabled={saving} onPress={() => setReady(value => !value)} style={f.readinessCheck}>
        <View style={[f.readinessBox, ready && f.readinessBoxChecked]}>{ready ? <CuritText style={f.readinessTick}>✓</CuritText> : null}</View>
        <CuritText style={f.flex}>상품 진열과 QR 가격·재고·수령 안내를 확인했어요.</CuritText>
      </Pressable>
      {stockChanged ? <CuritText style={f.hint}>변경한 수량을 먼저 저장해 주세요.</CuritText> : null}
      <Button label="QR 판매 시작" disabled={saving || !ready || stockChanged || !valuesValid} onPress={() => { void save('active'); }} />
    </View> : <CuritText style={f.hint}>진행 중인 전시에서만 QR 판매를 시작할 수 있어요.</CuritText>}
  </ScrollView></KeyboardAvoidingView>;
}

function QrLinkCard({ item, initiallyExpanded = false, allowExport = false }: { item: QrProduct; initiallyExpanded?: boolean; allowExport?: boolean }) {
  const url = item.qrUrl || '';
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [notice, setNotice] = useState('');
  const copy = async (value: string, success: string) => {
    try {
      if (!(await Clipboard.setStringAsync(value))) throw new Error('Clipboard unavailable');
      setNotice(success);
    } catch { setNotice('복사하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
  };
  const open = async () => {
    if (!url) return;
    try { await Linking.openURL(url); } catch { setNotice('상품 페이지를 열지 못했어요. QR 주소를 다시 확인해 주세요.'); }
  };
  const share = async (message: string) => {
    if (Platform.OS === 'web') {
      await copy(message, '클립보드에 복사했습니다.');
      return;
    }
    try {
      await Share.share({ message });
    } catch { setNotice('공유하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
  };
  return <View style={f.qrLinks}>
    <CuritText weight="semibold">QR 코드와 구매 링크</CuritText>
    <View style={f.two}>
      <View style={f.flex}><Button label="QR 주소 복사" variant="secondary" disabled={!url} onPress={() => { void copy(url, 'QR 주소를 복사했어요.'); }} /></View>
      <View style={f.flex}><Button label="구매 화면 열기" variant="secondary" disabled={!url} onPress={() => { void open(); }} /></View>
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} style={f.qrDetailsAction} onPress={() => setExpanded(value => !value)}>
      <CuritText weight="semibold">QR 미리보기</CuritText><CuritText>{expanded ? '−' : '＋'}</CuritText>
    </Pressable>
    {expanded ? <>
      <View style={f.preview}>
        {url ? <QRCode value={url} size={140} color={colors.ink} backgroundColor={colors.surface} /> : null}
        <CuritText weight="bold">{item.name}</CuritText>
        {url ? <CuritText selectable style={f.hint}>{url}</CuritText> : <CuritText style={f.hint}>연결된 구매 주소가 없어요.</CuritText>}
      </View>
      {Platform.OS !== 'web' && url ? <Button label="QR 링크 공유" variant="ghost" onPress={() => { void share(url); }} /> : null}
      {allowExport ? <Button label="데이터 내보내기" variant="ghost" onPress={() => { void share(JSON.stringify({ token: item.token, name: item.name, price: item.price, stock: item.stock, qrUrl: url }, null, 2)); }} /> : null}
    </> : null}
    {notice ? <View accessibilityLiveRegion="polite"><Notice text={notice} /></View> : null}
  </View>;
}

function FieldSaleProductScreen({ item, onBack }: { item: QrProduct; onBack: () => void }) {
  return <View style={f.flex}>
    <Header title="QR 상품 정보" back={onBack} />
    <ScrollView contentContainerStyle={f.scroll}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={f.qrProductImage} contentFit="cover" /> : null}
      <Chip label="현장 등록 상품" active />
      <CuritText weight="bold" style={{ fontSize: 22, marginTop: 10 }}>{item.name}</CuritText>
      <CuritText style={f.hint}>현장 판매 상품 · {item.status === 'SOLD_OUT' ? '품절' : item.status === 'ACTIVE' ? '구매 가능' : '구매 안내 준비 중'}</CuritText>
      <CuritText weight="bold" style={{ fontSize: 20, marginTop: 10 }}>{item.price.toLocaleString('ko-KR')}원</CuritText>
      <CuritText style={f.description}>{item.inventoryTracked === false ? '수량은 매장 재고를 확인해 주세요.' : `등록 수량 ${item.stock}개`}</CuritText>
      <QrLinkCard item={item} initiallyExpanded />
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
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const submitLock = useRef(false);
  const evidence = usePhotoPicker();
  useEffect(() => {
    if (demo) return;
    let active = true;
    void loadVerificationRequest(kind)
      .then(value => { if (active) { setRequest(value); setNote(value?.note || ''); } })
      .catch(error => { if (active) setLoadError(friendlyError(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, kind, attempt]);
  const submit = async () => {
    if (submitLock.current || loading || loadError) return;
    if (!imageUri) { setNotice('확인 가능한 증빙 이미지를 먼저 선택해 주세요.'); return; }
    submitLock.current = true;
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
    finally { submitLock.current = false; setSaving(false); }
  };
  if (loadError) return <LoadErrorScreen title={creator ? '활동 인증' : '매장 운영 인증'} message={loadError} onBack={onBack} onRetry={() => { setLoadError(''); setLoading(true); setAttempt(value => value + 1); }} />;
  const statusLabel = request?.status === 'approved' ? '승인 완료' : request?.status === 'rejected' ? '보완 필요' : request ? '검토 중' : '제출 전';
  const preview = imageUri || request?.evidenceUrl || '';
  return <KeyboardAvoidingView style={f.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title={creator ? '활동 인증' : '매장 운영 인증'} back={onBack} />
    <ScrollView contentContainerStyle={f.scroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
      {loading ? <ActivityIndicator color={colors.brand} style={f.loader} /> : <>
        <View style={f.verificationStatus}><View style={f.flex}><CuritText weight="bold">{creator ? '크리에이터 활동 확인' : '오프라인 매장 운영 확인'}</CuritText><CuritText style={f.description}>{creator ? '포트폴리오·전시·판매 활동을 확인할 수 있는 자료를 제출해 주세요.' : '사업자등록증 또는 매장 운영 사실을 확인할 수 있는 자료를 제출해 주세요.'}</CuritText></View><Chip label={statusLabel} active={request?.status === 'approved'} /></View>
        {request?.reviewNote ? <View style={f.infoBanner}><CuritText weight="semibold">검토 의견</CuritText><CuritText style={f.description}>{request.reviewNote}</CuritText></View> : null}
        {preview ? <Image source={{ uri: preview }} style={f.evidenceImage} contentFit="cover" /> : <View style={f.evidencePlaceholder}><Icon name="store" size={30} color={colors.brand} /><CuritText style={f.hint}>JPG, PNG, WEBP · 최대 5MB</CuritText></View>}
        <Button label={preview ? '증빙 이미지 변경' : '증빙 이미지 선택'} variant="secondary" disabled={saving || evidence.checking} onPress={() => { void evidence.choose(uri => { setImageUri(uri); setNotice(''); }); }} />
        {evidence.error ? <CuritText accessibilityRole="alert" style={f.danger}>{evidence.error}</CuritText> : null}
        <Field editable={!saving} label="검토 참고사항" value={note} onChangeText={setNote} placeholder={creator ? '활동 링크나 확인할 내용을 적어 주세요.' : '매장명과 확인할 내용을 적어 주세요.'} multiline style={f.textarea} />
        <View style={f.infoBanner}><CuritText weight="semibold">개인정보 안내</CuritText><CuritText style={f.description}>증빙 이미지는 공개 프로필에 노출되지 않으며 인증 검토 목적으로만 비공개 저장됩니다. 주민등록번호 등 불필요한 정보는 가린 뒤 제출해 주세요.</CuritText></View>
        <Button label={saving ? '제출 중…' : request ? '증빙 다시 제출' : '검토 요청하기'} disabled={saving || evidence.checking || !imageUri} onPress={() => { void submit(); }} />
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
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, SocialComment[]>>(demo ? demoSocialComments : {});
  const [olderByPost, setOlderByPost] = useState<Record<string, boolean>>({});
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState('');
  const [postError, setPostError] = useState('');
  const [savingPost, setSavingPost] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const photo = usePhotoPicker();
  const postRequest = useRef(false);
  const commentRequest = useRef(false);
  const commentPageRequests = useRef(new Set<string>());
  const load = async () => { if (demo) return; setLoading(true); setNotice(''); try { setItems(await loadSocialFeed()); } catch (error) { setNotice(friendlyError(error)); } finally { setLoading(false); } };
  useEffect(() => {
    if (demo) return;
    let active = true;
    void loadSocialFeed().then(value => { if (active) setItems(value); }).catch(error => { if (active) setNotice(friendlyError(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo]);
  const create = async () => {
    if (!compose.trim() || postRequest.current) return;
    if (demo) {
      const id = `local-post-${Date.now()}`;
      setItems(current => [{ id, creatorId: 'demo-current-user', creatorName: currentUserName, handle: 'curit_user', avatarUrl: '', content: compose.trim(), imageUrl: postImage, likes: 0, comments: 0, liked: false, followed: true, own: true, createdAt: new Date().toISOString() }, ...current]);
      setCommentsByPost(current => ({ ...current, [id]: [] }));
      setCompose(''); setPostImage(''); photo.clearError(); setNotice(''); return;
    }
    postRequest.current = true;
    setSavingPost(true); setPostError('');
    try { await createSocialPost(compose, postImage); setCompose(''); setPostImage(''); photo.clearError(); await load(); }
    catch (error) { setPostError(friendlyError(error)); }
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
  const loadComments = async (postId: string, before?: SocialComment) => {
    if (commentPageRequests.current.has(postId)) return;
    commentPageRequests.current.add(postId);
    setCommentErrors(current => ({ ...current, [postId]: '' }));
    setCommentsLoading(current => ({ ...current, [postId]: true }));
    try {
      const page = await loadPostComments(postId, before);
      setCommentsByPost(current => ({ ...current, [postId]: before ? [...page.comments, ...(current[postId] ?? [])] : page.comments }));
      setOlderByPost(current => ({ ...current, [postId]: page.hasOlder }));
    } catch (error) {
      setCommentErrors(current => ({ ...current, [postId]: friendlyError(error) }));
    } finally {
      commentPageRequests.current.delete(postId);
      setCommentsLoading(current => ({ ...current, [postId]: false }));
    }
  };
  const toggleComments = (item: SocialPost) => {
    if (commentFor === item.id) { setCommentFor(''); return; }
    setCommentFor(item.id);
    if (demo) {
      setCommentsByPost(current => ({ ...current, [item.id]: current[item.id] ?? [] }));
    } else if (!commentsByPost[item.id]) void loadComments(item.id);
  };
  const addComment = async (item: SocialPost) => {
    const text = (commentDrafts[item.id] || '').trim();
    if (!text || text.length > 500 || !commentsByPost[item.id] || commentRequest.current) return;
    commentRequest.current = true;
    setSavingComment(true);
    setCommentErrors(current => ({ ...current, [item.id]: '' }));
    try {
      const saved = demo
        ? { id: `local-comment-${Date.now()}`, postId: item.id, userId: 'demo-current-user', content: text, createdAt: new Date().toISOString() }
        : await addPostComment(item.id, text);
      const next: SocialComment = { ...saved, displayName: currentUserName, avatarUrl: '' };
      setCommentsByPost(current => ({ ...current, [item.id]: [...(current[item.id] ?? []), next] }));
      setItems(current => current.map(value => value.id === item.id ? { ...value, comments: value.comments + 1 } : value));
      setCommentDrafts(current => ({ ...current, [item.id]: '' }));
    } catch (error) {
      setCommentErrors(current => ({ ...current, [item.id]: friendlyError(error) }));
    } finally {
      commentRequest.current = false;
      setSavingComment(false);
    }
  };
  if (loading) return <ActivityIndicator color={colors.brand} style={f.loader} />;
  const comment = commentDrafts[commentFor] || '';
  return <View style={f.feed}>
    {notice ? <Notice text={notice} /> : null}
    {notice && !items.length ? <Button label="다시 불러오기" variant="secondary" onPress={() => { void load(); }} /> : null}
    {canPost ? <View style={f.compose}>
      <TextInput accessibilityLabel="소식 내용" value={compose} onChangeText={setCompose} placeholder="새 작품이나 전시 소식을 알려주세요" placeholderTextColor={colors.subtle} style={f.composeInput} maxLength={2000} editable={!savingPost} multiline />
      <CuritText style={f.inputCount}>{compose.length.toLocaleString('ko-KR')} / 2,000자</CuritText>
      {postError ? <Notice text={postError} /> : null}
      {postImage ? <Image source={{ uri: postImage }} style={f.postImage} /> : null}
      {photo.error ? <CuritText accessibilityRole="alert" style={f.danger}>{photo.error}</CuritText> : null}
      {postImage ? <Button label="사진 삭제" variant="ghost" disabled={savingPost || photo.checking} onPress={() => { setPostImage(''); photo.clearError(); }} /> : null}
      <View style={f.two}><View style={f.flex}><Button label={postImage ? '사진 변경' : '사진 추가'} variant="secondary" disabled={savingPost || photo.checking} onPress={() => { void photo.choose(setPostImage); }} /></View><View style={f.flex}><Button label={savingPost ? '등록 중…' : '소식 올리기'} disabled={savingPost || photo.checking || !compose.trim()} onPress={() => { void create(); }} /></View></View>
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
        <Pressable accessibilityRole="button" hitSlop={8} style={f.socialAction} accessibilityState={{ expanded: commentFor === item.id }} onPress={() => toggleComments(item)}><CuritText style={f.muted}>댓글 {demo ? (commentsByPost[item.id] ?? []).length : item.comments}</CuritText></Pressable>
      </View>
      {commentFor === item.id ? <View style={f.commentPanel}>
        {commentErrors[item.id] ? <Notice text={commentErrors[item.id] ?? ''} /> : null}
        {commentsLoading[item.id] ? <ActivityIndicator color={colors.brand} /> : olderByPost[item.id] || !commentsByPost[item.id] ? <Button label={commentsByPost[item.id] ? '이전 댓글 더 보기' : '댓글 다시 불러오기'} variant="secondary" onPress={() => { void loadComments(item.id, commentsByPost[item.id]?.[0]); }} /> : null}
        {(commentsByPost[item.id] ?? []).length ? (commentsByPost[item.id] ?? []).map(value => <View key={value.id} style={f.commentItem}>
          <View style={f.commentMeta}><CuritText weight="semibold">{value.displayName}</CuritText><CuritText style={f.hint}>{new Date(value.createdAt).toLocaleDateString('ko-KR')}</CuritText></View>
          <CuritText style={f.commentText}>{value.content}</CuritText>
        </View>) : commentsByPost[item.id] ? <CuritText style={f.emptyComment}>첫 댓글을 남겨보세요.</CuritText> : null}
        <View style={f.commentRow}>
          <TextInput accessibilityLabel="댓글 내용" value={comment} onChangeText={value => setCommentDrafts(current => ({ ...current, [item.id]: value }))} placeholder="응원 댓글을 남겨주세요" placeholderTextColor={colors.subtle} style={f.commentInput} maxLength={500} editable={!savingComment} returnKeyType="send" onSubmitEditing={() => { void addComment(item); }} />
          <Pressable accessibilityRole="button" accessibilityLabel="댓글 등록" disabled={savingComment || !comment.trim() || !commentsByPost[item.id]} style={f.commentSubmit} onPress={() => { void addComment(item); }}><CuritText weight="semibold" style={!comment.trim() ? f.muted : f.brand}>등록</CuritText></Pressable>
        </View>
        <CuritText style={f.inputCount}>{comment.length} / 500자</CuritText>
      </View> : null}
    </View>) : <Empty title="등록된 소식이 없습니다" description="크리에이터의 새 작품과 전시 소식이 여기에 표시됩니다." />}
  </View>;
}

function StepBars({ labels, current }: { labels: string[]; current: number }) { return <View style={f.stepBars}>{labels.map((label, index) => <View key={label} style={f.flex}><View style={[f.stepLine, index + 1 <= current && f.stepLineActive]} /><CuritText style={index + 1 === current ? f.brand : f.muted}>{label}</CuritText></View>)}</View>; }
function ChoiceCard({ title, options, selected, onToggle, disabled = false }: { title: string; options: string[]; selected: string[]; onToggle: (value: string) => void; disabled?: boolean }) { return <View style={f.choiceCard}><CuritText weight="semibold">{title}</CuritText><View style={f.wrap}>{options.map(value => <Chip key={value} label={value} active={selected.includes(value)} onPress={disabled ? undefined : () => onToggle(value)} />)}</View></View>; }
function Notice({ text }: { text: string }) { return <View style={f.notice}><CuritText style={text.includes('못') || text.includes('확인') ? f.danger : f.brand}>{text}</CuritText></View>; }
function InfoRow({ label, value }: { label: string; value: string }) {
  const multiline = value.length > 22;
  return <View style={[f.infoRow, multiline && f.infoRowMultiline]}><CuritText style={f.muted}>{label}</CuritText><CuritText weight="semibold" style={[f.infoValue, multiline && f.infoValueMultiline]}>{value || '-'}</CuritText></View>;
}

const f = StyleSheet.create({
  inputCount: { alignSelf: 'flex-end', color: colors.muted, fontSize: 12 },
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
  qrLinks: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, gap: 10 },
  qrDanger: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 8 },
  qrStopAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  readinessCheck: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  readinessBox: { width: 20, height: 20, borderWidth: 1, borderColor: colors.brand, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  readinessBoxChecked: { backgroundColor: colors.brand },
  readinessTick: { color: colors.surface, fontSize: 14, lineHeight: 18 },
  feed: { gap: 14 }, compose: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, gap: 10 }, composeInput: { height: 104, fontFamily: fonts.regular, color: colors.ink, textAlignVertical: 'top' }, post: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, gap: 12 }, avatarSmall: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, postImage: { width: '100%', height: 220, borderRadius: radius.sm }, socialActions: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }, socialAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, commentPanel: { gap: 10, paddingTop: 4 }, commentItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 4 }, commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 }, commentText: { color: colors.ink, fontSize: 13, lineHeight: 19 }, emptyComment: { color: colors.muted, fontSize: 12, paddingVertical: 8 }, commentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, commentInput: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 22, paddingHorizontal: 14, fontFamily: fonts.regular, color: colors.ink }, commentSubmit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
