import * as Notifications from 'expo-notifications';
import { registerNativePush } from './pushNotifications';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Button, Chip, CuritText, Empty, Field, Header, Icon, SectionTitle } from './ui';
import { colors, fonts, radius } from './theme';
import { images, projects, stores } from './data';
import { loadCollaborations, loadMatchRecommendations } from './curation';
import { friendlyError, issueQrListing, loadManagedOrders, loadManagedQrProducts, loadSettlements, type ManagedOrder, type SettlementEntry } from './platform';
import type { CollaborationSummary, MatchRecommendation, QrProduct, Role } from './types';
import { demoCollaborationList } from './demoContent';
import { loadFieldSaleProducts } from './fieldSaleCatalog';
import { loadWithDeadline } from './asyncRequest';

const money = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const demoSettlements: SettlementEntry[] = [
  { id: 'demo-settlement', orderId: 'QR-DEMO-20261030', collaborationId: 'demo', grossAmount: 35000, creatorAmount: 28000, storeAmount: 3500, platformAmount: 3500, status: 'scheduled', scheduledFor: '2026-11-13', createdAt: '2026-10-30T06:00:00Z' },
  { id: 'demo-settlement-paid', orderId: 'QR-DEMO-20261018', collaborationId: 'demo', grossAmount: 18000, creatorAmount: 14400, storeAmount: 1800, platformAmount: 1800, status: 'paid', scheduledFor: '2026-10-25', createdAt: '2026-10-18T05:10:00Z' },
];

function pendingSettlementTotal(entries: SettlementEntry[], role: Role) {
  return entries.reduce((total, entry) => {
    if (entry.status !== 'scheduled' && entry.status !== 'ready') return total;
    return total + (role === 'creator' ? entry.creatorAmount : entry.storeAmount);
  }, 0);
}

async function fetchQrCatalog(demo?: boolean) {
  const [fieldResult, managedResult] = await Promise.allSettled([
    loadFieldSaleProducts(),
    demo ? Promise.resolve([] as QrProduct[]) : loadManagedQrProducts(),
  ]);
  if (fieldResult.status === 'rejected' && managedResult.status === 'rejected') {
    throw new Error('QR 상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
  const field = fieldResult.status === 'fulfilled' ? fieldResult.value : { items: [], warning: '현장 QR 상품 정보를 불러오지 못했습니다.' };
  const managed = managedResult.status === 'fulfilled' ? managedResult.value : [];
  const realManagedItems = managed.filter(item => !item.token.startsWith('demo-'));
  const warning = [field.warning, managedResult.status === 'rejected' ? '협업 QR 정보를 불러오지 못했습니다.' : ''].filter(Boolean).join(' ');
  return { items: [...field.items, ...realManagedItems], warning };
}

export function LoginScreen({ onLogin, onSignUp, onDemo, onResetPassword, demoEnabled, configured, recovery }: {
  onLogin: (email: string, password: string) => Promise<void>;
  onSignUp?: () => void;
  onDemo?: (role: Role) => void;
  onResetPassword: (email: string) => Promise<void>;
  demoEnabled?: boolean;
  configured: boolean;
  recovery?: { email: string; onExit: () => Promise<void> };
}) {
  const [enteredEmail, setEmail] = useState('');
  const email = recovery?.email ?? enteredEmail;
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!email.trim() || password.length < 8 || busy) return;
    setBusy(true); setError('');
    try { await onLogin(email, password); } catch (caught) { setError(caught instanceof Error ? caught.message : '로그인하지 못했습니다.'); } finally { setBusy(false); }
  };
  const resetPassword = async () => {
    if (!email.trim() || busy) { setError('가입한 이메일을 먼저 입력해 주세요.'); return; }
    setBusy(true); setError('');
    try { await onResetPassword(email); setError('비밀번호 재설정 메일을 보냈습니다.'); } catch (caught) { setError(caught instanceof Error ? caught.message : '재설정 메일을 보내지 못했습니다.'); } finally { setBusy(false); }
  };
  const discardDraft = async () => {
    if (!recovery || busy) return;
    setBusy(true);
    try { await recovery.onExit(); } catch (caught) {
      setError(caught instanceof Error ? caught.message : '로그아웃하지 못했습니다.');
    } finally { setBusy(false); }
  };
  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={s.auth} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
      <CuritText weight="extrabold" style={s.logo}>CURI:T</CuritText>
      <View style={s.loginIntro}><CuritText weight="extrabold" style={s.loginTitle}>{recovery ? '다시 로그인해 주세요.' : '다시 만나 반가워요.'}</CuritText><CuritText style={s.logoCaption}>{recovery ? '같은 계정으로 로그인하면 작성 중이던 화면으로 돌아갈 수 있어요.' : '작품과 공간을 이어가는 나의 자리.'}</CuritText></View>
      <View style={s.form}>
        {recovery ? <View style={s.recoveryAccount}>
          <CuritText weight="semibold" style={s.recoveryLabel}>이전 계정</CuritText>
          <CuritText selectable textBreakStrategy="simple" style={s.recoveryEmail}>{email}</CuritText>
        </View> : <Field label="이메일 *" value={email} onChangeText={setEmail} placeholder="이메일 주소" autoCapitalize="none" keyboardType="email-address" />}
        <Field label="비밀번호 *" value={password} onChangeText={setPassword} placeholder="비밀번호" secureTextEntry />
        <View style={[s.loginOptions, { justifyContent: 'flex-end' }]}>
          <Pressable accessibilityRole="button" hitSlop={8} style={s.authTextAction} onPress={() => { void resetPassword(); }}><CuritText style={s.muted}>비밀번호 재설정</CuritText></Pressable>
        </View>
        {error ? <CuritText style={{ color: colors.danger }}>{error}</CuritText> : null}
        {!configured ? <CuritText style={s.demoNote}>지금은 로그인 서비스에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.</CuritText> : null}
        <Button label={busy ? '처리 중…' : recovery ? '로그인하고 이어서 작성' : '로그인'} disabled={!configured || !email.trim() || password.length < 8 || busy} onPress={() => { void submit(); }} />
        {recovery ? <Button label="작성 내용 지우고 로그아웃" variant="secondary" disabled={busy} onPress={() => { void discardDraft(); }} /> : null}
      </View>
      {onSignUp ? <View style={s.signUpRow}><CuritText style={s.muted}>CURI:T이 처음인가요?</CuritText><Pressable accessibilityRole="button" hitSlop={8} style={s.authTextAction} onPress={onSignUp}><CuritText weight="semibold" style={s.brandText}>회원가입</CuritText></Pressable></View> : null}
      {demoEnabled && onDemo ? <View style={s.demoBox}>
        <CuritText weight="semibold">서비스 둘러보기</CuritText>
        <CuritText style={s.demoNote}>가입 전에 역할별 주요 화면과 이용 흐름을 확인할 수 있어요.</CuritText>
        <View style={s.twoButtons}><View style={s.flex}><Button label="크리에이터" variant="secondary" onPress={() => onDemo('creator')} /></View><View style={s.flex}><Button label="매장 운영자" onPress={() => onDemo('store')} /></View></View>
      </View> : null}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AccountSignupScreen({ role, onBack, onSubmit }: { role: Role; onBack: () => void; onSubmit: (email: string, password: string, displayName: string) => Promise<void> }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const valid = displayName.trim() && /.+@.+\..+/.test(email) && password.length >= 8 && password === passwordConfirm;
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true); setNotice('');
    try { await onSubmit(email, password, displayName); } catch (caught) { setNotice(caught instanceof Error ? caught.message : '가입하지 못했습니다.'); } finally { setBusy(false); }
  };
  return <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Header title="회원가입" subtitle={role === 'creator' ? '크리에이터' : '매장 운영자'} back={onBack} /><ScrollView contentContainerStyle={s.accountSignup} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled"><View><CuritText weight="bold" style={s.pageTitle}>계정을 만들어 주세요</CuritText><CuritText style={s.pageDescription}>이메일 인증 후 모든 기기에서 같은 프로젝트와 이미지를 사용할 수 있어요.</CuritText></View><Field label={role === 'creator' ? '활동명 *' : '담당자명 *'} value={displayName} onChangeText={setDisplayName} placeholder={role === 'creator' ? '예: 김서연 도예' : '예: 최선문'} /><Field label="이메일 *" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" /><Field label="비밀번호 *" value={password} onChangeText={setPassword} secureTextEntry placeholder="8자 이상" /><Field label="비밀번호 확인 *" value={passwordConfirm} onChangeText={setPasswordConfirm} secureTextEntry placeholder="한 번 더 입력" />{passwordConfirm && password !== passwordConfirm ? <CuritText style={{ color: colors.danger }}>비밀번호가 일치하지 않습니다.</CuritText> : null}{notice ? <CuritText style={{ color: colors.danger }}>{notice}</CuritText> : null}<Button label={busy ? '계정 생성 중…' : role === 'store' ? '계정 생성 후 매장 등록' : '크리에이터로 시작'} disabled={!valid || busy} onPress={() => { void submit(); }} /></ScrollView></KeyboardAvoidingView>;
}

export function EmailConfirmationScreen({ email, onLogin, onResend }: { email: string; onLogin: () => void; onResend: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const resend = async () => {
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      await onResend();
      setNotice('새 인증 메일을 보냈습니다. 가장 최근 메일의 링크를 열어 주세요.');
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : '인증 메일을 다시 보내지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };
  return <View style={s.flex}><Header title="이메일 인증" /><View style={s.confirmationBody}><View style={s.roleIcon}><Icon name="chat" color={colors.brand} /></View><CuritText weight="bold" style={s.pageTitle}>인증 메일을 확인해 주세요</CuritText><CuritText style={s.pageDescription}>{email} 주소로 인증 링크를 보냈습니다. 가장 최근 메일의 링크를 열면 CURI:T 앱으로 돌아와 인증이 완료됩니다.</CuritText>{notice ? <CuritText style={{ color: notice.startsWith('새 인증') ? colors.brand : colors.danger }}>{notice}</CuritText> : null}<Button label={busy ? '보내는 중…' : '인증 메일 다시 보내기'} disabled={busy} onPress={() => { void resend(); }} /><Button label="로그인으로 돌아가기" variant="secondary" onPress={onLogin} /></View></View>;
}

export function RoleSelectionScreen({ onSelect, onBack }: { onSelect: (role: Role) => void; onBack: () => void }) {
  return (
    <View style={s.flex}>
      <Header title="가입 유형 선택" back={onBack} />
      <View style={s.roleBody}>
        <View><CuritText weight="bold" style={s.pageTitle}>어떤 역할로 시작할까요?</CuritText><CuritText style={s.pageDescription}>가입 후에도 상대 역할의 프로젝트와 공간을 둘러볼 수 있어요.</CuritText></View>
        <Pressable accessibilityRole="button" style={s.roleCard} onPress={() => onSelect('creator')}><View style={s.roleIcon}><Icon name="heart" color={colors.brand} /></View><View style={s.flex}><CuritText weight="bold" style={s.cardTitle}>크리에이터</CuritText><CuritText style={s.muted}>작품·굿즈를 등록하고 매장과 협업해요</CuritText></View><Icon name="chevron" color={colors.muted} /></Pressable>
        <Pressable accessibilityRole="button" style={s.roleCard} onPress={() => onSelect('store')}><View style={s.roleIcon}><Icon name="store" color={colors.brand} /></View><View style={s.flex}><CuritText weight="bold" style={s.cardTitle}>매장 운영자</CuritText><CuritText style={s.muted}>공간을 등록하고 어울리는 작품을 찾아요</CuritText></View><Icon name="chevron" color={colors.muted} /></Pressable>
      </View>
    </View>
  );
}

function useCommerceSummary(role: Role, demo?: boolean) {
  const [summary, setSummary] = useState({ qrViews: demo ? 203 : 0, salesCount: demo ? 8 : 0, expectedSettlement: demo ? pendingSettlementTotal(demoSettlements, role) : 0, loading: !demo, failed: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (demo) return;
    let active = true;
    const controller = new AbortController();
    void loadWithDeadline(signal => Promise.all([loadSettlements(signal), loadManagedQrProducts(signal)]), controller)
      .then(([entries, qrProducts]) => {
        if (!active) return;
        const eligible = entries.filter(entry => entry.status !== 'cancelled' && entry.status !== 'held');
        setSummary({
          qrViews: qrProducts.reduce((sum, item) => sum + (item.viewCount || 0), 0),
          salesCount: new Set(eligible.map(entry => entry.orderId)).size,
          expectedSettlement: pendingSettlementTotal(entries, role),
          loading: false,
          failed: false,
        });
      })
      .catch(() => {
        if (active) setSummary(current => ({ ...current, loading: false, failed: true }));
      });
    return () => { active = false; controller.abort(); };
  }, [demo, role, attempt]);
  return { ...summary, reload: () => { setSummary(current => ({ ...current, loading: true, failed: false })); setAttempt(value => value + 1); } };
}

type HomeProps = {
  displayName: string;
  demo?: boolean;
  onOpenPreferences: () => void;
  onOpenRecommendation: (item: MatchRecommendation) => void;
  onOpenCollaboration: (item: CollaborationSummary) => void;
};

export function HomeScreen({ role, ...props }: HomeProps & { role: Role }) {
  return role === 'creator' ? <CreatorHome {...props} /> : <StoreHome {...props} />;
}

function useRecommendations(role: Role, demo?: boolean) {
  const [items, setItems] = useState<MatchRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void loadWithDeadline(signal => loadMatchRecommendations(role, demo, '', signal), controller)
      .then(value => { if (active) setItems(value); })
      .catch(caught => { if (active) setError(friendlyError(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [demo, role, attempt]);
  return { items, loading, error, reload: () => { setError(''); setLoading(true); setAttempt(value => value + 1); } };
}

function useCollaborationList(role: Role, demo?: boolean) {
  const fallback: CollaborationSummary[] = demo ? demoCollaborationList(role) : [];
  const [items, setItems] = useState<CollaborationSummary[]>(fallback);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (demo) return;
    let active = true;
    const controller = new AbortController();
    void loadWithDeadline(signal => loadCollaborations(role, undefined, signal), controller)
      .then(value => { if (active) setItems(value); })
      .catch(caught => { if (active) setError(friendlyError(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [demo, role, attempt]);
  return { items, loading, error, reload: () => { setError(''); setLoading(true); setAttempt(value => value + 1); } };
}

function LoadFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={s.errorBox}><CuritText accessibilityRole="alert" style={{ color: colors.danger }}>{message}</CuritText><Button label="다시 불러오기" variant="secondary" onPress={onRetry} /></View>;
}

function CreatorHome({ displayName, demo, onOpenPreferences, onOpenRecommendation, onOpenCollaboration }: HomeProps) {
  const recommended = useRecommendations('creator', demo);
  const collaborations = useCollaborationList('creator', demo);
  const current = collaborations.loading || collaborations.error ? undefined : collaborations.items.find(item => !['completed', 'cancelled'].includes(item.status));
  const error = recommended.error || collaborations.error;
  const items = demo
    ? stores.map((store, index) => ({
      targetId: `demo-space-${index}`,
      targetType: 'store' as const,
      reasons: [store.mood],
      title: store.name,
      subtitle: `${index === 1 ? '서점' : '카페'} · 서울`,
      description: store.mood,
      score: store.match,
      image: store.image,
      tags: index === 1 ? ['계산대 옆 진열대', '북 큐레이션 테이블'] : ['창가 우드 선반', '입구 벽면'],
    }))
    : recommended.items.map(item => ({ ...item, image: item.imageUrl ? { uri: item.imageUrl } : undefined }));
  return (
    <ScrollView contentContainerStyle={s.curationScroll} showsVerticalScrollIndicator={false}>
      <CuritText style={s.eyebrow}>CURI:T</CuritText>
      <View style={s.curationHero}>
        <View style={s.flex}><CuritText style={s.curationPrelude}>{displayName} 님의 다음 장면</CuritText><CuritText weight="bold" style={s.curationTitle}>내 작품을 위한{`\n`}오늘의 큐레이션</CuritText></View>
        <Pressable accessibilityRole="button" accessibilityLabel="나의 작품 DNA 설정" style={s.preferenceLink} onPress={onOpenPreferences}><CuritText weight="semibold" style={s.preferenceLinkText}>작품 DNA 설정</CuritText><Icon name="chevron" size={13} color={colors.brand} /></Pressable>
      </View>
      {error ? <LoadFailure message={error} onRetry={() => { recommended.reload(); collaborations.reload(); }} /> : null}
      <View style={s.curationSectionTop}><CuritText weight="semibold" style={s.curationSectionTitle}>내 작품과 어울리는 공간</CuritText></View>
      {recommended.loading && !demo ? <ActivityIndicator color={colors.brand} style={{ marginVertical: 40 }} /> : null}
      {!recommended.error && (demo || !recommended.loading) ? <View style={s.curationGrid}>{items.slice(0, 4).map((item, index) => <CurationTile key={item.targetId} index={index} title={item.title} subtitle={item.subtitle} description={item.description} score={item.score} image={item.image} role="space" onPress={() => onOpenRecommendation(item)} />)}</View> : null}
      {!recommended.loading && !recommended.error && !items.length ? <Empty title="추천할 공간을 찾고 있어요" description="작품 DNA와 활동 지역을 저장하면 맞는 매장을 비교해 드립니다." /> : null}
      {current ? <Pressable accessibilityRole="button" accessibilityLabel="진행 중인 협업 상세 열기" style={s.compactCollaboration} onPress={() => onOpenCollaboration(current)}><View style={s.flex}><CuritText style={s.gridMeta}>진행 중인 협업</CuritText><CuritText weight="semibold">{current.projectTitle} · {current.storeName}</CuritText></View><Icon name="chevron" color={colors.subtle} /></Pressable> : null}
    </ScrollView>
  );
}

function StoreHome({ displayName, demo, onOpenPreferences, onOpenRecommendation, onOpenCollaboration }: HomeProps) {
  const summary = useCommerceSummary('store', demo);
  const recommended = useRecommendations('store', demo);
  const collaborations = useCollaborationList('store', demo);
  const current = collaborations.loading || collaborations.error ? undefined : collaborations.items.find(item => !['completed', 'cancelled'].includes(item.status));
  const error = recommended.error || collaborations.error || (summary.failed ? '판매·정산 정보를 불러오지 못했어요. 다시 시도해 주세요.' : '');
  const items = demo
    ? projects.map((project, index) => ({ targetId: project.id, targetType: 'project' as const, reasons: project.tags, tags: project.tags, title: project.title, subtitle: `${project.artist} 작가`, description: project.priceRange, score: project.match ?? Math.max(79, 88 - index * 2), image: project.image }))
    : recommended.items.map(item => ({ ...item, image: item.imageUrl ? { uri: item.imageUrl } : undefined }));
  return (
    <ScrollView contentContainerStyle={s.curationScroll} showsVerticalScrollIndicator={false}>
      <CuritText style={s.eyebrow}>CURI:T</CuritText>
      <View style={s.curationHero}>
        <View style={s.flex}><CuritText weight="bold" style={s.curationTitle}>{displayName}을 위한{`\n`}오늘의 큐레이션</CuritText></View>
        <Pressable accessibilityRole="button" accessibilityLabel="공간 취향과 전시 구역 설정" style={s.preferenceLink} onPress={onOpenPreferences}><CuritText weight="semibold" style={s.preferenceLinkText}>공간 설정</CuritText><Icon name="chevron" size={13} color={colors.brand} /></Pressable>
      </View>
      {error ? <LoadFailure message={error} onRetry={() => { recommended.reload(); collaborations.reload(); summary.reload(); }} /> : null}
      <View style={s.curationSectionTop}><View><CuritText style={s.curationPrelude}>공간의 취향을, 작품으로</CuritText><CuritText weight="semibold" style={s.curationSectionTitle}>현재 공간 추천 작품</CuritText></View></View>
      <CuritText style={[s.dnaHint, { marginBottom: 18 }]}>등록한 공간 정보와 공개된 작품 조건을 비교해 추천해요.</CuritText>
      {recommended.loading && !demo ? <ActivityIndicator color={colors.brand} style={{ marginVertical: 40 }} /> : null}
      {!recommended.error && (demo || !recommended.loading) ? <View style={s.curationGrid}>{items.slice(0, 4).map((item, index) => <CurationTile key={item.targetId} index={index} title={item.title} subtitle={item.subtitle} description={item.description} score={item.score} image={item.image} role="art" onPress={() => onOpenRecommendation(item)} />)}</View> : null}
      {!recommended.loading && !recommended.error && !items.length ? <Empty title="추천할 작품을 찾고 있어요" description="공간 취향과 예산을 저장하면 전시 가능한 작품을 비교해 드립니다." /> : null}
      {current ? <Pressable accessibilityRole="button" accessibilityLabel="현재 협업 상세 열기" style={s.compactCollaboration} onPress={() => onOpenCollaboration(current)}><View style={s.flex}><CuritText style={s.gridMeta}>현재 협업 · {collaborationStatusLabel(current.status)}</CuritText><CuritText weight="semibold">{current.projectTitle} · {current.creatorName}</CuritText><CuritText style={s.gridMeta}>{summary.loading ? '성과 집계 중' : summary.failed ? '성과 정보를 확인할 수 없어요' : `QR ${summary.qrViews}회 · ${summary.salesCount}건 판매`}</CuritText></View><Icon name="chevron" color={colors.subtle} /></Pressable> : null}
    </ScrollView>
  );
}

function CurationTile({ index, title, subtitle, description, score, image, role, onPress }: { index: number; title: string; subtitle: string; description: string; score: number; image?: number | { uri: string }; role: 'space' | 'art'; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title} 추천 상세 열기`} style={s.curationTile} onPress={onPress}><View style={s.curationImageWrap}>{image ? <Image source={image} style={s.curationImage} contentFit="cover" /> : <View style={[s.curationImage, s.imagePlaceholder]}><Icon name={role === 'art' ? 'discover' : 'store'} color={colors.brand} /><CuritText style={s.muted}>{role === 'space' ? '매장 사진 없음' : '이미지 준비 중'}</CuritText></View>}<View style={s.rankBadge}><CuritText style={s.rankText}>{String(index + 1).padStart(2, '0')}</CuritText></View>{role === 'art' ? <View style={s.scoreBadge}><CuritText weight="semibold" style={s.scoreText}>조건 일치 {score}점</CuritText></View> : null}</View><CuritText style={s.tileEyebrow} numberOfLines={1}>{subtitle}</CuritText><CuritText weight="semibold" style={s.tileTitle} numberOfLines={1}>{title}</CuritText><CuritText style={s.tileDescription} numberOfLines={2}>{description}</CuritText></Pressable>;
}

function collaborationStatusLabel(status: CollaborationSummary['status']) {
  if (status === 'active') return '전시·판매 중';
  if (status === 'approved') return '최종 확인';
  if (status === 'negotiating') return '조건 조율 중';
  if (status === 'proposed') return '승인 대기';
  return status === 'completed' ? '완료' : '취소';
}

function Metric({ value, label }: { value: string; label: string }) { return <View style={s.metric}><CuritText weight="bold" style={s.metricValue}>{value}</CuritText><CuritText style={s.metricLabel}>{label}</CuritText></View>; }

function StoreCard({ name, area, mood, image, match }: (typeof stores)[number]) {
  return <Pressable style={s.gridCard}><Image source={image} style={s.gridImage} contentFit="cover" /><View style={s.gridBody}><CuritText weight="semibold" numberOfLines={1}>{name}</CuritText><CuritText style={s.gridMeta}>{area} · {mood}</CuritText><View style={s.matchBadge}><CuritText weight="semibold" style={s.matchText}>{match}% 적합</CuritText></View></View></Pressable>;
}

export function DiscoverScreen({ role }: { role: Role }) {
  const [filter, setFilter] = useState('전체');
  const [dnaOpen, setDnaOpen] = useState(false);
  return (
    <View style={s.flex}>
      <Header title={role === 'creator' ? '매장 탐색' : '전시 탐색'} />
      <ScrollView contentContainerStyle={s.scroll}>
        <Field placeholder={role === 'creator' ? '매장명, 지역, 분위기 검색' : '작가명, 작품명, 태그 검색'} />
        {role === 'creator' ? <>
          <View style={s.exploreTabs}><CuritText weight="semibold" style={s.exploreTabActive}>매장</CuritText><CuritText style={s.exploreTab}>작품 · 작가</CuritText><CuritText style={s.exploreTab}>소식</CuritText></View>
          <View style={s.dnaFilter}>
            <Pressable style={s.dnaFilterHeader} onPress={() => setDnaOpen(value => !value)}>
              <CuritText weight="semibold">공간 DNA 필터</CuritText>
              <View style={s.dnaFilterSummary}><CuritText numberOfLines={1} style={s.dnaSummaryText}>{filter === '전체' ? '전체 조건' : filter}</CuritText><View style={{ transform: [{ rotate: dnaOpen ? '-90deg' : '90deg' }] }}><Icon name="chevron" size={17} color={colors.brand} /></View></View>
            </Pressable>
            {dnaOpen ? <View style={s.dnaFilterBody}><CuritText style={s.dnaFilterLabel}>협업 상태</CuritText><View style={s.dnaChips}>{['전체', '모집 중', '전시·판매 중', '매칭 완료'].map(value => <Chip key={value} label={value} active={filter === value} onPress={() => setFilter(value)} />)}</View></View> : null}
          </View>
        </> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{['전체', '모집 중', '전시·판매 중', '매칭 완료'].map(value => <Chip key={value} label={value} active={filter === value} onPress={() => setFilter(value)} />)}</ScrollView>}
        {role === 'creator' ? <View style={s.grid}>{stores.map(store => <StoreCard key={store.name} {...store} />)}</View> : <View style={s.discoverList}>{projects.map(item => <ProjectTile key={item.id} item={item} />)}</View>}
      </ScrollView>
    </View>
  );
}

function ProjectTile({ item }: { item: (typeof projects)[number] }) {
  return <Pressable style={s.projectTile}><Image source={item.image} style={s.tileImage} contentFit="cover" /><View style={s.tileBody}><View style={s.row}><Chip label={item.status} /><Icon name="heart" size={18} color={colors.muted} /></View><CuritText weight="bold" style={s.cardTitle}>{item.title}</CuritText><CuritText style={s.muted}>{item.artist} · {item.region} · {item.priceRange}</CuritText><View style={s.tagRow}>{item.tags.map(tag => <CuritText key={tag} style={s.tag}>#{tag}</CuritText>)}</View></View></Pressable>;
}

export function ChatScreen() {
  const chats = [{ name: '김서연', project: '흙의 기억', message: '교체 일정은 목요일 오후가 가능합니다.', time: '오전 11:23' }, { name: '박수아', project: '고요한 초록', message: '매장 사진을 확인했어요. 감사합니다!', time: '어제' }];
  return <View style={s.flex}><Header title="협업 메시지" /><View style={s.searchPad}><Field placeholder="대화 검색" /></View>{chats.map(chat => <Pressable key={chat.name} style={s.chatRow}><View style={s.avatar}><CuritText weight="bold">{chat.name[0]}</CuritText></View><View style={s.flex}><View style={s.row}><CuritText weight="semibold">{chat.name}</CuritText><CuritText style={s.chatTime}>{chat.time}</CuritText></View><CuritText style={s.chatProject}>{chat.project}</CuritText><CuritText style={s.muted} numberOfLines={1}>{chat.message}</CuritText></View></Pressable>)}</View>;
}

export function ManagementScreen({ role, demo, onOpenQr, onOpenPickup, onOpenSettlements, onOpenCollaboration }: { role: Role; demo?: boolean; onOpenQr: () => void; onOpenPickup: () => void; onOpenSettlements: () => void; onOpenCollaboration: (item: CollaborationSummary) => void }) {
  return role === 'creator'
    ? <CreatorManagement demo={demo} onOpenSettlements={onOpenSettlements} onOpenCollaboration={onOpenCollaboration} />
    : <StoreManagement demo={demo} onOpenQr={onOpenQr} onOpenPickup={onOpenPickup} onOpenSettlements={onOpenSettlements} onOpenCollaboration={onOpenCollaboration} />;
}

function CreatorManagement({ demo, onOpenSettlements, onOpenCollaboration }: { demo?: boolean; onOpenSettlements: () => void; onOpenCollaboration: (item: CollaborationSummary) => void }) {
  const summary = useCommerceSummary('creator', demo);
  const collaborations = useCollaborationList('creator', demo);
  const active = collaborations.items.filter(item => !['completed', 'cancelled'].includes(item.status));
  const proposalCount = collaborations.items.filter(item => ['proposed', 'negotiating'].includes(item.status)).length;
  const readyCount = collaborations.items.filter(item => item.status === 'approved').length;
  const exhibitionCount = collaborations.items.filter(item => item.status === 'active').length;
  const loadError = collaborations.error || (summary.failed ? '판매·정산 정보를 불러오지 못했어요. 다시 시도해 주세요.' : '');
  return <View style={s.flex}><Header title="협업 관리" /><ScrollView contentContainerStyle={s.scroll}>
    <View style={s.metricsBox}><Metric value={collaborations.loading || collaborations.error ? '—' : String(proposalCount)} label="제안 대기" /><Metric value={collaborations.loading || collaborations.error ? '—' : String(readyCount)} label="출고 준비" /><Metric value={collaborations.loading || collaborations.error ? '—' : String(exhibitionCount)} label="전시 중" /></View>
    {loadError ? <LoadFailure message={loadError} onRetry={() => { collaborations.reload(); summary.reload(); }} /> : null}
    <View style={s.quickGrid}><QuickAction icon="management" label="판매·정산" description={summary.loading || summary.failed ? '정산 내역 확인' : `${money(summary.expectedSettlement)} 정산 예정`} onPress={onOpenSettlements} /></View>
    <SectionTitle title="협업 제안 및 전시" />{collaborations.loading ? <ActivityIndicator accessibilityLabel="협업 정보를 불러오고 있어요" color={colors.brand} style={{ marginVertical: 24 }} /> : collaborations.error ? null : active.length ? active.map(item => <CollaborationCard key={item.id} item={item} role="creator" onPress={() => onOpenCollaboration(item)} />) : <Empty title="진행 중인 협업이 없습니다" description="AI 큐레이터의 추천에서 매장에 협업을 제안해 보세요." />}
  </ScrollView></View>;
}

function StoreManagement({ demo, onOpenQr, onOpenPickup, onOpenSettlements, onOpenCollaboration }: { demo?: boolean; onOpenQr: () => void; onOpenPickup: () => void; onOpenSettlements: () => void; onOpenCollaboration: (item: CollaborationSummary) => void }) {
  const summary = useCommerceSummary('store', demo);
  const collaborations = useCollaborationList('store', demo);
  const active = collaborations.items.filter(item => !['completed', 'cancelled'].includes(item.status));
  const proposalCount = collaborations.items.filter(item => ['proposed', 'negotiating'].includes(item.status)).length;
  const readyCount = collaborations.items.filter(item => item.status === 'approved').length;
  const exhibitionCount = collaborations.items.filter(item => item.status === 'active').length;
  const loadError = collaborations.error || (summary.failed ? '판매·정산 정보를 불러오지 못했어요. 다시 시도해 주세요.' : '');
  return <View style={s.flex}><Header title="매장 관리" /><ScrollView contentContainerStyle={s.scroll}>
    <View style={s.metricsBox}><Metric value={collaborations.loading || collaborations.error ? '—' : String(proposalCount)} label="제안 확인" /><Metric value={collaborations.loading || collaborations.error ? '—' : String(readyCount)} label="전시 준비" /><Metric value={collaborations.loading || collaborations.error ? '—' : String(exhibitionCount)} label="전시 중" /></View>
    <View style={s.commerceStrip}><Metric value={summary.loading || summary.failed ? '—' : String(summary.qrViews)} label="QR 조회" /><Metric value={summary.loading || summary.failed ? '—' : `${summary.salesCount}건`} label="누적 판매" /><Metric value={summary.loading || summary.failed ? '—' : money(summary.expectedSettlement)} label="정산 예정" /></View>
    {loadError ? <LoadFailure message={loadError} onRetry={() => { collaborations.reload(); summary.reload(); }} /> : null}
    <View style={s.quickGrid}><QuickAction icon="qr" label="QR 상품 관리" description="가격·수량·판매 상태" onPress={onOpenQr} /><QuickAction icon="store" label="수령 관리" description="예약·즉시 수령 전달" onPress={onOpenPickup} /><QuickAction icon="management" label="판매·정산" description="주문·정산 내역" onPress={onOpenSettlements} /></View><SectionTitle title="협업·전시 현황" />{collaborations.loading ? <ActivityIndicator accessibilityLabel="협업 정보를 불러오고 있어요" color={colors.brand} style={{ marginVertical: 24 }} /> : collaborations.error ? null : active.length ? active.map(item => <CollaborationCard key={item.id} item={item} role="store" onPress={() => onOpenCollaboration(item)} />) : <Empty title="진행 중인 전시가 없습니다" description="AI 추천에서 작품을 선택해 협업 제안을 보내보세요." />}
  </ScrollView></View>;
}

function CollaborationCard({ item, role, onPress }: { item: CollaborationSummary; role: Role; onPress: () => void }) {
  const labels: Record<CollaborationSummary['status'], string> = { proposed: '승인 대기', negotiating: '조건 조율 중', approved: '최종 확인 필요', active: '전시·판매 중', completed: '완료', cancelled: '취소' };
  const project = projects.find(value => value.id === item.projectId || value.title === item.projectTitle);
  const store = stores.find(value => value.name === item.storeName);
  const image = role === 'store' ? (project?.image ?? images.pottery) : (store?.image ?? images.cafe);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${item.projectTitle} 협업 상세 열기`} style={s.collabCard} onPress={onPress}><Image source={image} style={s.collabImage} contentFit="cover" /><View style={s.flex}><View style={s.row}><CuritText weight="bold" style={s.flex} numberOfLines={1}>{item.projectTitle}</CuritText><View style={s.compactStatus}><View style={s.compactStatusDot} /><CuritText style={s.compactStatusText}>{labels[item.status]}</CuritText></View></View><CuritText style={s.muted}>{item.counterpartName}{item.endsOn ? ` · 종료 ${item.endsOn}` : ''}</CuritText><CuritText style={s.gridMeta}>작가 {item.creatorShare}% · 매장 {item.storeShare}% · 플랫폼 {item.platformShare}%</CuritText></View></Pressable>;
}

function QuickAction({ icon, label, description, onPress }: { icon: 'qr' | 'management' | 'chat' | 'store' | 'discover'; label: string; description: string; onPress?: () => void }) { return <Pressable accessibilityRole="button" style={s.quickAction} onPress={onPress}><View style={s.quickIcon}><Icon name={icon} color={colors.brand} /></View><CuritText weight="semibold">{label}</CuritText><CuritText style={s.gridMeta}>{description}</CuritText></Pressable>; }

type SettlementFilter = '전체' | '정산 대기' | '정산 완료' | '보류·취소';

function settlementScheduleLabel(entry: SettlementEntry) {
  if (entry.status === 'paid') return entry.scheduledFor ? `${entry.scheduledFor} 지급 완료` : '지급 완료';
  if (entry.status === 'held') return '정산 보류';
  if (entry.status === 'cancelled') return '정산 취소';
  return entry.scheduledFor ? `${entry.scheduledFor} 정산 예정` : '정산일 확인 중';
}

export function SettlementScreen({ role, demo, onBack, onOpenCollaboration, onOpenPickup }: { role: Role; demo?: boolean; onBack: () => void; onOpenCollaboration?: (id: string) => void; onOpenPickup?: () => void }) {
  const [entries, setEntries] = useState<SettlementEntry[]>(demo ? demoSettlements : []);
  const [sales, setSales] = useState<{ orders: ManagedOrder[]; collaborations: CollaborationSummary[] } | null>(null);
  const [salesError, setSalesError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [section, setSection] = useState<'sales' | 'settlements'>(role === 'store' ? 'sales' : 'settlements');
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<SettlementFilter>('전체');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  useEffect(() => {
    if (demo) return;
    let active = true;
    void loadSettlements()
      .then(value => { if (active) setEntries(value); })
      .catch(caught => { if (active) setError(friendlyError(caught)); })
      .finally(() => { if (active) setLoading(false); });
    if (role === 'store') {
      void Promise.all([loadManagedOrders(), loadCollaborations('store')])
        .then(([orders, collaborations]) => { if (active) setSales({ orders, collaborations }); })
        .catch(caught => { if (active) setSalesError(friendlyError(caught)); });
    }
    return () => { active = false; };
  }, [attempt, demo, role]);
  const reload = () => {
    setLoading(true); setError(''); setSales(null); setSalesError('');
    setAttempt(value => value + 1);
  };
  const paid = entries.filter(entry => entry.status === 'paid');
  const share = (entry: SettlementEntry) => role === 'creator' ? entry.creatorAmount : entry.storeAmount;
  const expected = pendingSettlementTotal(entries, role);
  const completed = paid.reduce((sum, entry) => sum + share(entry), 0);
  const entriesByOrder = new Map(entries.map(entry => [entry.orderId, entry]));
  const titles = new Map(sales?.collaborations.map(item => [item.id, item.projectTitle]));
  const exhibitions = new Map<string, { title: string; quantity: number; expected: number }>();
  let quantity = 0;
  for (const order of sales?.orders ?? []) {
    const entry = entriesByOrder.get(order.id);
    const id = entry?.collaborationId ?? order.listingId;
    const exhibit = exhibitions.get(id) ?? {
      title: titles.get(id) ?? order.productName,
      quantity: 0,
      expected: 0,
    };
    exhibit.quantity += order.quantity;
    if (entry?.status === 'scheduled' || entry?.status === 'ready') exhibit.expected += entry.storeAmount;
    exhibitions.set(id, exhibit);
    quantity += order.quantity;
  }
  if (demo && role === 'store') {
    exhibitions.set('demo', { title: '흙의 기억', quantity: 1, expected });
    quantity = 1;
  }
  const visible = entries.filter(entry => filter === '전체'
    || (filter === '정산 대기' && ['scheduled', 'ready'].includes(entry.status))
    || (filter === '정산 완료' && entry.status === 'paid')
    || (filter === '보류·취소' && ['held', 'cancelled'].includes(entry.status)));
  return <View style={s.flex}><Header title="판매·정산" subtitle={role === 'creator' ? '주문별 판매대금과 정산 일정' : undefined} back={onBack} action={onOpenPickup ? <Pressable accessibilityRole="button" accessibilityLabel="주문 · 수령 열기" style={s.salesHeaderAction} onPress={onOpenPickup}><Icon name="store" size={19} color={colors.brand} /></Pressable> : undefined} /><ScrollView contentContainerStyle={s.scroll}>
    <View style={s.settlementSummary}><CuritText style={s.muted}>{role === 'store' ? '매장 정산 예정' : '예정·완료 정산 합계'}</CuritText><CuritText weight="bold" style={s.settlementTotal}>{loading || error ? '—' : money(role === 'store' ? expected : expected + completed)}</CuritText><CuritText style={s.gridMeta}>구매 취소와 보류 건은 합계에서 제외됩니다.</CuritText></View>
    {role === 'store' ? <>
      <View style={s.metricsBox}><Metric label="판매 수량" value={sales || demo ? `${quantity}개` : '—'} /><Metric label="정산 완료" value={loading || error ? '—' : money(completed)} /></View>
      <View style={s.salesTabs} accessibilityRole="tablist">{([['sales', '전시별 판매'], ['settlements', '정산']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: section === value }} style={[s.salesTab, section === value && s.salesTabActive]} onPress={() => setSection(value)}><CuritText weight={section === value ? 'semibold' : 'regular'} style={section === value ? s.settingsValue : s.muted}>{label}</CuritText></Pressable>)}</View>
    </> : null}
    {section === 'sales' ? (
      error || salesError ? <View style={s.errorBox}><CuritText style={{ color: colors.danger }}>{error || salesError}</CuritText><Button label="다시 불러오기" variant="secondary" onPress={reload} /></View>
        : !demo && (!sales || loading) ? <ActivityIndicator color={colors.brand} style={{ marginTop: 32 }} />
          : exhibitions.size ? [...exhibitions].map(([id, exhibit]) => <View key={id} style={s.salesRow}><CuritText weight="semibold">{exhibit.title}</CuritText><CuritText style={s.gridMeta}>판매 {exhibit.quantity}개 · 매장 정산 예정 {money(exhibit.expected)}</CuritText></View>)
            : <Empty title="전시 판매 내역이 없습니다" description="결제 완료된 주문이 생기면 전시별로 확인할 수 있어요." />
    ) : <>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.settlementFilters}>{(['전체', '정산 대기', '정산 완료', '보류·취소'] as SettlementFilter[]).map(value => <Chip key={value} label={value} active={filter === value} onPress={() => setFilter(value)} />)}</ScrollView>
    {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : null}
    {error ? <View style={s.errorBox}><CuritText style={{ color: colors.danger }}>{error}</CuritText><Button label="다시 불러오기" variant="secondary" onPress={reload} /></View> : null}
    {!loading && !error && visible.length === 0 ? <Empty title={entries.length ? '해당 상태의 정산이 없습니다' : '정산 내역이 없습니다'} description={entries.length ? '다른 정산 상태를 선택해 확인해 주세요.' : '주문이 완료되면 배분 금액을 이곳에서 확인할 수 있어요.'} /> : visible.map(entry => {
      const expanded = expandedId === entry.id;
      const status = entry.status === 'paid' ? '지급 완료' : entry.status === 'held' ? '보류' : entry.status === 'cancelled' ? '취소' : entry.status === 'ready' ? '지급 준비' : '정산 예정';
      return <View key={entry.id} style={s.settlementCard}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`주문 ${entry.orderId.slice(-8)} 정산 상세 ${expanded ? '접기' : '펼치기'}`} style={s.settlementRow} onPress={() => setExpandedId(current => current === entry.id ? null : entry.id)}><View style={s.flex}><CuritText weight="semibold">주문 {entry.orderId.slice(-8)}</CuritText><CuritText style={s.gridMeta}>{new Date(entry.createdAt).toLocaleDateString('ko-KR')} · {settlementScheduleLabel(entry)}</CuritText></View><View style={{ alignItems: 'flex-end' }}><CuritText weight="bold">{money(role === 'creator' ? entry.creatorAmount : entry.storeAmount)}</CuritText><CuritText style={s.settingsValue}>{status} {expanded ? '−' : '＋'}</CuritText></View></Pressable>
        {expanded ? <View style={s.settlementDetail}><SettlementLine label="총 결제액" value={money(entry.grossAmount)} /><SettlementLine label="크리에이터 배분" value={money(entry.creatorAmount)} /><SettlementLine label="매장 배분" value={money(entry.storeAmount)} /><SettlementLine label="플랫폼 수수료" value={money(entry.platformAmount)} />{entry.collaborationId && onOpenCollaboration ? <Button label="해당 협업 보기" variant="secondary" onPress={() => onOpenCollaboration(entry.collaborationId!)} /> : null}</View> : null}
      </View>;
    })}
    </>}
  </ScrollView></View>;
}

function SettlementLine({ label, value }: { label: string; value: string }) { return <View style={s.settlementLine}><CuritText style={s.muted}>{label}</CuritText><CuritText weight="semibold">{value}</CuritText></View>; }

function openCollaborationCount(items: CollaborationSummary[]) {
  return items.filter(item => item.status !== 'completed' && item.status !== 'cancelled').length;
}

function CreatorActivity({ sampleCollaborations }: { sampleCollaborations?: CollaborationSummary[] }) {
  const [activity, setActivity] = useState<{ open: number | null; pending: number | null }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (sampleCollaborations) return;
    let active = true;
    void Promise.allSettled([loadCollaborations('creator'), loadSettlements()]).then(([collaborations, settlements]) => {
      if (!active) return;
      setActivity({
        open: collaborations.status === 'fulfilled' ? openCollaborationCount(collaborations.value) : null,
        pending: settlements.status === 'fulfilled' ? pendingSettlementTotal(settlements.value, 'creator') : null,
      });
    });
    return () => { active = false; };
  }, [attempt, sampleCollaborations]);
  const open = sampleCollaborations ? openCollaborationCount(sampleCollaborations) : activity?.open;
  const pending = sampleCollaborations ? pendingSettlementTotal(demoSettlements, 'creator') : activity?.pending;
  const failed = open === null || pending === null;
  return <View style={s.myActivity}>
    <CuritText accessibilityRole="header" weight="semibold">협업·정산 활동</CuritText>
    <View style={s.myActivityMetrics}>
      <View style={s.myActivityMetric}><CuritText style={s.muted}>진행 중 협업</CuritText><CuritText weight="bold" style={s.metricValue}>{open == null ? '—' : `${open}건`}</CuritText></View>
      <View style={s.myActivityMetric}><CuritText style={s.muted}>정산 예정</CuritText><CuritText weight="bold" style={s.metricValue}>{pending == null ? '—' : money(pending)}</CuritText></View>
    </View>
    {failed ? <View style={s.myActivityRetry}><CuritText style={[s.muted, s.flex]}>일부 정보를 불러오지 못했어요.</CuritText><Pressable accessibilityRole="button" style={s.myActivityRetryButton} onPress={() => { setActivity(undefined); setAttempt(value => value + 1); }}><CuritText weight="semibold" style={s.settingsValue}>다시 시도</CuritText></Pressable></View> : null}
  </View>;
}

export function MyScreen({ role, displayName, sampleCollaborations, onOpenProject, onOpenProfile, onOpenDna, onOpenStore, onOpenPreferences, onOpenVerification, onOpenNotifications, onOpenAccount }: { role: Role; displayName: string; sampleCollaborations?: CollaborationSummary[]; onOpenProject?: () => void; onOpenProfile: () => void; onOpenDna: () => void; onOpenStore: () => void; onOpenPreferences: () => void; onOpenVerification: () => void; onOpenNotifications: () => void; onOpenAccount: () => void }) {
  const rows = role === 'creator'
    ? [{ icon: 'heart' as const, label: '활동 인증', onPress: onOpenVerification }, { icon: 'store' as const, label: '나의 작품 DNA', onPress: onOpenDna }, { icon: 'qr' as const, label: '내 전시 프로젝트', onPress: onOpenProject }, { icon: 'chat' as const, label: '내 소식', onPress: onOpenNotifications }]
    : [{ icon: 'store' as const, label: '매장 운영 인증', onPress: onOpenVerification }, { icon: 'heart' as const, label: '공간 취향·전시 구역', onPress: onOpenPreferences }, { icon: 'chat' as const, label: '내 소식', onPress: onOpenNotifications }];
  const openProfile = role === 'creator' ? onOpenProfile : onOpenStore;
  return <View style={s.flex}><Header title="마이" /><ScrollView contentContainerStyle={s.myScroll} showsVerticalScrollIndicator={false}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${role === 'creator' ? '크리에이터' : '매장'} 프로필 보기 및 수정`} style={s.myIdentity} onPress={openProfile}><View style={s.profileAvatar}><CuritText weight="bold" style={{ fontSize: 16 }}>{displayName.slice(0, 2) || 'CU'}</CuritText></View><View style={s.flex}><CuritText weight="bold" style={s.myName}>{displayName}</CuritText><CuritText style={s.muted}>{role === 'creator' ? '크리에이터' : '매장 운영자'}</CuritText></View><View style={s.profileOpen}><CuritText weight="semibold" style={s.profileOpenText}>프로필</CuritText><Icon name="chevron" size={14} color={colors.brand} /></View></Pressable>
    {role === 'creator' ? <CreatorActivity sampleCollaborations={sampleCollaborations} /> : null}
    <View style={s.myMenuBox}>{rows.map(row => <Pressable accessibilityRole="button" key={row.label} style={s.myMenuRow} onPress={row.onPress}><Icon name={row.icon} size={17} color={colors.muted} /><CuritText style={s.flex}>{row.label}</CuritText><Icon name="chevron" size={14} color={colors.subtle} /></Pressable>)}</View>
    <Pressable accessibilityRole="button" style={s.accountAction} onPress={onOpenAccount}><CuritText style={s.muted}>계정 정보 · 개인정보 관리</CuritText><CuritText style={s.muted}>→</CuritText></Pressable>
  </ScrollView></View>;
}

export function AccountSettingsScreen({ userId, email, role, demo, onBack, onResetPassword, onLogout }: { userId: string; email: string; role: Role; demo?: boolean; onBack: () => void; onResetPassword: () => Promise<void>; onLogout: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [notificationsDenied, setNotificationsDenied] = useState(false);
  useEffect(() => {
    if (demo || Platform.OS === 'web') return;
    let active = true;
    let wasDenied = false;
    const check = () => {
      void Notifications.getPermissionsAsync().then(permission => {
        if (!active) return;
        if (wasDenied && permission.granted) void registerNativePush(userId).catch(() => undefined);
        wasDenied = permission.status === 'denied';
        setNotificationsDenied(wasDenied);
      }).catch(() => undefined);
    };
    check();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') check(); });
    return () => { active = false; subscription.remove(); };
  }, [demo, userId]);
  const resetPassword = async () => {
    if (demo) { setNotice('둘러보기 계정에서는 비밀번호를 변경할 수 없습니다.'); return; }
    setBusy(true); setNotice('');
    try { await onResetPassword(); setNotice('가입한 이메일로 비밀번호 재설정 링크를 보냈습니다.'); }
    catch (error) { setNotice(friendlyError(error)); }
    finally { setBusy(false); }
  };
  return <View style={s.flex}><Header title="계정 정보" back={onBack} /><ScrollView contentContainerStyle={s.scroll}>
    <View style={s.accountInfoCard}><CuritText weight="bold" style={s.cardTitle}>내 계정</CuritText><View style={s.accountInfoRow}><CuritText style={s.muted}>이메일</CuritText><CuritText weight="semibold" style={s.accountInfoValue}>{email}</CuritText></View><View style={s.accountInfoRow}><CuritText style={s.muted}>계정 유형</CuritText><CuritText weight="semibold">{role === 'creator' ? '크리에이터' : '매장 운영자'}</CuritText></View></View>
    <View style={s.privacyCard}><CuritText weight="semibold">개인정보 표시 범위</CuritText><CuritText style={s.accountDescription}>이메일과 역할, 등록한 작품·공간·협업 정보는 계정 기능 제공에 사용됩니다. 매장 직원에게는 고객의 전체 전화번호 대신 주문번호와 뒤 4자리만 표시합니다.</CuritText></View>
    {notificationsDenied ? <View style={s.privacyCard}><CuritText weight="semibold">기기 알림이 꺼져 있어요</CuritText><CuritText style={s.accountDescription}>협업과 주문 소식은 앱의 내 소식에서도 확인할 수 있습니다.</CuritText><Button label="기기 설정 열기" variant="secondary" onPress={() => { void Linking.openSettings().catch(error => setNotice(friendlyError(error))); }} /></View> : null}
    <View style={s.accountButtons}><Button label={busy ? '메일 전송 중…' : '비밀번호 재설정 메일 받기'} variant="secondary" disabled={busy} onPress={() => { void resetPassword(); }} /><Button label="로그아웃" variant="ghost" onPress={() => { void onLogout(); }} /></View>
    {notice ? <View style={s.noticeCard}><CuritText style={s.muted}>{notice}</CuritText></View> : null}
  </ScrollView></View>;
}

export function QrProductsScreen({ demo, collaborationId, onBack, onSelect }: { demo?: boolean; collaborationId?: string; onBack: () => void; onSelect: (item: QrProduct) => void }) {
  const [items, setItems] = useState<QrProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const result = await fetchQrCatalog(demo);
      setItems(result.items);
      setError(result.warning);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setLoading(false);
    }
  };
  const openOrIssue = async (item: QrProduct) => {
    if (item.token) { onSelect(item); return; }
    if (!item.issuable || !item.collaborationId || issuing) return;
    setIssuing(item.id || item.productId); setError('');
    try {
      const issued = await issueQrListing(item.productId, item.collaborationId);
      setItems(current => current.map(entry => entry.id === item.id ? issued : entry));
      onSelect(issued);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setIssuing('');
    }
  };
  useEffect(() => {
    let active = true;
    void fetchQrCatalog(demo)
      .then(result => { if (active) { setItems(result.items); setError(result.warning); } })
      .catch(caught => { if (active) setError(friendlyError(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo]);
  const scopedItems = useMemo(() => collaborationId ? items.filter(item => item.collaborationId === collaborationId) : items, [collaborationId, items]);
  const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');
  const visibleItems = useMemo(() => scopedItems.filter(item => `${item.name} ${item.artistName || ''} ${item.token || ''}`.toLocaleLowerCase('ko-KR').includes(normalizedQuery)), [scopedItems, normalizedQuery]);
  return <View style={s.flex}>
    <Header title="QR 상품 관리" subtitle={collaborationId ? "이 전시에 연결된 작품만 표시해요" : "등록 상품과 협업 QR을 함께 확인해요"} back={onBack} />
    <ScrollView contentContainerStyle={s.scroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}>
      <View style={s.storeInfo}>
        <View style={s.quickIcon}><Icon name="store" color={colors.brand} /></View>
        <View style={s.flex}><CuritText weight="bold">판매 상품</CuritText><CuritText style={s.muted}>QR 관리 대상 {scopedItems.length}종</CuritText></View>
        <Chip label={`${scopedItems.length}종`} />
      </View>
      <Field placeholder="상품명 또는 QR 토큰 검색" value={query} onChangeText={setQuery} returnKeyType="search" />
      {loading && scopedItems.length === 0 ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : null}
      {error ? <View style={s.errorBox}><CuritText style={{ color: colors.danger }}>{error}</CuritText><Button label="다시 시도" variant="secondary" disabled={loading} onPress={() => { void load(); }} /></View> : null}
      {!loading && !error && scopedItems.length === 0 ? <Empty title="QR로 연결된 상품이 없습니다" description="현장 등록 상품이나 승인된 협업 상품이 이곳에 표시됩니다." /> : null}
      {!loading && scopedItems.length > 0 && visibleItems.length === 0 ? <Empty title="검색 결과가 없습니다" description="상품명, 작가명 또는 QR 토큰을 다시 확인해 주세요." /> : null}
      {visibleItems.map(item => <Pressable accessibilityRole="button" key={item.id || item.token} disabled={Boolean(issuing)} style={s.qrRow} onPress={() => { void openOrIssue(item); }}>
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={s.qrImage} contentFit="cover" /> : <View style={[s.qrImage, s.qrImagePlaceholder]}><Icon name="qr" size={20} color={colors.brand} /></View>}
        <View style={s.flex}>
          <View style={s.qrProductHeading}><CuritText weight="semibold" numberOfLines={1}>{item.name}</CuritText><Chip label={item.source === 'field-sale' ? '현장 QR' : '협업 QR'} /></View>
          <CuritText style={s.muted}>{money(item.price)} · {item.inventoryTracked === false ? '수량 별도 관리' : `재고 ${item.stock}개`} · {item.issuable ? 'QR 발급 전' : item.status === 'ACTIVE' ? '판매 중' : item.status === 'SOLD_OUT' ? '품절' : item.source === 'field-sale' ? '구매 안내 준비 중' : '판매 전'}</CuritText>
          <CuritText style={s.tokenText} numberOfLines={1}>{item.issuable ? '눌러서 상품 전용 QR 발급' : item.token}</CuritText>
        </View>
        <View style={s.qrArrow}>{issuing === (item.id || item.productId) ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon name="qr" size={21} color={colors.brand} />}</View>
      </Pressable>)}
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  auth: { flexGrow: 1, paddingHorizontal: 35, paddingTop: 30, paddingBottom: 34 },
  logo: { color: colors.brand, fontSize: 13, letterSpacing: 1.5 }, loginIntro: { marginTop: 38, marginBottom: 30 }, loginTitle: { fontSize: 26, lineHeight: 34, letterSpacing: -1 }, logoCaption: { color: colors.muted, marginTop: 10 },
  recoveryAccount: { gap: 8 }, recoveryLabel: { fontSize: 13 },
  recoveryEmail: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 15, paddingVertical: 13 },
  form: { gap: 16 }, loginOptions: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -2 }, rememberAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }, checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: colors.subtle, alignItems: 'center', justifyContent: 'center' }, checkboxChecked: { borderColor: colors.brand, backgroundColor: colors.brand }, checkmark: { color: colors.surface, fontSize: 13, lineHeight: 16 }, authTextAction: { minHeight: 44, justifyContent: 'center' },
  muted: { color: colors.muted }, brandText: { color: colors.brand }, signUpRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 20, alignItems: 'center' },
  demoBox: { marginTop: 24, padding: 16, backgroundColor: colors.brandPale, borderRadius: radius.md, gap: 10 }, demoNote: { color: colors.muted, fontSize: 12 }, twoButtons: { flexDirection: 'row', gap: 8 },
  roleBody: { flex: 1, padding: 24, gap: 16 }, pageTitle: { fontSize: 25, marginTop: 18 }, pageDescription: { color: colors.muted, marginTop: 8 },
  accountSignup: { flexGrow: 1, padding: 24, gap: 18 },
  confirmationBody: { flex: 1, padding: 24, justifyContent: 'center', gap: 18 },
  roleCard: { minHeight: 104, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }, roleIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, cardTitle: { fontSize: 17, marginBottom: 4 },
  scroll: { padding: 20, paddingBottom: 32 }, homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, eyebrow: { color: colors.brand, fontSize: 10, letterSpacing: 2, fontFamily: fonts.bold }, greeting: { fontSize: 21, marginTop: 4 },
  curationScroll: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 36 },
  curationHero: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginTop: 24, marginBottom: 38 },
  curationPrelude: { color: colors.muted, fontSize: 12, marginBottom: 7 },
  curationTitle: { color: colors.ink, fontSize: 28, lineHeight: 37, letterSpacing: -1.1 },
  preferenceLink: { minHeight: 40, marginTop: 8, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.brandSoft, flexDirection: 'row', alignItems: 'center', gap: 4 },
  preferenceLinkText: { color: colors.brand, fontSize: 11 },
  curationSectionTop: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 14 },
  curationSectionTitle: { color: colors.ink, fontSize: 17, lineHeight: 24, letterSpacing: -.3 },
  dnaHint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  curationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12, marginBottom: 24 },
  curationTile: { width: '47.5%', minWidth: 0, marginBottom: 8 },
  curationImageWrap: { width: '100%', aspectRatio: .9, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.brandPale, marginBottom: 10 },
  curationImage: { width: '100%', height: '100%' },
  rankBadge: { position: 'absolute', left: 9, top: 9, minWidth: 27, height: 27, paddingHorizontal: 7, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.92)', alignItems: 'center', justifyContent: 'center' },
  rankText: { color: colors.ink, fontSize: 9, letterSpacing: .6 },
  scoreBadge: { position: 'absolute', right: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(74,99,56,.92)' },
  scoreText: { color: colors.surface, fontSize: 9 },
  tileEyebrow: { color: colors.muted, fontSize: 9, lineHeight: 14, marginBottom: 2 },
  tileTitle: { color: colors.ink, fontSize: 15, lineHeight: 20 },
  tileDescription: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3, minHeight: 30 },
  compactCollaboration: { minHeight: 76, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  heroCard: { height: 158, backgroundColor: colors.ink, borderRadius: radius.lg, overflow: 'hidden', flexDirection: 'row', marginBottom: 28 }, heroCopy: { flex: 1, padding: 18, justifyContent: 'center', zIndex: 2 }, heroLabel: { color: '#D9DDCF', fontSize: 12 }, heroTitle: { color: colors.surface, fontSize: 21, marginVertical: 8 }, heroMeta: { color: '#CFD3CC', fontSize: 11 }, heroImage: { width: 138, height: '100%', opacity: .78 },
  startCard: { minHeight: 98, borderRadius: radius.lg, backgroundColor: colors.brandPale, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 }, gridCard: { width: '48.5%', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface }, gridImage: { width: '100%', height: 112 }, gridBody: { padding: 12, gap: 4 }, gridMeta: { color: colors.muted, fontSize: 11, lineHeight: 16 }, matchBadge: { marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandSoft }, matchText: { color: colors.brand, fontSize: 11 },
  noticeCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, noticeDate: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  statusCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 18, marginBottom: 14 }, statusTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, metrics: { flexDirection: 'row', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }, metric: { flex: 1, alignItems: 'center' }, metricValue: { fontSize: 16 }, metricLabel: { color: colors.muted, fontSize: 10, marginTop: 3 }, metricsBox: { flexDirection: 'row', backgroundColor: colors.brandPale, borderRadius: radius.md, paddingVertical: 16, marginBottom: 16 }, commerceStrip: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 15, marginBottom: 20 },
  aiBanner: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: 14, flexDirection: 'row', gap: 12, marginBottom: 26 }, aiBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  projectList: { gap: 10 }, projectRow: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, projectThumb: { width: 72, height: 72, borderRadius: radius.sm }, tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }, tag: { color: colors.muted, fontSize: 10, backgroundColor: '#F5F5F5', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  recommendReason: { color: colors.brand, fontSize: 10, marginTop: 5 },
  filters: { gap: 8, paddingVertical: 16 }, discoverList: { gap: 14 }, projectTile: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' }, tileImage: { width: '100%', height: 176 }, tileBody: { padding: 14, gap: 7 },
  exploreTabs: { flexDirection: 'row', minHeight: 54, alignItems: 'flex-end', justifyContent: 'space-around', borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: 4, marginBottom: 20 }, exploreTab: { color: colors.muted, paddingBottom: 12 }, exploreTabActive: { color: colors.brand, paddingBottom: 11, borderBottomWidth: 2, borderBottomColor: colors.brand },
  dnaFilter: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 18, overflow: 'hidden' }, dnaFilterHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }, dnaFilterSummary: { flex: 1, minWidth: 0, marginLeft: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }, dnaSummaryText: { color: colors.muted, fontSize: 11, flexShrink: 1, textAlign: 'right' }, dnaFilterBody: { borderTopWidth: 1, borderTopColor: colors.border, padding: 14, gap: 10 }, dnaFilterLabel: { color: colors.muted, fontSize: 11 }, dnaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  searchPad: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }, chatRow: { flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }, chatTime: { color: colors.subtle, fontSize: 10 }, chatProject: { color: colors.brand, fontSize: 11, marginVertical: 2 },
  collabCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, flexDirection: 'row', gap: 12, marginBottom: 12 }, collabImage: { width: 74, height: 74, borderRadius: radius.sm }, compactStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandSoft }, compactStatusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brand }, compactStatusText: { color: colors.brand, fontSize: 9 }, progressTrack: { height: 5, backgroundColor: colors.border, borderRadius: 3, marginVertical: 10 }, progress: { height: 5, backgroundColor: colors.brand, borderRadius: 3 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 }, quickAction: { width: '48.5%', minHeight: 112, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, justifyContent: 'center' }, quickIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: colors.border }, profileAvatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, settingsRow: { minHeight: 54, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' },
  myScroll: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 40 },
  myIdentity: { minHeight: 92, marginTop: 20, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  myActivity: { borderRadius: radius.lg, backgroundColor: colors.brandPale, padding: 16, gap: 12, marginBottom: 14 },
  myActivityMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  myActivityMetric: { flex: 1, minWidth: 106, gap: 4 },
  myActivityRetry: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  myActivityRetryButton: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  myName: { fontSize: 20, lineHeight: 27, letterSpacing: -.4, marginBottom: 3 },
  profileOpen: { minHeight: 40, paddingLeft: 10, flexDirection: 'row', alignItems: 'center', gap: 3 },
  profileOpenText: { color: colors.brand, fontSize: 11 },
  myProfilePanel: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 17, gap: 14, backgroundColor: colors.surface, marginBottom: 14 },
  myPanelButtons: { flexDirection: 'row', gap: 8 },
  myMenuBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, marginBottom: 12 },
  myMenuRow: { minHeight: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountAction: { minHeight: 52, paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accountInfoCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 17, gap: 4, backgroundColor: colors.surface },
  accountInfoRow: { minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  accountInfoValue: { flex: 1, textAlign: 'right' },
  privacyCard: { marginTop: 16, borderRadius: radius.md, padding: 16, gap: 7, backgroundColor: colors.brandPale },
  accountDescription: { color: colors.muted, lineHeight: 22 },
  accountButtons: { marginTop: 18, gap: 10 },
  settingsValue: { color: colors.brand, fontSize: 12, marginRight: 6 },
  storeInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 14 }, errorBox: { marginVertical: 14, backgroundColor: '#FFF2EF', borderRadius: radius.sm, padding: 13, gap: 5 }, errorHint: { color: colors.muted, fontSize: 11 },
  qrRow: { minHeight: 92, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, qrImage: { width: 66, height: 66, borderRadius: radius.sm }, qrArrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, tokenText: { color: colors.subtle, fontSize: 9, maxWidth: 190 }, qrImagePlaceholder: { backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, qrProductHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }, imagePlaceholder: { backgroundColor: colors.brandPale, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 8 },
  salesHeaderAction: { minHeight: 44, width: 44, alignItems: 'center', justifyContent: 'center' },
  salesTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  salesTab: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  salesTabActive: { borderBottomColor: colors.brand },
  salesRow: { minHeight: 68, justifyContent: 'center', paddingVertical: 14, gap: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
  settlementSummary: { backgroundColor: colors.brandPale, borderRadius: radius.lg, padding: 20, marginBottom: 12, gap: 5 }, settlementTotal: { fontSize: 25, color: colors.brand }, settlementFilters: { gap: 8, paddingVertical: 8, paddingRight: 20 }, settlementCard: { borderBottomWidth: 1, borderBottomColor: colors.border }, settlementRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12 }, settlementDetail: { backgroundColor: colors.brandPale, borderRadius: radius.md, padding: 14, gap: 10, marginBottom: 14 }, settlementLine: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
