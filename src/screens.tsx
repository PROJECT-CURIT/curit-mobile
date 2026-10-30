import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Button, Chip, CuritText, Empty, Field, Header, Icon, SectionTitle } from './ui';
import { colors, fonts, radius } from './theme';
import { projects, qrTokens, stores } from './data';
import { fetchQrProduct } from './api';
import type { QrProduct, Role } from './types';

const money = (value: number) => `${value.toLocaleString('ko-KR')}원`;

export function LoginScreen({ onLogin, onSignUp }: { onLogin: (role: Role) => void; onSignUp: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <ScrollView contentContainerStyle={s.auth} keyboardShouldPersistTaps="handled">
      <View style={s.logoWrap}><CuritText weight="extrabold" style={s.logo}>CURI:T</CuritText><CuritText style={s.logoCaption}>작품과 공간을 연결하는 전시 협업 플랫폼</CuritText></View>
      <View style={s.form}>
        <Field label="이메일" value={email} onChangeText={setEmail} placeholder="이메일을 입력해주세요" autoCapitalize="none" keyboardType="email-address" />
        <Field label="비밀번호" value={password} onChangeText={setPassword} placeholder="비밀번호를 입력해주세요" secureTextEntry />
        <Button label="로그인" onPress={() => onLogin(email.startsWith('creator') ? 'creator' : 'store')} />
        <View style={s.authLinks}><CuritText style={s.muted}>아이디 찾기</CuritText><View style={s.dividerV} /><CuritText style={s.muted}>비밀번호 찾기</CuritText></View>
      </View>
      <View style={s.signUpRow}><CuritText style={s.muted}>아직 회원이 아니신가요?</CuritText><Pressable onPress={onSignUp}><CuritText weight="semibold" style={s.brandText}>회원가입</CuritText></Pressable></View>
      <View style={s.demoBox}>
        <CuritText weight="semibold">프로토타입 바로 보기</CuritText>
        <CuritText style={s.demoNote}>현재 서버 인증 전 단계이며, 역할별 화면과 QR 연동을 검증할 수 있습니다.</CuritText>
        <View style={s.twoButtons}><View style={s.flex}><Button label="크리에이터" variant="secondary" onPress={() => onLogin('creator')} /></View><View style={s.flex}><Button label="매장 운영자" onPress={() => onLogin('store')} /></View></View>
      </View>
    </ScrollView>
  );
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

export function HomeScreen({ role, onMove }: { role: Role; onMove: (target: string) => void }) {
  return role === 'creator' ? <CreatorHome onMove={onMove} /> : <StoreHome onMove={onMove} />;
}

function CreatorHome({ onMove }: { onMove: (target: string) => void }) {
  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <View style={s.homeHeader}><View><CuritText style={s.eyebrow}>CURI:T</CuritText><CuritText weight="bold" style={s.greeting}>안녕하세요, 김서연 님</CuritText></View><View style={s.avatar}><CuritText weight="bold">김</CuritText></View></View>
      <Pressable style={s.heroCard} onPress={() => onMove('management')}><View style={s.heroCopy}><CuritText style={s.heroLabel}>진행 중인 전시</CuritText><CuritText weight="bold" style={s.heroTitle}>흙의 기억</CuritText><CuritText style={s.heroMeta}>아늑한 서울 · QR 조회 203 · 8건 판매</CuritText></View><Image source={projects[0]?.image} style={s.heroImage} contentFit="cover" /></Pressable>
      <SectionTitle title="새 매장 제안" action="전체 보기" onPress={() => onMove('discover')} />
      <View style={s.grid}>{stores.slice(0, 2).map(store => <StoreCard key={store.name} {...store} />)}</View>
      <SectionTitle title="다음 일정" />
      <View style={s.noticeCard}><View style={s.noticeDate}><CuritText weight="bold" style={{ color: colors.brand }}>18</CuritText><CuritText style={{ color: colors.brand, fontSize: 11 }}>10월</CuritText></View><View style={s.flex}><CuritText weight="semibold">흙의 기억 상품 교체</CuritText><CuritText style={s.muted}>아늑한 서울 · 회수 목록을 확인해주세요</CuritText></View><Icon name="chevron" color={colors.muted} /></View>
    </ScrollView>
  );
}

function StoreHome({ onMove }: { onMove: (target: string) => void }) {
  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <View style={s.homeHeader}><View><CuritText style={s.eyebrow}>CURI:T</CuritText><CuritText weight="bold" style={s.greeting}>아늑한 서울의 오늘</CuritText></View><View style={s.avatar}><Icon name="store" size={19} /></View></View>
      <Pressable style={s.statusCard} onPress={() => onMove('management')}><View style={s.statusTop}><View><CuritText style={s.muted}>현재 전시</CuritText><CuritText weight="bold" style={s.cardTitle}>흙의 기억</CuritText></View><Chip label="전시·판매 중" /></View><View style={s.metrics}><Metric value="203" label="QR 조회" /><Metric value="8건" label="판매" /><Metric value="31만원" label="예상 정산" /></View></Pressable>
      <View style={s.aiBanner}><View style={s.aiBadge}><CuritText weight="bold" style={{ color: colors.brand }}>T</CuritText></View><View style={s.flex}><CuritText weight="semibold">공간 DNA 기준으로 3개 작품을 추천했어요</CuritText><CuritText style={s.muted}>방문객과 예산 조건이 잘 맞는 순서예요</CuritText></View></View>
      <SectionTitle title="AI 추천 작품" action="추천 더 받기" onPress={() => onMove('discover')} />
      <View style={s.projectList}>{projects.slice(0, 3).map(item => <ProjectRow key={item.id} item={item} />)}</View>
    </ScrollView>
  );
}

function Metric({ value, label }: { value: string; label: string }) { return <View style={s.metric}><CuritText weight="bold" style={s.metricValue}>{value}</CuritText><CuritText style={s.metricLabel}>{label}</CuritText></View>; }

function StoreCard({ name, area, mood, image, match }: (typeof stores)[number]) {
  return <Pressable style={s.gridCard}><Image source={image} style={s.gridImage} contentFit="cover" /><View style={s.gridBody}><CuritText weight="semibold" numberOfLines={1}>{name}</CuritText><CuritText style={s.gridMeta}>{area} · {mood}</CuritText><View style={s.matchBadge}><CuritText weight="semibold" style={s.matchText}>{match}% 적합</CuritText></View></View></Pressable>;
}

function ProjectRow({ item }: { item: (typeof projects)[number] }) {
  return <Pressable style={s.projectRow}><Image source={item.image} style={s.projectThumb} contentFit="cover" /><View style={s.flex}><View style={s.row}><CuritText weight="semibold" style={s.flex}>{item.title}</CuritText>{item.match ? <CuritText weight="semibold" style={s.matchText}>{item.match}% 적합</CuritText> : null}</View><CuritText style={s.gridMeta}>{item.priceRange}</CuritText><View style={s.tagRow}>{item.tags.slice(0, 3).map(tag => <CuritText key={tag} style={s.tag}>#{tag}</CuritText>)}</View></View><Icon name="chevron" size={18} color={colors.subtle} /></Pressable>;
}

export function DiscoverScreen({ role }: { role: Role }) {
  const [filter, setFilter] = useState('전체');
  return (
    <View style={s.flex}>
      <Header title={role === 'creator' ? '매장 탐색' : '전시 탐색'} />
      <ScrollView contentContainerStyle={s.scroll}>
        <Field placeholder={role === 'creator' ? '매장명, 지역, 분위기 검색' : '작가명, 작품명, 태그 검색'} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{['전체', '모집 중', '전시·판매 중', '매칭 완료'].map(value => <Chip key={value} label={value} active={filter === value} onPress={() => setFilter(value)} />)}</ScrollView>
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

export function ManagementScreen({ role, onOpenQr }: { role: Role; onOpenQr: () => void }) {
  return role === 'creator' ? <CreatorManagement /> : <StoreManagement onOpenQr={onOpenQr} />;
}

function CreatorManagement() {
  return <View style={s.flex}><Header title="협업 관리" /><ScrollView contentContainerStyle={s.scroll}><View style={s.metricsBox}><Metric value="3" label="진행 중" /><Metric value="12" label="완료" /><Metric value="310,000원" label="예상 정산" /></View><SectionTitle title="진행 중인 협업" /><View style={s.collabCard}><Image source={projects[0]?.image} style={s.collabImage} /><View style={s.flex}><CuritText weight="bold">흙의 기억</CuritText><CuritText style={s.muted}>아늑한 서울 · 전시·판매 중</CuritText><View style={s.progressTrack}><View style={[s.progress, { width: '68%' }]} /></View><CuritText style={s.gridMeta}>종료 2026.12.31 · 8건 판매</CuritText></View></View><View style={s.collabCard}><Image source={projects[2]?.image} style={s.collabImage} /><View style={s.flex}><CuritText weight="bold">고요한 초록</CuritText><CuritText style={s.muted}>리프 쇼룸 · 조건 조율 중</CuritText><CuritText style={s.gridMeta}>작품 수량과 발송일을 확인해주세요</CuritText></View></View></ScrollView></View>;
}

function StoreManagement({ onOpenQr }: { onOpenQr: () => void }) {
  return <View style={s.flex}><Header title="매장 관리" /><ScrollView contentContainerStyle={s.scroll}><View style={s.metricsBox}><Metric value="203" label="QR 조회" /><Metric value="8건" label="이번 달 판매" /><Metric value="31만원" label="예상 정산" /></View><View style={s.quickGrid}><QuickAction icon="qr" label="QR 상품 관리" description="수량·판매 상태" onPress={onOpenQr} /><QuickAction icon="management" label="판매·정산" description="주문·정산 내역" /><QuickAction icon="chat" label="협업 채팅" description="작가와 일정 조율" /><QuickAction icon="store" label="공간 DNA" description="추천 조건 수정" /></View><SectionTitle title="진행 중인 전시" /><View style={s.collabCard}><Image source={projects[0]?.image} style={s.collabImage} /><View style={s.flex}><View style={s.row}><CuritText weight="bold">흙의 기억</CuritText><Chip label="전시·판매 중" /></View><CuritText style={s.muted}>김서연 · 종료 2026.12.31</CuritText><View style={s.tagRow}><CuritText style={s.tag}>QR 203</CuritText><CuritText style={s.tag}>판매 8건</CuritText></View></View></View><View style={s.aiBanner}><View style={s.aiBadge}><CuritText weight="bold" style={{ color: colors.brand }}>T</CuritText></View><View style={s.flex}><CuritText weight="semibold">다음 전시 제안</CuritText><CuritText style={s.muted}>박수아 작가의 겨울 패브릭 컬렉션과 공간 반응이 잘 맞아요.</CuritText></View></View></ScrollView></View>;
}

function QuickAction({ icon, label, description, onPress }: { icon: 'qr' | 'management' | 'chat' | 'store'; label: string; description: string; onPress?: () => void }) { return <Pressable style={s.quickAction} onPress={onPress}><View style={s.quickIcon}><Icon name={icon} color={colors.brand} /></View><CuritText weight="semibold">{label}</CuritText><CuritText style={s.gridMeta}>{description}</CuritText></Pressable>; }

export function MyScreen({ role, onLogout }: { role: Role; onLogout: () => void }) {
  const rows = ['프로필 및 공간 정보', '알림 설정', '계정 및 개인정보', '이용약관', '고객센터'];
  return <View style={s.flex}><Header title="마이" /><ScrollView contentContainerStyle={s.scroll}><View style={s.profileCard}><View style={s.profileAvatar}><CuritText weight="bold" style={{ fontSize: 22 }}>{role === 'creator' ? '김' : '아'}</CuritText></View><View style={s.flex}><CuritText weight="bold" style={s.cardTitle}>{role === 'creator' ? '김서연 도예' : '아늑한 서울'}</CuritText><CuritText style={s.muted}>{role === 'creator' ? '@soyeon_craft · 도예·세라믹' : '서울 성동구 성수동 · 카페'}</CuritText></View><Icon name="chevron" color={colors.subtle} /></View>{rows.map(row => <Pressable key={row} style={s.settingsRow}><CuritText style={s.flex}>{row}</CuritText><Icon name="chevron" size={17} color={colors.subtle} /></Pressable>)}<View style={{ marginTop: 18 }}><Button label="로그아웃" variant="secondary" onPress={onLogout} /></View></ScrollView></View>;
}

export function QrProductsScreen({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<QrProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    const results = await Promise.allSettled(qrTokens.map(token => fetchQrProduct(token)));
    const fulfilled = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    setItems(fulfilled);
    if (fulfilled.length !== qrTokens.length) setError('일부 QR 상품을 불러오지 못했습니다. API 주소와 실행 상태를 확인해주세요.');
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const totalStock = useMemo(() => items.reduce((sum, item) => sum + item.stock, 0), [items]);
  return <View style={s.flex}><Header title="QR 상품 관리" subtitle="흙의 기억 · 아늑한 서울" back={onBack} /><ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}><View style={s.storeInfo}><View style={s.quickIcon}><Icon name="store" color={colors.brand} /></View><View style={s.flex}><CuritText weight="bold">아늑한 서울</CuritText><CuritText style={s.muted}>전시 상품 {items.length}종 · 판매 가능 {totalStock}개</CuritText></View><Chip label="운영 중" /></View><Field placeholder="상품명 또는 QR 토큰 검색" />{loading && items.length === 0 ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : null}{error ? <View style={s.errorBox}><CuritText style={{ color: colors.danger }}>{error}</CuritText><CuritText style={s.errorHint}>`.env`의 API URL은 실기기에서 localhost가 아닌 개발 PC의 LAN IP여야 합니다.</CuritText></View> : null}{!loading && items.length === 0 ? <Empty title="연결된 상품이 없습니다" description="API를 실행하면 상품별 QR 토큰을 실시간으로 조회합니다." /> : items.map((item, index) => <Pressable key={item.token} style={s.qrRow} onPress={() => router.push(`/qr/${item.token}`)}><Image source={[projects[0]?.image, projects[1]?.image, projects[3]?.image][index]} style={s.qrImage} /><View style={s.flex}><CuritText weight="semibold">{item.name}</CuritText><CuritText style={s.muted}>{money(item.price)} · 재고 {item.stock}개</CuritText><CuritText style={s.tokenText} numberOfLines={1}>{item.token}</CuritText></View><View style={s.qrArrow}><Icon name="qr" size={21} color={colors.brand} /></View></Pressable>)}</ScrollView></View>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  auth: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 40, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 48 }, logo: { color: colors.brand, fontSize: 34, letterSpacing: -1 }, logoCaption: { color: colors.muted, marginTop: 8 },
  form: { gap: 16 }, authLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 }, dividerV: { width: 1, height: 12, backgroundColor: colors.border },
  muted: { color: colors.muted }, brandText: { color: colors.brand }, signUpRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 28 },
  demoBox: { marginTop: 30, padding: 16, backgroundColor: colors.brandPale, borderRadius: radius.md, gap: 10 }, demoNote: { color: colors.muted, fontSize: 12 }, twoButtons: { flexDirection: 'row', gap: 8 },
  roleBody: { flex: 1, padding: 24, gap: 16 }, pageTitle: { fontSize: 25, marginTop: 18 }, pageDescription: { color: colors.muted, marginTop: 8 },
  roleCard: { minHeight: 104, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }, roleIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, cardTitle: { fontSize: 17, marginBottom: 4 },
  scroll: { padding: 20, paddingBottom: 32 }, homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, eyebrow: { color: colors.brand, fontSize: 10, letterSpacing: 2, fontFamily: fonts.bold }, greeting: { fontSize: 21, marginTop: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  heroCard: { height: 158, backgroundColor: colors.ink, borderRadius: radius.lg, overflow: 'hidden', flexDirection: 'row', marginBottom: 28 }, heroCopy: { flex: 1, padding: 18, justifyContent: 'center', zIndex: 2 }, heroLabel: { color: '#D9DDCF', fontSize: 12 }, heroTitle: { color: colors.surface, fontSize: 21, marginVertical: 8 }, heroMeta: { color: '#CFD3CC', fontSize: 11 }, heroImage: { width: 138, height: '100%', opacity: .78 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 }, gridCard: { width: '48.5%', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface }, gridImage: { width: '100%', height: 112 }, gridBody: { padding: 12, gap: 4 }, gridMeta: { color: colors.muted, fontSize: 11, lineHeight: 16 }, matchBadge: { marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandSoft }, matchText: { color: colors.brand, fontSize: 11 },
  noticeCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, noticeDate: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  statusCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 18, marginBottom: 14 }, statusTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, metrics: { flexDirection: 'row', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }, metric: { flex: 1, alignItems: 'center' }, metricValue: { fontSize: 16 }, metricLabel: { color: colors.muted, fontSize: 10, marginTop: 3 }, metricsBox: { flexDirection: 'row', backgroundColor: colors.brandPale, borderRadius: radius.md, paddingVertical: 16, marginBottom: 28 },
  aiBanner: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: 14, flexDirection: 'row', gap: 12, marginBottom: 26 }, aiBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  projectList: { gap: 10 }, projectRow: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, projectThumb: { width: 72, height: 72, borderRadius: radius.sm }, tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }, tag: { color: colors.muted, fontSize: 10, backgroundColor: '#F5F5F5', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  filters: { gap: 8, paddingVertical: 16 }, discoverList: { gap: 14 }, projectTile: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' }, tileImage: { width: '100%', height: 176 }, tileBody: { padding: 14, gap: 7 },
  searchPad: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }, chatRow: { flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }, chatTime: { color: colors.subtle, fontSize: 10 }, chatProject: { color: colors.brand, fontSize: 11, marginVertical: 2 },
  collabCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, flexDirection: 'row', gap: 12, marginBottom: 12 }, collabImage: { width: 74, height: 74, borderRadius: radius.sm }, progressTrack: { height: 5, backgroundColor: colors.border, borderRadius: 3, marginVertical: 10 }, progress: { height: 5, backgroundColor: colors.brand, borderRadius: 3 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 }, quickAction: { width: '48.5%', minHeight: 112, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, justifyContent: 'center' }, quickIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: colors.border }, profileAvatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, settingsRow: { minHeight: 54, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' },
  storeInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 14 }, errorBox: { marginVertical: 14, backgroundColor: '#FFF2EF', borderRadius: radius.sm, padding: 13, gap: 5 }, errorHint: { color: colors.muted, fontSize: 11 },
  qrRow: { minHeight: 92, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, qrImage: { width: 66, height: 66, borderRadius: radius.sm }, qrArrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, tokenText: { color: colors.subtle, fontSize: 9, maxWidth: 190 },
});
