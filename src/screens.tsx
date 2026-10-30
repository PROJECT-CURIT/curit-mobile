import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Button, Chip, CuritText, Empty, Field, Header, Icon, SectionTitle } from './ui';
import { colors, fonts, radius } from './theme';
import { images, projects, qrTokens, stores } from './data';
import { loadCollaborations, loadMatchRecommendations } from './curation';
import { fetchQrProduct } from './api';
import { friendlyError, issueQrListing, loadManagedQrProducts, loadSettlements, type SettlementEntry } from './platform';
import type { CollaborationSummary, MatchRecommendation, QrProduct, Role } from './types';

const money = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const demoSettlements: SettlementEntry[] = [{ id: 'demo-settlement', orderId: 'QR-DEMO-20261030', grossAmount: 35000, creatorAmount: 28000, storeAmount: 3500, platformAmount: 3500, status: 'scheduled', scheduledFor: '2026-11-13', createdAt: '2026-10-30T06:00:00Z' }];

async function fetchQrCatalog(demo?: boolean) {
  if (!demo) return { items: await loadManagedQrProducts(), warning: '' };
  const results = await Promise.allSettled(qrTokens.map(token => fetchQrProduct(token)));
  const items = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  return { items, warning: items.length === qrTokens.length ? '' : '일부 샘플 QR 상품을 불러오지 못했습니다.' };
}

export function LoginScreen({ onLogin, onSignUp, onDemo, demoEnabled, configured }: { onLogin: (email: string, password: string) => Promise<void>; onSignUp: () => void; onDemo: (role: Role) => void; demoEnabled: boolean; configured: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!email.trim() || password.length < 8 || busy) return;
    setBusy(true); setError('');
    try { await onLogin(email, password); } catch (caught) { setError(caught instanceof Error ? caught.message : '로그인하지 못했습니다.'); } finally { setBusy(false); }
  };
  return (
    <ScrollView contentContainerStyle={s.auth} keyboardShouldPersistTaps="handled">
      <View style={s.logoWrap}><CuritText weight="extrabold" style={s.logo}>CURI:T</CuritText><CuritText style={s.logoCaption}>작품과 공간을 연결하는 전시 협업 플랫폼</CuritText></View>
      <View style={s.form}>
        <Field label="이메일" value={email} onChangeText={setEmail} placeholder="이메일을 입력해주세요" autoCapitalize="none" keyboardType="email-address" />
        <Field label="비밀번호" value={password} onChangeText={setPassword} placeholder="비밀번호를 입력해주세요" secureTextEntry />
        {error ? <CuritText style={{ color: colors.danger }}>{error}</CuritText> : null}
        {!configured ? <CuritText style={s.demoNote}>서버 환경변수가 아직 연결되지 않았습니다. `.env`에 Supabase URL과 Publishable Key를 설정해 주세요.</CuritText> : null}
        <Button label={busy ? '로그인 중…' : '로그인'} disabled={!configured || !email.trim() || password.length < 8 || busy} onPress={() => { void submit(); }} />
        <View style={s.authLinks}><CuritText style={s.muted}>아이디 찾기</CuritText><View style={s.dividerV} /><CuritText style={s.muted}>비밀번호 찾기</CuritText></View>
      </View>
      <View style={s.signUpRow}><CuritText style={s.muted}>아직 회원이 아니신가요?</CuritText><Pressable onPress={onSignUp}><CuritText weight="semibold" style={s.brandText}>회원가입</CuritText></Pressable></View>
      {demoEnabled ? <View style={s.demoBox}>
        <CuritText weight="semibold">프로토타입 바로 보기</CuritText>
        <CuritText style={s.demoNote}>심사·디자인 확인용 샘플 데이터입니다. 운영 데이터와 분리됩니다.</CuritText>
        <View style={s.twoButtons}><View style={s.flex}><Button label="크리에이터" variant="secondary" onPress={() => onDemo('creator')} /></View><View style={s.flex}><Button label="매장 운영자" onPress={() => onDemo('store')} /></View></View>
      </View> : null}
    </ScrollView>
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
  return <View style={s.flex}><Header title="회원가입" subtitle={role === 'creator' ? '크리에이터' : '매장 운영자'} back={onBack} /><ScrollView contentContainerStyle={s.accountSignup} keyboardShouldPersistTaps="handled"><View><CuritText weight="bold" style={s.pageTitle}>계정을 만들어 주세요</CuritText><CuritText style={s.pageDescription}>이메일 인증 후 모든 기기에서 같은 프로젝트와 이미지를 사용할 수 있어요.</CuritText></View><Field label={role === 'creator' ? '활동명 *' : '담당자명 *'} value={displayName} onChangeText={setDisplayName} placeholder={role === 'creator' ? '예: 김서연 도예' : '예: 최선문'} /><Field label="이메일 *" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" /><Field label="비밀번호 *" value={password} onChangeText={setPassword} secureTextEntry placeholder="8자 이상" /><Field label="비밀번호 확인 *" value={passwordConfirm} onChangeText={setPasswordConfirm} secureTextEntry placeholder="한 번 더 입력" />{passwordConfirm && password !== passwordConfirm ? <CuritText style={{ color: colors.danger }}>비밀번호가 일치하지 않습니다.</CuritText> : null}{notice ? <CuritText style={{ color: colors.danger }}>{notice}</CuritText> : null}<Button label={busy ? '계정 생성 중…' : role === 'store' ? '계정 생성 후 매장 등록' : '크리에이터로 시작'} disabled={!valid || busy} onPress={() => { void submit(); }} /></ScrollView></View>;
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
        <Pressable style={s.roleCard} onPress={() => onSelect('creator')}><View style={s.roleIcon}><Icon name="heart" color={colors.brand} /></View><View style={s.flex}><CuritText weight="bold" style={s.cardTitle}>크리에이터</CuritText><CuritText style={s.muted}>작품·굿즈를 등록하고 매장과 협업해요</CuritText></View><Icon name="chevron" color={colors.muted} /></Pressable>
        <Pressable style={s.roleCard} onPress={() => onSelect('store')}><View style={s.roleIcon}><Icon name="store" color={colors.brand} /></View><View style={s.flex}><CuritText weight="bold" style={s.cardTitle}>매장 운영자</CuritText><CuritText style={s.muted}>공간을 등록하고 어울리는 작품을 찾아요</CuritText></View><Icon name="chevron" color={colors.muted} /></Pressable>
      </View>
    </View>
  );
}

function useCommerceSummary(role: Role, demo?: boolean) {
  const [summary, setSummary] = useState({ salesCount: demo ? 8 : 0, expectedSettlement: demo ? 310000 : 0, loading: !demo });
  useEffect(() => {
    if (demo) return;
    let active = true;
    void loadSettlements()
      .then(entries => {
        if (!active) return;
        const eligible = entries.filter(entry => entry.status !== 'cancelled' && entry.status !== 'held');
        setSummary({
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
  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <View style={s.homeHeader}><View><CuritText style={s.eyebrow}>CURI:T</CuritText><CuritText weight="bold" style={s.greeting}>안녕하세요, {displayName} 님</CuritText></View><View style={s.avatar}><CuritText weight="bold">{displayName[0] || 'C'}</CuritText></View></View>
      <Pressable style={s.heroCard} onPress={() => onMove('management')}><View style={s.heroCopy}><CuritText style={s.heroLabel}>진행 중인 전시</CuritText><CuritText weight="bold" style={s.heroTitle}>흙의 기억</CuritText><CuritText style={s.heroMeta}>아늑한 서울 · QR 조회 203 · {summary.loading ? '—' : `${summary.salesCount}건`} 판매</CuritText></View><Image source={projects[0]?.image} style={s.heroImage} contentFit="cover" /></Pressable>
      <SectionTitle title="새 매장 제안" action="전체 보기" onPress={() => onMove('discover')} />
      <View style={s.grid}>{recommended.items.slice(0, 2).map(item => <RecommendationGridCard key={item.targetId} item={item} />)}{!recommended.loading && !recommended.items.length ? <CuritText style={s.muted}>공개된 매장이 아직 없습니다.</CuritText> : null}</View>
      <SectionTitle title="다음 일정" />
      <View style={s.noticeCard}><View style={s.noticeDate}><CuritText weight="bold" style={{ color: colors.brand }}>18</CuritText><CuritText style={{ color: colors.brand, fontSize: 11 }}>10월</CuritText></View><View style={s.flex}><CuritText weight="semibold">흙의 기억 상품 교체</CuritText><CuritText style={s.muted}>아늑한 서울 · 회수 목록을 확인해주세요</CuritText></View><Icon name="chevron" color={colors.muted} /></View>
    </ScrollView>
  );
}

function StoreHome({ displayName, demo, onMove }: { displayName: string; demo?: boolean; onMove: (target: string) => void }) {
  const summary = useCommerceSummary('store', demo);
  const recommended = useRecommendations('store', demo);
  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <View style={s.homeHeader}><View><CuritText style={s.eyebrow}>CURI:T</CuritText><CuritText weight="bold" style={s.greeting}>{displayName}의 오늘</CuritText></View><View style={s.avatar}><Icon name="store" size={19} /></View></View>
      <Pressable style={s.statusCard} onPress={() => onMove('management')}><View style={s.statusTop}><View><CuritText style={s.muted}>현재 전시</CuritText><CuritText weight="bold" style={s.cardTitle}>흙의 기억</CuritText></View><Chip label="전시·판매 중" /></View><View style={s.metrics}><Metric value="203" label="QR 조회" /><Metric value={summary.loading ? '—' : `${summary.salesCount}건`} label="판매" /><Metric value={summary.loading ? '—' : money(summary.expectedSettlement)} label="예상 정산" /></View></Pressable>
      <Pressable style={s.aiBanner} onPress={() => onMove('chat')}><View style={s.aiBadge}><CuritText weight="bold" style={{ color: colors.brand }}>T</CuritText></View><View style={s.flex}><CuritText weight="semibold">공간 DNA 기준으로 {recommended.items.length}개 작품을 비교했어요</CuritText><CuritText style={s.muted}>취향·예산·설치 구역·재고를 함께 확인했어요</CuritText></View></Pressable>
      <SectionTitle title="AI 추천 작품" action="추천 더 받기" onPress={() => onMove('discover')} />
      <View style={s.projectList}>{recommended.items.slice(0, 3).map(item => <RecommendationRow key={item.targetId} item={item} />)}{recommended.loading ? <ActivityIndicator color={colors.brand} /> : null}</View>
    </ScrollView>
  );
}

function RecommendationGridCard({ item }: { item: MatchRecommendation }) {
  return <View style={s.gridCard}><Image source={item.imageUrl ? { uri: item.imageUrl } : images.cafe} style={s.gridImage} contentFit="cover" /><View style={s.gridBody}><CuritText weight="semibold" numberOfLines={1}>{item.title}</CuritText><CuritText style={s.gridMeta} numberOfLines={2}>{item.subtitle}</CuritText><View style={s.matchBadge}><CuritText weight="semibold" style={s.matchText}>{item.score}% 적합</CuritText></View></View></View>;
}

function RecommendationRow({ item }: { item: MatchRecommendation }) {
  return <View style={s.projectRow}><Image source={item.imageUrl ? { uri: item.imageUrl } : images.pottery} style={s.projectThumb} contentFit="cover" /><View style={s.flex}><View style={s.row}><CuritText weight="semibold" style={s.flex}>{item.title}</CuritText><CuritText weight="semibold" style={s.matchText}>{item.score}% 적합</CuritText></View><CuritText style={s.gridMeta}>{item.priceRange || item.subtitle}</CuritText><CuritText style={s.recommendReason} numberOfLines={1}>{item.reasons[0]}</CuritText></View><Icon name="chevron" size={18} color={colors.subtle} /></View>;
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

export function ManagementScreen({ role, demo, onOpenQr, onOpenSettlements, onOpenCollaboration }: { role: Role; demo?: boolean; onOpenQr: () => void; onOpenSettlements: () => void; onOpenCollaboration: (item: CollaborationSummary) => void }) {
  return role === 'creator' ? <CreatorManagement demo={demo} onOpenSettlements={onOpenSettlements} onOpenCollaboration={onOpenCollaboration} /> : <StoreManagement demo={demo} onOpenQr={onOpenQr} onOpenSettlements={onOpenSettlements} onOpenCollaboration={onOpenCollaboration} />;
}

function CreatorManagement({ demo, onOpenSettlements, onOpenCollaboration }: { demo?: boolean; onOpenSettlements: () => void; onOpenCollaboration: (item: CollaborationSummary) => void }) {
  const summary = useCommerceSummary('creator', demo);
  const collaborations = useCollaborationList('creator', demo);
  const active = collaborations.items.filter(item => !['completed', 'cancelled'].includes(item.status));
  return <View style={s.flex}><Header title="협업 관리" /><ScrollView contentContainerStyle={s.scroll}><View style={s.metricsBox}><Metric value={collaborations.loading ? '—' : String(active.length)} label="진행 중" /><Metric value={collaborations.loading ? '—' : String(collaborations.items.filter(item => item.status === 'completed').length)} label="완료" /><Metric value={summary.loading ? '—' : money(summary.expectedSettlement)} label="예상 정산" /></View><View style={{ marginBottom: 18 }}><Button label="주문·정산 내역" variant="secondary" onPress={onOpenSettlements} /></View><SectionTitle title="진행 중인 협업" />{active.length ? active.map(item => <CollaborationCard key={item.id} item={item} role="creator" onPress={() => onOpenCollaboration(item)} />) : <Empty title="진행 중인 협업이 없습니다" description="AI 큐레이터의 추천에서 매장에 협업을 제안해 보세요." />}</ScrollView></View>;
}

function StoreManagement({ demo, onOpenQr, onOpenSettlements, onOpenCollaboration }: { demo?: boolean; onOpenQr: () => void; onOpenSettlements: () => void; onOpenCollaboration: (item: CollaborationSummary) => void }) {
  const summary = useCommerceSummary('store', demo);
  const collaborations = useCollaborationList('store', demo);
  const active = collaborations.items.filter(item => !['completed', 'cancelled'].includes(item.status));
  return <View style={s.flex}><Header title="매장 관리" /><ScrollView contentContainerStyle={s.scroll}><View style={s.metricsBox}><Metric value={demo ? '203' : '—'} label="QR 조회" /><Metric value={summary.loading ? '—' : `${summary.salesCount}건`} label="이번 달 판매" /><Metric value={summary.loading ? '—' : money(summary.expectedSettlement)} label="예상 정산" /></View><View style={s.quickGrid}><QuickAction icon="qr" label="QR 상품 관리" description="수량·판매 상태" onPress={onOpenQr} /><QuickAction icon="management" label="판매·정산" description="주문·정산 내역" onPress={onOpenSettlements} /></View><SectionTitle title="협업·전시 현황" />{active.length ? active.map(item => <CollaborationCard key={item.id} item={item} role="store" onPress={() => onOpenCollaboration(item)} />) : <Empty title="진행 중인 전시가 없습니다" description="AI 추천에서 작품을 선택해 협업 제안을 보내보세요." />}</ScrollView></View>;
}

function CollaborationCard({ item, role, onPress }: { item: CollaborationSummary; role: Role; onPress: () => void }) {
  const labels: Record<CollaborationSummary['status'], string> = { proposed: '승인 대기', negotiating: '조건 조율 중', approved: '최종 확인 필요', active: '전시·판매 중', completed: '완료', cancelled: '취소' };
  return <Pressable style={s.collabCard} onPress={onPress}><Image source={role === 'store' ? images.pottery : images.cafe} style={s.collabImage} /><View style={s.flex}><View style={s.row}><CuritText weight="bold">{item.projectTitle}</CuritText><Chip label={labels[item.status]} /></View><CuritText style={s.muted}>{item.counterpartName}{item.endsOn ? ` · 종료 ${item.endsOn}` : ''}</CuritText><CuritText style={s.gridMeta}>작가 {item.creatorShare}% · 매장 {item.storeShare}% · 플랫폼 {item.platformShare}%</CuritText></View></Pressable>;
}

function QuickAction({ icon, label, description, onPress }: { icon: 'qr' | 'management' | 'chat' | 'store'; label: string; description: string; onPress?: () => void }) { return <Pressable style={s.quickAction} onPress={onPress}><View style={s.quickIcon}><Icon name={icon} color={colors.brand} /></View><CuritText weight="semibold">{label}</CuritText><CuritText style={s.gridMeta}>{description}</CuritText></Pressable>; }

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

export function MyScreen({ role, displayName, onLogout, onOpenProject }: { role: Role; displayName: string; onLogout: () => void; onOpenProject?: () => void }) {
  const rows = role === 'creator'
    ? [{ label: '내 전시 프로젝트', onPress: onOpenProject }, { label: '프로필 및 활동 정보' }, { label: '알림 설정' }, { label: '계정 및 개인정보' }, { label: '고객센터' }]
    : [{ label: '프로필 및 공간 정보' }, { label: '알림 설정' }, { label: '계정 및 개인정보' }, { label: '이용약관' }, { label: '고객센터' }];
  return <View style={s.flex}><Header title="마이" /><ScrollView contentContainerStyle={s.scroll}><View style={s.profileCard}><View style={s.profileAvatar}><CuritText weight="bold" style={{ fontSize: 22 }}>{displayName[0] || 'C'}</CuritText></View><View style={s.flex}><CuritText weight="bold" style={s.cardTitle}>{displayName}</CuritText><CuritText style={s.muted}>{role === 'creator' ? '크리에이터 계정 · 작품과 프로젝트 관리' : '매장 운영자 계정 · 공간과 정산 관리'}</CuritText></View><Icon name="chevron" color={colors.subtle} /></View>{rows.map(row => <Pressable key={row.label} style={s.settingsRow} onPress={row.onPress}><CuritText style={s.flex}>{row.label}</CuritText>{row.label === '내 전시 프로젝트' ? <CuritText style={s.settingsValue}>관리</CuritText> : null}<Icon name="chevron" size={17} color={colors.subtle} /></Pressable>)}<View style={{ marginTop: 18 }}><Button label="로그아웃" variant="secondary" onPress={onLogout} /></View></ScrollView></View>;
}

export function QrProductsScreen({ demo, onBack }: { demo?: boolean; onBack: () => void }) {
  const [items, setItems] = useState<QrProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState('');
  const [error, setError] = useState('');
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
    if (item.token) { router.push(`/qr/${item.token}`); return; }
    if (!item.issuable || !item.collaborationId || issuing) return;
    setIssuing(item.id || item.productId); setError('');
    try {
      const issued = await issueQrListing(item.productId, item.collaborationId);
      setItems(current => current.map(entry => entry.id === item.id ? issued : entry));
      router.push(`/qr/${issued.token}`);
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
  return <View style={s.flex}><Header title="QR 상품 관리" subtitle={demo ? '심사용 샘플 전시' : '승인된 협업의 상품별 QR'} back={onBack} /><ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}><View style={s.storeInfo}><View style={s.quickIcon}><Icon name="store" color={colors.brand} /></View><View style={s.flex}><CuritText weight="bold">판매 상품</CuritText><CuritText style={s.muted}>전시 상품 {items.length}종 · 판매 가능 {totalStock}개</CuritText></View><Chip label={demo ? '샘플' : '서버 연결'} /></View><Field placeholder="상품명 또는 QR 토큰 검색" />{loading && items.length === 0 ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : null}{error ? <View style={s.errorBox}><CuritText style={{ color: colors.danger }}>{error}</CuritText></View> : null}{!loading && !error && items.length === 0 ? <Empty title="발급 가능한 QR 상품이 없습니다" description="양측 승인이 완료된 협업에서 전시·판매 상품의 QR을 발급할 수 있습니다." /> : items.map((item, index) => <Pressable key={item.id || item.token} disabled={Boolean(issuing)} style={s.qrRow} onPress={() => { void openOrIssue(item); }}><Image source={item.imageUrl ? { uri: item.imageUrl } : [projects[0]?.image, projects[1]?.image, projects[3]?.image][index % 3]} style={s.qrImage} /><View style={s.flex}><CuritText weight="semibold">{item.name}</CuritText><CuritText style={s.muted}>{money(item.price)} · 재고 {item.stock}개 · {item.issuable ? '발급 전' : item.status === 'ACTIVE' ? '판매 중' : item.status === 'SOLD_OUT' ? '품절' : '판매 전'}</CuritText><CuritText style={s.tokenText} numberOfLines={1}>{item.token || '눌러서 상품 전용 QR 발급'}</CuritText></View><View style={s.qrArrow}>{issuing === (item.id || item.productId) ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon name="qr" size={21} color={colors.brand} />}</View></Pressable>)}</ScrollView></View>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  auth: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 40, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 48 }, logo: { color: colors.brand, fontSize: 34, letterSpacing: -1 }, logoCaption: { color: colors.muted, marginTop: 8 },
  form: { gap: 16 }, authLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 }, dividerV: { width: 1, height: 12, backgroundColor: colors.border },
  muted: { color: colors.muted }, brandText: { color: colors.brand }, signUpRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 28 },
  demoBox: { marginTop: 30, padding: 16, backgroundColor: colors.brandPale, borderRadius: radius.md, gap: 10 }, demoNote: { color: colors.muted, fontSize: 12 }, twoButtons: { flexDirection: 'row', gap: 8 },
  roleBody: { flex: 1, padding: 24, gap: 16 }, pageTitle: { fontSize: 25, marginTop: 18 }, pageDescription: { color: colors.muted, marginTop: 8 },
  accountSignup: { flexGrow: 1, padding: 24, gap: 18 },
  confirmationBody: { flex: 1, padding: 24, justifyContent: 'center', gap: 18 },
  roleCard: { minHeight: 104, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }, roleIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, cardTitle: { fontSize: 17, marginBottom: 4 },
  scroll: { padding: 20, paddingBottom: 32 }, homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, eyebrow: { color: colors.brand, fontSize: 10, letterSpacing: 2, fontFamily: fonts.bold }, greeting: { fontSize: 21, marginTop: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  heroCard: { height: 158, backgroundColor: colors.ink, borderRadius: radius.lg, overflow: 'hidden', flexDirection: 'row', marginBottom: 28 }, heroCopy: { flex: 1, padding: 18, justifyContent: 'center', zIndex: 2 }, heroLabel: { color: '#D9DDCF', fontSize: 12 }, heroTitle: { color: colors.surface, fontSize: 21, marginVertical: 8 }, heroMeta: { color: '#CFD3CC', fontSize: 11 }, heroImage: { width: 138, height: '100%', opacity: .78 },
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
  settingsValue: { color: colors.brand, fontSize: 12, marginRight: 6 },
  storeInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 14 }, errorBox: { marginVertical: 14, backgroundColor: '#FFF2EF', borderRadius: radius.sm, padding: 13, gap: 5 }, errorHint: { color: colors.muted, fontSize: 11 },
  qrRow: { minHeight: 92, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, qrImage: { width: 66, height: 66, borderRadius: radius.sm }, qrArrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, tokenText: { color: colors.subtle, fontSize: 9, maxWidth: 190 },
  settlementSummary: { backgroundColor: colors.brandPale, borderRadius: radius.lg, padding: 20, marginBottom: 20, gap: 5 }, settlementTotal: { fontSize: 25, color: colors.brand }, settlementRow: { minHeight: 76, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
