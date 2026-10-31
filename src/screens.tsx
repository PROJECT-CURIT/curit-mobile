import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Button, Chip, CuritText, Empty, Field, Header, Icon, SectionTitle } from './ui';
import { colors, fonts, radius } from './theme';
import { images, projects, qrTokens, stores } from './data';
import { loadCollaborations, loadMatchRecommendations } from './curation';
import { fetchQrProduct } from './api';
import { friendlyError, issueQrListing, loadManagedQrProducts, loadSettlements, type SettlementEntry } from './platform';
import type { CollaborationSummary, MatchRecommendation, QrProduct, Role } from './types';
import { demoQrProducts } from './demoContent';

const money = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const demoSettlements: SettlementEntry[] = [{ id: 'demo-settlement', orderId: 'QR-DEMO-20261030', grossAmount: 35000, creatorAmount: 28000, storeAmount: 3500, platformAmount: 3500, status: 'scheduled', scheduledFor: '2026-11-13', createdAt: '2026-10-30T06:00:00Z' }];

async function fetchQrCatalog(demo?: boolean) {
  if (!demo) return { items: await loadManagedQrProducts(), warning: '' };
  const results = await Promise.allSettled(qrTokens.map(token => fetchQrProduct(token)));
  const items = demoQrProducts.map((fallback, index) => {
    const result = results[index];
    return result?.status === 'fulfilled'
      ? { ...fallback, ...result.value, viewCount: fallback.viewCount, qrUrl: fallback.qrUrl }
      : fallback;
  });
  return { items, warning: '' };
}

export function LoginScreen({ onLogin, onSignUp, onDemo, onResetPassword, demoEnabled, configured }: { onLogin: (email: string, password: string) => Promise<void>; onSignUp: () => void; onDemo: (role: Role) => void; onResetPassword: (email: string) => Promise<void>; demoEnabled: boolean; configured: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
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
  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={s.auth} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
      <CuritText weight="extrabold" style={s.logo}>CURI:T</CuritText>
      <View style={s.loginIntro}><CuritText weight="extrabold" style={s.loginTitle}>다시 만나 반가워요.</CuritText><CuritText style={s.logoCaption}>작품과 공간을 이어가는 나의 자리.</CuritText></View>
      <View style={s.form}>
        <Field label="이메일 *" value={email} onChangeText={setEmail} placeholder="이메일 주소" autoCapitalize="none" keyboardType="email-address" />
        <Field label="비밀번호 *" value={password} onChangeText={setPassword} placeholder="비밀번호" secureTextEntry />
        <View style={s.loginOptions}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember }} hitSlop={8} style={s.rememberAction} onPress={() => setRemember(value => !value)}><View style={[s.checkbox, remember && s.checkboxChecked]}>{remember ? <CuritText weight="bold" style={s.checkmark}>✓</CuritText> : null}</View><CuritText style={s.muted}>로그인 유지</CuritText></Pressable>
          <Pressable accessibilityRole="button" hitSlop={8} style={s.authTextAction} onPress={() => { void resetPassword(); }}><CuritText style={s.muted}>비밀번호 재설정</CuritText></Pressable>
        </View>
        {error ? <CuritText style={{ color: colors.danger }}>{error}</CuritText> : null}
        {!configured ? <CuritText style={s.demoNote}>서버 환경변수가 아직 연결되지 않았습니다. `.env`에 Supabase URL과 Publishable Key를 설정해 주세요.</CuritText> : null}
        <Button label={busy ? '로그인 중…' : '로그인'} disabled={!configured || !email.trim() || password.length < 8 || busy} onPress={() => { void submit(); }} />
      </View>
      <View style={s.signUpRow}><CuritText style={s.muted}>CURI:T이 처음인가요?</CuritText><Pressable accessibilityRole="button" hitSlop={8} style={s.authTextAction} onPress={onSignUp}><CuritText weight="semibold" style={s.brandText}>회원가입</CuritText></Pressable></View>
      {demoEnabled ? <View style={s.demoBox}>
        <CuritText weight="semibold">프로토타입 바로 보기</CuritText>
        <CuritText style={s.demoNote}>심사·디자인 확인용 샘플 데이터입니다. 운영 데이터와 분리됩니다.</CuritText>
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

export function EmailConfirmationScreen({ email, onLogin }: { email: string; onLogin: () => void }) {
  return <View style={s.flex}><Header title="이메일 인증" /><View style={s.confirmationBody}><View style={s.roleIcon}><Icon name="chat" color={colors.brand} /></View><CuritText weight="bold" style={s.pageTitle}>인증 메일을 확인해 주세요</CuritText><CuritText style={s.pageDescription}>{email} 주소로 인증 링크를 보냈습니다. 링크를 연 뒤 로그인하면 프로젝트와 이미지가 계정에 안전하게 저장됩니다.</CuritText><Button label="로그인으로 돌아가기" onPress={onLogin} /></View></View>;
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
  const [summary, setSummary] = useState({ qrViews: demo ? 203 : 0, salesCount: demo ? 8 : 0, expectedSettlement: demo ? 310000 : 0, loading: !demo });
  useEffect(() => {
    if (demo) return;
    let active = true;
    void Promise.all([loadSettlements(), loadManagedQrProducts()])
      .then(([entries, qrProducts]) => {
        if (!active) return;
        const eligible = entries.filter(entry => entry.status !== 'cancelled' && entry.status !== 'held');
        setSummary({
          qrViews: qrProducts.reduce((sum, item) => sum + (item.viewCount || 0), 0),
          salesCount: new Set(eligible.map(entry => entry.orderId)).size,
          expectedSettlement: eligible.reduce((sum, entry) => sum + (role === 'creator' ? entry.creatorAmount : entry.storeAmount), 0),
          loading: false,
        });
      })
      .catch(() => {
        if (active) setSummary(current => ({ ...current, loading: false }));
      });
    return () => { active = false; };
  }, [demo, role]);
  return summary;
}

export function HomeScreen({ role, displayName, demo, onMove }: { role: Role; displayName: string; demo?: boolean; onMove: (target: string) => void }) {
  return role === 'creator' ? <CreatorHome displayName={displayName} demo={demo} onMove={onMove} /> : <StoreHome displayName={displayName} demo={demo} onMove={onMove} />;
}

function useRecommendations(role: Role, demo?: boolean) {
  const [items, setItems] = useState<MatchRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void loadMatchRecommendations(role, demo).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, [demo, role]);
  return { items, loading };
}

function useCollaborationList(role: Role, demo?: boolean) {
  const fallback: CollaborationSummary[] = demo ? [{ id: 'demo', projectId: 'demo-project', storeId: 'demo-store', creatorId: 'demo-creator', projectTitle: '흙의 기억', storeName: '아늑한 서울', creatorName: '김서연', counterpartName: role === 'creator' ? '아늑한 서울' : '김서연', status: 'active', startsOn: '2026-10-01', endsOn: '2026-12-31', creatorShare: 80, storeShare: 10, platformShare: 10, terms: {}, updatedAt: new Date().toISOString() }] : [];
  const [items, setItems] = useState<CollaborationSummary[]>(fallback);
  const [loading, setLoading] = useState(!demo);
  useEffect(() => {
    if (demo) return;
    void loadCollaborations(role).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, [demo, role]);
  return { items, loading };
}

function CreatorHome({ displayName, demo, onMove }: { displayName: string; demo?: boolean; onMove: (target: string) => void }) {
  const summary = useCommerceSummary('creator', demo);
  const recommended = useRecommendations('creator', demo);
  const collaborations = useCollaborationList('creator', demo);
  const current = collaborations.items.find(item => !['completed', 'cancelled'].includes(item.status));
  const items = demo
    ? stores.map((store, index) => ({
      targetId: `demo-space-${index}`,
      title: store.name,
      subtitle: `${index === 1 ? '서점' : '카페'} · 서울`,
      description: store.mood,
      score: store.match,
      image: store.image,
      tags: index === 1 ? ['계산대 옆 진열대', '북 큐레이션 테이블'] : ['창가 우드 선반', '입구 벽면'],
    }))
    : recommended.items.map((item, index) => ({ ...item, image: item.imageUrl ? { uri: item.imageUrl } : [images.cafe, images.bookstore, images.showroom, images.lounge][index % 4] }));
  return (
    <ScrollView contentContainerStyle={s.curationScroll} showsVerticalScrollIndicator={false}>
      <CuritText style={s.eyebrow}>CURI:T</CuritText>
      <View style={s.curationHero}>
        <View style={s.flex}><CuritText style={s.curationPrelude}>{displayName} 님의 다음 장면</CuritText><CuritText weight="bold" style={s.curationTitle}>내 작품을 위한{`\n`}오늘의 큐레이션</CuritText></View>
        <Pressable accessibilityRole="button" accessibilityLabel="나의 작품 DNA 보기" style={s.roundArrow} onPress={() => onMove('my')}><CuritText style={s.roundArrowText}>↗</CuritText></Pressable>
      </View>
      <View style={s.curationSectionTop}><CuritText weight="semibold" style={s.curationSectionTitle}>내 작품과 어울리는 공간</CuritText><Pressable accessibilityRole="button" hitSlop={10} style={s.curationLinkAction} onPress={() => onMove('discover')}><CuritText weight="semibold" style={s.curationLink}>전체 보기 ↗</CuritText></Pressable></View>
      <View style={s.dnaIntro}><CuritText weight="semibold" style={s.dnaLabel}>ARTIST DNA</CuritText><CuritText style={s.dnaHint}>작품 취향을 등록해 보세요 →</CuritText></View>
      {recommended.loading && !demo ? <ActivityIndicator color={colors.brand} style={{ marginVertical: 40 }} /> : null}
      <View style={s.curationGrid}>{items.slice(0, 4).map((item, index) => <CurationTile key={item.targetId} index={index} title={item.title} subtitle={item.subtitle} description={item.description} score={item.score} image={item.image} role="space" onPress={() => onMove('discover')} />)}</View>
      {!recommended.loading && !items.length ? <Empty title="추천할 공간을 찾고 있어요" description="작품 DNA와 활동 지역을 저장하면 맞는 매장을 비교해 드립니다." /> : null}
      {current ? <Pressable style={s.compactCollaboration} onPress={() => onMove('management')}><View style={s.flex}><CuritText style={s.gridMeta}>진행 중인 협업</CuritText><CuritText weight="semibold">{current.projectTitle} · {current.storeName}</CuritText><CuritText style={s.gridMeta}>{summary.loading ? '성과 집계 중' : `${summary.salesCount}건 판매 · ${money(summary.expectedSettlement)} 예상 정산`}</CuritText></View><Icon name="chevron" color={colors.subtle} /></Pressable> : null}
    </ScrollView>
  );
}

function StoreHome({ displayName, demo, onMove }: { displayName: string; demo?: boolean; onMove: (target: string) => void }) {
  const summary = useCommerceSummary('store', demo);
  const recommended = useRecommendations('store', demo);
  const collaborations = useCollaborationList('store', demo);
  const current = collaborations.items.find(item => !['completed', 'cancelled'].includes(item.status));
  const items = demo
    ? projects.map((project, index) => ({ targetId: project.id, title: project.title, subtitle: `${project.artist} 작가`, description: project.priceRange, score: project.match ?? Math.max(79, 88 - index * 2), image: project.image }))
    : recommended.items.map((item, index) => ({ ...item, image: item.imageUrl ? { uri: item.imageUrl } : [images.pottery, images.linen, images.bowls, images.print][index % 4] }));
  return (
    <ScrollView contentContainerStyle={s.curationScroll} showsVerticalScrollIndicator={false}>
      <CuritText style={s.eyebrow}>CURI:T</CuritText>
      <View style={s.curationHero}>
        <View style={s.flex}><CuritText weight="bold" style={s.curationTitle}>{displayName}을 위한{`\n`}오늘의 큐레이션</CuritText></View>
        <Pressable accessibilityRole="button" accessibilityLabel="공간 DNA 보기" style={s.roundArrow} onPress={() => onMove('my')}><CuritText style={s.roundArrowText}>↗</CuritText></Pressable>
      </View>
      <View style={s.curationSectionTop}><View><CuritText style={s.curationPrelude}>공간의 취향을, 작품으로</CuritText><CuritText weight="semibold" style={s.curationSectionTitle}>현재 공간 추천 작품 ·</CuritText></View><Pressable accessibilityRole="button" hitSlop={10} style={s.curationLinkAction} onPress={() => onMove('discover')}><CuritText weight="semibold" style={s.curationLink}>전체 보기 ↗</CuritText></Pressable></View>
      <View style={s.dnaIntro}><CuritText weight="semibold" style={s.dnaLabel}>SPACE DNA</CuritText><View style={s.dnaPill}><CuritText style={s.dnaPillText}>미니멀</CuritText></View></View>
      <CuritText style={[s.dnaHint, { marginBottom: 18 }]}>등록한 공간 분위기와 작품 태그를 비교해 골랐어요.</CuritText>
      {recommended.loading && !demo ? <ActivityIndicator color={colors.brand} style={{ marginVertical: 40 }} /> : null}
      <View style={s.curationGrid}>{items.slice(0, 4).map((item, index) => <CurationTile key={item.targetId} index={index} title={item.title} subtitle={item.subtitle} description={item.description} score={item.score} image={item.image} role="art" onPress={() => onMove('discover')} />)}</View>
      {!recommended.loading && !items.length ? <Empty title="추천할 작품을 찾고 있어요" description="공간 취향과 예산을 저장하면 전시 가능한 작품을 비교해 드립니다." /> : null}
      {current ? <Pressable style={s.compactCollaboration} onPress={() => onMove('management')}><View style={s.flex}><CuritText style={s.gridMeta}>현재 협업 · {collaborationStatusLabel(current.status)}</CuritText><CuritText weight="semibold">{current.projectTitle} · {current.creatorName}</CuritText><CuritText style={s.gridMeta}>{summary.loading ? '성과 집계 중' : `QR ${summary.qrViews}회 · ${summary.salesCount}건 판매`}</CuritText></View><Icon name="chevron" color={colors.subtle} /></Pressable> : null}
    </ScrollView>
  );
}

function CurationTile({ index, title, subtitle, description, score, image, role, onPress }: { index: number; title: string; subtitle: string; description: string; score: number; image: typeof images[keyof typeof images] | { uri: string }; role: 'space' | 'art'; onPress: () => void }) {
  return <Pressable accessibilityRole="button" style={s.curationTile} onPress={onPress}><View style={s.curationImageWrap}><Image source={image} style={s.curationImage} contentFit="cover" /><View style={s.rankBadge}><CuritText style={s.rankText}>{String(index + 1).padStart(2, '0')}</CuritText></View>{role === 'art' ? <View style={s.scoreBadge}><CuritText weight="semibold" style={s.scoreText}>DNA 적합 {score}%</CuritText></View> : null}</View><CuritText style={s.tileEyebrow} numberOfLines={1}>{subtitle}</CuritText><CuritText weight="semibold" style={s.tileTitle} numberOfLines={1}>{title}</CuritText><CuritText style={s.tileDescription} numberOfLines={2}>{description}</CuritText></Pressable>;
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
  return role === 'creator' ? <CreatorManagement demo={demo} onOpenSettlements={onOpenSettlements} onOpenCollaboration={onOpenCollaboration} /> : <StoreManagement demo={demo} onOpenQr={onOpenQr} onOpenPickup={onOpenPickup} onOpenSettlements={onOpenSettlements} onOpenCollaboration={onOpenCollaboration} />;
}

function CreatorManagement({ demo, onOpenSettlements, onOpenCollaboration }: { demo?: boolean; onOpenSettlements: () => void; onOpenCollaboration: (item: CollaborationSummary) => void }) {
  const summary = useCommerceSummary('creator', demo);
  const collaborations = useCollaborationList('creator', demo);
  const active = collaborations.items.filter(item => !['completed', 'cancelled'].includes(item.status));
  return <View style={s.flex}><Header title="협업 관리" /><ScrollView contentContainerStyle={s.scroll}><View style={s.metricsBox}><Metric value={collaborations.loading ? '—' : String(active.length)} label="진행 중" /><Metric value={collaborations.loading ? '—' : String(collaborations.items.filter(item => item.status === 'completed').length)} label="완료" /><Metric value={summary.loading ? '—' : money(summary.expectedSettlement)} label="예상 정산" /></View><View style={{ marginBottom: 18 }}><Button label="주문·정산 내역" variant="secondary" onPress={onOpenSettlements} /></View><SectionTitle title="진행 중인 협업" />{active.length ? active.map(item => <CollaborationCard key={item.id} item={item} role="creator" onPress={() => onOpenCollaboration(item)} />) : <Empty title="진행 중인 협업이 없습니다" description="AI 큐레이터의 추천에서 매장에 협업을 제안해 보세요." />}</ScrollView></View>;
}

function StoreManagement({ demo, onOpenQr, onOpenPickup, onOpenSettlements, onOpenCollaboration }: { demo?: boolean; onOpenQr: () => void; onOpenPickup: () => void; onOpenSettlements: () => void; onOpenCollaboration: (item: CollaborationSummary) => void }) {
  const summary = useCommerceSummary('store', demo);
  const collaborations = useCollaborationList('store', demo);
  const active = collaborations.items.filter(item => !['completed', 'cancelled'].includes(item.status));
  return <View style={s.flex}><Header title="매장 관리" /><ScrollView contentContainerStyle={s.scroll}><View style={s.metricsBox}><Metric value={summary.loading ? '—' : String(summary.qrViews)} label="QR 조회" /><Metric value={summary.loading ? '—' : `${summary.salesCount}건`} label="이번 달 판매" /><Metric value={summary.loading ? '—' : money(summary.expectedSettlement)} label="예상 정산" /></View><View style={s.quickGrid}><QuickAction icon="qr" label="QR 상품 관리" description="가격·수량·판매 상태" onPress={onOpenQr} /><QuickAction icon="store" label="수령 관리" description="예약·즉시 수령 전달" onPress={onOpenPickup} /><QuickAction icon="management" label="판매·정산" description="주문·정산 내역" onPress={onOpenSettlements} /></View><SectionTitle title="협업·전시 현황" />{active.length ? active.map(item => <CollaborationCard key={item.id} item={item} role="store" onPress={() => onOpenCollaboration(item)} />) : <Empty title="진행 중인 전시가 없습니다" description="AI 추천에서 작품을 선택해 협업 제안을 보내보세요." />}</ScrollView></View>;
}

function CollaborationCard({ item, role, onPress }: { item: CollaborationSummary; role: Role; onPress: () => void }) {
  const labels: Record<CollaborationSummary['status'], string> = { proposed: '승인 대기', negotiating: '조건 조율 중', approved: '최종 확인 필요', active: '전시·판매 중', completed: '완료', cancelled: '취소' };
  return <Pressable style={s.collabCard} onPress={onPress}><Image source={role === 'store' ? images.pottery : images.cafe} style={s.collabImage} /><View style={s.flex}><View style={s.row}><CuritText weight="bold">{item.projectTitle}</CuritText><Chip label={labels[item.status]} /></View><CuritText style={s.muted}>{item.counterpartName}{item.endsOn ? ` · 종료 ${item.endsOn}` : ''}</CuritText><CuritText style={s.gridMeta}>작가 {item.creatorShare}% · 매장 {item.storeShare}% · 플랫폼 {item.platformShare}%</CuritText></View></Pressable>;
}

function QuickAction({ icon, label, description, onPress }: { icon: 'qr' | 'management' | 'chat' | 'store'; label: string; description: string; onPress?: () => void }) { return <Pressable accessibilityRole="button" style={s.quickAction} onPress={onPress}><View style={s.quickIcon}><Icon name={icon} color={colors.brand} /></View><CuritText weight="semibold">{label}</CuritText><CuritText style={s.gridMeta}>{description}</CuritText></Pressable>; }

export function SettlementScreen({ role, demo, onBack }: { role: Role; demo?: boolean; onBack: () => void }) {
  const [entries, setEntries] = useState<SettlementEntry[]>(demo ? demoSettlements : []);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState('');
  useEffect(() => {
    if (demo) return;
    void loadSettlements().then(setEntries).catch(caught => setError(friendlyError(caught))).finally(() => setLoading(false));
  }, [demo]);
  const total = entries.filter(entry => entry.status !== 'cancelled').reduce((sum, entry) => sum + (role === 'creator' ? entry.creatorAmount : entry.storeAmount), 0);
  return <View style={s.flex}><Header title="판매·정산" subtitle={demo ? '심사용 샘플 정산 원장' : '서버 정산 원장'} back={onBack} /><ScrollView contentContainerStyle={s.scroll}><View style={s.settlementSummary}><CuritText style={s.muted}>예정·완료 정산 합계</CuritText><CuritText weight="bold" style={s.settlementTotal}>{money(total)}</CuritText><CuritText style={s.gridMeta}>구매 취소와 보류 건은 합계에서 제외됩니다.</CuritText></View>{loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : null}{error ? <View style={s.errorBox}><CuritText style={{ color: colors.danger }}>{error}</CuritText></View> : null}{!loading && !error && entries.length === 0 ? <Empty title="정산 내역이 없습니다" description="실결제가 승인되면 배분 비율에 따라 정산 원장이 자동 생성됩니다." /> : entries.map(entry => <View key={entry.id} style={s.settlementRow}><View style={s.flex}><CuritText weight="semibold">주문 {entry.orderId.slice(-8)}</CuritText><CuritText style={s.gridMeta}>{new Date(entry.createdAt).toLocaleDateString('ko-KR')} · {entry.scheduledFor ? `${entry.scheduledFor} 정산 예정` : '정산일 확인 중'}</CuritText></View><View style={{ alignItems: 'flex-end' }}><CuritText weight="bold">{money(role === 'creator' ? entry.creatorAmount : entry.storeAmount)}</CuritText><CuritText style={s.settingsValue}>{entry.status === 'paid' ? '지급 완료' : entry.status === 'held' ? '보류' : entry.status === 'cancelled' ? '취소' : '정산 예정'}</CuritText></View></View>)}</ScrollView></View>;
}

export function MyScreen({ role, displayName, demo, onLogout, onOpenProject, onOpenProfile, onOpenDna, onOpenStore, onOpenPreferences, onOpenCollaborations, onOpenVerification, onOpenNotifications, onOpenSettlements, onOpenAccount }: { role: Role; displayName: string; demo?: boolean; onLogout: () => void; onOpenProject?: () => void; onOpenProfile: () => void; onOpenDna: () => void; onOpenStore: () => void; onOpenPreferences: () => void; onOpenCollaborations: () => void; onOpenVerification: () => void; onOpenNotifications: () => void; onOpenSettlements: () => void; onOpenAccount: () => void }) {
  const summary = useCommerceSummary(role, demo);
  const rows = role === 'creator'
    ? [{ icon: 'heart' as const, label: '크리에이터 프로필', onPress: onOpenProfile }, { icon: 'store' as const, label: '작품 DNA', onPress: onOpenDna }, { icon: 'qr' as const, label: '내 전시 프로젝트', onPress: onOpenProject }, { icon: 'chat' as const, label: '협업 제안 내역', onPress: onOpenCollaborations }, { icon: 'heart' as const, label: '활동 인증', onPress: onOpenVerification }, { icon: 'management' as const, label: '판매·정산', onPress: onOpenSettlements }, { icon: 'chat' as const, label: '내 소식', onPress: onOpenNotifications }]
    : [{ icon: 'store' as const, label: '매장 프로필 및 공간 정보', onPress: onOpenStore }, { icon: 'heart' as const, label: '공간 취향 및 전시 구역', onPress: onOpenPreferences }, { icon: 'chat' as const, label: '협업 요청 내역', onPress: onOpenCollaborations }, { icon: 'store' as const, label: '매장 운영 인증', onPress: onOpenVerification }, { icon: 'management' as const, label: '판매·정산', onPress: onOpenSettlements }, { icon: 'chat' as const, label: '내 소식', onPress: onOpenNotifications }, { icon: 'heart' as const, label: '분기 공간 관리', onPress: onOpenPreferences }];
  const openProfile = role === 'creator' ? onOpenProfile : onOpenStore;
  return <View style={s.flex}><ScrollView contentContainerStyle={s.myScroll} showsVerticalScrollIndicator={false}>
    <CuritText style={s.eyebrow}>CURI:T</CuritText>
    <Pressable accessibilityRole="button" style={s.myIdentity} onPress={openProfile}><View style={s.profileAvatar}><CuritText weight="bold" style={{ fontSize: 16 }}>{displayName.slice(0, 2) || 'CU'}</CuritText></View><View style={s.flex}><CuritText weight="bold" style={s.myName}>{displayName}</CuritText><CuritText style={s.muted}>{role === 'creator' ? '도예·세라믹' : '카페'} / 서울</CuritText></View></Pressable>
    <View style={s.myProfilePanel}><View style={s.myPanelTitle}><CuritText weight="semibold">{role === 'creator' ? '크리에이터 프로필' : '매장 프로필'}</CuritText><CuritText style={s.settingsValue}>공개 중</CuritText></View><View style={s.myPanelButtons}><View style={s.flex}><Button label={role === 'creator' ? '프로필 수정' : '매장 정보 수정'} onPress={openProfile} /></View><View style={s.flex}><Button label={role === 'creator' ? '프로필 보기' : '매장 프로필 보기'} variant="secondary" onPress={openProfile} /></View></View></View>
    {role === 'store' ? <Pressable accessibilityRole="button" style={s.myPerformanceCard} onPress={onOpenSettlements}><View style={s.myPanelTitle}><View><CuritText weight="semibold">판매 현황</CuritText><CuritText style={s.gridMeta}>QR 조회와 승인된 주문 기준</CuritText></View><CuritText style={s.curationLink}>판매·정산 보기</CuritText></View><View style={s.myPerformanceMetrics}><Metric value={summary.loading ? '—' : String(summary.qrViews)} label="QR 조회" /><Metric value={summary.loading ? '—' : `${summary.salesCount}건`} label="판매" /><Metric value={summary.loading ? '—' : money(summary.expectedSettlement)} label="예상 정산" /></View></Pressable> : null}
    <View style={s.myMenuBox}>{rows.map(row => <Pressable accessibilityRole="button" key={row.label} style={s.myMenuRow} onPress={row.onPress}><Icon name={row.icon} size={17} color={colors.muted} /><CuritText style={s.flex}>{row.label}</CuritText><Icon name="chevron" size={14} color={colors.subtle} /></Pressable>)}</View>
    <Pressable accessibilityRole="button" style={s.accountAction} onPress={onOpenAccount}><CuritText style={s.muted}>계정 정보 · 개인정보 관리</CuritText><CuritText style={s.muted}>→</CuritText></Pressable>
    <Pressable accessibilityRole="button" style={s.logoutAction} onPress={onLogout}><CuritText style={s.muted}>로그아웃</CuritText></Pressable>
  </ScrollView></View>;
}

export function AccountSettingsScreen({ email, role, demo, onBack, onOpenNotifications, onResetPassword, onLogout }: { email: string; role: Role; demo?: boolean; onBack: () => void; onOpenNotifications: () => void; onResetPassword: () => Promise<void>; onLogout: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const resetPassword = async () => {
    if (demo) { setNotice('심사용 샘플 계정에는 비밀번호 재설정 메일을 보내지 않습니다.'); return; }
    setBusy(true); setNotice('');
    try { await onResetPassword(); setNotice('가입한 이메일로 비밀번호 재설정 링크를 보냈습니다.'); }
    catch (error) { setNotice(friendlyError(error)); }
    finally { setBusy(false); }
  };
  return <View style={s.flex}><Header title="계정 정보" back={onBack} /><ScrollView contentContainerStyle={s.scroll}>
    <View style={s.accountInfoCard}><CuritText weight="bold" style={s.cardTitle}>내 계정</CuritText><View style={s.accountInfoRow}><CuritText style={s.muted}>이메일</CuritText><CuritText weight="semibold" style={s.accountInfoValue}>{email}</CuritText></View><View style={s.accountInfoRow}><CuritText style={s.muted}>계정 유형</CuritText><CuritText weight="semibold">{role === 'creator' ? '크리에이터' : '매장 운영자'}</CuritText></View><View style={s.accountInfoRow}><CuritText style={s.muted}>저장 방식</CuritText><CuritText weight="semibold">{demo ? '기기 내 심사용 샘플' : '암호화 인증 · 서버 저장'}</CuritText></View></View>
    <View style={s.privacyCard}><CuritText weight="semibold">개인정보 표시 범위</CuritText><CuritText style={s.accountDescription}>이메일과 역할, 등록한 작품·공간·협업 정보는 계정 기능 제공에 사용됩니다. 매장 직원에게는 고객의 전체 전화번호 대신 주문번호와 뒤 4자리만 표시합니다.</CuritText></View>
    <View style={s.accountButtons}><Button label="푸시 알림·내 소식 관리" variant="secondary" onPress={onOpenNotifications} /><Button label={busy ? '메일 전송 중…' : '비밀번호 재설정 메일 받기'} variant="secondary" disabled={busy} onPress={() => { void resetPassword(); }} /><Button label="로그아웃" variant="ghost" onPress={() => { void onLogout(); }} /></View>
    {notice ? <View style={s.noticeCard}><CuritText style={s.muted}>{notice}</CuritText></View> : null}
  </ScrollView></View>;
}

export function QrProductsScreen({ demo, onBack, onSelect }: { demo?: boolean; onBack: () => void; onSelect: (item: QrProduct) => void }) {
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
  const totalStock = useMemo(() => items.reduce((sum, item) => sum + item.stock, 0), [items]);
  const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');
  const visibleItems = useMemo(() => items.filter(item => `${item.name} ${item.artistName || ''} ${item.token || ''}`.toLocaleLowerCase('ko-KR').includes(normalizedQuery)), [items, normalizedQuery]);
  return <View style={s.flex}><Header title="QR 상품 관리" subtitle={demo ? '심사용 샘플 전시' : '승인된 협업의 상품별 QR'} back={onBack} /><ScrollView contentContainerStyle={s.scroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}><View style={s.storeInfo}><View style={s.quickIcon}><Icon name="store" color={colors.brand} /></View><View style={s.flex}><CuritText weight="bold">판매 상품</CuritText><CuritText style={s.muted}>전시 상품 {items.length}종 · 판매 가능 {totalStock}개</CuritText></View><Chip label={demo ? '샘플' : '서버 연결'} /></View><Field placeholder="상품명 또는 QR 토큰 검색" value={query} onChangeText={setQuery} returnKeyType="search" />{loading && items.length === 0 ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : null}{error ? <View style={s.errorBox}><CuritText style={{ color: colors.danger }}>{error}</CuritText></View> : null}{!loading && items.length === 0 ? <Empty title="발급 가능한 QR 상품이 없습니다" description="양측 승인이 완료된 협업에서 전시·판매 상품의 QR을 발급할 수 있습니다." /> : !loading && visibleItems.length === 0 ? <Empty title="검색 결과가 없습니다" description="상품명, 작가명 또는 QR 토큰을 다시 확인해 주세요." /> : visibleItems.map((item, index) => <Pressable accessibilityRole="button" key={item.id || item.token} disabled={Boolean(issuing)} style={s.qrRow} onPress={() => { void openOrIssue(item); }}><Image source={item.imageUrl ? { uri: item.imageUrl } : [projects[0]?.image, projects[1]?.image, projects[3]?.image][index % 3]} style={s.qrImage} /><View style={s.flex}><CuritText weight="semibold">{item.name}</CuritText><CuritText style={s.muted}>{money(item.price)} · 재고 {item.stock}개 · {item.issuable ? '발급 전' : item.status === 'ACTIVE' ? '판매 중' : item.status === 'SOLD_OUT' ? '품절' : '판매 전'}</CuritText><CuritText style={s.tokenText} numberOfLines={1}>{item.issuable ? '눌러서 상품 전용 QR 발급' : `QR 조회 ${(item.viewCount || 0).toLocaleString('ko-KR')}회 · ${item.token}`}</CuritText></View><View style={s.qrArrow}>{issuing === (item.id || item.productId) ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon name="qr" size={21} color={colors.brand} />}</View></Pressable>)}</ScrollView></View>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  auth: { flexGrow: 1, paddingHorizontal: 35, paddingTop: 30, paddingBottom: 34 },
  logo: { color: colors.brand, fontSize: 13, letterSpacing: 1.5 }, loginIntro: { marginTop: 38, marginBottom: 30 }, loginTitle: { fontSize: 26, lineHeight: 34, letterSpacing: -1 }, logoCaption: { color: colors.muted, marginTop: 10 },
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
  roundArrow: { width: 46, height: 46, borderRadius: 23, marginTop: 8, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  roundArrowText: { color: colors.surface, fontSize: 21, lineHeight: 24 },
  curationSectionTop: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 14 },
  curationSectionTitle: { color: colors.ink, fontSize: 17, lineHeight: 24, letterSpacing: -.3 },
  curationLinkAction: { minWidth: 72, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  curationLink: { color: colors.brand, fontSize: 11 },
  dnaIntro: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 },
  dnaLabel: { color: colors.brand, fontSize: 10, letterSpacing: 1.2 },
  dnaHint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  dnaPill: { paddingHorizontal: 9, paddingVertical: 4, backgroundColor: colors.brandSoft, borderRadius: radius.pill },
  dnaPillText: { color: colors.brand, fontSize: 10 },
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
  statusCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 18, marginBottom: 14 }, statusTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, metrics: { flexDirection: 'row', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }, metric: { flex: 1, alignItems: 'center' }, metricValue: { fontSize: 16 }, metricLabel: { color: colors.muted, fontSize: 10, marginTop: 3 }, metricsBox: { flexDirection: 'row', backgroundColor: colors.brandPale, borderRadius: radius.md, paddingVertical: 16, marginBottom: 28 },
  aiBanner: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: 14, flexDirection: 'row', gap: 12, marginBottom: 26 }, aiBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  projectList: { gap: 10 }, projectRow: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, projectThumb: { width: 72, height: 72, borderRadius: radius.sm }, tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }, tag: { color: colors.muted, fontSize: 10, backgroundColor: '#F5F5F5', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  recommendReason: { color: colors.brand, fontSize: 10, marginTop: 5 },
  filters: { gap: 8, paddingVertical: 16 }, discoverList: { gap: 14 }, projectTile: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' }, tileImage: { width: '100%', height: 176 }, tileBody: { padding: 14, gap: 7 },
  exploreTabs: { flexDirection: 'row', minHeight: 54, alignItems: 'flex-end', justifyContent: 'space-around', borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: 4, marginBottom: 20 }, exploreTab: { color: colors.muted, paddingBottom: 12 }, exploreTabActive: { color: colors.brand, paddingBottom: 11, borderBottomWidth: 2, borderBottomColor: colors.brand },
  dnaFilter: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 18, overflow: 'hidden' }, dnaFilterHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }, dnaFilterSummary: { flex: 1, minWidth: 0, marginLeft: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }, dnaSummaryText: { color: colors.muted, fontSize: 11, flexShrink: 1, textAlign: 'right' }, dnaFilterBody: { borderTopWidth: 1, borderTopColor: colors.border, padding: 14, gap: 10 }, dnaFilterLabel: { color: colors.muted, fontSize: 11 }, dnaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  searchPad: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }, chatRow: { flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }, chatTime: { color: colors.subtle, fontSize: 10 }, chatProject: { color: colors.brand, fontSize: 11, marginVertical: 2 },
  collabCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, flexDirection: 'row', gap: 12, marginBottom: 12 }, collabImage: { width: 74, height: 74, borderRadius: radius.sm }, progressTrack: { height: 5, backgroundColor: colors.border, borderRadius: 3, marginVertical: 10 }, progress: { height: 5, backgroundColor: colors.brand, borderRadius: 3 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 }, quickAction: { width: '48.5%', minHeight: 112, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, justifyContent: 'center' }, quickIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: colors.border }, profileAvatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, settingsRow: { minHeight: 54, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' },
  myScroll: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 40 },
  myIdentity: { minHeight: 92, marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  myName: { fontSize: 20, lineHeight: 27, letterSpacing: -.4, marginBottom: 3 },
  myProfilePanel: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 17, gap: 14, backgroundColor: colors.surface, marginBottom: 14 },
  myPanelTitle: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  myPanelButtons: { flexDirection: 'row', gap: 8 },
  myPerformanceCard: { borderRadius: radius.lg, padding: 17, backgroundColor: colors.brandPale, marginBottom: 14 },
  myPerformanceMetrics: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 15, marginTop: 12 },
  myMenuBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, marginBottom: 12 },
  myMenuRow: { minHeight: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountAction: { minHeight: 52, paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoutAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  accountInfoCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 17, gap: 4, backgroundColor: colors.surface },
  accountInfoRow: { minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  accountInfoValue: { flex: 1, textAlign: 'right' },
  privacyCard: { marginTop: 16, borderRadius: radius.md, padding: 16, gap: 7, backgroundColor: colors.brandPale },
  accountDescription: { color: colors.muted, lineHeight: 22 },
  accountButtons: { marginTop: 18, gap: 10 },
  settingsValue: { color: colors.brand, fontSize: 12, marginRight: 6 },
  storeInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 14 }, errorBox: { marginVertical: 14, backgroundColor: '#FFF2EF', borderRadius: radius.sm, padding: 13, gap: 5 }, errorHint: { color: colors.muted, fontSize: 11 },
  qrRow: { minHeight: 92, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, qrImage: { width: 66, height: 66, borderRadius: radius.sm }, qrArrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, tokenText: { color: colors.subtle, fontSize: 9, maxWidth: 190 },
  settlementSummary: { backgroundColor: colors.brandPale, borderRadius: radius.lg, padding: 20, marginBottom: 20, gap: 5 }, settlementTotal: { fontSize: 25, color: colors.brand }, settlementRow: { minHeight: 76, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
