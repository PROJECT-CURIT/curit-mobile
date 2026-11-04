import { readImageUpload } from './mediaUpload';
import type { QrProduct, Role, Session } from './types';
import { getSupabase } from './supabase';
import type { ProjectProduct } from './detailScreens';
import { buildCommerceApiUrl } from './config';
import { authRedirectUrl } from './authRedirect';

type ProfileRow = { id: string; role: Role; display_name: string };

export type StoreOnboarding = {
  name: string;
  category: string;
  address: string;
  introduction: string;
  targetAudience: string;
  moodTags: string[];
  purposeTags: string[];
  monthlyBudgetMin: number | null;
  monthlyBudgetMax: number | null;
  photoPaths: string[];
  exhibitionZones: { type: string; widthCm: number | null; heightCm: number | null }[];
  step: number;
  complete: boolean;
};

function message(error: unknown) {
  return error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
}

async function profileFor(userId: string): Promise<ProfileRow> {
  const supabase = getSupabase();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, display_name')
      .eq('id', userId)
      .maybeSingle<ProfileRow>();
    if (data) return data;
    if (error) throw new Error(error.message);
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw new Error('프로필 생성이 지연되고 있습니다. 잠시 후 다시 로그인해 주세요.');
}

async function accountDisplayName(profile: ProfileRow) {
  if (profile.role !== 'store') return profile.display_name;
  const { data } = await getSupabase()
    .from('store_profiles')
    .select('name')
    .eq('owner_id', profile.id)
    .maybeSingle<{ name: string }>();
  return data?.name || profile.display_name;
}

export async function currentSession(): Promise<Session | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const user = data.session?.user;
  if (!user?.email) return null;
  const profile = await profileFor(user.id);
  return { userId: user.id, email: user.email, role: profile.role, displayName: await accountDisplayName(profile) };
}

export async function signIn(email: string, password: string): Promise<Session> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user?.email) throw new Error(error?.message ?? '로그인하지 못했습니다.');
  const profile = await profileFor(data.user.id);
  return { userId: data.user.id, email: data.user.email, role: profile.role, displayName: await accountDisplayName(profile) };
}

export async function signUp(email: string, password: string, displayName: string, role: Role) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: authRedirectUrl('signup'),
      data: { role, display_name: displayName.trim() },
    },
  });
  if (error) throw new Error(error.message);
  if (!data.session || !data.user?.email) {
    return { session: null, confirmationRequired: true as const };
  }
  const profile = await profileFor(data.user.id);
  return {
    session: { userId: data.user.id, email: data.user.email, role: profile.role, displayName: profile.display_name } satisfies Session,
    confirmationRequired: false as const,
  };
}

export async function resendSignupConfirmation(email: string) {
  const { error } = await getSupabase().auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: authRedirectUrl('signup') },
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw new Error(error.message);
}

export async function uploadMedia(uri: string, folder: 'store' | 'project' | 'profile' | 'post') {
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error('로그인이 필요합니다.');
  const { body, extension, contentType } = await readImageUpload(uri);
  const path = `${user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const { error } = await supabase.storage.from('curit-media').upload(path, body, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export function mediaUrl(path: string) {
  if (!path || /^(https?:|data:|blob:|file:)/.test(path)) return path;
  return getSupabase().storage.from('curit-media').getPublicUrl(path).data.publicUrl;
}

export async function saveStoreOnboarding(value: StoreOnboarding) {
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('로그인이 필요합니다.');
  const { error } = await supabase.from('store_profiles').upsert(
    {
      owner_id: auth.user.id,
      name: value.name.trim(),
      category: value.category.trim(),
      address: value.address.trim(),
      introduction: value.introduction.trim(),
      target_audience: value.targetAudience.trim(),
      mood_tags: value.moodTags,
      purpose_tags: value.purposeTags,
      monthly_budget_min: value.monthlyBudgetMin,
      monthly_budget_max: value.monthlyBudgetMax,
      photo_paths: value.photoPaths,
      exhibition_zones: value.exhibitionZones,
      onboarding_step: value.step,
      onboarding_complete: value.complete,
    },
    { onConflict: 'owner_id' },
  );
  if (error) throw new Error(error.message);
}

export async function storeOnboardingComplete(userId: string) {
  const { data, error } = await getSupabase()
    .from('store_profiles')
    .select('onboarding_complete')
    .eq('owner_id', userId)
    .maybeSingle<{ onboarding_complete: boolean }>();
  if (error) throw new Error(error.message);
  return data?.onboarding_complete === true;
}

export async function loadStoreOnboarding(userId: string): Promise<StoreOnboarding | null> {
  const { data, error } = await getSupabase()
    .from('store_profiles')
    .select('name, category, address, introduction, target_audience, mood_tags, purpose_tags, monthly_budget_min, monthly_budget_max, photo_paths, exhibition_zones, onboarding_step, onboarding_complete')
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    name: String(data.name || ''),
    category: String(data.category || ''),
    address: String(data.address || ''),
    introduction: String(data.introduction || ''),
    targetAudience: String(data.target_audience || ''),
    moodTags: Array.isArray(data.mood_tags) ? data.mood_tags.map(String) : [],
    purposeTags: Array.isArray(data.purpose_tags) ? data.purpose_tags.map(String) : [],
    monthlyBudgetMin: data.monthly_budget_min === null ? null : Number(data.monthly_budget_min),
    monthlyBudgetMax: data.monthly_budget_max === null ? null : Number(data.monthly_budget_max),
    photoPaths: Array.isArray(data.photo_paths) ? data.photo_paths.map(String) : [],
    exhibitionZones: Array.isArray(data.exhibition_zones)
      ? data.exhibition_zones.map((zone: Record<string, unknown>) => ({
        type: String(zone.type || ''),
        widthCm: zone.widthCm === null || zone.widthCm === undefined ? null : Number(zone.widthCm),
        heightCm: zone.heightCm === null || zone.heightCm === undefined ? null : Number(zone.heightCm),
      }))
      : [],
    step: Math.max(1, Math.min(5, Number(data.onboarding_step) || 1)),
    complete: data.onboarding_complete === true,
  };
}

export async function managementRequest(path: string, init?: RequestInit) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('로그인이 필요합니다.');
  let response: Response;
  try {
    response = await fetch(buildCommerceApiUrl(path), {
      ...init,
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result?.message === 'string' ? result.message : '요청을 처리하지 못했습니다.');
  return result;
}

export async function loadManagedQrProducts(): Promise<QrProduct[]> {
  const result = await managementRequest('/api/management/listings');
  const listings = [
    ...(Array.isArray(result?.listings) ? result.listings : []),
    ...(Array.isArray(result?.candidates) ? result.candidates : []),
  ];
  return listings.map(mapManagedQrProduct);
}

function mapManagedQrProduct(item: Record<string, unknown>): QrProduct {
  return {
    id: String(item.id || ''),
    token: String(item.token || ''),
    productId: String(item.productItemId || ''),
    collaborationId: typeof item.collaborationId === 'string' ? item.collaborationId : undefined,
    name: String(item.name || '등록 상품'),
    price: Number(item.price || 0),
    stock: Number(item.stock || 0),
    viewCount: Number(item.viewCount || 0),
    supplyLimit: typeof item.supplyLimit === 'number' ? item.supplyLimit : undefined,
    description: typeof item.description === 'string' ? item.description : undefined,
    material: typeof item.material === 'string' ? item.material : undefined,
    canStartSale: typeof item.canStartSale === 'boolean' ? item.canStartSale : undefined,
    status: ['ACTIVE', 'PAUSED', 'SOLD_OUT'].includes(String(item.status)) ? item.status as QrProduct['status'] : 'PAUSED',
    pickupMode: String(item.pickupMode || 'immediate'),
    imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
    artistName: typeof item.artistName === 'string' ? item.artistName : undefined,
    qrUrl: typeof item.qrUrl === 'string' ? item.qrUrl : undefined,
    issuable: item.issuable === true,
    source: 'collaboration',
    inventoryTracked: true,
  };
}

export async function issueQrListing(projectItemId: string, collaborationId: string): Promise<QrProduct> {
  const item = await managementRequest('/api/management/listings', {
    method: 'POST',
    body: JSON.stringify({ projectItemId, collaborationId }),
  });
  return mapManagedQrProduct(item as Record<string, unknown>);
}

export async function updateQrListing(id: string, updates: { stock: number; expectedStock: number } | { saleStatus: 'active' | 'preparing' }): Promise<QrProduct> {
  const item = await managementRequest(`/api/management/listings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return mapManagedQrProduct(item as Record<string, unknown>);
}

export type ManagedOrder = {
  id: string;
  listingId: string;
  productName: string;
  imageUrl: string;
  customerName: string;
  customerPhoneLast4: string;
  quantity: number;
  amount: number;
  paymentMethod: string;
  paymentStatus: 'paid' | 'cancelled';
  pickupMode: 'immediate' | 'exhibition';
  pickupDate: string;
  fulfillmentStatus: 'awaiting_pickup' | 'reserved' | 'delivered';
  deliveredAt: string | null;
  createdAt: string;
};

function mapManagedOrder(row: Record<string, unknown>): ManagedOrder {
  return {
    id: String(row.id),
    listingId: String(row.listingId),
    productName: String(row.productName || '등록 상품'),
    imageUrl: String(row.imageUrl || ''),
    customerName: String(row.customerName || ''),
    customerPhoneLast4: String(row.customerPhoneLast4 || ''),
    quantity: Number(row.quantity || 0),
    amount: Number(row.amount || 0),
    paymentMethod: String(row.paymentMethod || ''),
    paymentStatus: row.paymentStatus === 'cancelled' ? 'cancelled' : 'paid',
    pickupMode: row.pickupMode === 'exhibition' ? 'exhibition' : 'immediate',
    pickupDate: String(row.pickupDate || ''),
    fulfillmentStatus: ['reserved', 'delivered'].includes(String(row.fulfillmentStatus)) ? row.fulfillmentStatus as ManagedOrder['fulfillmentStatus'] : 'awaiting_pickup',
    deliveredAt: row.deliveredAt ? String(row.deliveredAt) : null,
    createdAt: String(row.createdAt || ''),
  };
}

export async function loadManagedOrders(): Promise<ManagedOrder[]> {
  const result = await managementRequest('/api/management/orders');
  return (Array.isArray(result?.orders) ? result.orders : []).map(mapManagedOrder);
}

export async function loadManagedOrder(id: string): Promise<ManagedOrder> {
  const result = await managementRequest(`/api/management/orders/${encodeURIComponent(id)}`);
  return mapManagedOrder(result);
}

export async function updateManagedOrder(id: string, fulfillmentStatus: ManagedOrder['fulfillmentStatus']) {
  await managementRequest(`/api/management/orders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ fulfillmentStatus }),
  });
}

export async function cancelManagedOrder(id: string, reason = '매장 운영자 요청') {
  return managementRequest(`/api/management/orders/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function dispatchCollaborationPush(collaborationId: string) {
  await managementRequest(`/api/push/collaborations/${encodeURIComponent(collaborationId)}`, {
    method: 'POST',
  });
}

export async function loadCreatorProject() {
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('로그인이 필요합니다.');
  let { data: project, error } = await supabase
    .from('projects')
    .select('id, title, story, concept, region, purpose, status, cover_path, creator_share_percent')
    .eq('creator_id', auth.user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      title: string | null;
      story: string | null;
      concept: string | null;
      region: string | null;
      purpose: string | null;
      status: string | null;
      cover_path: string | null;
      creator_share_percent: number | null;
    }>();
  if (error) throw new Error(error.message);
  if (!project) {
    const result = await supabase
      .from('projects')
      .insert({ creator_id: auth.user.id, title: '최종 프로젝트', concept: '프로젝트 정보와 상품을 등록해 주세요.', region: '서울', status: 'draft' })
      .select('id, title, story, concept, region, purpose, status, cover_path, creator_share_percent')
      .single();
    if (result.error) throw new Error(result.error.message);
    project = result.data;
  }
  const items = await supabase
    .from('project_items')
    .select('id, name, description, price, stock, image_path, sale_mode, item_type, material, width_mm, height_mm, pickup_mode, care')
    .eq('project_id', project.id)
    .order('created_at');
  if (items.error) throw new Error(items.error.message);
  return {
    projectId: project.id,
    project: {
      id: String(project.id),
      title: String(project.title || ''),
      story: String(project.story || ''),
      concept: String(project.concept || ''),
      region: String(project.region || ''),
      purpose: String(project.purpose || ''),
      status: String(project.status || 'draft') as 'draft' | 'recruiting' | 'matched' | 'archived',
      coverPath: project.cover_path ? String(project.cover_path) : '',
      coverUrl: project.cover_path ? mediaUrl(String(project.cover_path)) : '',
      creatorSharePercent: Number(project.creator_share_percent || 80),
    },
    products: (items.data ?? []).map((item) => ({
      id: String(item.id),
      name: String(item.name),
      price: Number(item.price),
      stock: Number(item.stock),
      image: item.image_path ? mediaUrl(String(item.image_path)) : '',
      imagePath: item.image_path ? String(item.image_path) : undefined,
      mode: item.sale_mode === 'display_only' ? '전시만' as const : '전시·판매' as const,
      type: item.item_type === 'artwork' ? 'artwork' as const : 'goods' as const,
      description: String(item.description || ''),
      material: String(item.material || ''),
      widthMm: item.width_mm === null ? null : Number(item.width_mm),
      heightMm: item.height_mm === null ? null : Number(item.height_mm),
      pickupMode: item.pickup_mode === 'exhibition' ? 'exhibition' as const : 'immediate' as const,
      care: String(item.care || ''),
    })),
  };
}

export async function addProjectProduct(projectId: string, product: Omit<ProjectProduct, 'id'>) {
  const imagePath = product.image && !/^(https?:)/.test(product.image)
    ? await uploadMedia(product.image, 'project')
    : product.imagePath;
  const { error } = await getSupabase().from('project_items').insert({
    project_id: projectId,
    name: product.name,
    item_type: product.type,
    sale_mode: product.mode === '전시만' ? 'display_only' : 'display_sale',
    price: product.price,
    stock: product.stock,
    image_path: imagePath || null,
    description: product.description || '',
    material: product.material || '',
    width_mm: product.widthMm || null,
    height_mm: product.heightMm || null,
    pickup_mode: product.pickupMode || (product.type === 'artwork' ? 'exhibition' : 'immediate'),
    care: product.care || '',
  });
  if (error) throw new Error(error.message);
  return loadCreatorProject();
}

export type CreatorProjectDetails = Awaited<ReturnType<typeof loadCreatorProject>>['project'];

export async function saveCreatorProject(projectId: string, value: Omit<CreatorProjectDetails, 'id' | 'coverUrl'> & { coverUri?: string }) {
  let coverPath = value.coverPath;
  if (value.coverUri && !/^(https?:)/.test(value.coverUri)) coverPath = await uploadMedia(value.coverUri, 'project');
  const { error } = await getSupabase().from('projects').update({
    title: value.title.trim(),
    story: value.story.trim(),
    concept: value.concept.trim(),
    region: value.region.trim(),
    purpose: value.purpose.trim(),
    status: value.status,
    cover_path: coverPath || null,
    creator_share_percent: value.creatorSharePercent,
  }).eq('id', projectId);
  if (error) throw new Error(error.message);
  return loadCreatorProject();
}

export async function updateProjectProduct(productId: string, product: Omit<ProjectProduct, 'id'>) {
  const imagePath = product.image && !/^(https?:)/.test(product.image)
    ? await uploadMedia(product.image, 'project')
    : product.imagePath;
  const { error } = await getSupabase().from('project_items').update({
    name: product.name.trim(), description: product.description || '', item_type: product.type,
    sale_mode: product.mode === '전시만' ? 'display_only' : 'display_sale', price: product.price, stock: product.stock,
    image_path: imagePath || null, material: product.material || '', width_mm: product.widthMm || null,
    height_mm: product.heightMm || null, pickup_mode: product.pickupMode || (product.type === 'artwork' ? 'exhibition' : 'immediate'), care: product.care || '',
  }).eq('id', productId);
  if (error) throw new Error(error.message);
  return loadCreatorProject();
}

export async function deleteProjectProduct(productId: string) {
  const { error } = await getSupabase().from('project_items').delete().eq('id', productId);
  if (error) throw new Error(error.message);
  return loadCreatorProject();
}

export type SettlementEntry = {
  id: string;
  orderId: string;
  collaborationId: string | null;
  grossAmount: number;
  creatorAmount: number;
  storeAmount: number;
  platformAmount: number;
  status: 'scheduled' | 'ready' | 'paid' | 'held' | 'cancelled';
  scheduledFor: string | null;
  createdAt: string;
};

export async function loadSettlements(): Promise<SettlementEntry[]> {
  const { data, error } = await getSupabase()
    .from('settlement_entries')
    .select('id, order_id, collaboration_id, gross_amount, creator_amount, store_amount, platform_amount, status, scheduled_for, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    orderId: String(row.order_id),
    collaborationId: row.collaboration_id ? String(row.collaboration_id) : null,
    grossAmount: Number(row.gross_amount),
    creatorAmount: Number(row.creator_amount),
    storeAmount: Number(row.store_amount),
    platformAmount: Number(row.platform_amount),
    status: row.status as SettlementEntry['status'],
    scheduledFor: row.scheduled_for ? String(row.scheduled_for) : null,
    createdAt: String(row.created_at),
  }));
}

export function friendlyError(error: unknown) {
  const raw = message(error);
  if (/failed to fetch|network request failed|networkerror|fetch failed/i.test(raw)) return '연결이 원활하지 않아요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
  if (/Invalid login credentials/i.test(raw)) return '이메일 또는 비밀번호가 맞지 않습니다.';
  if (/User already registered/i.test(raw)) return '이미 가입된 이메일입니다.';
  if (/Password should be/i.test(raw)) return '비밀번호는 8자 이상으로 입력해 주세요.';
  if (raw === 'INVALID_COLLABORATION_QUANTITY') return '보유 수량 내에서 1개 이상으로 설정해 주세요.';
  if (raw === 'COLLABORATION_QUANTITY_CHANGED') return '제안한 작품이나 수량이 바뀌었어요. 최신 조건을 불러온 뒤 다시 확인해 주세요.';
  if (raw === 'INVALID_EXHIBITION_DATES') return '종료일은 시작일보다 뒤인 실제 날짜로 입력해 주세요.';
  if (raw === 'COLLABORATION_SCHEDULE_CHANGED') return '전시 기간이 바뀌었어요. 최신 조건을 불러온 뒤 다시 확인해 주세요.';
  if (raw === 'COLLABORATION_SCHEDULE_UNCONFIRMED') return '크리에이터가 변경된 전시 기간을 확인하면 전시를 확정할 수 있어요.';
  if (raw === 'COLLABORATION_SCHEDULE_LOCKED') return 'QR이 발급됐거나 전시가 확정되어 기간을 바꿀 수 없어요.';
  if (raw === 'COLLABORATION_SUPPLY_UNCONFIRMED') return '크리에이터가 선택한 작품의 수량을 모두 확인한 뒤 전시를 확정해 주세요.';
  if (raw === 'COLLABORATION_SUPPLY_OUT_OF_STOCK') return '작품 재고가 줄었어요. 최신 조건을 불러온 뒤 전시 수량을 조정해 주세요.';
  if (raw === 'INVALID_COLLABORATION_TRANSITION') return '협업 상태가 바뀌었어요. 최신 조건을 불러와 확인해 주세요.';
  if (raw === 'COLLABORATION_CONFIRM_CREATOR_ONLY') return '작품 수량 확인은 크리에이터만 할 수 있어요.';
  if (raw === 'COLLABORATION_QUANTITY_LOCKED') return 'QR이 발급된 상품의 합의 수량은 변경할 수 없어요.';
  if (raw === 'COLLABORATION_CLOSED') return '종료된 협업의 조건은 변경할 수 없어요.';
  if (raw === 'INVALID_COLLABORATION_ITEM') return '협업에 포함된 작품을 다시 확인해 주세요.';
  return raw;
}
