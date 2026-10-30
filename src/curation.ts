import { mediaUrl } from './platform';
import { getSupabase } from './supabase';
import type {
  CollaborationMessage,
  CollaborationStatus,
  CollaborationSummary,
  CuratorMessage,
  MatchRecommendation,
  Role,
} from './types';

type ProjectRow = {
  id: string;
  creator_id: string;
  title: string;
  story: string;
  concept: string;
  region: string;
  purpose: string;
  status: string;
};

type ProjectItemRow = {
  project_id: string;
  name: string;
  price: number;
  stock: number;
  image_path: string | null;
  material: string;
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

type CreatorProfileRow = {
  user_id: string;
  introduction: string;
  categories: string[];
  regions: string[];
};

const STOP_WORDS = new Set(['그리고', '또는', '위한', '있는', '없는', '합니다', '해요', '공간', '작품', '전시', '판매']);

function terms(value: string | string[]) {
  const text = Array.isArray(value) ? value.join(' ') : value;
  return [...new Set(text
    .toLocaleLowerCase('ko-KR')
    .replace(/[^0-9a-z가-힣]+/g, ' ')
    .split(/\s+/)
    .map(item => item.trim())
    .filter(item => item.length > 1 && !STOP_WORDS.has(item)))];
}

function overlap(left: string[], right: string[]) {
  const matched = left.filter(item => right.some(candidate => candidate.includes(item) || item.includes(candidate)));
  return [...new Set(matched)];
}

function clampScore(value: number) {
  return Math.max(55, Math.min(97, Math.round(value)));
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
    { targetId: '20000000-0000-4000-8000-000000000001', targetType: 'project', title: '흙의 기억', subtitle: '김서연 · 서울·제주', description: '우드톤 공간과 잘 어울리는 따뜻한 세라믹 생활 공예', score: 94, reasons: ['매장 우드톤과 작품의 자연 소재가 일치해요', '2만~5만원대 방문객 구매 범위에 들어와요', '선반 전시가 가능한 소형 굿즈예요'], tags: ['우드톤', '세라믹', 'QR 판매'], priceRange: '28,000~150,000원' },
    { targetId: 'demo-project-green', targetType: 'project', title: '고요한 초록', subtitle: '박수아 · 서울·인천', description: '식물과 린넨을 활용한 편안한 패브릭 컬렉션', score: 87, reasons: ['따뜻한 매장 분위기와 색감이 가까워요', '카운터 선반에 셀프 설치할 수 있어요'], tags: ['식물', '패브릭', '포근함'], priceRange: '18,000~45,000원' },
  ] : [
    { targetId: '10000000-0000-4000-8000-000000000001', targetType: 'store', title: '아늑한 서울', subtitle: '카페 · 서울 성동구 성수동', description: '우드톤 공간에서 독립 창작자의 작품을 소개하는 30석 카페', score: 94, reasons: ['도예 작품과 우드톤 선반의 소재가 잘 맞아요', '예술·공예에 관심 있는 방문객이 많아요', 'QR 판매 목적과 전시 조건이 일치해요'], tags: ['우드톤', '미니멀', '카운터 선반'] },
    { targetId: 'demo-store-book', targetType: 'store', title: '성수 독립서점', subtitle: '서점 · 서울 성동구', description: '조용한 관람과 벽면 전시가 가능한 독립서점', score: 86, reasons: ['작품을 천천히 보는 방문 환경이에요', '서울 활동 지역과 일치해요'], tags: ['조용함', '전시벽', '독립서점'] },
  ];
}

async function storeRecommendations(): Promise<MatchRecommendation[]> {
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('로그인이 필요합니다.');
  const storeResult = await supabase.from('store_profiles').select('*').eq('owner_id', auth.user.id).single<StoreRow>();
  if (storeResult.error) throw new Error(storeResult.error.message);
  const projectsResult = await supabase.from('projects').select('id, creator_id, title, story, concept, region, purpose, status').neq('status', 'archived');
  if (projectsResult.error) throw new Error(projectsResult.error.message);
  const projects = (projectsResult.data ?? []) as ProjectRow[];
  if (!projects.length) return [];
  const creatorIds = [...new Set(projects.map(project => project.creator_id))];
  const projectIds = projects.map(project => project.id);
  const [profilesResult, creatorsResult, itemsResult] = await Promise.all([
    supabase.from('profiles').select('id, display_name').in('id', creatorIds),
    supabase.from('creator_profiles').select('user_id, introduction, categories, regions').in('user_id', creatorIds),
    supabase.from('project_items').select('project_id, name, price, stock, image_path, material').in('project_id', projectIds),
  ]);
  if (profilesResult.error || creatorsResult.error || itemsResult.error) throw new Error(profilesResult.error?.message ?? creatorsResult.error?.message ?? itemsResult.error?.message ?? '추천 데이터를 불러오지 못했습니다.');
  const names = new Map((profilesResult.data ?? []).map(row => [String(row.id), String(row.display_name)]));
  const creators = new Map(((creatorsResult.data ?? []) as CreatorProfileRow[]).map(row => [row.user_id, row]));
  const items = (itemsResult.data ?? []) as ProjectItemRow[];
  const store = storeResult.data;
  const storeTerms = terms([store.category, store.introduction, store.target_audience, ...store.mood_tags, ...store.purpose_tags]);

  return projects.map(project => {
    const creator = creators.get(project.creator_id);
    const projectItems = items.filter(item => item.project_id === project.id && item.stock > 0);
    const projectTerms = terms([project.title, project.story, project.concept, project.purpose, project.region, ...(creator?.categories ?? []), ...projectItems.flatMap(item => [item.name, item.material])]);
    const matched = overlap(storeTerms, projectTerms);
    const minPrice = projectItems.length ? Math.min(...projectItems.map(item => item.price)) : 0;
    const budgetFit = store.monthly_budget_max === null || minPrice === 0 || minPrice <= store.monthly_budget_max;
    const regionFit = /서울|경기|인천/.test(project.region) === /서울|경기|인천/.test(store.address);
    const installFit = store.exhibition_zones.length > 0 && projectItems.length > 0;
    const score = clampScore(61 + Math.min(21, matched.length * 5) + (budgetFit ? 8 : -10) + (regionFit ? 5 : 0) + (installFit ? 4 : 0));
    const reasons = [
      matched.length ? `${matched.slice(0, 3).join('·')} 취향이 매장 DNA와 겹쳐요` : '등록한 공간 목적과 작품 전시 방식이 맞아요',
      budgetFit ? `최저 상품가가 매장 예산 범위에 들어와요` : '현재 예산보다 높은 상품이 있어 수량 조정이 필요해요',
      installFit ? `${store.exhibition_zones.length}개 전시 구역에 배치 가능한 재고가 있어요` : '설치 구역과 재고를 협의해야 해요',
      regionFit ? '활동 지역과 매장 지역이 가까워요' : '',
    ].filter(Boolean).slice(0, 3);
    return {
      targetId: project.id,
      targetType: 'project' as const,
      title: project.title,
      subtitle: `${names.get(project.creator_id) ?? '크리에이터'} · ${project.region || '지역 협의'}`,
      description: project.concept || project.story || '작품과 굿즈 전시 협업을 제안할 수 있어요.',
      score,
      reasons,
      tags: [...new Set([...(creator?.categories ?? []), ...matched])].slice(0, 4),
      imageUrl: projectItems[0]?.image_path ? mediaUrl(projectItems[0].image_path) : undefined,
      priceRange: priceLabel(projectItems),
    };
  }).sort((a, b) => b.score - a.score).slice(0, 6);
}

async function creatorRecommendations(): Promise<MatchRecommendation[]> {
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('로그인이 필요합니다.');
  const [creatorResult, projectResult, storesResult, itemsResult] = await Promise.all([
    supabase.from('creator_profiles').select('user_id, introduction, categories, regions').eq('user_id', auth.user.id).maybeSingle<CreatorProfileRow>(),
    supabase.from('projects').select('id, creator_id, title, story, concept, region, purpose, status').eq('creator_id', auth.user.id).neq('status', 'archived').order('updated_at', { ascending: false }).limit(1).maybeSingle<ProjectRow>(),
    supabase.from('store_profiles').select('*').eq('onboarding_complete', true),
    supabase.from('project_items').select('project_id, name, price, stock, image_path, material'),
  ]);
  if (creatorResult.error || projectResult.error || storesResult.error || itemsResult.error) throw new Error(creatorResult.error?.message ?? projectResult.error?.message ?? storesResult.error?.message ?? itemsResult.error?.message ?? '추천 데이터를 불러오지 못했습니다.');
  const creator = creatorResult.data;
  const project = projectResult.data;
  const ownItems = ((itemsResult.data ?? []) as ProjectItemRow[]).filter(item => !project || item.project_id === project.id);
  const creatorTerms = terms([creator?.introduction ?? '', ...(creator?.categories ?? []), ...(creator?.regions ?? []), project?.story ?? '', project?.concept ?? '', ...ownItems.flatMap(item => [item.name, item.material])]);
  const stores = (storesResult.data ?? []) as StoreRow[];
  return stores.map(store => {
    const storeTerms = terms([store.category, store.address, store.introduction, store.target_audience, ...store.mood_tags, ...store.purpose_tags]);
    const matched = overlap(creatorTerms, storeTerms);
    const regionFit = (creator?.regions ?? []).some(region => store.address.includes(region) || region.includes(store.address.split(' ')[0] ?? ''));
    const maxPrice = ownItems.length ? Math.max(...ownItems.map(item => item.price)) : 0;
    const budgetFit = store.monthly_budget_max === null || maxPrice === 0 || maxPrice <= store.monthly_budget_max;
    const score = clampScore(60 + Math.min(23, matched.length * 5) + (regionFit ? 7 : 0) + (budgetFit ? 5 : -8) + (store.exhibition_zones.length ? 4 : 0));
    const zones = store.exhibition_zones.map(zone => zone.label || zone.type).filter(Boolean);
    return {
      targetId: store.id,
      targetType: 'store' as const,
      title: store.name,
      subtitle: `${store.category || '오프라인 매장'} · ${store.address || '위치 협의'}`,
      description: store.introduction || `${store.target_audience} 고객이 방문하는 공간입니다.`,
      score,
      reasons: [
        matched.length ? `${matched.slice(0, 3).join('·')} 조건이 작품 DNA와 맞아요` : '작품 전시 목적과 매장의 운영 목적이 맞아요',
        zones.length ? `${zones.slice(0, 2).join('·')} 구역에 배치할 수 있어요` : '구체적인 배치 구역은 협의가 필요해요',
        regionFit ? '선호 활동 지역과 일치해요' : budgetFit ? '작품 가격이 매장 예산 범위에 들어와요' : '예산에 맞춘 상품 구성이 필요해요',
      ],
      tags: [...new Set([...store.mood_tags, store.category, ...zones])].filter((tag): tag is string => Boolean(tag)).slice(0, 4),
      imageUrl: store.photo_paths[0] ? mediaUrl(store.photo_paths[0]) : undefined,
    };
  }).sort((a, b) => b.score - a.score).slice(0, 6);
}

export async function loadMatchRecommendations(role: Role, demo = false) {
  if (demo) return demoRecommendations(role);
  return role === 'store' ? storeRecommendations() : creatorRecommendations();
}

async function ensureCuratorThread(role: Role) {
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('로그인이 필요합니다.');
  const result = await supabase.from('curator_threads').upsert(
    { user_id: auth.user.id, role, title: role === 'store' ? 'CURI:T AI 큐레이터' : 'AI 콘셉트 큐레이터' },
    { onConflict: 'user_id,role' },
  ).select('id').single<{ id: string }>();
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
    ? { content: '안녕하세요. 등록한 공간 DNA와 예산, 설치 구역, 작품 재고를 함께 확인해 맞는 전시 협업을 찾아드릴게요.', actions: ['우리 공간에 어울리는 작품을 추천해 주세요', '협업 진행 방법을 알려주세요', 'QR 판매 운영을 알려주세요'] }
    : { content: '안녕하세요. 작품 DNA와 활동 지역, 매장 공간 조건을 비교해 실제 협업 가능한 공간을 찾아드릴게요.', actions: ['내 작품과 어울리는 매장을 추천해 주세요', '협업과 출고 흐름을 알려주세요', '판매와 정산을 알려주세요'] };
}

export async function loadCuratorMessages(role: Role): Promise<CuratorMessage[]> {
  const supabase = getSupabase();
  const threadId = await ensureCuratorThread(role);
  const result = await supabase.from('curator_messages').select('id, sender, content, metadata, created_at').eq('thread_id', threadId).order('created_at');
  if (result.error) throw new Error(result.error.message);
  if (result.data.length) return result.data.map(row => mapCuratorMessage(row as Record<string, unknown>));
  const first = welcome(role);
  const inserted = await supabase.from('curator_messages').insert({ thread_id: threadId, sender: 'assistant', content: first.content, metadata: { actions: first.actions } }).select('id, sender, content, metadata, created_at').single();
  if (inserted.error) throw new Error(inserted.error.message);
  return [mapCuratorMessage(inserted.data as Record<string, unknown>)];
}

function answerFor(role: Role, prompt: string, recommendations: MatchRecommendation[]) {
  const isRecommendation = /추천|어울|찾|매칭/.test(prompt);
  if (isRecommendation) {
    const best = recommendations[0];
    return {
      content: best
        ? `${role === 'store' ? '공간' : '작품'} 조건과 실제 등록 데이터를 비교했어요. ${best.title}의 적합도가 ${best.score}%로 가장 높습니다. 점수만 보지 말고 아래 추천 이유와 조건을 확인한 뒤 협업을 제안해 주세요.`
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
    content: '방문객이 상품별 QR에서 결제하면 재고가 차감되고 정산 원장이 생성됩니다. 현재 기준은 크리에이터 80%, 매장 10%, 플랫폼 10%이며, 실제 승인된 협업 조건을 주문 시점에 고정해 계산합니다.',
    actions: ['추천 후보 보기'],
  };
  return {
    content: '추천은 분위기만으로 정하지 않습니다. 공간·작품 태그, 지역, 예산, 설치 구역, 판매 가능한 재고를 먼저 확인하고, 선택·거절·협업 결과를 다음 추천에 반영합니다. 어떤 후보를 찾고 있는지 더 구체적으로 알려주세요.',
    actions: role === 'store' ? ['우리 공간에 어울리는 작품을 추천해 주세요'] : ['내 작품과 어울리는 매장을 추천해 주세요'],
  };
}

export async function sendCuratorMessage(role: Role, content: string) {
  const text = content.trim();
  if (!text) throw new Error('메시지를 입력해 주세요.');
  const supabase = getSupabase();
  const threadId = await ensureCuratorThread(role);
  const userInsert = await supabase.from('curator_messages').insert({ thread_id: threadId, sender: 'user', content: text }).select('id, sender, content, metadata, created_at').single();
  if (userInsert.error) throw new Error(userInsert.error.message);
  const recommendationRequested = /추천|어울|찾|매칭|후보/.test(text);
  const recommendations = recommendationRequested ? await loadMatchRecommendations(role) : [];
  const answer = answerFor(role, text, recommendations);
  const assistantInsert = await supabase.from('curator_messages').insert({
    thread_id: threadId,
    sender: 'assistant',
    content: answer.content,
    metadata: { recommendations: recommendations.slice(0, 3), actions: answer.actions },
  }).select('id, sender, content, metadata, created_at').single();
  if (assistantInsert.error) throw new Error(assistantInsert.error.message);
  return [mapCuratorMessage(userInsert.data as Record<string, unknown>), mapCuratorMessage(assistantInsert.data as Record<string, unknown>)];
}

export async function createCollaborationProposal(recommendation: MatchRecommendation, message: string) {
  const result = await getSupabase().rpc('create_curit_proposal', {
    p_target_id: recommendation.targetId,
    p_target_kind: recommendation.targetType,
    p_message: message.trim(),
  });
  if (result.error) throw new Error(result.error.message);
  return String((result.data as { id?: string } | null)?.id || '');
}

export async function loadCollaborations(role: Role): Promise<CollaborationSummary[]> {
  const supabase = getSupabase();
  const result = await supabase.from('collaborations').select('id, project_id, store_id, creator_id, status, starts_on, ends_on, creator_share_percent, store_share_percent, platform_share_percent, terms, updated_at').order('updated_at', { ascending: false });
  if (result.error) throw new Error(result.error.message);
  const rows = result.data ?? [];
  if (!rows.length) return [];
  const [projectsResult, storesResult, creatorsResult] = await Promise.all([
    supabase.from('projects').select('id, title').in('id', [...new Set(rows.map(row => String(row.project_id)))]),
    supabase.from('store_profiles').select('id, name').in('id', [...new Set(rows.map(row => String(row.store_id)))]),
    supabase.from('profiles').select('id, display_name').in('id', [...new Set(rows.map(row => String(row.creator_id)))]),
  ]);
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
