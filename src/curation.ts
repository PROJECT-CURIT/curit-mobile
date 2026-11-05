import { dispatchCollaborationPush, mediaUrl } from './platform';
import { getSupabase } from './supabase';
import { randomUUID } from 'expo-crypto';
import { calculateMatchScore, matchCreatorTraits, type CreatorMatchTraits } from './matchScoring';
import type {
  CollaborationItem,
  CollaborationMessage,
  CollaborationStatus,
  CollaborationSummary,
  CuratorMessage,
  MatchRecommendation,
  Role,
} from './types';

export { calculateMatchScore } from './matchScoring';

type ProjectRow = {
  id: string;
  creator_id: string;
  title: string;
  story: string;
  concept: string;
  region: string;
  purpose: string;
  status: string;
  cover_path?: string | null;
  updated_at?: string;
};

type ProjectItemRow = {
  project_id: string;
  name: string;
  price: number;
  stock: number;
  image_path: string | null;
  material: string;
  sale_mode?: string;
};

type StoreRow = {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  address: string;
  introduction: string;
  target_audience: string;
  mood_tags: string[];
  purpose_tags: string[];
  monthly_budget_min: number | null;
  monthly_budget_max: number | null;
  photo_paths: string[];
  exhibition_zones: { type?: string; label?: string }[];
};

type CreatorProfileRow = CreatorMatchTraits & {
  user_id: string;
  introduction: string;
  categories: string[];
  regions: string[];
};

export type CreatorDirectoryEntry = {
  id: string;
  title: string;
  artist: string;
  region: string;
  tags: string[];
  searchTerms?: string[];
  priceRange: string;
  status: string;
  imageUrl?: string;
};

const catalogPageSize = 80;
const publicProjectFields = 'id, creator_id, title, story, concept, region, purpose, status, cover_path, updated_at';
const creatorMatchFields = 'user_id, introduction, categories, regions, dna_moods, dna_colors, preferred_spaces, collaboration_goals, install_conditions';
type CatalogQuery = PromiseLike<{ data: unknown; error: { message: string } | null }> & {
  abortSignal(signal: AbortSignal): void;
  order(column: 'id'): void;
  limit(count: number): void;
  gt(column: 'id', value: string): void;
};

async function catalogRows<Row extends { id: string }>(queryForPage: () => CatalogQuery, all: boolean, signal?: AbortSignal) {
  const rows: Row[] = [];
  let after: string | undefined;
  do {
    const query = queryForPage();
    if (signal) query.abortSignal(signal);
    if (all) {
      query.order('id');
      query.limit(catalogPageSize);
      if (after) query.gt('id', after);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    after = all && page.length === catalogPageSize ? page.at(-1)?.id : undefined;
  } while (after);
  return rows;
}

async function projectMetadata(projects: ProjectRow[], signal?: AbortSignal) {
  const supabase = getSupabase();
  const creatorIds = [...new Set(projects.map(project => project.creator_id))];
  const projectIds = projects.map(project => project.id);
  const profilesQuery = supabase.from('profiles').select('id, display_name').in('id', creatorIds);
  const creatorsQuery = supabase.from('creator_profiles').select(creatorMatchFields).in('user_id', creatorIds);
  if (signal) { profilesQuery.abortSignal(signal); creatorsQuery.abortSignal(signal); }
  const [profiles, creators, items] = await Promise.all([
    profilesQuery,
    creatorsQuery,
    catalogRows<ProjectItemRow & { id: string }>(() => supabase.from('project_items').select('id, project_id, name, price, stock, image_path, material, sale_mode').in('project_id', projectIds), true, signal),
  ]);
  const error = profiles.error || creators.error;
  if (error) throw new Error(error.message);
  const names = new Map((profiles.data ?? []).map(row => [String(row.id), String(row.display_name || '크리에이터')]));
  const categories = new Map((creators.data ?? []).map(row => [String(row.user_id), (row.categories ?? []) as string[]]));
  const traits = new Map((creators.data ?? []).map(row => [String(row.user_id), row as CreatorProfileRow]));
  const byProject = new Map<string, ProjectItemRow[]>();
  for (const item of items) {
    const list = byProject.get(item.project_id);
    if (list) list.push(item);
    else byProject.set(item.project_id, [item]);
  }
  return { names, categories, traits, byProject };
}

const STOP_WORDS = new Set(['그리고', '또는', '위한', '있는', '없는', '합니다', '해요', '공간', '작품', '전시', '판매']);

function terms(value: string | string[]) {
  const text = Array.isArray(value) ? value.join(' ') : value;
  return [...new Set(text
    .toLocaleLowerCase('ko-KR')
    .replace(/[^0-9a-z가-힣]+/g, ' ')
    .split(/\s+/)
    .map(item => item.trim().replace(/(?:에게|에서|으로|와|과|은|는|이|가|을|를|에)$/u, ''))
    .filter(item => item.length > 1 && !STOP_WORDS.has(item)))];
}

function displayTerm(value: string) {
  return value === 'qr' ? 'QR' : value;
}

function overlap(left: string[], right: string[]) {
  const matched = left.filter(item => right.some(candidate => candidate.includes(item) || item.includes(candidate)));
  return [...new Set(matched)];
}

function regionsOverlap(left: string, right: string) {
  const regions = ['서울', '경기', '인천', '강원', '대전', '세종', '충청', '광주', '전라', '대구', '부산', '울산', '경상', '제주'];
  const leftRegions = regions.filter(region => left.includes(region));
  return leftRegions.some(region => right.includes(region));
}

function priceLabel(items: ProjectItemRow[]) {
  if (!items.length) return '가격 협의';
  const values = items.map(item => Number(item.price)).filter(value => Number.isFinite(value) && value > 0);
  if (!values.length) return '가격 협의';
  const min = Math.min(...values).toLocaleString('ko-KR');
  const max = Math.max(...values).toLocaleString('ko-KR');
  return min === max ? `${min}원` : `${min}~${max}원`;
}

function demoRecommendations(role: Role): MatchRecommendation[] {
  return role === 'store' ? [
    { targetId: 'demo-project-glass', targetType: 'project', title: '유리 정원의 오후', subtitle: '권아영 · 서울·경기', description: '빛과 식물의 색을 담은 패브릭 소품 컬렉션', score: 94, reasons: ['매장의 초록 식물과 작품 색감이 자연스럽게 이어져요', '2만~5만원대 방문객 구매 범위에 들어와요', '선반에 셀프 설치할 수 있는 소형 작품이에요'], tags: ['식물', '패브릭', '파스텔'], priceRange: '18,000~48,000원' },
    { targetId: 'demo-project-paper', targetType: 'project', title: '종이 위의 산책', subtitle: '최선문 · 서울 전역', description: '도시의 산책 장면을 기록한 드로잉과 아트 프린트', score: 91, reasons: ['우드톤 벽면에 차분한 드로잉이 잘 어울려요', '가벼운 액자라 기존 벽면을 그대로 활용할 수 있어요'], tags: ['드로잉', '프린트', '모던'], priceRange: '15,000~65,000원' },
    { targetId: 'demo-project-blue', targetType: 'project', title: '파란 식탁', subtitle: '김해름 · 서울·인천', description: '푸른 유약의 농도를 달리한 작은 그릇과 오브제', score: 88, reasons: ['카운터의 밝은 조명과 세라믹 표면이 잘 맞아요', '현장 수령이 쉬운 생활 소품 구성이에요'], tags: ['세라믹', '블루', '미니멀'], priceRange: '28,000~120,000원' },
    { targetId: 'demo-project-earth', targetType: 'project', title: '흙의 기억', subtitle: '김서연 · 서울·제주', description: '흙의 질감을 살린 따뜻한 생활 도예 컬렉션', score: 86, reasons: ['매장 우드톤과 자연 소재가 일치해요', '카운터와 선반을 함께 활용할 수 있어요'], tags: ['우드톤', '도예', '자연'], priceRange: '35,000~180,000원' },
  ] : [
    { targetId: '10000000-0000-4000-8000-000000000001', targetType: 'store', title: '아늑한 서울', subtitle: '카페 · 서울 성동구 성수동', description: '우드톤 공간에서 독립 창작자의 작품을 소개하는 30석 카페', score: 94, reasons: ['도예 작품과 우드톤 선반의 소재가 잘 맞아요', '예술·공예에 관심 있는 방문객이 많아요', 'QR 판매 목적과 전시 조건이 일치해요'], tags: ['우드톤', '미니멀', '카운터 선반'] },
    { targetId: 'demo-store-book', targetType: 'store', title: '성수 독립서점', subtitle: '서점 · 서울 성동구', description: '조용한 관람과 벽면 전시가 가능한 독립서점', score: 86, reasons: ['작품을 천천히 보는 방문 환경이에요', '서울 활동 지역과 일치해요'], tags: ['조용함', '전시벽', '독립서점'] },
    { targetId: 'demo-store-leaf', targetType: 'store', title: '리프 쇼룸', subtitle: '쇼룸 · 서울 마포구 연남동', description: '밝은 자연광과 낮은 진열대를 갖춘 소형 쇼룸', score: 83, reasons: ['밝은 색 작품의 촬영과 전시에 적합해요', '선반과 테이블 구역을 함께 사용할 수 있어요'], tags: ['밝음', '선반', '쇼룸'] },
    { targetId: 'demo-store-afternoon', targetType: 'store', title: '오후의 기록', subtitle: '카페 · 서울 마포구 망원동', description: '창가 좌석과 조용한 벽면이 있는 동네 카페', score: 79, reasons: ['차분한 작품을 오래 감상하기 좋은 공간이에요', '작은 굿즈를 계산대 옆에 배치할 수 있어요'], tags: ['차분함', '창가', '벽면'] },
  ];
}

async function storeRecommendations(preferenceText = '', all = false, signal?: AbortSignal): Promise<MatchRecommendation[]> {
  const supabase = getSupabase();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('로그인이 필요합니다.');
  const storeQuery = supabase.from('store_profiles').select('*').eq('owner_id', auth.user.id);
  if (signal) storeQuery.abortSignal(signal);
  const [storeResult, projects] = await Promise.all([
    storeQuery.single<StoreRow>(),
    catalogRows<ProjectRow>(() => supabase.from('projects').select(publicProjectFields).in('status', ['recruiting', 'matched']), all, signal),
  ]);
  if (storeResult.error) throw new Error(storeResult.error.message);
  if (!projects.length) return [];
  const store = storeResult.data;
  const storeTerms = terms([store.category, store.introduction, store.target_audience, ...store.mood_tags, ...store.purpose_tags, preferenceText]);
  const collaborationRows = await catalogRows<{ id: string; project_id: string; status: CollaborationStatus }>(
    () => supabase.from('collaborations').select('id, project_id, status').eq('store_id', store.id), true, signal,
  );
  const collaborations = new Map(collaborationRows.map(row => [row.project_id, row]));
  const ranked: MatchRecommendation[] = [];
  for (let start = 0; start < projects.length; start += catalogPageSize) {
    const batch = projects.slice(start, start + catalogPageSize);
    const { names, categories, traits, byProject } = await projectMetadata(batch, signal);
    for (const project of batch) {
      const creatorCategories = categories.get(project.creator_id) ?? [];
      const projectItems = (byProject.get(project.id) ?? []).filter(item => item.stock > 0 && item.sale_mode === 'display_sale');
      if (!projectItems.length) continue;
      const projectTerms = terms([project.title, project.story, project.concept, project.purpose, project.region, ...creatorCategories, ...projectItems.flatMap(item => [item.name, item.material])]);
      const matched = overlap(storeTerms, projectTerms);
      const dna = matchCreatorTraits(traits.get(project.creator_id), store);
      const regionFit = regionsOverlap(project.region, store.address);
      const installFit = store.exhibition_zones.length > 0;
      const score = calculateMatchScore({ matchedTermCount: new Set([...matched, ...dna.keywords]).size, regionFit, hasAvailableItems: true, hasExhibitionZones: installFit });
      const reasons = [
        ...dna.reasons.slice(0, 2),
        ...(matched.length ? [`${matched.slice(0, 3).map(displayTerm).join('·')} 키워드가 등록 정보에서 겹쳐요`] : dna.reasons.length ? [] : ['취향 키워드가 적어 작품을 직접 확인해 주세요']),
        `${projectItems.length}개 판매 가능 상품에 재고가 있어요`,
        installFit ? `${store.exhibition_zones.length}개 전시 구역을 등록했어요` : '전시 구역을 등록하면 배치 가능성을 더 확인할 수 있어요',
        regionFit ? '작가 활동 지역과 매장 지역이 겹쳐요' : '지역 조건은 협업 제안 전에 확인해 주세요',
      ].filter(Boolean).slice(0, 3);
      ranked.push({
        targetId: project.id,
        targetType: 'project' as const,
        title: project.title,
        subtitle: `${names.get(project.creator_id) ?? '크리에이터'} · ${project.region || '지역 협의'}`,
        description: project.concept || project.story || '작품과 굿즈 전시 협업을 제안할 수 있어요.',
        score,
        reasons,
        confirmationNotes: [dna.installationNote, '작품 치수와 실제 설치 가능 여부는 협업 전에 확인해 주세요.', '매장 월 예산과 상품 판매가는 별도로 확인해 주세요.'].filter(Boolean),
        tags: [...new Set([...creatorCategories, ...matched])],
        searchTerms: projectItems.flatMap(item => [item.name, item.material]),
        imageUrl: projectItems[0]?.image_path ? mediaUrl(projectItems[0].image_path) : undefined,
        priceRange: priceLabel(projectItems),
        collaborationId: collaborations.get(project.id)?.id,
        collaborationStatus: collaborations.get(project.id)?.status,
      });
    }
  }
  ranked.sort((a, b) => b.score - a.score || a.targetId.localeCompare(b.targetId));
  return all ? ranked : ranked.slice(0, 6);
}

async function creatorRecommendations(preferenceText = '', all = false, signal?: AbortSignal): Promise<MatchRecommendation[]> {
  const supabase = getSupabase();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('로그인이 필요합니다.');
  const creatorQuery = supabase.from('creator_profiles').select(creatorMatchFields).eq('user_id', auth.user.id);
  const projectQuery = supabase.from('projects').select(publicProjectFields).eq('creator_id', auth.user.id).in('status', ['recruiting', 'matched']).order('updated_at', { ascending: false }).limit(1);
  if (signal) { creatorQuery.abortSignal(signal); projectQuery.abortSignal(signal); }
  const [creatorResult, projectResult, stores, collaborationRows] = await Promise.all([
    creatorQuery.maybeSingle<CreatorProfileRow>(),
    projectQuery.maybeSingle<ProjectRow>(),
    catalogRows<StoreRow>(() => supabase.from('store_profiles').select('id, name, category, address, introduction, target_audience, mood_tags, purpose_tags, photo_paths, exhibition_zones').eq('onboarding_complete', true), all, signal),
    catalogRows<{ id: string; store_id: string; status: CollaborationStatus }>(() => supabase.from('collaborations').select('id, store_id, status').eq('creator_id', auth.user.id), true, signal),
  ]);
  const error = creatorResult.error || projectResult.error;
  if (error) throw new Error(error.message);
  const creator = creatorResult.data;
  const project = projectResult.data;
  const ownItems = project
    ? await catalogRows<ProjectItemRow & { id: string }>(() => supabase.from('project_items').select('id, project_id, name, price, stock, image_path, material, sale_mode').eq('project_id', project.id).eq('sale_mode', 'display_sale').gt('stock', 0), true, signal)
    : [];
  const creatorTerms = terms([creator?.introduction ?? '', ...(creator?.categories ?? []), ...(creator?.regions ?? []), project?.story ?? '', project?.concept ?? '', ...ownItems.flatMap(item => [item.name, item.material]), preferenceText]);
  const collaborations = new Map(collaborationRows.map(row => [row.store_id, row]));
  const ranked = stores.map(store => {
    const storeTerms = terms([store.category, store.address, store.introduction, store.target_audience, ...store.mood_tags, ...store.purpose_tags]);
    const matched = overlap(creatorTerms, storeTerms);
    const dna = matchCreatorTraits(creator, store);
    const regionFit = regionsOverlap((creator?.regions ?? []).join(' '), store.address);
    const score = calculateMatchScore({ matchedTermCount: new Set([...matched, ...dna.keywords]).size, regionFit, hasAvailableItems: ownItems.length > 0, hasExhibitionZones: store.exhibition_zones.length > 0 });
    const zones = store.exhibition_zones.map(zone => zone.label || zone.type).filter(Boolean);
    return {
      targetId: store.id,
      targetType: 'store' as const,
      title: store.name,
      subtitle: `${store.category || '오프라인 매장'} · ${store.address || '위치 협의'}`,
      description: store.introduction || `${store.target_audience} 고객이 방문하는 공간입니다.`,
      score,
      reasons: [
        ...dna.reasons.slice(0, 2),
        ...(matched.length ? [`${matched.slice(0, 3).map(displayTerm).join('·')} 키워드가 등록 정보에서 겹쳐요`] : dna.reasons.length ? [] : ['취향 키워드가 적어 매장 공간을 직접 확인해 주세요']),
        zones.length ? `${zones.slice(0, 2).join('·')} 구역이 등록돼 있어요` : '전시 구역 정보가 없어 협의가 필요해요',
        regionFit ? '활동 지역과 매장 지역이 겹쳐요' : '지역 조건은 협업 제안 전에 확인해 주세요',
      ].slice(0, 3),
      confirmationNotes: [dna.installationNote, '작품 치수와 실제 설치 가능 여부는 협업 전에 확인해 주세요.'].filter(Boolean),
      tags: [...new Set([...store.mood_tags, store.category, ...zones])].filter((tag): tag is string => Boolean(tag)),
      searchTerms: [...store.purpose_tags, ...store.exhibition_zones.map(zone => zone.type ?? '')],
      imageUrl: store.photo_paths[0] ? mediaUrl(store.photo_paths[0]) : undefined,
      collaborationId: collaborations.get(store.id)?.id,
      collaborationStatus: collaborations.get(store.id)?.status,
    };
  }).sort((a, b) => b.score - a.score || a.targetId.localeCompare(b.targetId));
  return all ? ranked : ranked.slice(0, 6);
}

export async function loadMatchRecommendations(role: Role, demo = false, preferenceText = '', signal?: AbortSignal) {
  if (demo) return demoRecommendations(role);
  return role === 'store' ? storeRecommendations(preferenceText, false, signal) : creatorRecommendations(preferenceText, false, signal);
}

export async function loadDiscoveryCandidates(role: Role, demo: boolean | undefined, signal: AbortSignal) {
  if (demo) return demoRecommendations(role);
  return role === 'store' ? storeRecommendations('', true, signal) : creatorRecommendations('', true, signal);
}

export async function loadCreatorDirectory(signal?: AbortSignal): Promise<CreatorDirectoryEntry[]> {
  const supabase = getSupabase();
  const rows = await catalogRows<ProjectRow>(() => supabase.from('projects').select(publicProjectFields).in('status', ['recruiting', 'matched']), true, signal);
  const results: CreatorDirectoryEntry[] = [];
  rows.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '') || a.id.localeCompare(b.id));
  for (let start = 0; start < rows.length; start += catalogPageSize) {
    const batch = rows.slice(start, start + catalogPageSize);
    const { names, categories, byProject } = await projectMetadata(batch, signal);
    for (const row of batch) {
      const items = byProject.get(row.id) ?? [];
      const coverPath = row.cover_path || items.find(item => item.image_path)?.image_path;
      results.push({
        id: row.id,
        title: row.title,
        artist: names.get(row.creator_id) ?? '크리에이터',
        region: row.region || '활동 지역 협의',
        tags: [...new Set(categories.get(row.creator_id) ?? [])].filter(Boolean),
        searchTerms: [row.concept, row.purpose, ...items.map(item => item.name)],
        priceRange: priceLabel(items.filter(item => item.sale_mode === 'display_sale' && item.stock > 0)),
        status: row.status === 'matched' ? '협업 진행 중' : '협업 모집 중',
        imageUrl: coverPath ? mediaUrl(coverPath) : undefined,
      });
    }
  }
  return results;
}

async function ensureCuratorThread(role: Role, signal?: AbortSignal) {
  const supabase = getSupabase();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!auth.user) throw new Error('로그인이 필요합니다.');
  const query = supabase.from('curator_threads').upsert(
    { user_id: auth.user.id, role, title: role === 'store' ? 'CURI:T AI 큐레이터' : 'AI 콘셉트 큐레이터' },
    { onConflict: 'user_id,role' },
  ).select('id');
  if (signal) query.abortSignal(signal);
  const result = await query.single<{ id: string }>();
  if (result.error) throw new Error(result.error.message);
  return result.data.id;
}

function mapCuratorMessage(row: Record<string, unknown>): CuratorMessage {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};
  return {
    id: String(row.id),
    sender: row.sender === 'user' ? 'user' : 'assistant',
    content: String(row.content || ''),
    recommendations: Array.isArray(metadata.recommendations) ? metadata.recommendations as MatchRecommendation[] : [],
    actions: Array.isArray(metadata.actions) ? metadata.actions.map(String) : [],
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

function welcome(role: Role) {
  return role === 'store'
    ? { content: '안녕하세요. 공간과 작품의 취향·지역·판매 재고·등록 구역을 비교해 협업 후보를 찾아드릴게요. 예산과 실제 설치 조건은 협업 전에 함께 확인해 주세요.', actions: ['우리 공간에 어울리는 작품을 추천해 주세요', '협업 진행 방법을 알려주세요', 'QR 판매 운영을 알려주세요'] }
    : { content: '안녕하세요. 작품 DNA와 활동 지역, 매장 공간 조건을 비교해 실제 협업 가능한 공간을 찾아드릴게요.', actions: ['내 작품과 어울리는 매장을 추천해 주세요', '협업과 출고 흐름을 알려주세요', '판매와 정산을 알려주세요'] };
}

export async function loadCuratorMessages(role: Role, signal?: AbortSignal): Promise<CuratorMessage[]> {
  const supabase = getSupabase();
  const threadId = await ensureCuratorThread(role, signal);
  const query = supabase.from('curator_messages').select('id, sender, content, metadata, created_at').eq('thread_id', threadId).order('created_at').order('sender', { ascending: false });
  if (signal) query.abortSignal(signal);
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  if (result.data.length) return result.data.map(row => mapCuratorMessage(row as Record<string, unknown>));
  const first = welcome(role);
  const insert = supabase.from('curator_messages').insert({ id: threadId, thread_id: threadId, sender: 'assistant', content: first.content, metadata: { actions: first.actions } }).select('id, sender, content, metadata, created_at');
  if (signal) insert.abortSignal(signal);
  const inserted = await insert.single();
  if (inserted.error) {
    if (inserted.error.code === '23505') {
      const existing = supabase.from('curator_messages').select('id, sender, content, metadata, created_at').eq('thread_id', threadId).eq('id', threadId);
      if (signal) existing.abortSignal(signal);
      const saved = await existing.single();
      if (!saved.error) return [mapCuratorMessage(saved.data)];
    }
    throw new Error(inserted.error.message);
  }
  return [mapCuratorMessage(inserted.data as Record<string, unknown>)];
}

function answerFor(role: Role, prompt: string, recommendations: MatchRecommendation[]) {
  const isRecommendation = /추천|어울|찾|매칭/.test(prompt);
  if (isRecommendation) {
    const best = recommendations[0];
    return {
      content: best
        ? `${role === 'store' ? '공간' : '작품'} 등록 정보를 기준으로 비교했어요. ${best.title}이(가) 조건 일치도 ${best.score}점으로 가장 높습니다. 점수는 추천 순위를 돕는 기준이며, 상품 가격과 실제 배치 조건은 협업 전 확인해 주세요.`
        : '현재 협업 가능한 후보가 없습니다. 프로젝트 공개 상태, 작품 재고 또는 매장 등록 완료 여부를 먼저 확인해 주세요.',
      actions: role === 'store' ? ['다른 작품도 비교해 주세요', '협업 진행 방법을 알려주세요'] : ['다른 매장도 비교해 주세요', '협업과 출고 흐름을 알려주세요'],
    };
  }
  if (/출고|협업|진행|제안/.test(prompt)) return {
    content: role === 'creator'
      ? '매장이 제안하면 작품·수량·기간·배분 조건을 확인합니다. 크리에이터 승인 후 매장이 최종 확정하면 전시 준비 상태가 되고, 이후 출고·QR 발급·전시를 진행합니다.'
      : '추천 후보에서 협업을 제안하면 크리에이터가 조건을 승인하거나 조정을 요청합니다. 크리에이터 승인 뒤 매장이 최종 확정해야 QR 발급과 전시 운영 단계로 넘어갑니다.',
    actions: role === 'creator' ? ['내 작품과 어울리는 매장을 추천해 주세요'] : ['우리 공간에 어울리는 작품을 추천해 주세요'],
  };
  if (/정산|판매|QR|수령|결제/.test(prompt)) return {
    content: '결제 승인된 협업 주문은 재고와 정산 원장에 반영됩니다. 기본 배분은 크리에이터 80%, 매장 10%, 플랫폼 10%이며, 승인된 협업 조건을 주문 시점에 고정합니다. 계좌이체 안내 상품은 별도로 입금을 확인해야 합니다.',
    actions: ['추천 후보 보기'],
  };
  return {
    content: '저장한 작품 DNA와 공간 취향, 선호 업종, 협업 목적, 지역, 판매 재고와 등록 구역으로 조건 일치도를 계산합니다. 취향을 수정하거나 원하는 조건을 말하면 새 추천에 반영해요. 설치 가능 여부와 비용은 양측 확인이 필요합니다.',
    actions: role === 'store' ? ['우리 공간에 어울리는 작품을 추천해 주세요'] : ['내 작품과 어울리는 매장을 추천해 주세요'],
  };
}

export type CuratorSendRequest = { userMessageId: string; assistantMessageId: string };

export function createCuratorSendRequest(): CuratorSendRequest {
  return { userMessageId: randomUUID(), assistantMessageId: randomUUID() };
}

export async function sendCuratorMessage(role: Role, content: string, request = createCuratorSendRequest(), signal?: AbortSignal) {
  const text = content.trim();
  if (!text) throw new Error('메시지를 입력해 주세요.');
  if (text.length > 4000) throw new Error('메시지는 4,000자까지 입력해 주세요.');
  const supabase = getSupabase();
  const threadId = await ensureCuratorThread(role, signal);
  const fields = 'id, sender, content, metadata, created_at';
  const savedExchange = async () => {
    const query = supabase.from('curator_messages').select(fields).eq('thread_id', threadId).in('id', [request.userMessageId, request.assistantMessageId]);
    if (signal) query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data?.length) return null;
    const user = data.find(row => row.id === request.userMessageId && row.sender === 'user' && row.content === text);
    const assistant = data.find(row => row.id === request.assistantMessageId && row.sender === 'assistant');
    if (!user || !assistant) throw new Error('대화 저장 상태를 확인하지 못했어요. 대화를 다시 불러와 주세요.');
    return [mapCuratorMessage(user), mapCuratorMessage(assistant)];
  };
  const existing = await savedExchange();
  if (existing) return existing;
  const recommendationRequested = /추천|어울|찾|매칭|후보/.test(text);
  const recommendations = recommendationRequested ? await loadMatchRecommendations(role, false, text, signal) : [];
  const answer = answerFor(role, text, recommendations);
  // One insert keeps the question and its answer atomic. Stable IDs also let a
  // retry recover a committed exchange whose original response was lost.
  const insert = supabase.from('curator_messages').insert([
    { id: request.userMessageId, thread_id: threadId, sender: 'user', content: text, metadata: {} },
    { id: request.assistantMessageId, thread_id: threadId, sender: 'assistant', content: answer.content, metadata: { recommendations: recommendations.slice(0, 3), actions: answer.actions } },
  ]).select(fields);
  if (signal) insert.abortSignal(signal);
  const inserted = await insert;
  if (inserted.error) {
    if (inserted.error.code === '23505') {
      const saved = await savedExchange();
      if (saved) return saved;
    }
    throw new Error(inserted.error.message);
  }
  return [request.userMessageId, request.assistantMessageId].map(id => {
    const row = inserted.data.find(value => value.id === id);
    if (!row) throw new Error('대화 저장 결과를 확인하지 못했어요. 다시 시도해 주세요.');
    return mapCuratorMessage(row);
  });
}

export async function createCollaborationProposal(recommendation: MatchRecommendation, message: string, period?: { startsOn: string; endsOn: string }) {
  if (recommendation.collaborationId) return recommendation.collaborationId;
  const result = await getSupabase().rpc('create_curit_proposal', {
    p_target_id: recommendation.targetId,
    p_target_kind: recommendation.targetType,
    p_message: message.trim(),
    ...(period ? { p_starts_on: period.startsOn, p_ends_on: period.endsOn } : {}),
  });
  if (result.error) throw new Error(result.error.message);
  const collaborationId = String((result.data as { id?: string } | null)?.id || '');
  if (collaborationId) await dispatchCollaborationPush(collaborationId).catch(() => undefined);
  return collaborationId;
}

export async function loadCollaborations(role: Role, id?: string, signal?: AbortSignal): Promise<CollaborationSummary[]> {
  const supabase = getSupabase();
  const query = supabase.from('collaborations').select('id, project_id, store_id, creator_id, status, starts_on, ends_on, creator_share_percent, store_share_percent, platform_share_percent, terms, updated_at').order('updated_at', { ascending: false });
  if (id) query.eq('id', id);
  if (signal) query.abortSignal(signal);
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  const rows = result.data ?? [];
  if (!rows.length) return [];
  const relatedQueries = [
    supabase.from('projects').select('id, title').in('id', [...new Set(rows.map(row => String(row.project_id)))]),
    supabase.from('store_profiles').select('id, name').in('id', [...new Set(rows.map(row => String(row.store_id)))]),
    supabase.from('profiles').select('id, display_name').in('id', [...new Set(rows.map(row => String(row.creator_id)))]),
  ] as const;
  if (signal) for (const related of relatedQueries) related.abortSignal(signal);
  const [projectsResult, storesResult, creatorsResult] = await Promise.all(relatedQueries);
  if (projectsResult.error || storesResult.error || creatorsResult.error) throw new Error(projectsResult.error?.message ?? storesResult.error?.message ?? creatorsResult.error?.message ?? '협업 정보를 불러오지 못했습니다.');
  const projectNames = new Map((projectsResult.data ?? []).map(row => [String(row.id), String(row.title)]));
  const storeNames = new Map((storesResult.data ?? []).map(row => [String(row.id), String(row.name)]));
  const creatorNames = new Map((creatorsResult.data ?? []).map(row => [String(row.id), String(row.display_name)]));
  return rows.map(row => {
    const projectId = String(row.project_id);
    const storeId = String(row.store_id);
    const creatorId = String(row.creator_id);
    const storeName = storeNames.get(storeId) ?? '매장';
    const creatorName = creatorNames.get(creatorId) ?? '크리에이터';
    return {
      id: String(row.id), projectId, storeId, creatorId,
      projectTitle: projectNames.get(projectId) ?? '전시 프로젝트', storeName, creatorName,
      counterpartName: role === 'creator' ? storeName : creatorName,
      status: row.status as CollaborationStatus,
      startsOn: row.starts_on ? String(row.starts_on) : null,
      endsOn: row.ends_on ? String(row.ends_on) : null,
      creatorShare: Number(row.creator_share_percent), storeShare: Number(row.store_share_percent), platformShare: Number(row.platform_share_percent),
      terms: row.terms && typeof row.terms === 'object' ? row.terms as Record<string, unknown> : {},
      updatedAt: String(row.updated_at),
    };
  });
}

export async function transitionCollaboration(collaborationId: string, action: 'accept' | 'confirm' | 'counter' | 'cancel' | 'complete', message = '') {
  const result = await getSupabase().rpc('transition_curit_collaboration', { p_collaboration_id: collaborationId, p_action: action, p_message: message.trim() });
  if (result.error) throw new Error(result.error.message);
  void dispatchCollaborationPush(collaborationId).catch(() => undefined);
  return result.data.status as CollaborationStatus;
}

export async function loadCollaborationItems(collaboration: Pick<CollaborationSummary, 'id' | 'projectId'>): Promise<CollaborationItem[]> {
  const supabase = getSupabase();
  const [itemsResult, selectedResult] = await Promise.all([
    supabase.from('project_items').select('id, name, image_path, price, stock').eq('project_id', collaboration.projectId).order('created_at'),
    supabase.from('collaboration_items').select('project_item_id, quantity, creator_confirmed').eq('collaboration_id', collaboration.id),
  ]);
  if (itemsResult.error || selectedResult.error) throw new Error(itemsResult.error?.message || selectedResult.error?.message || '협업 상품을 불러오지 못했습니다.');
  const selected = new Map((selectedResult.data || []).map(row => [String(row.project_item_id), row]));
  return (itemsResult.data || []).filter(row => Number(row.stock) > 0 || selected.has(String(row.id))).map(row => ({
    projectItemId: String(row.id),
    name: String(row.name),
    imageUrl: row.image_path ? mediaUrl(String(row.image_path)) : '',
    price: Number(row.price),
    stock: Number(row.stock),
    quantity: Number(selected.get(String(row.id))?.quantity || 1),
    selected: selected.has(String(row.id)),
    creatorConfirmed: selected.get(String(row.id))?.creator_confirmed === true,
  }));
}

export async function saveCollaborationTerms(collaborationId: string, terms: Record<string, unknown>, items: CollaborationItem[], notify = false) {
  const result = await getSupabase().rpc('save_curit_collaboration_terms', {
    p_collaboration_id: collaborationId,
    p_terms: terms,
    p_items: items.map(item => ({ projectItemId: item.projectItemId, quantity: item.quantity, selected: item.selected, creatorConfirmed: item.creatorConfirmed })),
  });
  if (result.error) throw new Error(result.error.message);
  if (notify) void dispatchCollaborationPush(collaborationId).catch(() => undefined);
  return {
    startsOn: result.data.starts_on as string | null,
    endsOn: result.data.ends_on as string | null,
    terms: result.data.terms as Record<string, unknown>,
  };
}

export async function loadCollaborationMessages(collaborationId: string): Promise<CollaborationMessage[]> {
  const result = await getSupabase().from('collaboration_messages').select('id, collaboration_id, sender_id, content, created_at').eq('collaboration_id', collaborationId).order('created_at');
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []).map(row => ({ id: String(row.id), collaborationId: String(row.collaboration_id), senderId: String(row.sender_id), content: String(row.content), createdAt: String(row.created_at) }));
}

export async function sendCollaborationMessage(collaborationId: string, content: string) {
  const text = content.trim();
  if (!text) return;
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('로그인이 필요합니다.');
  const result = await supabase.from('collaboration_messages').insert({ collaboration_id: collaborationId, sender_id: auth.user.id, content: text });
  if (result.error) throw new Error(result.error.message);
}
