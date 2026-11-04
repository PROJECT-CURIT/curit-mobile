import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { Image } from 'expo-image';
import {
  createCollaborationProposal,
  loadCollaborationMessages,
  loadCollaborations,
  loadCollaborationItems,
  loadCreatorDirectory,
  loadCuratorMessages,
  loadMatchRecommendations,
  sendCollaborationMessage,
  sendCuratorMessage,
  saveCollaborationTerms,
  transitionCollaboration,
} from './curation';
import { SocialFeedSection } from './fullPrototypeScreens';
import { projects } from './data';
import { demoCollaborationList, nextDemoCollaborationStatus } from './demoContent';
import { friendlyError } from './platform';
import { colors, fonts, radius } from './theme';
import type { CollaborationItem, CollaborationMessage, CollaborationSummary, CuratorMessage, MatchRecommendation, Role } from './types';
import type { CreatorDirectoryEntry } from './curation';
import { Button, Chip, CuritText, Empty, Header, Icon } from './ui';

const statusLabel: Record<CollaborationSummary['status'], string> = {
  proposed: '승인 대기', negotiating: '조건 조율 중', approved: '매장 최종 확인', active: '전시·판매 중', completed: '협업 완료', cancelled: '취소',
};

const dnaFilterGroups = [
  ['매장 유형', ['카페', '서점', '쇼룸']],
  ['분위기', ['미니멀', '우드톤', '조용함']],
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
  const items = demo ? (demoItems ?? demoCollaborationList(role)) : loadedItems;
  useEffect(() => {
    if (demo) return;
    void loadCollaborations(role).then(setLoadedItems).catch(caught => setError(friendlyError(caught))).finally(() => setLoading(false));
  }, [demo, role]);
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
      {error ? <View style={c.error}><CuritText style={c.errorText}>{error}</CuritText></View> : null}
      {!loading && !error && !items.length ? <Empty title="아직 협업 대화가 없어요" description="AI 큐레이터의 추천에서 협업을 제안하면 상대방과 대화를 시작할 수 있어요." /> : items.map(item => <Pressable accessibilityRole="button" accessibilityLabel={`${item.counterpartName} ${item.projectTitle} 협업 대화 열기`} key={item.id} style={c.chatRow} onPress={() => onOpenCollaboration(item)}>
        <View style={c.contactAvatar}><CuritText weight="bold">{item.counterpartName[0] || 'C'}</CuritText></View>
        <View style={c.flex}><View style={c.between}><CuritText weight="semibold" style={c.chatName}>{item.counterpartName}</CuritText><CuritText style={c.time}>{new Date(item.updatedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</CuritText></View><View style={c.chatProjectRow}><CuritText style={c.project} numberOfLines={1}>{item.projectTitle}</CuritText><View style={c.chatStatus}><View style={c.chatStatusDot} /><CuritText style={c.chatStatusText}>{statusLabel[item.status]}</CuritText></View></View><CuritText style={c.muted} numberOfLines={1}>{String(item.terms.message || '조건과 일정을 확인해 주세요.')}</CuritText></View>
      </Pressable>)}
    </ScrollView>
  </View>;
}

async function loadDiscoverResults<T>(request: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('연결이 오래 걸리고 있어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.')), 10_000);
  });
  try { return await Promise.race([request, deadline]); }
  finally { clearTimeout(timer); }
}

export function MatchingDiscoverScreen({ role, demo, currentUserName, onOpenCurator, onProposalCreated }: { role: Role; demo?: boolean; currentUserName?: string; onOpenCurator: () => void; onProposalCreated: (id: string) => Promise<void> }) {
  const [items, setItems] = useState<MatchRecommendation[]>([]);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [region, setRegion] = useState('전체');
  const [dnaFilters, setDnaFilters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [section, setSection] = useState<'matches' | 'creators' | 'news'>('matches');
  const [matchError, setMatchError] = useState('');
  const [matchAttempt, setMatchAttempt] = useState(0);
  const [directoryAttempt, setDirectoryAttempt] = useState(0);
  const [directory, setDirectory] = useState<{ projects: CreatorDirectoryCard[]; error: string } | null>(null);
  const directoryProjects = demo ? demoDirectoryProjects : (directory?.projects ?? []);
  const directoryLoading = !demo && directory === null;
  const directoryError = demo ? '' : (directory?.error ?? '');

  useEffect(() => {
    let active = true;
    void loadDiscoverResults(loadMatchRecommendations(role, demo))
      .then(value => { if (active) setItems(value); })
      .catch(caught => { if (active) setMatchError(friendlyError(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, role, matchAttempt]);
  useEffect(() => {
    if (demo) return;
    let active = true;
    void loadDiscoverResults(loadCreatorDirectory()).then(projects => {
      if (active) setDirectory({ projects, error: '' });
    }).catch(caught => {
      if (active) setDirectory({ projects: [], error: friendlyError(caught) });
    });
    return () => { active = false; };
  }, [demo, directoryAttempt]);
  const visible = items.filter(item => {
    const text = [item.title, item.subtitle, item.description, ...item.tags].join(' ').toLocaleLowerCase('ko-KR');
    const queryMatches = text.includes(query.trim().toLocaleLowerCase('ko-KR'));
    const regionMatches = role !== 'creator' || region === '전체' || region === '전국 / 온라인'
      || region.split(/[·/]/).some(value => value.trim() && text.includes(value.trim().toLocaleLowerCase('ko-KR')));
    const dnaMatches = role !== 'creator' || dnaFilterGroups.every(([, values]) => {
      const selected = values.filter(value => dnaFilters.includes(value));
      return selected.length === 0 || selected.some(value => text.includes(value.toLocaleLowerCase('ko-KR')));
    });
    return queryMatches && regionMatches && dnaMatches;
  });
  const visibleDirectoryProjects = directoryProjects.filter(item => [item.title, item.artist, item.region, ...item.tags].join(' ').toLocaleLowerCase('ko-KR').includes(query.trim().toLocaleLowerCase('ko-KR')));
  const toggleDna = (value: string) => setDnaFilters(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  const resetFilters = () => { setRegion('전체'); setDnaFilters([]); };
  const propose = async (item: MatchRecommendation) => {
    if (busy) return;
    setBusy(item.targetId); setNotice('');
    try {
      if (demo) { await onProposalCreated('demo-proposal'); return; }
      if (item.collaborationId) { setNotice('이미 진행 중인 협업으로 이동합니다.'); await onProposalCreated(item.collaborationId); return; }
      const id = await createCollaborationProposal(item, `${item.title}과(와) 전시 협업을 제안합니다.`);
      setNotice('협업 제안을 보냈습니다. 채팅에서 승인 상태를 확인할 수 있어요.');
      if (id) await onProposalCreated(id);
    } catch (caught) { setNotice(friendlyError(caught)); } finally { setBusy(''); }
  };
  return <View style={c.flex}>
    <Header title={role === 'creator' ? '매장 탐색' : '전시 탐색'} action={<Pressable accessibilityRole="button" accessibilityLabel="AI 큐레이터 열기" hitSlop={10} onPress={onOpenCurator}><View style={c.headerAi}><CuritText weight="bold" style={c.brandText}>AI</CuritText></View></Pressable>} />
    <ScrollView contentContainerStyle={c.discoverScroll} keyboardShouldPersistTaps="handled">
      <View style={c.searchBox}><Icon name="discover" size={17} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder={role === 'creator' ? '매장명, 지역, 공간 DNA 검색' : '작가명, 작품명, 태그 검색'} placeholderTextColor={colors.subtle} style={c.searchInput} /></View>
      <View accessibilityRole="tablist" style={c.exploreTabs}>{(role === 'creator' ? [['matches', '매장'], ['creators', '작품·작가'], ['news', '소식']] : [['matches', '전시 프로젝트'], ['news', '크리에이터 소식']]).map(([value, label]) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: section === value }} key={value} style={[c.exploreTab, section === value && c.exploreTabActive]} onPress={() => setSection(value as 'matches' | 'creators' | 'news')}><CuritText weight={section === value ? 'semibold' : 'regular'} style={section === value ? c.brandText : c.muted}>{label}</CuritText></Pressable>)}</View>
      {section === 'news' ? <SocialFeedSection canPost={role === 'creator'} demo={demo} currentUserName={currentUserName} /> : section === 'creators' ? <CreatorDirectory items={visibleDirectoryProjects} loading={directoryLoading} error={directoryError} onRetry={() => { setDirectory(null); setDirectoryAttempt(value => value + 1); }} /> : <>
      {role === 'creator' ? <>
        <CuritText weight="bold" style={c.directoryTitle}>작품과 어울리는 공간</CuritText>
        <View style={c.filterCard}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: filtersOpen }} style={c.filterHeader} onPress={() => setFiltersOpen(value => !value)}>
            <View style={c.flex}><CuritText weight="semibold">공간 필터</CuritText><CuritText style={c.filterEyebrow} numberOfLines={1}>{[region !== '전체' ? region : '', ...dnaFilters].filter(Boolean).join(' · ') || '지역과 공간 DNA를 한 번에 설정'}</CuritText></View>
            <View style={c.filterHeaderAction}>{region !== '전체' || dnaFilters.length ? <CuritText style={c.filterCount}>{(region !== '전체' ? 1 : 0) + dnaFilters.length}</CuritText> : null}<View style={{ transform: [{ rotate: filtersOpen ? '-90deg' : '90deg' }] }}><Icon name="chevron" size={17} color={colors.brand} /></View></View>
          </Pressable>
          {filtersOpen ? <View style={c.filterBody}>
            <View style={c.filterGroup}><CuritText style={c.filterEyebrow}>지역</CuritText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={c.filterOptionsHorizontal}>{['전체', '서울', '경기', '인천', '강원', '충청', '전라', '경상', '제주', '전국 / 온라인'].map(value => <Chip key={value} label={value} active={region === value} onPress={() => setRegion(value)} />)}</ScrollView></View>
            {dnaFilterGroups.map(([label, values]) => <View key={label} style={c.filterGroup}><CuritText style={c.filterEyebrow}>{label}</CuritText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={c.filterOptionsHorizontal}>{values.map(value => <Chip key={value} label={value} active={dnaFilters.includes(value)} onPress={() => toggleDna(value)} />)}</ScrollView></View>)}
            <Pressable accessibilityRole="button" style={c.resetFilter} onPress={resetFilters}><CuritText style={c.muted}>선택 초기화</CuritText></Pressable>
          </View> : null}
        </View>
      </> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="추천 점수 설명을 AI 큐레이터에게 묻기" style={c.explainBanner} onPress={onOpenCurator}><View style={c.smallAvatar}><CuritText weight="bold" style={c.brandText}>T</CuritText></View><View style={c.flex}><CuritText weight="semibold">조건 일치도는 등록 정보 기준 참고 점수예요</CuritText><CuritText style={c.pinCaption}>취향 키워드·지역·판매 재고·전시 구역을 반영하며, 판매가는 예산과 따로 확인합니다.</CuritText></View><Icon name="chevron" size={17} color={colors.brand} /></Pressable>
      <View style={c.listHeading}><CuritText weight="bold">맞춤 추천</CuritText><CuritText style={c.muted}>{visible.length}개</CuritText></View>
      {loading ? <ActivityIndicator color={colors.brand} style={c.loader} /> : matchError ? <View style={c.error}><CuritText style={c.errorText}>{matchError}</CuritText><Button label="다시 불러오기" variant="secondary" onPress={() => { setLoading(true); setMatchError(''); setMatchAttempt(value => value + 1); }} /></View> : visible.length ? visible.map(item => <View key={item.targetId} style={c.discoverCard}><RecommendationCard item={item} inset={false} busy={busy === item.targetId} onPropose={() => { void propose(item); }} /></View>) : <Empty title="조건에 맞는 후보가 없어요" description="검색어를 바꾸거나 등록한 공간·작품 DNA를 보완해 주세요." />}
      {notice ? <View style={c.notice}><CuritText style={notice.includes('못') || notice.includes('오류') ? c.errorText : c.brandText}>{notice}</CuritText></View> : null}
      </>}
    </ScrollView>
  </View>;
}

function CreatorDirectory({ items, loading, error, onRetry }: { items: CreatorDirectoryCard[]; loading: boolean; error: string; onRetry: () => void }) {
  return <View style={c.creatorDirectory}>
    <View><CuritText weight="bold" style={c.directoryTitle}>작품과 작가</CuritText><CuritText style={c.muted}>다른 크리에이터의 작품 세계와 활동을 살펴보세요.</CuritText></View>
    {loading ? <ActivityIndicator color={colors.brand} style={c.loader} /> : error ? <View style={c.error}><CuritText style={c.errorText}>{error}</CuritText><Button label="다시 불러오기" variant="secondary" onPress={onRetry} /></View> : items.length ? items.map(item => <View key={item.id} style={c.creatorCard}>
      {item.imageSource ? <Image source={item.imageSource} style={c.creatorCardImage} contentFit="cover" /> : item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={c.creatorCardImage} contentFit="cover" /> : <View style={[c.creatorCardImage, c.cardImagePlaceholder]}><Icon name="discover" color={colors.brand} /><CuritText style={c.pinCaption}>이미지 준비 중</CuritText></View>}
      <View style={c.creatorCardBody}><View style={c.between}><View style={c.flex}><CuritText weight="bold" style={c.creatorCardTitle}>{item.title}</CuritText><CuritText style={c.muted}>{item.artist} · {item.region}</CuritText></View><View style={c.creatorAvatar}><CuritText weight="bold" style={c.brandText}>{item.artist[0]}</CuritText></View></View><View style={c.tags}>{item.tags.map(tag => <CuritText key={tag} style={c.tag}>#{tag}</CuritText>)}</View><CuritText style={c.pinCaption}>{item.priceRange} · {item.status}</CuritText></View>
    </View>) : <Empty title="공개된 작품이 없습니다" description="크리에이터가 협업 모집을 시작하면 이곳에서 확인할 수 있어요." />}
  </View>;
}

function demoWelcome(role: Role): CuratorMessage {
  return {
    id: 'demo-welcome', sender: 'assistant',
    content: role === 'store' ? '등록한 공간 DNA와 예산, 설치 구역을 바탕으로 실제 협업 가능한 작품을 찾아드릴게요.' : '작품 DNA와 활동 지역을 바탕으로 실제 협업 가능한 매장을 찾아드릴게요.',
    recommendations: [], actions: role === 'store' ? ['우리 공간에 어울리는 작품을 추천해 주세요', '협업 진행 방법을 알려주세요'] : ['내 작품과 어울리는 매장을 추천해 주세요', '협업과 출고 흐름을 알려주세요'], createdAt: new Date().toISOString(),
  };
}

export function CuratorScreen({ role, demo, onBack, onProposalCreated }: { role: Role; demo?: boolean; onBack: () => void; onProposalCreated: (id: string) => Promise<void> }) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [messages, setMessages] = useState<CuratorMessage[]>(demo ? [demoWelcome(role)] : []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(!demo);
  const [sending, setSending] = useState(false);
  const [proposalTarget, setProposalTarget] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (demo) return;
    void Promise.all([loadCuratorMessages(role), loadMatchRecommendations(role)])
      .then(([savedMessages, currentRecommendations]) => {
        const currentByTarget = new Map(currentRecommendations.map(item => [`${item.targetType}:${item.targetId}`, item]));
        setMessages(savedMessages.map(message => ({
          ...message,
          recommendations: message.recommendations.map(saved => currentByTarget.get(`${saved.targetType}:${saved.targetId}`) ?? saved),
        })));
      })
      .catch(caught => setNotice(friendlyError(caught)))
      .finally(() => setLoading(false));
  }, [demo, role]);

  const submit = async (text = input) => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true); setNotice(''); setInput('');
    try {
      if (demo) {
        const recs = /추천|어울|찾|매칭/.test(value) ? await loadMatchRecommendations(role, true) : [];
        const now = new Date().toISOString();
        setMessages(current => [...current,
          { id: `du-${Date.now()}`, sender: 'user', content: value, recommendations: [], actions: [], createdAt: now },
          { id: `da-${Date.now()}`, sender: 'assistant', content: recs.length ? `${recs[0]?.title}이(가) 조건 일치도 ${recs[0]?.score}점으로 가장 높아요. 추천 이유와 실제 협업 조건을 확인해 보세요.` : '협업은 제안, 크리에이터 승인, 매장 최종 확정 순서로 진행됩니다.', recommendations: recs.slice(0, 3), actions: recs.length ? ['다른 후보도 비교해 주세요'] : [role === 'store' ? '우리 공간에 어울리는 작품을 추천해 주세요' : '내 작품과 어울리는 매장을 추천해 주세요'], createdAt: now },
        ]);
      } else {
        const appended = await sendCuratorMessage(role, value);
        setMessages(current => [...current, ...appended]);
      }
    } catch (caught) { setNotice(friendlyError(caught)); } finally { setSending(false); }
  };

  const propose = async (item: MatchRecommendation) => {
    if (proposalTarget) return;
    setProposalTarget(item.targetId); setNotice('');
    try {
      if (demo) {
        setNotice('협업 조건을 확인할 수 있는 대화방으로 이동합니다.');
        await onProposalCreated('demo-proposal');
        return;
      }
      if (item.collaborationId) {
        setNotice('이미 진행 중인 협업으로 이동합니다.');
        await onProposalCreated(item.collaborationId);
        return;
      }
      const id = await createCollaborationProposal(item, `${item.title}과(와) 전시 협업을 제안합니다. 조건 일치도 ${item.score}점과 추천 이유를 확인했습니다.`);
      setNotice('협업 제안을 보냈습니다. 상대방 승인 후 다음 단계가 열립니다.');
      if (id) await onProposalCreated(id);
    } catch (caught) { setNotice(friendlyError(caught)); } finally { setProposalTarget(''); }
  };

  const topics = role === 'store' ? ['우리 공간에 어울리는 작품을 추천해 주세요', '협업 진행 방법을 알려주세요', 'QR 판매 운영을 알려주세요'] : ['내 작품과 어울리는 매장을 추천해 주세요', '협업과 출고 흐름을 알려주세요', '판매와 정산을 알려주세요'];
  return <KeyboardAvoidingView style={c.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title={role === 'creator' ? 'AI 콘셉트 큐레이터' : 'CURI:T AI 큐레이터'} subtitle="공간·작품·예산·재고 기반 추천" back={onBack} />
    <ScrollView ref={scrollRef} style={c.flex} contentContainerStyle={c.chatScroll} keyboardShouldPersistTaps="handled">
      {loading ? <ActivityIndicator color={colors.brand} style={c.loader} /> : messages.map((message, index) => <View key={message.id} style={c.messageBlock} onLayout={index === messages.length - 1 ? event => scrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 10), animated: true }) : undefined}>
        <View style={[c.bubbleRow, message.sender === 'user' && c.bubbleRowUser]}>
          {message.sender === 'assistant' ? <View style={c.smallAvatar}><CuritText weight="bold" style={c.brandText}>T</CuritText></View> : null}
          <View style={[c.bubble, message.sender === 'user' ? c.userBubble : c.aiBubble]}><CuritText style={message.sender === 'user' ? c.userText : undefined}>{message.content}</CuritText></View>
        </View>
        {message.recommendations.map(item => <RecommendationCard key={`${message.id}-${item.targetId}`} item={item} busy={proposalTarget === item.targetId} onPropose={() => { void propose(item); }} />)}
        {message.actions.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={c.actionRow}>{message.actions.map(action => <Chip key={action} label={action} onPress={() => { void submit(action); }} />)}</ScrollView> : null}
      </View>)}
      {sending ? <View style={c.typing}><ActivityIndicator size="small" color={colors.brand} /><CuritText style={c.muted}>등록 데이터와 조건을 비교하고 있어요…</CuritText></View> : null}
      {notice ? <View style={c.notice}><CuritText style={notice.includes('못') || notice.includes('오류') ? c.errorText : c.brandText}>{notice}</CuritText></View> : null}
    </ScrollView>
    <View style={c.composerWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={c.topicRow}>{topics.map(topic => <Chip key={topic} label={topic.replace('해 주세요', '')} onPress={() => setInput(topic)} />)}</ScrollView>
      <View style={c.composer}><TextInput value={input} onChangeText={setInput} onSubmitEditing={() => { void submit(); }} editable={!sending} placeholder="메시지를 입력해 주세요" placeholderTextColor={colors.subtle} style={c.input} /><Pressable accessibilityRole="button" accessibilityLabel="메시지 보내기" disabled={!input.trim() || sending} style={[c.send, (!input.trim() || sending) && c.sendDisabled]} onPress={() => { void submit(); }}><CuritText weight="bold" style={c.sendText}>↑</CuritText></Pressable></View>
    </View>
  </KeyboardAvoidingView>;
}

export function RecommendationScreen({ item, demo, onBack, onOpenCollaboration }: {
  item: MatchRecommendation;
  demo?: boolean;
  onBack: () => void;
  onOpenCollaboration: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const propose = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const id = demo ? 'demo-proposal' : item.collaborationId || await createCollaborationProposal(item, `${item.title} 전시 협업을 제안합니다.`);
      await onOpenCollaboration(id);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setBusy(false);
    }
  };

  return <View style={c.flex}>
    <Header title={item.targetType === 'project' ? '추천 작품' : '추천 공간'} subtitle="추천 이유와 협업 조건" back={onBack} />
    <ScrollView contentContainerStyle={c.discoverScroll}>
      <RecommendationCard item={item} busy={busy} inset={false} onPropose={() => { void propose(); }} />
      {error ? <View style={c.error}><CuritText accessibilityRole="alert" style={c.errorText}>{error}</CuritText></View> : null}
    </ScrollView>
  </View>;
}

function RecommendationCard({ item, busy, onPropose, inset = true }: { item: MatchRecommendation; busy: boolean; onPropose: () => void; inset?: boolean }) {
  return <View style={[c.recommendation, !inset && c.recommendationWide]}>
    {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={c.recommendationImage} contentFit="cover" /> : <View style={[c.recommendationImage, c.cardImagePlaceholder]}><Icon name={item.targetType === 'project' ? 'discover' : 'store'} color={colors.brand} /><CuritText style={c.pinCaption}>이미지 준비 중</CuritText></View>}
    <View style={c.recommendationBody}>
      <View style={c.between}><View style={c.flex}><CuritText weight="bold" style={c.recommendationTitle}>{item.title}</CuritText><CuritText style={c.muted}>{item.subtitle}</CuritText></View><View style={c.score}><CuritText weight="bold" style={c.brandText}>{item.score}점</CuritText></View></View>
      <CuritText style={c.description}>{item.description}</CuritText>
      {item.priceRange ? <CuritText weight="semibold">{item.priceRange}</CuritText> : null}
      <View style={c.reasonBox}>{item.reasons.map(reason => <View key={reason} style={c.reasonRow}><CuritText style={c.check}>✓</CuritText><CuritText style={c.reasonText}>{reason}</CuritText></View>)}</View>
      <View style={c.tags}>{item.tags.map(tag => <CuritText key={tag} style={c.tag}>#{tag}</CuritText>)}</View>
      <Button label={busy ? '처리 중…' : item.collaborationId ? `기존 협업 보기 · ${collaborationRecommendationLabel(item.collaborationStatus)}` : '이 후보에게 협업 제안'} disabled={busy} onPress={onPropose} />
    </View>
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

export function CollaborationDetailScreen({ role, userId, item, demo, onBack, onChanged, onDemoStatusChanged }: { role: Role; userId: string; item: CollaborationSummary; demo?: boolean; onBack: () => void; onChanged: () => void; onDemoStatusChanged?: (status: CollaborationSummary['status']) => void }) {
  const [messages, setMessages] = useState<CollaborationMessage[]>(demo ? [{ id: 'demo-message', collaborationId: item.id, senderId: role === 'creator' ? 'demo-store' : 'demo-creator', content: '전시 조건과 상품 수량을 확인했습니다.', createdAt: new Date().toISOString() }] : []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(!demo);
  const [notice, setNotice] = useState('');
  const [collaborationItems, setCollaborationItems] = useState<CollaborationItem[]>(demo ? [{ projectItemId: 'demo-mug', name: '머그컵 (화이트·그레이)', imageUrl: '', price: 35000, stock: 12, quantity: 2, creatorConfirmed: false }] : []);
  const [zone, setZone] = useState(String(item.terms.installationZone || '선반'));
  const [termNote, setTermNote] = useState(String(item.terms.note || ''));
  const [termsBusy, setTermsBusy] = useState(!demo);
  const [currentStatus, setCurrentStatus] = useState(item.status);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const refreshMessages = async () => {
    if (demo) return;
    setBusy(true);
    try { setMessages(await loadCollaborationMessages(item.id)); } catch (caught) { setNotice(friendlyError(caught)); } finally { setBusy(false); }
  };
  useEffect(() => {
    if (demo) return;
    let active = true;
    void loadCollaborationMessages(item.id)
      .then(value => { if (active) setMessages(value); })
      .catch(caught => { if (active) setNotice(friendlyError(caught)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [demo, item.id]);
  useEffect(() => {
    if (demo) return;
    let active = true;
    void loadCollaborationItems(item).then(value => { if (active) setCollaborationItems(value); }).catch(caught => { if (active) setNotice(friendlyError(caught)); }).finally(() => { if (active) setTermsBusy(false); });
    return () => { active = false; };
  }, [demo, item]);
  const saveTerms = async (confirm = false) => {
    const nextItems = confirm ? collaborationItems.map(value => ({ ...value, creatorConfirmed: true })) : collaborationItems;
    if (demo) { setCollaborationItems(nextItems); setNotice(confirm ? '작품 구성과 수량을 확인했습니다.' : '협업 조건을 저장했습니다.'); return; }
    setTermsBusy(true); setNotice('');
    try { await saveCollaborationTerms(item.id, { ...item.terms, installationZone: zone, note: termNote }, nextItems); setCollaborationItems(nextItems); setNotice(confirm ? '작품 구성과 수량을 확인했습니다.' : '협업 상품과 배치 조건을 저장했습니다.'); }
    catch (caught) { setNotice(friendlyError(caught)); } finally { setTermsBusy(false); }
  };
  const send = async () => {
    if (!input.trim() || busy) return;
    if (demo) { setMessages(current => [...current, { id: `demo-${Date.now()}`, collaborationId: item.id, senderId: userId, content: input.trim(), createdAt: new Date().toISOString() }]); setInput(''); return; }
    setBusy(true); setNotice('');
    try { await sendCollaborationMessage(item.id, input); setInput(''); await refreshMessages(); } catch (caught) { setNotice(friendlyError(caught)); } finally { setBusy(false); }
  };
  const transition = async (action: 'accept' | 'confirm' | 'counter' | 'cancel' | 'complete') => {
    if (busy) return;
    if (demo) {
      const nextStatus = nextDemoCollaborationStatus(currentStatus, action, role);
      if (nextStatus === currentStatus) { setNotice('현재 역할과 협업 단계에서는 이 상태로 변경할 수 없습니다.'); return; }
      setCurrentStatus(nextStatus);
      onDemoStatusChanged?.(nextStatus);
      setInput('');
      setNotice(`협업 상태를 '${statusLabel[nextStatus]}'으로 변경했습니다.`);
      return;
    }
    setBusy(true); setNotice('');
    try { await transitionCollaboration(item.id, action, input); setInput(''); setNotice('협업 상태를 변경했습니다.'); onChanged(); } catch (caught) { setNotice(friendlyError(caught)); } finally { setBusy(false); }
  };
  const actions = useMemo(() => {
    const result: { action: 'accept' | 'confirm' | 'counter' | 'cancel' | 'complete'; label: string; primary?: boolean }[] = [];
    if (role === 'creator' && ['proposed', 'negotiating'].includes(currentStatus)) result.push({ action: 'accept', label: '조건 승인', primary: true });
    if (role === 'store' && currentStatus === 'approved') result.push({ action: 'confirm', label: '매장 최종 확정', primary: true });
    if (['proposed', 'negotiating', 'approved'].includes(currentStatus)) result.push({ action: 'counter', label: '조건 수정 요청' });
    if (currentStatus === 'active') result.push({ action: 'complete', label: '전시 종료 처리', primary: true });
    if (!['completed', 'cancelled'].includes(currentStatus)) result.push({ action: 'cancel', label: '협업 취소' });
    return result;
  }, [currentStatus, role]);
  const itemQuantity = collaborationItems.reduce((sum, value) => sum + value.quantity, 0);
  const quickReplies = ['전시 연장 문의', '작품 교체 문의', '배송 일정 확인', '정산 확인'];
  return <KeyboardAvoidingView style={c.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title={item.counterpartName} subtitle={`${item.projectTitle} · ${statusLabel[currentStatus]}`} back={onBack} />
    <ScrollView style={c.flex} contentContainerStyle={c.detailScroll} keyboardShouldPersistTaps="handled">
      <View style={c.compactSummary}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: summaryOpen }} accessibilityLabel={`협업 요약 ${summaryOpen ? '접기' : '펼치기'}`} style={c.summaryHeader} onPress={() => setSummaryOpen(value => !value)}>
          <View style={c.flex}><View style={c.summaryTitleRow}><CuritText weight="semibold" style={c.summaryTitle}>협업 정보</CuritText><View style={c.inlineStatus}><View style={c.chatStatusDot} /><CuritText style={c.chatStatusText}>{statusLabel[currentStatus]}</CuritText></View></View><CuritText style={c.summaryMeta}>{item.startsOn && item.endsOn ? `${item.startsOn} ~ ${item.endsOn}` : '기간 협의 중'} · 작품 {collaborationItems.length || '—'}종{itemQuantity ? ` ${itemQuantity}개` : ''}</CuritText></View>
          <CuritText weight="semibold" style={c.summaryToggle}>{summaryOpen ? '접기' : '보기'}</CuritText>
        </Pressable>
        {summaryOpen ? <View style={c.summaryBody}>
          <CuritText style={c.muted}>{item.storeName} × {item.creatorName}</CuritText>
          <Term label="판매 배분" value={`작가 ${item.creatorShare}% · 매장 ${item.storeShare}% · 플랫폼 ${item.platformShare}%`} />
          <CuritText style={c.flowHint}>{item.terms.initiatedBy === 'creator' ? '크리에이터 제안 → 매장 최종 확정 → QR 발급·전시' : '매장 제안 → 크리에이터 승인 → 매장 최종 확정 → QR 발급·전시'}</CuritText>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: conditionsOpen }} style={c.conditionToggle} onPress={() => setConditionsOpen(value => !value)}><CuritText weight="semibold" style={c.brandText}>작품 수량·배치 조건 {conditionsOpen ? '접기' : '관리'}</CuritText><CuritText style={c.brandText}>{conditionsOpen ? '−' : '＋'}</CuritText></Pressable>
          {conditionsOpen ? <View style={c.conditionBody}>
            {termsBusy && !collaborationItems.length ? <ActivityIndicator color={colors.brand} /> : collaborationItems.map(value => <View key={value.projectItemId} style={c.itemCard}>{value.imageUrl ? <Image source={{ uri: value.imageUrl }} style={c.itemImage} /> : <View style={[c.itemImage, c.itemPlaceholder]}><Icon name="management" color={colors.brand} /></View>}<View style={c.flex}><CuritText weight="semibold">{value.name}</CuritText><CuritText style={c.muted}>{value.price.toLocaleString()}원 · 재고 {value.stock}개</CuritText><CuritText style={value.creatorConfirmed ? c.brandText : c.time}>{value.creatorConfirmed ? '크리에이터 확인 완료' : '확인 전'}</CuritText></View><View style={c.quantity}><Pressable accessibilityLabel="수량 줄이기" accessibilityRole="button" disabled={role === 'creator' || value.quantity <= 1} style={c.quantityTap} onPress={() => setCollaborationItems(current => current.map(candidate => candidate.projectItemId === value.projectItemId ? { ...candidate, quantity: Math.max(1, candidate.quantity - 1), creatorConfirmed: false } : candidate))}><CuritText style={c.quantityButton}>−</CuritText></Pressable><CuritText weight="bold">{value.quantity}</CuritText><Pressable accessibilityLabel="수량 늘리기" accessibilityRole="button" disabled={role === 'creator' || value.quantity >= value.stock} style={c.quantityTap} onPress={() => setCollaborationItems(current => current.map(candidate => candidate.projectItemId === value.projectItemId ? { ...candidate, quantity: Math.min(candidate.stock, candidate.quantity + 1), creatorConfirmed: false } : candidate))}><CuritText style={c.quantityButton}>＋</CuritText></Pressable></View></View>)}
            <CuritText weight="semibold" style={c.conditionLabel}>배치 위치</CuritText>
            <View style={c.tags}>{['벽면', '선반', '카운터', '테이블', '입구'].map(value => <Chip key={value} label={value} active={zone === value} onPress={() => role === 'store' && setZone(value)} />)}</View>
            <TextInput value={termNote} onChangeText={setTermNote} editable={role === 'store'} placeholder="설치 위치, 발송 일정, 관리 조건" placeholderTextColor={colors.subtle} multiline style={c.termInput} />
            <Button label={termsBusy ? '저장 중…' : role === 'creator' ? '작품 구성·수량 확인' : '상품·배치 조건 저장'} disabled={termsBusy || !collaborationItems.length} variant="secondary" onPress={() => { void saveTerms(role === 'creator'); }} />
          </View> : null}
          {actions.length ? <View style={c.actionButtons}>{actions.map(action => <View key={action.action} style={c.actionButton}><Button label={action.label} variant={action.primary ? 'primary' : 'secondary'} disabled={busy} onPress={() => { void transition(action.action); }} /></View>)}</View> : null}
        </View> : null}
      </View>
      {busy && !messages.length ? <ActivityIndicator color={colors.brand} /> : messages.length ? messages.map(message => <View key={message.id} style={[c.collabBubble, message.senderId === userId ? c.ownCollabBubble : c.otherCollabBubble]}><CuritText style={message.senderId === userId ? c.userText : undefined}>{message.content}</CuritText><CuritText style={[c.time, message.senderId === userId && { color: '#D7DFCF' }]}>{new Date(message.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</CuritText></View>) : <CuritText style={c.muted}>조건이나 일정에 관해 첫 메시지를 남겨보세요.</CuritText>}
      {notice ? <View style={c.notice}><CuritText style={c.brandText}>{notice}</CuritText></View> : null}
    </ScrollView>
    <View style={c.composerWrap}>
      {quickRepliesOpen ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={c.topicRow}>{quickReplies.map(value => <Pressable key={value} accessibilityRole="button" style={c.quickReply} onPress={() => { setInput(value); setQuickRepliesOpen(false); }}><CuritText style={c.quickReplyText}>{value}</CuritText></Pressable>)}</ScrollView> : null}
      <View style={c.composer}><Pressable accessibilityRole="button" accessibilityLabel="빠른 문의 열기" accessibilityState={{ expanded: quickRepliesOpen }} style={c.composerMore} onPress={() => setQuickRepliesOpen(value => !value)}><CuritText weight="semibold" style={c.composerMoreText}>＋</CuritText></Pressable><TextInput value={input} onChangeText={setInput} placeholder="메시지를 입력해 주세요" placeholderTextColor={colors.subtle} style={c.input} /><Pressable accessibilityRole="button" accessibilityLabel="협업 메시지 보내기" disabled={!input.trim() || busy} style={[c.send, (!input.trim() || busy) && c.sendDisabled]} onPress={() => { void send(); }}><CuritText weight="bold" style={c.sendText}>↑</CuritText></Pressable></View>
    </View>
  </KeyboardAvoidingView>;
}

function Term({ label, value }: { label: string; value: string }) { return <View style={c.termRow}><CuritText style={c.termLabel}>{label}</CuritText><CuritText weight="semibold" style={c.termValue}>{value}</CuritText></View>; }

const c = StyleSheet.create({
  flex: { flex: 1 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, muted: { color: colors.muted }, brandText: { color: colors.brand },
  hubScroll: { flexGrow: 1, padding: 20, paddingBottom: 36 }, curatorPin: { minHeight: 82, borderRadius: radius.lg, backgroundColor: colors.brandSoft, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }, curatorAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, smallAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft }, pinCaption: { color: colors.muted, fontSize: 11, marginTop: 3 }, pinAction: { color: colors.brand, fontSize: 11 }, listHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, marginBottom: 6 }, chatRow: { minHeight: 88, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }, contactAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPale }, chatName: { fontSize: 16 }, chatProjectRow: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 7 }, project: { flexShrink: 1, color: colors.brand, fontSize: 11, marginVertical: 3 }, chatStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.brandSoft }, chatStatusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brand }, chatStatusText: { color: colors.brand, fontSize: 9 }, time: { color: colors.subtle, fontSize: 9 }, loader: { marginVertical: 40 }, error: { padding: 14, borderRadius: radius.sm, backgroundColor: '#FFF2EF', marginVertical: 16 }, errorText: { color: colors.danger },
  chatScroll: { padding: 16, paddingBottom: 28, gap: 12 }, messageBlock: { gap: 10 }, bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, bubbleRowUser: { justifyContent: 'flex-end' }, bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11 }, aiBubble: { backgroundColor: colors.brandPale, borderTopLeftRadius: 4 }, userBubble: { backgroundColor: colors.brand, borderTopRightRadius: 4 }, userText: { color: colors.surface }, actionRow: { gap: 7, paddingLeft: 42, paddingBottom: 4 }, typing: { flexDirection: 'row', gap: 9, alignItems: 'center', marginLeft: 42 }, notice: { padding: 12, backgroundColor: colors.brandSoft, borderRadius: radius.sm },
  composerWrap: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingTop: 8 }, topicRow: { gap: 7, paddingHorizontal: 12, paddingBottom: 8 }, composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 12 }, composerMore: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, composerMoreText: { color: colors.brand, fontSize: 20, lineHeight: 22 }, input: { flex: 1, minHeight: 46, borderRadius: 23, backgroundColor: '#F7F7F7', borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, fontFamily: fonts.regular, color: colors.ink }, send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }, sendDisabled: { backgroundColor: colors.border }, sendText: { color: colors.surface, fontSize: 20 },
  recommendation: { marginLeft: 42, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface }, recommendationWide: { marginLeft: 0 }, recommendationImage: { width: '100%', height: 148 }, recommendationBody: { padding: 14, gap: 10 }, recommendationTitle: { fontSize: 17 }, score: { minWidth: 48, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.brandSoft, alignItems: 'center' }, description: { color: colors.muted, lineHeight: 21 }, reasonBox: { borderRadius: radius.sm, padding: 10, backgroundColor: colors.brandPale, gap: 6 }, reasonRow: { flexDirection: 'row', gap: 7 }, check: { color: colors.brand }, reasonText: { flex: 1, fontSize: 12, color: colors.muted }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, tag: { fontSize: 10, color: colors.brand, backgroundColor: colors.brandSoft, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 }, cardImagePlaceholder: { backgroundColor: colors.brandPale, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 12 },
  detailScroll: { flexGrow: 1, padding: 16, paddingBottom: 24 }, compactSummary: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden', marginBottom: 12 }, summaryHeader: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 9 }, summaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 }, summaryTitle: { flexShrink: 1, fontSize: 14 }, summaryMeta: { color: colors.muted, fontSize: 10, marginTop: 3 }, summaryToggle: { color: colors.brand, fontSize: 10 }, summaryBody: { borderTopWidth: 1, borderTopColor: colors.border, padding: 14, gap: 12 }, conditionToggle: { minHeight: 46, borderRadius: radius.sm, backgroundColor: colors.brandSoft, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, conditionBody: { gap: 10, paddingTop: 2 }, conditionLabel: { fontSize: 13, marginTop: 2 }, termRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 18 }, termLabel: { color: colors.muted, fontSize: 12 }, termValue: { flex: 1, textAlign: 'right', fontSize: 12 }, flowHint: { color: colors.brand, fontSize: 11, backgroundColor: colors.brandSoft, padding: 10, borderRadius: radius.sm }, itemCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10 }, itemImage: { width: 52, height: 52, borderRadius: radius.sm }, itemPlaceholder: { backgroundColor: colors.brandPale, alignItems: 'center', justifyContent: 'center' }, quantity: { flexDirection: 'row', alignItems: 'center', gap: 2 }, quantityTap: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }, quantityButton: { fontSize: 20, color: colors.brand }, termInput: { minHeight: 76, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontFamily: fonts.regular, color: colors.ink, textAlignVertical: 'top' }, quickReply: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, backgroundColor: colors.surface }, quickReplyText: { color: colors.muted, fontSize: 11 }, collabBubble: { maxWidth: '82%', borderRadius: 15, padding: 12, marginBottom: 8 }, ownCollabBubble: { backgroundColor: colors.brand, alignSelf: 'flex-end', borderTopRightRadius: 4 }, otherCollabBubble: { backgroundColor: colors.brandPale, alignSelf: 'flex-start', borderTopLeftRadius: 4 }, actionButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }, actionButton: { minWidth: '47%', flexGrow: 1 },
  headerAi: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft }, discoverScroll: { padding: 18, paddingBottom: 36 }, exploreTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: 8, marginBottom: 18 }, exploreTab: { flex: 1, alignItems: 'center', paddingVertical: 13 }, exploreTabActive: { borderBottomWidth: 2, borderBottomColor: colors.brand }, searchBox: { minHeight: 48, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: '#F8F8F8', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 }, searchInput: { flex: 1, minHeight: 46, color: colors.ink, fontFamily: fonts.regular }, directoryTitle: { fontSize: 19, lineHeight: 28, marginBottom: 6 }, filterCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', marginBottom: 10, backgroundColor: colors.surface }, filterHeader: { minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, filterHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: 9 }, filterCount: { minWidth: 20, height: 20, borderRadius: 10, textAlign: 'center', lineHeight: 20, color: colors.surface, backgroundColor: colors.brand, fontSize: 10 }, filterEyebrow: { color: colors.muted, fontSize: 11, lineHeight: 17 }, filterBody: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 12, gap: 12 }, filterGroup: { gap: 7 }, filterOptionsHorizontal: { gap: 7, paddingHorizontal: 14 }, resetFilter: { minHeight: 36, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 14 }, explainBanner: { borderRadius: radius.md, backgroundColor: colors.brandSoft, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }, discoverCard: { marginBottom: 14 }, creatorDirectory: { gap: 14 }, creatorCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface }, creatorCardImage: { width: '100%', height: 150 }, creatorCardBody: { padding: 14, gap: 9 }, creatorCardTitle: { fontSize: 17 }, creatorAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
});
