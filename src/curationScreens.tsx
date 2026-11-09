import { useContext, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ActivityIndicator, AppState, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { Image } from 'expo-image';
import {
  createCollaborationProposal,
  createCuratorSendRequest,
  loadCollaborationMessages,
  loadCollaborations,
  loadCollaborationItems,
  loadCreatorDirectory,
  loadCuratorMessages,
  loadDiscoveryCandidates,
  loadMatchRecommendations,
  sendCollaborationMessage,
  sendCuratorMessage,
  saveCollaborationTerms,
  requestCollaborationTerms,
  resolveCollaborationTerms,
  transitionCollaboration,
} from './curation';
import { SocialFeedSection } from './fullPrototypeScreens';
import { CreatorProjectScreen } from './detailScreens';
import { projects } from './data';
import { demoCollaborationList, nextDemoCollaborationStatus } from './demoContent';
import { exhibitionPeriodError, formatExhibitionDateInput, suggestedExhibitionPeriod, type ExhibitionPeriod } from './exhibitionPeriod';
import { friendlyError, loadPublicProject } from './platform';
import { storeColors } from './storePreferences';
import { colors, fonts, radius } from './theme';
import { loadWithDeadline } from './asyncRequest';
import type { CollaborationItem, CollaborationMessage, CollaborationSummary, CuratorMessage, MatchRecommendation, Role } from './types';
import type { CreatorDirectoryEntry, CuratorSendRequest } from './curation';
import { Button, Chip, CuritText, Empty, Field, Header, Icon, ScreenFrame, SessionLockedContext } from './ui';

const statusLabel: Record<CollaborationSummary['status'], string> = {
  proposed: '승인 대기', negotiating: '조건 조율 중', approved: '매장 최종 확인', active: '전시·판매 중', completed: '협업 완료', cancelled: '취소',
};

const dnaFilterGroups = [
  ['매장 유형', ['카페', '서점', '쇼룸']],
  ['분위기', ['미니멀', '우드톤', '조용함']],
  ['공간 색감', storeColors],
  ['전시 위치', ['벽면', '선반', '테이블', '창가', '카운터']],
] as const;

type CreatorDirectoryCard = CreatorDirectoryEntry & { imageSource?: number | { uri: string } };

const demoDirectoryProjects: CreatorDirectoryCard[] = projects.map(item => ({
  id: item.id,
  title: item.title,
  artist: item.artist,
  region: item.region,
  tags: item.tags,
  priceRange: item.priceRange,
  status: item.status,
  imageSource: item.image,
}));

export function ChatHubScreen({ role, demo, demoItems, onOpenCurator, onOpenCollaboration }: { role: Role; demo?: boolean; demoItems?: CollaborationSummary[]; onOpenCurator: () => void; onOpenCollaboration: (item: CollaborationSummary) => void }) {
  const [loadedItems, setLoadedItems] = useState<CollaborationSummary[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const items = demo ? (demoItems ?? demoCollaborationList(role)) : loadedItems;
  useEffect(() => {
    if (demo) return;
    let active = true;
    const controller = new AbortController();
    void loadWithDeadline(signal => loadCollaborations(role, undefined, signal), controller)
      .then(value => { if (active) setLoadedItems(value); })
      .catch(caught => { if (active) setError(friendlyError(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [demo, role, attempt]);
  return <View style={c.flex}>
    <Header title="채팅" />
    <ScrollView contentContainerStyle={c.hubScroll}>
      <Pressable accessibilityRole="button" style={c.curatorPin} onPress={onOpenCurator} accessibilityLabel="AI 큐레이터 대화 열기">
        <View style={c.curatorAvatar}><CuritText weight="bold" style={c.brandText}>T</CuritText></View>
        <View style={c.flex}><CuritText weight="semibold" style={c.brandText}>{role === 'creator' ? '나만의 AI 콘셉트 큐레이터' : '나만의 CURI:T AI 큐레이터'}</CuritText><CuritText style={c.pinCaption}>{role === 'creator' ? '작품과 어울리는 공간을 데이터로 찾아요.' : '공간과 운영 조건에 맞는 작품을 찾아요.'}</CuritText></View>
        <CuritText weight="semibold" style={c.pinAction}>상담하기</CuritText>
      </Pressable>
      <View style={c.listHeading}><CuritText weight="bold">함께하는 대화</CuritText><CuritText style={c.muted}>{items.length}</CuritText></View>
      {loading ? <ActivityIndicator color={colors.brand} style={c.loader} /> : null}
      {error ? <View style={[c.error, { gap: 10 }]}><CuritText accessibilityRole="alert" style={c.errorText}>{error}</CuritText><Button label="대화 다시 불러오기" variant="secondary" onPress={() => { setError(''); setLoading(true); setAttempt(value => value + 1); }} /></View> : null}
      {!loading && !error && !items.length ? <Empty title="아직 협업 대화가 없어요" description="AI 큐레이터의 추천에서 협업을 제안하면 상대방과 대화를 시작할 수 있어요." /> : items.map(item => <Pressable accessibilityRole="button" accessibilityLabel={`${item.counterpartName} ${item.projectTitle} 협업 대화 열기`} key={item.id} style={c.chatRow} onPress={() => onOpenCollaboration(item)}>
        <View style={c.contactAvatar}><CuritText weight="bold">{item.counterpartName[0] || 'C'}</CuritText></View>
        <View style={c.flex}><View style={c.between}><CuritText weight="semibold" style={c.chatName}>{item.counterpartName}</CuritText><CuritText style={c.time}>{new Date(item.updatedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</CuritText></View><View style={c.chatProjectRow}><CuritText style={c.project} numberOfLines={1}>{item.projectTitle}</CuritText><View style={c.chatStatus}><View style={c.chatStatusDot} /><CuritText style={c.chatStatusText}>{statusLabel[item.status]}</CuritText></View></View><CuritText style={c.muted} numberOfLines={1}>{String(item.terms.message || '조건과 일정을 확인해 주세요.')}</CuritText></View>
      </Pressable>)}
    </ScrollView>
  </View>;
}

const discoverDisplayStep = 8;

export function MatchingDiscoverScreen({ role, demo, currentUserName, onOpenCurator, onProposalCreated }: { role: Role; demo?: boolean; currentUserName?: string; onOpenCurator: () => void; onProposalCreated: (id: string, period?: ExhibitionPeriod) => Promise<void> }) {
  const [items, setItems] = useState<MatchRecommendation[]>([]);
  const [query, setQuery] = useState('');
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [matchDisplayCount, setMatchDisplayCount] = useState(discoverDisplayStep);
  const [directoryDisplayCount, setDirectoryDisplayCount] = useState(discoverDisplayStep);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [region, setRegion] = useState('전체');
  const [dnaFilters, setDnaFilters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [section, setSection] = useState<'matches' | 'creators' | 'news'>('matches');
  const [newsVisited, setNewsVisited] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [matchAttempt, setMatchAttempt] = useState(0);
  const [directoryAttempt, setDirectoryAttempt] = useState(0);
  const [directoryVisited, setDirectoryVisited] = useState(false);
  const [directory, setDirectory] = useState<{ projects: CreatorDirectoryCard[]; error: string } | null>(null);
  const directoryProjects = demo ? demoDirectoryProjects : (directory?.projects ?? []);
  const directoryLoading = !demo && directory === null;
  const directoryError = demo ? '' : (directory?.error ?? '');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void loadWithDeadline(signal => loadDiscoveryCandidates(role, demo, signal), controller)
      .then(value => { if (active) setItems(value); })
      .catch(caught => { if (active) setMatchError(friendlyError(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [demo, role, matchAttempt]);
  useEffect(() => {
    if (demo || !directoryVisited) return;
    let active = true;
    const controller = new AbortController();
    void loadWithDeadline(loadCreatorDirectory, controller).then(projects => {
      if (active) setDirectory({ projects, error: '' });
    }).catch(caught => {
      if (active) setDirectory({ projects: [], error: friendlyError(caught) });
    });
    return () => { active = false; controller.abort(); };
  }, [demo, directoryAttempt, directoryVisited]);
  const visible = items.filter(item => {
    const text = [item.title, item.subtitle, item.description, ...item.tags, ...(item.searchTerms ?? [])].join(' ').toLocaleLowerCase('ko-KR');
    const queryMatches = text.includes(query.trim().toLocaleLowerCase('ko-KR'));
    const regionMatches = role !== 'creator' || region === '전체' || region === '전국 / 온라인'
      || region.split(/[·/]/).some(value => value.trim() && text.includes(value.trim().toLocaleLowerCase('ko-KR')));
    const dnaMatches = role !== 'creator' || dnaFilterGroups.every(([, values]) => {
      const selected = values.filter(value => dnaFilters.includes(value));
      return selected.length === 0 || selected.some(value => text.includes(value.toLocaleLowerCase('ko-KR')));
    });
    return queryMatches && regionMatches && dnaMatches;
  });
  const visibleDirectoryProjects = directoryProjects.filter(item => [item.title, item.artist, item.region, ...item.tags, ...(item.searchTerms ?? [])].join(' ').toLocaleLowerCase('ko-KR').includes(directoryQuery.trim().toLocaleLowerCase('ko-KR')));
  const toggleDna = (value: string) => {
    setDnaFilters(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
    setMatchDisplayCount(discoverDisplayStep);
  };
  const resetFilters = () => { setRegion('전체'); setDnaFilters([]); setMatchDisplayCount(discoverDisplayStep); };
  const propose = async (item: MatchRecommendation, period?: ExhibitionPeriod) => {
    if (busy) return;
    setBusy(item.targetId); setNotice('');
    try {
      if (demo) { await onProposalCreated(item.collaborationId || 'demo-proposal', period); return; }
      if (item.collaborationId) { setNotice('이미 진행 중인 협업으로 이동합니다.'); await onProposalCreated(item.collaborationId); return; }
      const id = await createCollaborationProposal(item, `${item.title}과(와) 전시 협업을 제안합니다.`, period);
      setNotice('협업 제안을 보냈습니다. 채팅에서 승인 상태를 확인할 수 있어요.');
      if (id) await onProposalCreated(id);
    } catch (caught) { setNotice(friendlyError(caught)); } finally { setBusy(''); }
  };
  return <View style={c.flex}>
    <Header title={role === 'creator' ? '매장 탐색' : '전시 탐색'} action={<Pressable accessibilityRole="button" accessibilityLabel="AI 큐레이터 열기" hitSlop={10} onPress={onOpenCurator}><View style={c.headerAi}><CuritText weight="bold" style={c.brandText}>AI</CuritText></View></Pressable>} />
    <ScrollView style={c.flex} contentContainerStyle={c.discoverScroll} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'} keyboardShouldPersistTaps="handled">
      {section !== 'news' ? <View style={c.searchBox}><Icon name="discover" size={17} color={colors.muted} /><TextInput value={section === 'creators' ? directoryQuery : query} onChangeText={value => {
        if (section === 'creators') { setDirectoryQuery(value); setDirectoryDisplayCount(discoverDisplayStep); }
        else { setQuery(value); setMatchDisplayCount(discoverDisplayStep); }
      }} placeholder={role === 'creator' && section === 'matches' ? '매장명, 지역, 공간 DNA 검색' : '작가명, 작품명, 태그 검색'} placeholderTextColor={colors.subtle} style={c.searchInput} /></View> : null}
      <View accessibilityRole="tablist" style={c.exploreTabs}>{(role === 'creator' ? [['matches', '매장'], ['creators', '작품·작가'], ['news', '소식']] : [['matches', '전시 프로젝트'], ['news', '크리에이터 소식']]).map(([value, label]) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: section === value }} key={value} style={[c.exploreTab, section === value && c.exploreTabActive]} onPress={() => {
        if (section === value) return;
        Keyboard.dismiss();
        if (value === 'news') setNewsVisited(true);
        if (value === 'creators') setDirectoryVisited(true);
        setSection(value as 'matches' | 'creators' | 'news');
      }}><CuritText weight={section === value ? 'semibold' : 'regular'} style={section === value ? c.brandText : c.muted}>{label}</CuritText></Pressable>)}</View>
      {newsVisited ? <View style={section !== 'news' ? { display: 'none' } : undefined} accessibilityElementsHidden={section !== 'news'} importantForAccessibility={section === 'news' ? 'auto' : 'no-hide-descendants'}><SocialFeedSection canPost={role === 'creator'} demo={demo} currentUserName={currentUserName} /></View> : null}
      {section === 'news' ? null : section === 'creators' ? <CreatorDirectory demo={demo} items={visibleDirectoryProjects.slice(0, directoryDisplayCount)} hasMore={visibleDirectoryProjects.length > directoryDisplayCount} onMore={() => setDirectoryDisplayCount(count => count + discoverDisplayStep)} hasSearch={Boolean(directoryQuery.trim())} loading={directoryLoading} error={directoryError} onRetry={() => { setDirectory(null); setDirectoryAttempt(value => value + 1); }} /> : <>
      {role === 'creator' ? <>
        <CuritText weight="bold" style={c.directoryTitle}>작품과 어울리는 공간</CuritText>
        <View style={c.filterCard}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: filtersOpen }} style={c.filterHeader} onPress={() => setFiltersOpen(value => !value)}>
            <View style={c.flex}><CuritText weight="semibold">공간 필터</CuritText><CuritText style={c.filterEyebrow} numberOfLines={1}>{[region !== '전체' ? region : '', ...dnaFilters].filter(Boolean).join(' · ') || '지역과 공간 DNA를 한 번에 설정'}</CuritText></View>
            <View style={c.filterHeaderAction}>{region !== '전체' || dnaFilters.length ? <CuritText style={c.filterCount}>{(region !== '전체' ? 1 : 0) + dnaFilters.length}</CuritText> : null}<View style={{ transform: [{ rotate: filtersOpen ? '-90deg' : '90deg' }] }}><Icon name="chevron" size={17} color={colors.brand} /></View></View>
          </Pressable>
          {filtersOpen ? <View style={c.filterBody}>
            <View style={c.filterGroup}><CuritText style={c.filterEyebrow}>지역</CuritText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={c.filterOptionsHorizontal}>{['전체', '서울', '경기', '인천', '강원', '충청', '전라', '경상', '제주', '전국 / 온라인'].map(value => <Chip key={value} label={value} active={region === value} onPress={() => { setRegion(value); setMatchDisplayCount(discoverDisplayStep); }} />)}</ScrollView></View>
            {dnaFilterGroups.map(([label, values]) => <View key={label} style={c.filterGroup}><CuritText style={c.filterEyebrow}>{label}</CuritText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={c.filterOptionsHorizontal}>{values.map(value => <Chip key={value} label={value} active={dnaFilters.includes(value)} onPress={() => toggleDna(value)} />)}</ScrollView></View>)}
            <Pressable accessibilityRole="button" style={c.resetFilter} onPress={resetFilters}><CuritText style={c.muted}>선택 초기화</CuritText></Pressable>
          </View> : null}
        </View>
      </> : null}
      <CuritText style={[c.pinCaption, { marginTop: 12 }]}>조건 일치도는 취향·지역·재고·등록 구역 기준의 참고 점수예요.</CuritText>
      <View style={c.listHeading}><CuritText weight="bold">{query.trim() || region !== '전체' || dnaFilters.length ? '검색 결과' : '맞춤 추천'}</CuritText>{!loading && !matchError ? <CuritText style={c.muted}>{visible.length}개</CuritText> : null}</View>
      {loading ? <ActivityIndicator color={colors.brand} style={c.loader} /> : matchError ? <View style={c.error}><CuritText style={c.errorText}>{matchError}</CuritText><Button label="다시 불러오기" variant="secondary" onPress={() => { setLoading(true); setMatchError(''); setMatchAttempt(value => value + 1); }} /></View> : visible.length ? <>
        {visible.slice(0, matchDisplayCount).map(item => <View key={item.targetId} style={c.discoverCard}><RecommendationCard item={item} demo={demo} inset={false} busy={busy === item.targetId} onPropose={period => { void propose(item, period); }} /></View>)}
        {visible.length > matchDisplayCount ? <Button label="후보 더 보기" variant="secondary" onPress={() => setMatchDisplayCount(count => count + discoverDisplayStep)} /> : null}
      </> : <Empty title="조건에 맞는 후보가 없어요" description="검색어를 바꾸거나 등록한 공간·작품 DNA를 보완해 주세요." />}
      {notice ? <View style={c.notice}><CuritText style={notice.includes('못') || notice.includes('오류') ? c.errorText : c.brandText}>{notice}</CuritText></View> : null}
      </>}
    </ScrollView>
  </View>;
}

function CreatorDirectory({ items, loading, error, hasMore, hasSearch, demo, onMore, onRetry }: { items: CreatorDirectoryCard[]; loading: boolean; error: string; hasMore: boolean; hasSearch: boolean; demo?: boolean; onMore: () => void; onRetry: () => void }) {
  const [selected, setSelected] = useState<CreatorDirectoryCard | null>(null);
  return <View style={c.creatorDirectory}>
    <View><CuritText weight="bold" style={c.directoryTitle}>작품과 작가</CuritText><CuritText style={c.muted}>다른 크리에이터의 작품 세계와 활동을 살펴보세요.</CuritText></View>
    {loading ? <ActivityIndicator color={colors.brand} style={c.loader} /> : error ? <View style={c.error}><CuritText style={c.errorText}>{error}</CuritText><Button label="다시 불러오기" variant="secondary" onPress={onRetry} /></View> : items.length ? items.map(item => <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} 프로젝트 상세`} key={item.id} style={c.creatorCard} onPress={() => { Keyboard.dismiss(); setSelected(item); }}>
      {item.imageSource ? <Image source={item.imageSource} style={c.creatorCardImage} contentFit="cover" /> : item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={c.creatorCardImage} contentFit="cover" /> : <View style={[c.creatorCardImage, c.cardImagePlaceholder]}><Icon name="discover" color={colors.brand} /><CuritText style={c.pinCaption}>이미지 준비 중</CuritText></View>}
      <View style={c.creatorCardBody}><View style={c.between}><View style={c.flex}><CuritText weight="bold" style={c.creatorCardTitle}>{item.title}</CuritText><CuritText style={c.muted}>{item.artist} · {item.region}</CuritText></View><Icon name="chevron" size={17} color={colors.brand} /></View><View style={c.tags}>{item.tags.slice(0, 4).map(tag => <CuritText key={tag} style={c.tag}>#{tag}</CuritText>)}</View><CuritText style={c.pinCaption}>{item.priceRange} · {item.status}</CuritText></View>
    </Pressable>) : <Empty title={hasSearch ? '조건에 맞는 작품이 없어요' : '공개된 작품이 없습니다'} description={hasSearch ? '작가명이나 작품 이름을 바꿔 검색해 보세요.' : '크리에이터가 협업 모집을 시작하면 이곳에서 확인할 수 있어요.'} />}
    {hasMore ? <Button label="작품 더 보기" variant="secondary" onPress={onMore} /> : null}
    {selected ? <PublicProjectModal id={selected.id} artist={selected.artist} demo={demo} onClose={() => setSelected(null)} /> : null}
  </View>;
}

function PublicProjectModal({ id, artist, demo, onClose }: { id: string; artist?: string; demo?: boolean; onClose: () => void }) {
  const sessionLocked = useContext(SessionLockedContext);
  const [result, setResult] = useState<Awaited<ReturnType<typeof loadPublicProject>>>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const sample = demo ? projects.find(project => project.id === id) : undefined;
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    let active = true;
    void loadWithDeadline(signal => loadPublicProject(id, signal), controller)
      .then(value => { if (active) setResult(value); })
      .catch(caught => { if (active) setError(friendlyError(caught)); });
    return () => { active = false; controller.abort(); };
  }, [attempt, demo, id]);

  return <Modal visible={!sessionLocked} animationType="fade" onRequestClose={onClose}>
    <ScreenFrame>
      {sample ? <CreatorProjectScreen project={{ id, title: sample.title, concept: sample.tags.join(' · '), story: '', region: sample.region, purpose: '', status: sample.status === '모집 중' ? 'recruiting' : 'matched', coverPath: '', coverUrl: '' }} products={[]} artist={sample.artist} fallbackCover={sample.image} onBack={onClose} />
        : result ? <CreatorProjectScreen project={result.project} products={result.products} artist={artist} fallbackCover={result.products[0]?.image ? { uri: result.products[0].image } : undefined} onBack={onClose} />
        : <>
          <Header title="전시 프로젝트" back={onClose} />
          {error ? <ScrollView style={c.flex} contentContainerStyle={c.detailScroll}>
            <View style={c.error} accessibilityRole="alert">
              <CuritText weight="semibold" style={c.errorText}>프로젝트를 불러오지 못했어요</CuritText>
              <CuritText style={c.errorText}>{error}</CuritText>
            </View>
            <Button label="다시 불러오기" variant="secondary" onPress={() => { setError(''); setAttempt(value => value + 1); }} />
          </ScrollView>
            : result === null || demo ? <Empty title="현재 공개된 프로젝트가 아니에요" description="공개 상태가 변경됐을 수 있어요. 탐색 목록으로 돌아가 다른 작품을 확인해 주세요." />
            : <ActivityIndicator accessibilityLabel="프로젝트를 불러오고 있어요" color={colors.brand} style={c.loader} />}
        </>}
    </ScreenFrame>
  </Modal>;
}

function demoWelcome(role: Role): CuratorMessage {
  return {
    id: 'demo-welcome', sender: 'assistant',
    content: role === 'store' ? '등록한 공간과 작품의 취향·지역·판매 재고를 비교해 협업 후보를 찾아드릴게요.' : '작품 DNA와 활동 지역을 바탕으로 실제 협업 가능한 매장을 찾아드릴게요.',
    recommendations: [], actions: role === 'store' ? ['우리 공간에 어울리는 작품을 추천해 주세요', '협업 진행 방법을 알려주세요'] : ['내 작품과 어울리는 매장을 추천해 주세요', '협업과 출고 흐름을 알려주세요'], createdAt: new Date().toISOString(),
  };
}

export function CuratorScreen({ role, demo, onBack, onProposalCreated }: { role: Role; demo?: boolean; onBack: () => void; onProposalCreated: (id: string, period?: ExhibitionPeriod) => Promise<void> }) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [messages, setMessages] = useState<CuratorMessage[]>(demo ? [demoWelcome(role)] : []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(!demo);
  const [sending, setSending] = useState(false);
  const [proposalTarget, setProposalTarget] = useState('');
  const [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const sendLock = useRef(false);
  const sendController = useRef<AbortController | null>(null);
  const pendingSend = useRef<{ text: string; request: CuratorSendRequest } | null>(null);
  useEffect(() => () => { sendController.current?.abort(); }, []);
  useEffect(() => {
    if (demo) return;
    let active = true;
    const controller = new AbortController();
    void loadWithDeadline(signal => Promise.all([loadCuratorMessages(role, signal), loadMatchRecommendations(role, false, '', signal)]), controller)
      .then(([savedMessages, currentRecommendations]) => {
        if (!active) return;
        const currentByTarget = new Map(currentRecommendations.map(item => [`${item.targetType}:${item.targetId}`, item]));
        setMessages(savedMessages.map(message => ({
          ...message,
          recommendations: message.recommendations.map(saved => currentByTarget.get(`${saved.targetType}:${saved.targetId}`) ?? saved),
        })));
      })
      .catch(caught => { if (active) setLoadError(friendlyError(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [demo, role, attempt]);

  const submit = async (text = input) => {
    const value = text.trim();
    if (!value || loading || loadError || sendLock.current) return;
    if (value.length > 4000) { setNotice('메시지는 4,000자까지 입력해 주세요.'); return; }
    sendLock.current = true;
    setSending(true); setNotice('');
    try {
      if (demo) {
        const recs = /추천|어울|찾|매칭/.test(value) ? await loadMatchRecommendations(role, true) : [];
        const now = new Date().toISOString();
        setMessages(current => [...current,
          { id: `du-${Date.now()}`, sender: 'user', content: value, recommendations: [], actions: [], createdAt: now },
          { id: `da-${Date.now()}`, sender: 'assistant', content: recs.length ? `${recs[0]?.title}이(가) 조건 일치도 ${recs[0]?.score}점으로 가장 높아요. 추천 이유와 실제 협업 조건을 확인해 보세요.` : '협업은 제안, 크리에이터 승인, 매장 최종 확정 순서로 진행됩니다.', recommendations: recs.slice(0, 3), actions: recs.length ? ['다른 후보도 비교해 주세요'] : [role === 'store' ? '우리 공간에 어울리는 작품을 추천해 주세요' : '내 작품과 어울리는 매장을 추천해 주세요'], createdAt: now },
        ]);
      } else {
        if (!pendingSend.current || pendingSend.current.text !== value) pendingSend.current = { text: value, request: createCuratorSendRequest() };
        const request = pendingSend.current.request;
        const controller = new AbortController();
        sendController.current = controller;
        const appended = await loadWithDeadline(signal => sendCuratorMessage(role, value, request, signal), controller);
        setMessages(current => {
          const existing = new Set(current.map(message => message.id));
          return [...current, ...appended.filter(message => !existing.has(message.id))];
        });
        pendingSend.current = null;
      }
      setInput(current => current === text ? '' : current);
    } catch (caught) { setNotice(friendlyError(caught)); } finally { sendController.current = null; sendLock.current = false; setSending(false); }
  };

  const propose = async (item: MatchRecommendation, period?: ExhibitionPeriod) => {
    if (loading || loadError || proposalTarget) return;
    setProposalTarget(item.targetId); setNotice('');
    try {
      if (demo) {
        setNotice('협업 조건을 확인할 수 있는 대화방으로 이동합니다.');
        await onProposalCreated(item.collaborationId || 'demo-proposal', period);
        return;
      }
      if (item.collaborationId) {
        setNotice('이미 진행 중인 협업으로 이동합니다.');
        await onProposalCreated(item.collaborationId);
        return;
      }
      const id = await createCollaborationProposal(item, `${item.title}과(와) 전시 협업을 제안합니다. 조건 일치도 ${item.score}점과 추천 이유를 확인했습니다.`, period);
      setNotice('협업 제안을 보냈습니다. 상대방 승인 후 다음 단계가 열립니다.');
      if (id) await onProposalCreated(id);
    } catch (caught) { setNotice(friendlyError(caught)); } finally { setProposalTarget(''); }
  };

  const topics = role === 'store' ? ['우리 공간에 어울리는 작품을 추천해 주세요', '협업 진행 방법을 알려주세요', 'QR 판매 운영을 알려주세요'] : ['내 작품과 어울리는 매장을 추천해 주세요', '협업과 출고 흐름을 알려주세요', '판매와 정산을 알려주세요'];
  return <KeyboardAvoidingView style={c.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title={role === 'creator' ? 'AI 콘셉트 큐레이터' : 'CURI:T AI 큐레이터'} subtitle="취향·지역·재고 기반 추천" back={onBack} />
    <ScrollView ref={scrollRef} style={c.flex} contentContainerStyle={c.chatScroll} keyboardShouldPersistTaps="handled">
      {loading ? <ActivityIndicator color={colors.brand} style={c.loader} /> : messages.map((message, index) => <View key={message.id} style={c.messageBlock} onLayout={index === messages.length - 1 ? event => scrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 10), animated: true }) : undefined}>
        <View style={[c.bubbleRow, message.sender === 'user' && c.bubbleRowUser]}>
          {message.sender === 'assistant' ? <View style={c.smallAvatar}><CuritText weight="bold" style={c.brandText}>T</CuritText></View> : null}
          <View style={[c.bubble, message.sender === 'user' ? c.userBubble : c.aiBubble]}><CuritText style={message.sender === 'user' ? c.userText : undefined}>{message.content}</CuritText></View>
        </View>
        {message.recommendations.map(item => <RecommendationCard key={`${message.id}-${item.targetId}`} item={item} demo={demo} busy={proposalTarget === item.targetId} onPropose={period => { void propose(item, period); }} />)}
        {message.actions.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={c.actionRow}>{message.actions.map(action => <Chip key={action} label={action} onPress={sending || loading || loadError ? undefined : () => { void submit(action); }} />)}</ScrollView> : null}
      </View>)}
      {sending ? <View style={c.typing}><ActivityIndicator size="small" color={colors.brand} /><CuritText style={c.muted}>등록 데이터와 조건을 비교하고 있어요…</CuritText></View> : null}
    </ScrollView>
    <View style={c.composerWrap}>
      {loadError ? <View style={[c.error, { marginHorizontal: 12, marginVertical: 4, gap: 8 }]}><CuritText accessibilityRole="alert" style={c.errorText}>{loadError}</CuritText><Button label="대화 다시 불러오기" variant="secondary" onPress={() => { setLoadError(''); setLoading(true); setAttempt(value => value + 1); }} /></View> : null}
      {notice ? <View accessibilityLiveRegion="polite" style={[c.notice, { marginHorizontal: 12, marginBottom: 8 }]}><CuritText style={notice.includes('못') || notice.includes('오류') ? c.errorText : c.brandText}>{notice}</CuritText></View> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={c.topicRow}>{topics.map(topic => <Chip key={topic} label={topic.replace('해 주세요', '')} onPress={sending ? undefined : () => setInput(topic)} />)}</ScrollView>
      <View style={c.composer}><TextInput accessibilityLabel="큐레이터에게 보낼 메시지" maxLength={4000} value={input} onChangeText={setInput} onSubmitEditing={() => { void submit(); }} editable={!sending} placeholder="메시지를 입력해 주세요" placeholderTextColor={colors.subtle} style={c.input} /><Pressable accessibilityRole="button" accessibilityLabel="메시지 보내기" accessibilityState={{ disabled: !input.trim() || sending || loading || Boolean(loadError) }} disabled={!input.trim() || sending || loading || Boolean(loadError)} style={[c.send, (!input.trim() || sending || loading || Boolean(loadError)) && c.sendDisabled]} onPress={() => { void submit(); }}><CuritText weight="bold" style={c.sendText}>↑</CuritText></Pressable></View>
    </View>
  </KeyboardAvoidingView>;
}

export function RecommendationScreen({ item, demo, onBack, onOpenCollaboration }: {
  item: MatchRecommendation;
  demo?: boolean;
  onBack: () => void;
  onOpenCollaboration: (id: string, period?: ExhibitionPeriod) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const propose = async (period?: ExhibitionPeriod) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const id = item.collaborationId || (demo ? 'demo-proposal' : await createCollaborationProposal(item, `${item.title} 전시 협업을 제안합니다.`, period));
      await onOpenCollaboration(id, period);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setBusy(false);
    }
  };

  return <View style={c.flex}>
    <Header title={item.targetType === 'project' ? '추천 작품' : '추천 공간'} subtitle="추천 이유와 협업 조건" back={onBack} />
    <ScrollView contentContainerStyle={c.discoverScroll}>
      <RecommendationCard item={item} demo={demo} busy={busy} inset={false} showConfirmationNotes onPropose={period => { void propose(period); }} />
      {error ? <View style={c.error}><CuritText accessibilityRole="alert" style={c.errorText}>{error}</CuritText></View> : null}
    </ScrollView>
  </View>;
}

function RecommendationCard({ item, busy, demo, onPropose, inset = true, showConfirmationNotes = false }: { item: MatchRecommendation; busy: boolean; demo?: boolean; onPropose: (period?: ExhibitionPeriod) => void; inset?: boolean; showConfirmationNotes?: boolean }) {
  const sessionLocked = useContext(SessionLockedContext);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [period, setPeriod] = useState<ExhibitionPeriod>(suggestedExhibitionPeriod);
  const submitting = useRef(false);
  const dateInputActive = useRef(false);
  const closeProposal = () => { dateInputActive.current = false; Keyboard.dismiss(); setProposalOpen(false); };
  const backFromProposal = () => {
    // Android's modal window can clear the native focus before onRequestClose.
    if (dateInputActive.current || Keyboard.isVisible() || TextInput.State.currentlyFocusedInput()) {
      dateInputActive.current = false;
      Keyboard.dismiss();
      return;
    }
    closeProposal();
  };
  const submitProposal = () => {
    if (busy || submitting.current || exhibitionPeriodError(period)) return;
    submitting.current = true;
    closeProposal();
    onPropose(period);
  };
  const cover = item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={c.recommendationImage} contentFit="cover" /> : <View style={[c.recommendationImage, c.cardImagePlaceholder]}><Icon name={item.targetType === 'project' ? 'discover' : 'store'} color={colors.brand} /><CuritText style={c.pinCaption}>{item.targetType === 'store' ? '매장 사진 없음' : '이미지 준비 중'}</CuritText></View>;
  const heading = <View style={c.between}><View style={c.flex}><CuritText weight="bold" style={[c.recommendationTitle, showConfirmationNotes && c.recommendationDetailTitle]}>{item.title}</CuritText><CuritText style={c.muted}>{item.subtitle}</CuritText></View><View style={c.score}><CuritText weight="bold" style={c.brandText}>{item.score}점</CuritText></View>{item.targetType === 'project' ? <Icon name="chevron" size={17} color={colors.brand} /> : null}</View>;
  return <View style={[c.recommendation, !inset && c.recommendationWide]}>
    {item.targetType === 'project' ? <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} 프로젝트 상세`} onPress={() => { Keyboard.dismiss(); setDetailsOpen(true); }}>
      {cover}<View style={[c.recommendationHeading, showConfirmationNotes && c.recommendationDetailHeading]}>{heading}</View>
    </Pressable> : cover}
    <View style={[c.recommendationBody, showConfirmationNotes && c.recommendationDetailBody]}>
      {item.targetType === 'store' ? heading : null}
      <CuritText style={c.description}>{item.description}</CuritText>
      {item.priceRange ? <CuritText weight="semibold">{item.priceRange}</CuritText> : null}
      <View style={[c.reasonBox, showConfirmationNotes && c.recommendationDetailReasons]}>{item.reasons.map(reason => <View key={reason} style={c.reasonRow}><CuritText style={c.check}>✓</CuritText><CuritText style={c.reasonText}>{reason}</CuritText></View>)}</View>
      {showConfirmationNotes && item.scoreBreakdown?.length ? <View style={c.scoreDetails}>
        <CuritText weight="semibold">추천 점수 기준</CuritText>
        {item.scoreBreakdown.map(part => <Term key={part.label} label={part.label} value={`${part.points} / ${part.max}점`} />)}
      </View> : null}
      {showConfirmationNotes && item.confirmationNotes?.length ? <ConfirmationNotes notes={item.confirmationNotes} /> : null}
      <View style={c.tags}>{item.tags.slice(0, 4).map(tag => <CuritText key={tag} style={c.tag}>#{tag}</CuritText>)}</View>
      <Button label={busy ? '처리 중…' : item.collaborationId ? `기존 협업 보기 · ${collaborationRecommendationLabel(item.collaborationStatus)}` : '이 후보에게 협업 제안'} disabled={busy} onPress={() => {
        if (item.collaborationId) onPropose();
        else { submitting.current = false; setProposalOpen(true); }
      }} />
    </View>
    {detailsOpen ? <PublicProjectModal id={item.targetId} artist={item.subtitle.split(' · ')[0]} demo={demo} onClose={() => setDetailsOpen(false)} /> : null}
    {proposalOpen ? <Modal visible={!sessionLocked} animationType="slide" onRequestClose={backFromProposal}>
      <ScreenFrame>
        <KeyboardAvoidingView style={c.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Header title="협업 제안" back={closeProposal} />
          <ScrollView contentContainerStyle={c.proposalScroll} keyboardShouldPersistTaps="handled">
            <CuritText weight="bold" style={c.directoryTitle}>{item.title}</CuritText>
            <CuritText style={c.muted}>희망 기간을 확인한 뒤 제안을 보내 주세요.</CuritText>
            <ExhibitionPeriodFields period={period} onFocus={() => { dateInputActive.current = true; }} onChange={value => {
              dateInputActive.current = true;
              setPeriod(value);
            }} />
            {item.confirmationNotes?.length ? <ConfirmationNotes notes={item.confirmationNotes} /> : null}
            <Button label="협업 제안 보내기" disabled={busy || Boolean(exhibitionPeriodError(period))} onPress={submitProposal} />
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenFrame>
    </Modal> : null}
  </View>;
}

function ConfirmationNotes({ notes }: { notes: string[] }) {
  return <View style={c.reasonBox}><CuritText weight="semibold">협업 전에 확인해 주세요</CuritText>{notes.map(note => <CuritText key={note} style={c.reasonText}>{note}</CuritText>)}</View>;
}

function ExhibitionPeriodFields({ period, onChange, onFocus, disabled }: { period: ExhibitionPeriod; onChange: (period: ExhibitionPeriod) => void; onFocus?: () => void; disabled?: boolean }) {
  const error = period.startsOn.length === 10 && period.endsOn.length === 10 ? exhibitionPeriodError(period) : '';
  return <View style={c.periodFields}>
    <Field label="전시 시작 희망일" value={period.startsOn} onFocus={onFocus} onChangeText={value => onChange({ ...period, startsOn: formatExhibitionDateInput(value) })} placeholder="YYYY-MM-DD" keyboardType="number-pad" maxLength={10} editable={!disabled} />
    <Field label="전시 종료 희망일" value={period.endsOn} onFocus={onFocus} onChangeText={value => onChange({ ...period, endsOn: formatExhibitionDateInput(value) })} placeholder="YYYY-MM-DD" keyboardType="number-pad" maxLength={10} editable={!disabled} />
    {error ? <CuritText accessibilityLiveRegion="polite" style={c.errorText}>{error}</CuritText> : null}
  </View>;
}

function collaborationRecommendationLabel(status?: MatchRecommendation['collaborationStatus']) {
  if (status === 'active') return '전시 중';
  if (status === 'approved') return '최종 확인';
  if (status === 'negotiating') return '조율 중';
  if (status === 'proposed') return '승인 대기';
  if (status === 'completed') return '완료';
  if (status === 'cancelled') return '취소됨';
  return '진행 중';
}

export function CollaborationDetailScreen({ role, userId, item, demo, input, setInput, onBack, onUpdated, onOpenQr }: { role: Role; userId: string; item: CollaborationSummary; demo?: boolean; input: string; setInput: Dispatch<SetStateAction<string>>; onBack: () => void; onUpdated: (item: CollaborationSummary) => void; onOpenQr?: () => void }) {
  const locked = useContext(SessionLockedContext);
  const scroll = useRef<ScrollViewInstance>(null);
  const nearLatest = useRef(true);
  const [messages, setMessages] = useState<CollaborationMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(!demo);
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const [notice, setNotice] = useState('');
  const [termsError, setTermsError] = useState('');
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [termVersion, setTermVersion] = useState(item);
  const [savedItems, setSavedItems] = useState<CollaborationItem[]>([]);
  const [draftItems, setDraftItems] = useState<CollaborationItem[]>([]);
  const [period, setPeriod] = useState<ExhibitionPeriod>({ startsOn: item.startsOn ?? '', endsOn: item.endsOn ?? '' });
  const [zone, setZone] = useState(String(item.terms.installationZone ?? ''));
  const [note, setNote] = useState(String(item.terms.note ?? ''));
  const [loaded, setLoaded] = useState(Boolean(demo));
  const [periodLocked, setPeriodLocked] = useState(false);

  const applyTerms = (updated: CollaborationSummary, items: CollaborationItem[]) => {
    setTermVersion(updated);
    setSavedItems(items);
    setDraftItems(items);
    setPeriod({ startsOn: updated.startsOn ?? '', endsOn: updated.endsOn ?? '' });
    setZone(String(updated.terms.installationZone ?? ''));
    setNote(String(updated.terms.note ?? ''));
    setLoaded(true);
    onUpdated(updated);
  };
  const loadConversation = async () => {
    const [conversation, [updated]] = await Promise.all([loadCollaborationMessages(item.id), loadCollaborations(role, item.id)]);
    setMessages(conversation);
    if (updated) onUpdated(updated);
  };
  const onUpdatedRef = useRef(onUpdated);
  useEffect(() => { onUpdatedRef.current = onUpdated; }, [onUpdated]);
  useEffect(() => {
    if (demo || locked) return;
    let active = true;
    let controller: AbortController | undefined;
    const refresh = async () => {
      if (controller || actionLock.current || (AppState.currentState && AppState.currentState !== 'active')) return;
      controller = new AbortController();
      const timer = setTimeout(() => controller?.abort(), 9_000);
      try {
        const [conversation, [updated]] = await Promise.all([
          loadCollaborationMessages(item.id, controller.signal), loadCollaborations(role, item.id, controller.signal),
        ]);
        if (!active || actionLock.current) return;
        setMessages(conversation);
        if (updated) onUpdatedRef.current(updated);
      } catch (error) {
        if (active && initialLoading) setNotice(friendlyError(error));
      } finally {
        clearTimeout(timer);
        controller = undefined;
        if (active) setInitialLoading(false);
      }
    };
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 6000);
    return () => { active = false; controller?.abort(); clearInterval(interval); };
  }, [demo, locked, role, item.id, initialLoading]);

  const runAction = async (operation: () => Promise<void>, reportError = setNotice) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true); setNotice(''); setTermsError('');
    try { await operation(); } catch (error) {
      if (error instanceof Error && error.message === 'COLLABORATION_TERMS_LOCKED') setPeriodLocked(true);
      reportError(friendlyError(error));
    } finally { actionLock.current = false; setBusy(false); }
  };
  const refreshTerms = async () => {
    if (demo) { applyTerms(item, savedItems); return; }
    const [[updated], items, conversation] = await Promise.all([
      loadCollaborations(role, item.id), loadCollaborationItems(item), loadCollaborationMessages(item.id),
    ]);
    if (!updated) throw new Error('협업을 찾지 못했어요. 다시 열어 주세요.');
    applyTerms(updated, items);
    setMessages(conversation);
  };
  const openConditions = () => {
    setCancelOpen(false);
    setConditionsOpen(true);
    setLoaded(false);
    void runAction(refreshTerms, setTermsError);
  };

  const pending = messages.find(message => message.termRequestStatus === 'pending');
  const closed = item.status === 'completed' || item.status === 'cancelled';
  const editable = loaded && !closed && !pending && !busy;
  const scheduleEditable = editable && item.status !== 'active' && !periodLocked;
  const selectedItems = draftItems.filter(value => value.selected);
  const quantitiesFit = selectedItems.every(value => value.quantity >= 1 && value.quantity <= Math.min(value.stock, 100_000));
  const supplyConfirmed = savedItems.some(value => value.selected) && savedItems.filter(value => value.selected).every(value => value.creatorConfirmed && value.quantity <= value.stock);
  const needsScheduleReview = termVersion.terms.scheduleNeedsReview === true;
  const stale = termVersion.updatedAt !== item.updatedAt;
  const periodChanged = period.startsOn !== (termVersion.startsOn ?? '') || period.endsOn !== (termVersion.endsOn ?? '');
  const periodError = periodChanged ? exhibitionPeriodError(period) : '';
  const termChanges: Record<string, string> = {
    ...(periodChanged ? period : {}),
    ...(zone !== String(termVersion.terms.installationZone ?? '') ? { installationZone: zone } : {}),
    ...(note.trim() !== String(termVersion.terms.note ?? '') ? { note: note.trim() } : {}),
  };
  const savedQuantities = new Map(savedItems.filter(value => value.selected).map(value => [value.projectItemId, value.quantity]));
  const itemChanges = draftItems.flatMap(value => {
    const quantity = value.selected ? value.quantity : 0;
    return quantity !== (savedQuantities.get(value.projectItemId) ?? 0) ? [{ projectItemId: value.projectItemId, quantity }] : [];
  });
  const changed = Object.keys(termChanges).length > 0 || itemChanges.length > 0;
  const requestEnabled = editable && !stale && changed && !periodError && (!itemChanges.length || (quantitiesFit && selectedItems.length > 0));
  const setQuantity = (id: string, quantity: number) => setDraftItems(current => current.map(value => value.projectItemId === id
    ? { ...value, selected: quantity > 0, quantity: Math.max(1, quantity) } : value));

  const submitChanges = () => {
    if (!requestEnabled || demo) return;
    void runAction(async () => {
      await requestCollaborationTerms(termVersion, { terms: termChanges, items: itemChanges });
      setConditionsOpen(false);
      await loadConversation();
      scroll.current?.scrollToEnd({ animated: true });
    }, error => { setTermsError(error); setNotice(error); });
  };
  const respond = (id: string, accept: boolean) => void runAction(async () => {
    await resolveCollaborationTerms(item.id, id, accept);
    await loadConversation();
    scroll.current?.scrollToEnd({ animated: true });
  });
  const send = () => {
    const draft = input;
    if (!draft.trim() || closed || busy) return;
    void runAction(async () => {
      if (demo) setMessages(current => [...current, { id: String(Date.now()), collaborationId: item.id, senderId: userId, content: draft.trim(), createdAt: new Date().toISOString() }]);
      else await sendCollaborationMessage(item.id, draft);
      setInput(current => current === draft ? '' : current);
      if (!demo) await loadConversation();
      scroll.current?.scrollToEnd({ animated: true });
    });
  };
  const confirmSupply = () => void runAction(async () => {
    if (demo) return;
    const dates = termVersion.startsOn && termVersion.endsOn ? { startsOn: termVersion.startsOn, endsOn: termVersion.endsOn } : {};
    await saveCollaborationTerms(item.id, dates, savedItems.filter(value => value.selected).map(value => ({ ...value, creatorConfirmed: true })));
    await refreshTerms();
  }, setTermsError);
  const transition = (action: 'accept' | 'confirm' | 'cancel' | 'complete') => void runAction(async () => {
    if (demo) {
      const status = nextDemoCollaborationStatus(item.status, action, role);
      onUpdated({ ...item, status });
    } else {
      await transitionCollaboration(item.id, action);
    }
    setCancelOpen(false); setConditionsOpen(false);
    if (!demo) await loadConversation();
    scroll.current?.scrollToEnd({ animated: true });
  }, error => { setCancelOpen(false); setTermsError(error); setNotice(error); });

  return <KeyboardAvoidingView style={c.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title={item.counterpartName} back={onBack} />
    <Pressable accessibilityRole="button" accessibilityLabel="협업 조건 보기" style={c.chatConditionBar} onPress={openConditions}>
      <View style={c.flex}><CuritText numberOfLines={1} weight="semibold" style={c.summaryTitle}>{item.projectTitle}</CuritText><CuritText style={c.summaryMeta}>{statusLabel[item.status]}{pending ? ' · 조건 요청 1건' : ''}</CuritText></View>
      <CuritText weight="semibold" style={c.summaryToggle}>협업 조건</CuritText><Icon name="chevron" size={15} color={colors.brand} />
    </Pressable>
    <ScrollView ref={scroll} style={c.flex} contentContainerStyle={c.detailScroll} keyboardShouldPersistTaps="handled" onContentSizeChange={() => { if (nearLatest.current) scroll.current?.scrollToEnd({ animated: false }); }}
      onScroll={event => {
        const { contentSize, layoutMeasurement, contentOffset } = event.nativeEvent;
        nearLatest.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 90;
      }} scrollEventThrottle={32}>
      {initialLoading ? <ActivityIndicator color={colors.brand} /> : null}
      {!initialLoading && !messages.length ? <CuritText style={c.muted}>조건이나 일정에 관해 첫 메시지를 남겨보세요.</CuritText> : null}
      {messages.map(message => {
        const mine = message.senderId === userId;
        const requestStatus = message.termRequestStatus;
        const time = new Date(message.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        return requestStatus ? <View key={message.id} style={[c.requestCard, mine ? c.ownRequest : c.otherRequest]}>
          <CuritText weight="semibold">조건 수정 요청</CuritText>
          <CuritText style={c.description}>{message.content.split('\n').slice(1).join('\n')}</CuritText>
          {requestStatus === 'pending' && !mine && !closed ? <View style={c.actionButtons}>
            <View style={c.flex}><Button label="거절" variant="secondary" disabled={busy} onPress={() => respond(message.id, false)} /></View>
            <View style={c.flex}><Button label="수락" disabled={busy} onPress={() => respond(message.id, true)} /></View>
          </View> : <CuritText style={c.brandText}>{requestStatus === 'accepted' ? '수락됨' : requestStatus === 'rejected' ? '거절됨' : requestStatus === 'closed' ? '협업 종료' : '상대 답변 대기 중'}</CuritText>}
          <CuritText style={c.time}>{time}</CuritText>
        </View> : <View key={message.id} style={[c.collabBubble, mine ? c.ownCollabBubble : c.otherCollabBubble]}>
          <CuritText style={mine ? c.userText : undefined}>{mine && message.content === '상대가 협업 취소를 신청했습니다.' ? '협업을 취소했습니다.' : message.content}</CuritText>
          <CuritText style={[c.time, mine && { color: '#D7DFCF' }]}>{time}</CuritText>
        </View>;
      })}
    </ScrollView>
    {notice ? <Pressable accessibilityLiveRegion="polite" accessibilityRole="button" accessibilityHint="눌러서 안내 닫기" style={[c.notice, { marginHorizontal: 12, marginBottom: 8 }]} onPress={() => setNotice('')}><CuritText style={c.brandText}>{notice}</CuritText></Pressable> : null}
    {!closed ? <View style={c.composerWrap}><View style={c.composer}>
      <TextInput value={input} onChangeText={setInput} maxLength={2000} placeholder="메시지를 입력해 주세요" placeholderTextColor={colors.subtle} style={c.input} onFocus={() => scroll.current?.scrollToEnd({ animated: true })} />
      <Pressable accessibilityRole="button" accessibilityLabel="협업 메시지 보내기" disabled={!input.trim() || busy} style={[c.send, (!input.trim() || busy) && c.sendDisabled]} onPress={send}><CuritText weight="bold" style={c.sendText}>↑</CuritText></Pressable>
    </View></View> : null}
    <Modal visible={conditionsOpen && !locked} animationType="slide" onRequestClose={() => { if (cancelOpen) setCancelOpen(false); else setConditionsOpen(false); }}>
      <ScreenFrame><KeyboardAvoidingView style={c.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title="협업 조건" subtitle={item.projectTitle} back={() => setConditionsOpen(false)} />
        <ScrollView contentContainerStyle={c.proposalScroll} keyboardShouldPersistTaps="handled">
          {termsError ? <CuritText accessibilityRole="alert" style={c.errorText}>{termsError}</CuritText> : null}
          {busy && !loaded ? <ActivityIndicator color={colors.brand} /> : null}
          {loaded ? <>
            <Term label="판매 배분" value={`작가 ${item.creatorShare}% · 매장 ${item.storeShare}% · 플랫폼 ${item.platformShare}%`} />
            {pending ? <CuritText style={c.flowHint}>조건 수정 요청이 있어요. 채팅에서 답변을 확인해 주세요.</CuritText> : null}
            {stale ? <CuritText style={c.flowHint}>다른 기기에서 조건이 변경됐어요. 최신 조건을 불러와 주세요.</CuritText> : null}
            {scheduleEditable ? <ExhibitionPeriodFields period={period} onChange={setPeriod} disabled={busy} /> : <Term label="전시 기간" value={`${termVersion.startsOn ?? '미정'} ~ ${termVersion.endsOn ?? '미정'}`} />}
            <CuritText weight="semibold">작품과 전시 수량</CuritText>
            {(scheduleEditable ? draftItems : selectedItems).map(value => <View key={value.projectItemId} style={c.itemCard}>
              <View style={c.itemRow}>
                {value.imageUrl ? <Image source={{ uri: value.imageUrl }} style={c.itemImage} /> : null}
                <View style={c.flex}><CuritText weight="semibold">{value.name}</CuritText><CuritText style={c.muted}>재고 {value.stock}개{value.creatorConfirmed ? ' · 수량 확인됨' : ''}</CuritText></View>
                {scheduleEditable ? <Pressable accessibilityRole="checkbox" accessibilityLabel={`${value.name} 전시 선택`} accessibilityState={{ checked: value.selected }} style={c.quantityTap} onPress={() => setQuantity(value.projectItemId, value.selected ? 0 : 1)}><CuritText style={c.quantityButton}>{value.selected ? '☑' : '□'}</CuritText></Pressable> : null}
              </View>
              {value.selected ? <View style={c.between}>
                <CuritText style={c.muted}>전시 수량</CuritText>
                {scheduleEditable ? <View style={c.quantity}>
                  <Pressable accessibilityLabel={`${value.name} 수량 줄이기`} accessibilityRole="button" disabled={value.quantity <= 1} style={[c.quantityTap, value.quantity <= 1 && c.dim]} onPress={() => setQuantity(value.projectItemId, value.quantity - 1)}><CuritText style={c.quantityButton}>−</CuritText></Pressable>
                  <CuritText weight="bold">{value.quantity}개</CuritText>
                  <Pressable accessibilityLabel={`${value.name} 수량 늘리기`} accessibilityRole="button" disabled={value.quantity >= Math.min(value.stock, 100_000)} style={[c.quantityTap, value.quantity >= Math.min(value.stock, 100_000) && c.dim]} onPress={() => setQuantity(value.projectItemId, value.quantity + 1)}><CuritText style={c.quantityButton}>＋</CuritText></Pressable>
                </View> : <CuritText weight="semibold">{value.quantity}개</CuritText>}
              </View> : null}
            </View>)}
            {!draftItems.length ? <CuritText style={c.muted}>등록된 작품이 없어요.</CuritText> : null}
            {editable ? <>
              <CuritText weight="semibold">배치 위치</CuritText>
              <View style={c.tags}>{['벽면', '선반', '카운터', '테이블', '입구'].map(value => <Chip key={value} label={value} active={zone === value} onPress={() => setZone(current => current === value ? '' : value)} />)}</View>
              <Field label="배치·운영 조건" value={note} onChangeText={setNote} multiline maxLength={1000} style={c.termInput} placeholder="예: 선반 왼쪽에 진열해 주세요" />
            </> : <>
              <Term label="배치 위치" value={zone || '미정'} />
              <Term label="운영 조건" value={note || '미정'} />
            </>}
            {!closed && !pending ? <Button label="조건 수정 요청" disabled={!requestEnabled || Boolean(demo)} onPress={submitChanges} /> : null}
            {!closed && !pending && role === 'creator' && savedItems.some(value => value.selected) && (!supplyConfirmed || needsScheduleReview) ? <Button label="기존 작품 수량 확인" variant="secondary" disabled={busy || changed || stale || !quantitiesFit} onPress={confirmSupply} /> : null}
            {role === 'creator' && ['proposed', 'negotiating'].includes(item.status) ? <Button label="협업 제안 승인" variant="secondary" disabled={busy || Boolean(pending) || changed || stale} onPress={() => transition('accept')} /> : null}
            {role === 'store' && item.status === 'approved' ? <Button label="전시 확정" variant="secondary" disabled={busy || Boolean(pending) || changed || stale || needsScheduleReview || !supplyConfirmed} onPress={() => transition('confirm')} /> : null}
            {onOpenQr && item.status === 'active' ? <Button label="이 전시의 QR 상품 관리" onPress={() => { setConditionsOpen(false); onOpenQr(); }} /> : null}
            {item.status === 'active' ? <Button label="전시 종료 처리" variant="secondary" disabled={busy} onPress={() => transition('complete')} /> : null}
            {!closed ? <Button label="협업 취소" variant="secondary" disabled={busy} onPress={() => setCancelOpen(true)} /> : null}
          </> : null}
          {!demo ? <Button label="최신 조건 불러오기" variant="secondary" disabled={busy} onPress={() => { void runAction(refreshTerms, setTermsError); }} /> : null}
        </ScrollView>
        {cancelOpen ? <View style={c.confirmBackdrop} accessibilityViewIsModal>
          <View style={c.confirmCard}>
            <CuritText weight="bold" style={c.recommendationTitle}>협업을 취소할까요?</CuritText>
            <CuritText style={c.description}>상대방에게 채팅으로 알려드려요.</CuritText>
            <View style={c.actionButtons}><View style={c.flex}><Button label="돌아가기" variant="secondary" disabled={busy} onPress={() => setCancelOpen(false)} /></View>
            <View style={c.flex}><Button label="협업 취소" disabled={busy} onPress={() => transition('cancel')} /></View></View>
          </View>
        </View> : null}
      </KeyboardAvoidingView></ScreenFrame>
    </Modal>
  </KeyboardAvoidingView>;
}

function Term({ label, value }: { label: string; value: string }) { return <View style={c.termRow}><CuritText style={c.termLabel}>{label}</CuritText><CuritText weight="semibold" style={c.termValue}>{value}</CuritText></View>; }

const c = StyleSheet.create({
  chatConditionBar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 7, gap: 7, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.brandPale },
  requestCard: { width: '91%', maxWidth: 440, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: radius.md, marginBottom: 10, gap: 9 },
  ownRequest: { alignSelf: 'flex-end', backgroundColor: colors.brandSoft },
  otherRequest: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  confirmBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  confirmCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 20, gap: 14 },
  scoreDetails: { gap: 10, padding: 15, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm },
  recommendationDetailHeading: { paddingHorizontal: 20, paddingTop: 20 },
  recommendationDetailBody: { paddingHorizontal: 20, paddingVertical: 20, gap: 19 },
  recommendationDetailReasons: { padding: 15, gap: 12 },
  recommendationDetailTitle: { lineHeight: 27, marginBottom: 5 },
  proposalScroll: { padding: 20, gap: 14, paddingBottom: 32 }, periodFields: { gap: 10 },
  flex: { flex: 1 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, muted: { color: colors.muted }, brandText: { color: colors.brand },
  hubScroll: { flexGrow: 1, padding: 20, paddingBottom: 36 }, curatorPin: { minHeight: 82, borderRadius: radius.lg, backgroundColor: colors.brandSoft, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }, curatorAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, smallAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft }, pinCaption: { color: colors.muted, fontSize: 11, marginTop: 3 }, pinAction: { color: colors.brand, fontSize: 11 }, listHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, marginBottom: 6 }, chatRow: { minHeight: 88, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }, contactAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPale }, chatName: { fontSize: 16 }, chatProjectRow: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 7 }, project: { flexShrink: 1, color: colors.brand, fontSize: 11, marginVertical: 3 }, chatStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.brandSoft }, chatStatusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brand }, chatStatusText: { color: colors.brand, fontSize: 9 }, time: { color: colors.subtle, fontSize: 9 }, loader: { marginVertical: 40 }, error: { padding: 14, borderRadius: radius.sm, backgroundColor: '#FFF2EF', marginVertical: 16 }, errorText: { color: colors.danger },
  chatScroll: { padding: 16, paddingBottom: 28, gap: 12 }, messageBlock: { gap: 10 }, bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, bubbleRowUser: { justifyContent: 'flex-end' }, bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11 }, aiBubble: { backgroundColor: colors.brandPale, borderTopLeftRadius: 4 }, userBubble: { backgroundColor: colors.brand, borderTopRightRadius: 4 }, userText: { color: colors.surface }, actionRow: { gap: 7, paddingLeft: 42, paddingBottom: 4 }, typing: { flexDirection: 'row', gap: 9, alignItems: 'center', marginLeft: 42 }, notice: { padding: 12, backgroundColor: colors.brandSoft, borderRadius: radius.sm },
  composerWrap: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingTop: 8 }, topicRow: { gap: 7, paddingHorizontal: 12, paddingBottom: 8 }, composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 12 }, composerMore: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, composerMoreText: { color: colors.brand, fontSize: 20, lineHeight: 22 }, input: { flex: 1, minHeight: 46, borderRadius: 23, backgroundColor: '#F7F7F7', borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, fontFamily: fonts.regular, color: colors.ink }, send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }, sendDisabled: { backgroundColor: colors.border }, sendText: { color: colors.surface, fontSize: 20 },
  recommendation: { marginLeft: 42, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface }, recommendationWide: { marginLeft: 0 }, recommendationImage: { width: '100%', height: 148 }, recommendationBody: { padding: 14, gap: 10 }, recommendationHeading: { paddingHorizontal: 14, paddingTop: 14 }, recommendationTitle: { fontSize: 17 }, score: { minWidth: 48, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.brandSoft, alignItems: 'center' }, description: { color: colors.muted, lineHeight: 21 }, reasonBox: { borderRadius: radius.sm, padding: 10, backgroundColor: colors.brandPale, gap: 6 }, reasonRow: { flexDirection: 'row', gap: 7 }, check: { color: colors.brand }, reasonText: { flex: 1, fontSize: 12, color: colors.muted }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, tag: { fontSize: 10, color: colors.brand, backgroundColor: colors.brandSoft, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 }, cardImagePlaceholder: { backgroundColor: colors.brandPale, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 12 },
  detailScroll: { flexGrow: 1, padding: 16, paddingBottom: 24 }, compactSummary: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden', marginBottom: 12 }, summaryHeader: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 9 }, summaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 }, summaryTitle: { flexShrink: 1, fontSize: 14 }, summaryMeta: { color: colors.muted, fontSize: 10, marginTop: 3 }, summaryToggle: { color: colors.brand, fontSize: 10 }, summaryBody: { borderTopWidth: 1, borderTopColor: colors.border, padding: 14, gap: 12 }, conditionToggle: { minHeight: 46, borderRadius: radius.sm, backgroundColor: colors.brandSoft, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, conditionBody: { gap: 10, paddingTop: 2 }, conditionLabel: { fontSize: 13, marginTop: 2 }, termRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 18 }, termLabel: { color: colors.muted, fontSize: 12 }, termValue: { flex: 1, textAlign: 'right', fontSize: 12 }, flowHint: { color: colors.brand, fontSize: 11, backgroundColor: colors.brandSoft, padding: 10, borderRadius: radius.sm }, itemCard: { gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10 }, itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, itemQuantity: { minHeight: 30, paddingLeft: 4 }, dim: { opacity: 0.35 }, itemImage: { width: 52, height: 52, borderRadius: radius.sm }, itemPlaceholder: { backgroundColor: colors.brandPale, alignItems: 'center', justifyContent: 'center' }, quantity: { flexDirection: 'row', alignItems: 'center', gap: 2 }, quantityTap: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }, quantityButton: { fontSize: 20, color: colors.brand }, termInput: { minHeight: 76, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontFamily: fonts.regular, color: colors.ink, textAlignVertical: 'top' }, quickReply: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, backgroundColor: colors.surface }, quickReplyText: { color: colors.muted, fontSize: 11 }, collabBubble: { maxWidth: '82%', borderRadius: 15, padding: 12, marginBottom: 8 }, ownCollabBubble: { backgroundColor: colors.brand, alignSelf: 'flex-end', borderTopRightRadius: 4 }, otherCollabBubble: { backgroundColor: colors.brandPale, alignSelf: 'flex-start', borderTopLeftRadius: 4 }, actionButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }, actionButton: { minWidth: '47%', flexGrow: 1 },
  headerAi: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft }, discoverScroll: { padding: 18, paddingBottom: 36 }, exploreTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: 8, marginBottom: 18 }, exploreTab: { flex: 1, alignItems: 'center', paddingVertical: 13 }, exploreTabActive: { borderBottomWidth: 2, borderBottomColor: colors.brand }, searchBox: { minHeight: 48, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: '#F8F8F8', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 }, searchInput: { flex: 1, minHeight: 46, color: colors.ink, fontFamily: fonts.regular }, directoryTitle: { fontSize: 19, lineHeight: 28, marginBottom: 6 }, filterCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', marginBottom: 10, backgroundColor: colors.surface }, filterHeader: { minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, filterHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: 9 }, filterCount: { minWidth: 20, height: 20, borderRadius: 10, textAlign: 'center', lineHeight: 20, color: colors.surface, backgroundColor: colors.brand, fontSize: 10 }, filterEyebrow: { color: colors.muted, fontSize: 11, lineHeight: 17 }, filterBody: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 12, gap: 12 }, filterGroup: { gap: 7 }, filterOptionsHorizontal: { gap: 7, paddingHorizontal: 14 }, resetFilter: { minHeight: 36, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 14 }, discoverCard: { marginBottom: 14 }, creatorDirectory: { gap: 14 }, creatorCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface }, creatorCardImage: { width: '100%', height: 150 }, creatorCardBody: { padding: 14, gap: 9 }, creatorCardTitle: { fontSize: 17 },
});
