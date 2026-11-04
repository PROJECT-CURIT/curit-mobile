import { readImageUpload } from './mediaUpload';
import { getSupabase } from './supabase';
import { mediaUrl, uploadMedia } from './platform';

export type CreatorProfileData = {
  userId: string;
  displayName: string;
  handle: string;
  avatarPath: string;
  avatarUrl: string;
  headline: string;
  introduction: string;
  categories: string[];
  regions: string[];
  portfolioUrl: string;
  snsUrl: string;
  dnaMoods: string[];
  dnaColors: string[];
  preferredSpaces: string[];
  collaborationGoals: string[];
  installConditions: string;
  activityVerified: boolean;
  onboardingStep: number;
  onboardingComplete: boolean;
};

export type VerificationKind = 'creator_activity' | 'store_operation';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type VerificationRequest = {
  id: string;
  kind: VerificationKind;
  status: VerificationStatus;
  evidencePath: string;
  evidenceUrl: string;
  note: string;
  reviewNote: string;
  submittedAt: string;
  reviewedAt: string;
};

async function currentUserId() {
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new Error('로그인이 필요합니다.');
  return data.user.id;
}

export async function loadVerificationRequest(kind: VerificationKind): Promise<VerificationRequest | null> {
  const userId = await currentUserId();
  const supabase = getSupabase();
  const { data, error } = await supabase.from('verification_requests')
    .select('id, kind, status, evidence_path, note, review_note, submitted_at, reviewed_at')
    .eq('user_id', userId)
    .eq('kind', kind)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const signed = await supabase.storage.from('verification-evidence').createSignedUrl(String(data.evidence_path), 60 * 60);
  return {
    id: String(data.id), kind: data.kind as VerificationKind, status: data.status as VerificationStatus,
    evidencePath: String(data.evidence_path), evidenceUrl: signed.data?.signedUrl || '', note: String(data.note || ''),
    reviewNote: String(data.review_note || ''), submittedAt: String(data.submitted_at), reviewedAt: String(data.reviewed_at || ''),
  };
}

export async function submitVerificationRequest(kind: VerificationKind, imageUri: string, note: string) {
  const userId = await currentUserId();
  const supabase = getSupabase();
  const { body, extension, contentType } = await readImageUpload(imageUri);
  const evidencePath = `${userId}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const upload = await supabase.storage.from('verification-evidence').upload(evidencePath, body, { contentType, upsert: false });
  if (upload.error) throw new Error(upload.error.message);
  const submitted = await supabase.rpc('submit_verification_request', { p_kind: kind, p_evidence_path: evidencePath, p_note: note.trim() });
  if (submitted.error) {
    await supabase.storage.from('verification-evidence').remove([evidencePath]);
    throw new Error(submitted.error.message);
  }
  return loadVerificationRequest(kind);
}

export async function creatorOnboardingComplete(userId: string) {
  const { data, error } = await getSupabase().from('creator_profiles').select('onboarding_complete').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.onboarding_complete === true;
}

export async function loadCreatorProfile(userId?: string): Promise<CreatorProfileData> {
  const id = userId || await currentUserId();
  const supabase = getSupabase();
  const [profileResult, detailResult] = await Promise.all([
    supabase.from('profiles').select('id, display_name, handle, avatar_path, activity_verified').eq('id', id).single(),
    supabase.from('creator_profiles').select('headline, introduction, categories, regions, portfolio_url, sns_url, dna_moods, dna_colors, preferred_spaces, collaboration_goals, install_conditions, onboarding_step, onboarding_complete').eq('user_id', id).single(),
  ]);
  if (profileResult.error || detailResult.error) throw new Error(profileResult.error?.message || detailResult.error?.message || '프로필을 불러오지 못했습니다.');
  const profile = profileResult.data;
  const detail = detailResult.data;
  const list = (value: unknown) => Array.isArray(value) ? value.map(String) : [];
  return {
    userId: id,
    displayName: String(profile.display_name || ''), handle: String(profile.handle || ''),
    avatarPath: String(profile.avatar_path || ''), avatarUrl: profile.avatar_path ? mediaUrl(String(profile.avatar_path)) : '',
    headline: String(detail.headline || ''), introduction: String(detail.introduction || ''), categories: list(detail.categories), regions: list(detail.regions),
    portfolioUrl: String(detail.portfolio_url || ''), snsUrl: String(detail.sns_url || ''), dnaMoods: list(detail.dna_moods), dnaColors: list(detail.dna_colors),
    preferredSpaces: list(detail.preferred_spaces), collaborationGoals: list(detail.collaboration_goals), installConditions: String(detail.install_conditions || ''),
    activityVerified: profile.activity_verified === true, onboardingStep: Number(detail.onboarding_step || 1), onboardingComplete: detail.onboarding_complete === true,
  };
}

export async function saveCreatorProfile(value: CreatorProfileData & { avatarUri?: string }, complete = value.onboardingComplete) {
  const supabase = getSupabase();
  const id = await currentUserId();
  let avatarPath = value.avatarPath;
  if (value.avatarUri && !/^(https?:)/.test(value.avatarUri)) avatarPath = await uploadMedia(value.avatarUri, 'profile');
  const [profileResult, detailResult] = await Promise.all([
    supabase.from('profiles').update({ display_name: value.displayName.trim(), handle: value.handle.trim() || null, avatar_path: avatarPath || null }).eq('id', id),
    supabase.from('creator_profiles').update({
      headline: value.headline.trim(), introduction: value.introduction.trim(), categories: value.categories, regions: value.regions,
      portfolio_url: value.portfolioUrl.trim() || null, sns_url: value.snsUrl.trim() || null,
      onboarding_step: complete ? 2 : Math.max(1, value.onboardingStep), onboarding_complete: complete,
    }).eq('user_id', id),
  ]);
  if (profileResult.error || detailResult.error) throw new Error(profileResult.error?.message || detailResult.error?.message || '프로필을 저장하지 못했습니다.');
  return loadCreatorProfile(id);
}

export async function saveCreatorDna(value: Pick<CreatorProfileData, 'dnaMoods' | 'dnaColors' | 'preferredSpaces' | 'collaborationGoals' | 'installConditions'>) {
  const id = await currentUserId();
  const { error } = await getSupabase().from('creator_profiles').update({
    dna_moods: value.dnaMoods, dna_colors: value.dnaColors, preferred_spaces: value.preferredSpaces,
    collaboration_goals: value.collaborationGoals, install_conditions: value.installConditions.trim(), onboarding_step: 2,
  }).eq('user_id', id);
  if (error) throw new Error(error.message);
}

export type SocialPost = {
  id: string;
  creatorId: string;
  creatorName: string;
  handle: string;
  avatarUrl: string;
  content: string;
  imageUrl: string;
  likes: number;
  comments: number;
  liked: boolean;
  followed: boolean;
  own: boolean;
  createdAt: string;
};

export type SocialComment = {
  id: string;
  postId: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  content: string;
  createdAt: string;
};

export async function loadSocialFeed(): Promise<SocialPost[]> {
  const supabase = getSupabase();
  const userId = await currentUserId();
  const postsResult = await supabase.from('creator_posts').select('id, creator_id, content, image_path, created_at').order('created_at', { ascending: false }).limit(50);
  if (postsResult.error) throw new Error(postsResult.error.message);
  const rows = postsResult.data || [];
  if (!rows.length) return [];
  const creatorIds = [...new Set(rows.map(row => String(row.creator_id)))];
  const postIds = rows.map(row => String(row.id));
  const [profilesResult, likesResult, commentsResult, followsResult] = await Promise.all([
    supabase.from('profiles').select('id, display_name, handle, avatar_path').in('id', creatorIds),
    supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
    supabase.from('post_comments').select('post_id').in('post_id', postIds),
    supabase.from('creator_follows').select('creator_id').eq('follower_id', userId).in('creator_id', creatorIds),
  ]);
  const error = profilesResult.error || likesResult.error || commentsResult.error || followsResult.error;
  if (error) throw new Error(error.message);
  const profiles = new Map((profilesResult.data || []).map(row => [String(row.id), row]));
  const followed = new Set((followsResult.data || []).map(row => String(row.creator_id)));
  return rows.map(row => {
    const profile = profiles.get(String(row.creator_id));
    const likes = (likesResult.data || []).filter(value => value.post_id === row.id);
    return {
      id: String(row.id), creatorId: String(row.creator_id), creatorName: String(profile?.display_name || '크리에이터'),
      handle: String(profile?.handle || ''), avatarUrl: profile?.avatar_path ? mediaUrl(String(profile.avatar_path)) : '', content: String(row.content),
      imageUrl: row.image_path ? mediaUrl(String(row.image_path)) : '', likes: likes.length,
      comments: (commentsResult.data || []).filter(value => value.post_id === row.id).length,
      liked: likes.some(value => value.user_id === userId), followed: followed.has(String(row.creator_id)), own: String(row.creator_id) === userId, createdAt: String(row.created_at),
    };
  });
}

export async function createSocialPost(content: string, imageUri = '') {
  const id = await currentUserId();
  const imagePath = imageUri ? await uploadMedia(imageUri, 'post') : null;
  const { error } = await getSupabase().from('creator_posts').insert({ creator_id: id, content: content.trim(), image_path: imagePath });
  if (error) throw new Error(error.message);
}

export async function togglePostLike(postId: string, liked: boolean) {
  const userId = await currentUserId();
  const query = getSupabase().from('post_likes');
  const result = liked ? await query.delete().eq('post_id', postId).eq('user_id', userId) : await query.insert({ post_id: postId, user_id: userId });
  if (result.error) throw new Error(result.error.message);
}

export async function toggleCreatorFollow(creatorId: string, followed: boolean) {
  const followerId = await currentUserId();
  const query = getSupabase().from('creator_follows');
  const result = followed ? await query.delete().eq('creator_id', creatorId).eq('follower_id', followerId) : await query.insert({ creator_id: creatorId, follower_id: followerId });
  if (result.error) throw new Error(result.error.message);
}

export async function addPostComment(postId: string, content: string) {
  const text = content.trim();
  if (!text) throw new Error('댓글 내용을 입력해 주세요.');
  if (text.length > 500) throw new Error('댓글은 500자 이내로 작성해 주세요.');
  const userId = await currentUserId();
  const { error } = await getSupabase().from('post_comments').insert({ post_id: postId, user_id: userId, content: text });
  if (error) throw new Error(error.message);
}

export async function loadPostComments(postId: string): Promise<SocialComment[]> {
  const supabase = getSupabase();
  const result = await supabase
    .from('post_comments')
    .select('id, post_id, user_id, content, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (result.error) throw new Error(result.error.message);
  const rows = result.data || [];
  if (!rows.length) return [];
  const userIds = [...new Set(rows.map(row => String(row.user_id)))];
  const profilesResult = await supabase
    .from('profiles')
    .select('id, display_name, avatar_path')
    .in('id', userIds);
  if (profilesResult.error) throw new Error(profilesResult.error.message);
  const profiles = new Map((profilesResult.data || []).map(row => [String(row.id), row]));
  return rows.map(row => {
    const userId = String(row.user_id);
    const profile = profiles.get(userId);
    return {
      id: String(row.id),
      postId: String(row.post_id),
      userId,
      displayName: String(profile?.display_name || 'CURI:T 이용자'),
      avatarUrl: profile?.avatar_path ? mediaUrl(String(profile.avatar_path)) : '',
      content: String(row.content || ''),
      createdAt: String(row.created_at),
    };
  });
}

export type AppNotification = { id: string; title: string; body: string; kind: string; entityId: string; orderId?: string; read: boolean; createdAt: string };

export async function loadNotifications(): Promise<AppNotification[]> {
  const { data, error } = await getSupabase().from('notifications').select('id, title, body, kind, entity_id, dedupe_key, read_at, created_at').order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data || []).map(row => ({ id: String(row.id), title: String(row.title), body: String(row.body || ''), kind: String(row.kind), entityId: String(row.entity_id || ''), orderId: row.kind === 'order' && typeof row.dedupe_key === 'string' ? row.dedupe_key.match(/^order-paid:(QR-[0-9a-f-]{36})$/i)?.[1] : undefined, read: Boolean(row.read_at), createdAt: String(row.created_at) }));
}

export async function markNotificationRead(id: string) {
  const { error } = await getSupabase().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function requestPasswordReset(email: string) {
  const { authRedirectUrl } = await import('./authRedirect');
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl('recovery') });
  if (error) throw new Error(error.message);
}
