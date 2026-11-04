import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Keyboard, View } from 'react-native';
import { BottomNav, ScreenFrame } from '../ui';
import { AccountSettingsScreen, AccountSignupScreen, EmailConfirmationScreen, HomeScreen, LoginScreen, ManagementScreen, MyScreen, QrProductsScreen, RoleSelectionScreen, SettlementScreen } from '../screens';
import { ChatHubScreen, CollaborationDetailScreen, CuratorScreen, MatchingDiscoverScreen, RecommendationScreen } from '../curationScreens';
import { loadCollaborations } from '../curation';
import { CreatorProjectEditScreen, CreatorProjectScreen, initialCreatorProducts, StoreSignupScreen, type ProjectProduct } from '../detailScreens';
import { config } from '../config';
import { addProjectProduct, currentSession, deleteProjectProduct, friendlyError, loadCreatorProject, loadStoreOnboarding, resendSignupConfirmation, saveCreatorProject, signIn, signOut, signUp, storeOnboardingComplete, updateProjectProduct, type CreatorProjectDetails, type StoreOnboarding } from '../platform';
import { creatorOnboardingComplete, requestPasswordReset } from '../fullPlatform';
import { CreatorDnaScreen, CreatorProfileScreen, NotificationsScreen, PickupScreen, QrProductEditorScreen, StorePreferencesScreen, StoreProfileScreen, VerificationScreen } from '../fullPrototypeScreens';
import { isSupabaseConfigured } from '../supabase';
import { colors } from '../theme';
import { addPushResponseListener, deactivateNativePush, registerNativePush } from '../pushNotifications';
import type { CollaborationSummary, MatchRecommendation, QrProduct, Role, Session, TabKey } from '../types';
import { demoCollaboration, demoCollaborationList, demoProposalCollaboration, demoStoreOnboarding } from '../demoContent';

type AuthView = 'login' | 'role' | 'account-signup' | 'store-signup' | 'confirmation';

export default function AppIndex() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [signupRole, setSignupRole] = useState<Role>('creator');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [pendingStoreSession, setPendingStoreSession] = useState<Session | null>(null);
  const [pendingStoreOnboarding, setPendingStoreOnboarding] = useState<StoreOnboarding | null>(null);
  const [tab, setTab] = useState<TabKey>('home');
  const [subview, setSubview] = useState<'qr-products' | 'qr-editor' | 'pickup' | 'creator-dna' | 'creator-profile' | 'creator-profile-edit' | 'creator-project' | 'creator-project-edit' | 'store-profile' | 'store-edit' | 'store-preferences' | 'verification' | 'notifications' | 'settlements' | 'account' | 'curator' | 'collaboration' | 'recommendation' | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<MatchRecommendation | null>(null);
  const [selectedCollaboration, setSelectedCollaboration] = useState<CollaborationSummary | null>(null);
  const [demoCollaborations, setDemoCollaborations] = useState<CollaborationSummary[]>([]);
  const [creatorProducts, setCreatorProducts] = useState<ProjectProduct[]>(initialCreatorProducts);
  const [creatorProjectId, setCreatorProjectId] = useState('');
  const [creatorProject, setCreatorProject] = useState<CreatorProjectDetails>({ id: 'demo-project', title: '흙의 기억', story: '흙이 일상에 머무는 순간을 담았습니다.', concept: '따뜻한 생활 도예 컬렉션', region: '서울', purpose: '작품 전시 및 판매', status: 'recruiting', coverPath: '', coverUrl: '', creatorSharePercent: 80 });
  const [selectedQrProduct, setSelectedQrProduct] = useState<QrProduct | null>(null);
  const [storeOnboarding, setStoreOnboarding] = useState<StoreOnboarding | null>(null);
  const [creatorOnboardingFlow, setCreatorOnboardingFlow] = useState(false);
  const [storePreferencesParent, setStorePreferencesParent] = useState<'home' | 'profile'>('profile');

  const hydrateCreator = useCallback(async () => {
    const result = await loadCreatorProject();
    setCreatorProjectId(result.projectId);
    setCreatorProject(result.project);
    setCreatorProducts(result.products);
  }, []);

  const hydrateStore = useCallback(async (userId: string) => setStoreOnboarding(await loadStoreOnboarding(userId)), []);

  const enterSession = useCallback(async (next: Session) => {
    if (next.role === 'creator') {
      await hydrateCreator();
      if (!next.demo && !(await creatorOnboardingComplete(next.userId))) { setCreatorOnboardingFlow(true); setSubview('creator-dna'); }
    } else if (!next.demo) await hydrateStore(next.userId);
    setSession(next); setTab('home'); setAuthView('login');
  }, [hydrateCreator, hydrateStore]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void currentSession()
      .then(async value => {
        if (!value) return;
        if (value.role === 'store' && !(await storeOnboardingComplete(value.userId))) {
          setPendingStoreSession(value);
          setPendingStoreOnboarding(await loadStoreOnboarding(value.userId));
          setAuthView('store-signup');
          return;
        }
        await enterSession(value);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [enterSession]);

  useEffect(() => {
    if (!session || session.demo) return;
    void registerNativePush().catch(() => undefined);
  }, [session]);

  const pushRole = session && !session.demo ? session.role : null;
  useEffect(() => {
    if (!pushRole) return;
    const subscription = addPushResponseListener(data => {
      if (data.kind === 'order' && pushRole === 'store') setSubview('pickup');
      else setSubview('notifications');
    });
    return () => subscription.remove();
  }, [pushRole]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (Keyboard.isVisible()) { Keyboard.dismiss(); return true; }
      if (subview === 'creator-project-edit' || subview === 'store-edit' || (!session && authView === 'store-signup')) return false;
      if (subview) {
        if (subview === 'creator-dna' && creatorOnboardingFlow) setCreatorOnboardingFlow(false);
        const parentSubview = subview === 'creator-profile-edit'
          ? 'creator-profile'
          : subview === 'qr-editor'
              ? 'qr-products'
              : subview === 'store-preferences'
                  ? storePreferencesParent === 'profile' ? 'store-profile' : null
                  : null;
        setSubview(parentSubview);
        return true;
      }
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      if (!session && authView !== 'login') {
        setAuthView(authView === 'account-signup' ? 'role' : 'login');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [authView, creatorOnboardingFlow, session, storePreferencesParent, subview, tab]);

  const login = async (email: string, password: string) => {
    try {
      const next = await signIn(email, password);
      if (next.role === 'store' && !(await storeOnboardingComplete(next.userId))) {
        setPendingStoreSession(next);
        setPendingStoreOnboarding(await loadStoreOnboarding(next.userId));
        setAuthView('store-signup');
        return;
      }
      await enterSession(next);
    } catch (error) {
      throw new Error(friendlyError(error));
    }
  };

  const demoLogin = (role: Role) => {
    const next = { userId: `demo-${role}`, email: `demo-${role}@curit.local`, role, displayName: role === 'creator' ? '권아영' : '아늑한 서울', demo: true } satisfies Session;
    if (role === 'store') setStoreOnboarding(demoStoreOnboarding);
    setDemoCollaborations(demoCollaborationList(role));
    setSession(next); setTab('home'); setAuthView('login');
  };

  const createAccount = async (email: string, password: string, displayName: string) => {
    try {
      const result = await signUp(email, password, displayName, signupRole);
      if (!result.session) {
        setConfirmationEmail(email.trim());
        setAuthView('confirmation');
        return;
      }
      if (signupRole === 'store') {
        setPendingStoreSession(result.session);
        setPendingStoreOnboarding(null);
        setAuthView('store-signup');
      } else {
        await enterSession(result.session);
      }
    } catch (error) {
      throw new Error(friendlyError(error));
    }
  };

  const logout = async () => {
    const wasDemo = session?.demo;
    if (!wasDemo && isSupabaseConfigured) await deactivateNativePush().catch(() => undefined);
    setSession(null); setPendingStoreSession(null); setDemoCollaborations([]); setTab('home'); setSubview(null);
    if (!wasDemo && isSupabaseConfigured) await signOut();
  };

  const leaveStoreOnboarding = async () => {
    setPendingStoreSession(null);
    setPendingStoreOnboarding(null);
    setAuthView('login');
    if (isSupabaseConfigured) await signOut();
  };

  const saveCreatorProduct = async (product: Omit<ProjectProduct, 'id'>) => {
    if (session?.demo) {
      setCreatorProducts(current => [...current, { ...product, id: `demo-${Date.now()}` }]);
      return;
    }
    if (!creatorProjectId) throw new Error('프로젝트를 불러오지 못했습니다. 다시 로그인해 주세요.');
    const result = await addProjectProduct(creatorProjectId, product);
    setCreatorProducts(result.products);
    setCreatorProject(result.project);
  };

  const saveCreatorProductUpdate = async (id: string, product: Omit<ProjectProduct, 'id'>) => {
    if (session?.demo) {
      setCreatorProducts(current => current.map(item => item.id === id ? { ...product, id } : item));
      return;
    }
    const result = await updateProjectProduct(id, product);
    setCreatorProducts(result.products); setCreatorProject(result.project);
  };

  const removeCreatorProduct = async (id: string) => {
    if (session?.demo) {
      setCreatorProducts(current => current.filter(item => item.id !== id));
      return;
    }
    const result = await deleteProjectProduct(id);
    setCreatorProducts(result.products); setCreatorProject(result.project);
  };

  const saveProject = async (value: Omit<CreatorProjectDetails, 'id' | 'coverUrl'> & { coverUri?: string }) => {
    if (session?.demo) {
      setCreatorProject(current => ({ ...current, ...value, coverUrl: value.coverUri || current.coverUrl }));
      return;
    }
    const result = await saveCreatorProject(creatorProjectId, value);
    setCreatorProject(result.project); setCreatorProducts(result.products);
  };

  const showCollaboration = (item: CollaborationSummary) => {
    setSelectedCollaboration(item);
    setSubview('collaboration');
  };

  const openCollaboration = async (id: string) => {
    if (!session) throw new Error('로그인이 필요합니다.');
    if (session.demo) {
      const next = id === 'demo-proposal'
        ? demoProposalCollaboration(session.role)
        : demoCollaborations.find(item => item.id === id) ?? demoCollaboration(session.role);
      if (id === 'demo-proposal') setDemoCollaborations(current => [next, ...current.filter(item => item.id !== next.id)]);
      setTab('chat');
      showCollaboration(next);
      return;
    }
    const items = await loadCollaborations(session.role);
    const item = items.find(candidate => candidate.id === id);
    if (!item) throw new Error('이 협업 대화를 찾지 못했어요. 잠시 후 다시 시도해 주세요.');
    setTab('chat');
    showCollaboration(item);
  };

  if (loading) return <ScreenFrame><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.brand} /></View></ScreenFrame>;
  if (!session) return <ScreenFrame>{authView === 'login'
    ? <LoginScreen onLogin={login} onSignUp={() => setAuthView('role')} onDemo={demoLogin} onResetPassword={async email => { try { await requestPasswordReset(email); } catch (error) { throw new Error(friendlyError(error)); } }} demoEnabled={config.demoMode} configured={isSupabaseConfigured} />
    : authView === 'role'
      ? <RoleSelectionScreen onBack={() => setAuthView('login')} onSelect={role => { setSignupRole(role); setAuthView('account-signup'); }} />
      : authView === 'account-signup'
        ? <AccountSignupScreen role={signupRole} onBack={() => setAuthView('role')} onSubmit={createAccount} />
        : authView === 'confirmation'
          ? <EmailConfirmationScreen email={confirmationEmail} onLogin={() => setAuthView('login')} onResend={() => resendSignupConfirmation(confirmationEmail)} />
          : <StoreSignupScreen initial={pendingStoreOnboarding} onBack={() => { void leaveStoreOnboarding(); }} onComplete={storeName => { if (pendingStoreSession) { setSession({ ...pendingStoreSession, displayName: storeName }); setPendingStoreSession(null); setPendingStoreOnboarding(null); setAuthView('login'); } }} />}</ScreenFrame>;
  if (subview === 'creator-dna') return <ScreenFrame><CreatorDnaScreen demo={session.demo} onBack={() => { setCreatorOnboardingFlow(false); setSubview(null); }} onNext={creatorOnboardingFlow ? () => { setCreatorOnboardingFlow(false); setSubview('creator-profile-edit'); } : undefined} /></ScreenFrame>;
  if (subview === 'creator-profile') return <ScreenFrame><CreatorProfileScreen demo={session.demo} mode="view" project={creatorProject} onBack={() => setSubview(null)} onEdit={() => setSubview('creator-profile-edit')} onOpenProject={() => setSubview('creator-project')} /></ScreenFrame>;
  if (subview === 'creator-profile-edit') return <ScreenFrame><CreatorProfileScreen demo={session.demo} mode="edit" onBack={() => setSubview('creator-profile')} onSaved={() => setSubview('creator-profile')} /></ScreenFrame>;
  if (subview === 'store-profile') return <ScreenFrame><StoreProfileScreen demo={session.demo} userId={session.userId} onBack={() => setSubview(null)} onEdit={() => setSubview('store-edit')} onPreferences={() => { setStorePreferencesParent('profile'); setSubview('store-preferences'); }} /></ScreenFrame>;
  if (subview === 'store-edit') return <ScreenFrame><StoreSignupScreen demo={session.demo} initial={storeOnboarding ? { ...storeOnboarding, step: 1 } : null} onBack={() => setSubview('store-profile')} onComplete={storeName => { setSession(current => current ? { ...current, displayName: storeName } : current); if (session.demo) { setStoreOnboarding(current => current ? { ...current, name: storeName, complete: true, step: 5 } : demoStoreOnboarding); setSubview('store-profile'); } else void hydrateStore(session.userId).then(() => setSubview('store-profile')); }} /></ScreenFrame>;
  if (subview === 'store-preferences') return <ScreenFrame><StorePreferencesScreen demo={session.demo} userId={session.userId} onBack={() => { if (!session.demo) void hydrateStore(session.userId); setSubview(storePreferencesParent === 'profile' ? 'store-profile' : null); }} /></ScreenFrame>;
  if (subview === 'verification') return <ScreenFrame><VerificationScreen kind={session.role === 'creator' ? 'creator_activity' : 'store_operation'} demo={session.demo} onBack={() => setSubview(null)} /></ScreenFrame>;
  if (subview === 'notifications') return <ScreenFrame><NotificationsScreen demo={session.demo} onBack={() => setSubview(null)} /></ScreenFrame>;
  if (subview === 'account') return <ScreenFrame><AccountSettingsScreen email={session.email} role={session.role} demo={session.demo} onBack={() => setSubview(null)} onResetPassword={() => requestPasswordReset(session.email)} onLogout={logout} /></ScreenFrame>;
  if (subview === 'qr-products') return <ScreenFrame><QrProductsScreen demo={session.demo} onBack={() => setSubview(null)} onSelect={item => { setSelectedQrProduct(item); setSubview('qr-editor'); }} /></ScreenFrame>;
  if (subview === 'qr-editor' && selectedQrProduct) return <ScreenFrame><QrProductEditorScreen demo={session.demo} item={selectedQrProduct} onBack={() => setSubview('qr-products')} onSaved={setSelectedQrProduct} /></ScreenFrame>;
  if (subview === 'pickup') return <ScreenFrame><PickupScreen demo={session.demo} onBack={() => setSubview(null)} /></ScreenFrame>;
  if (subview === 'settlements') return <ScreenFrame><SettlementScreen role={session.role} demo={session.demo} onBack={() => setSubview(null)} onOpenCollaboration={id => { void openCollaboration(id).catch(error => Alert.alert('협업 대화를 열 수 없어요', friendlyError(error))); }} /></ScreenFrame>;
  if (subview === 'creator-project') return <ScreenFrame><CreatorProjectScreen project={creatorProject} products={creatorProducts} onBack={() => setSubview(null)} onEdit={() => setSubview('creator-project-edit')} /></ScreenFrame>;
  if (subview === 'creator-project-edit') return <ScreenFrame><CreatorProjectEditScreen project={creatorProject} products={creatorProducts} onSaveProject={saveProject} onSaveProduct={saveCreatorProduct} onUpdateProduct={saveCreatorProductUpdate} onDeleteProduct={removeCreatorProduct} onBack={() => setSubview('creator-project')} /></ScreenFrame>;
  if (subview === 'curator') return <ScreenFrame><CuratorScreen role={session.role} demo={session.demo} onBack={() => setSubview(null)} onProposalCreated={openCollaboration} /></ScreenFrame>;
  if (subview === 'recommendation' && selectedRecommendation) return <ScreenFrame><RecommendationScreen item={selectedRecommendation} demo={session.demo} onBack={() => setSubview(null)} onOpenCollaboration={openCollaboration} /></ScreenFrame>;
  if (subview === 'collaboration' && selectedCollaboration) return <ScreenFrame><CollaborationDetailScreen role={session.role} userId={session.userId} item={selectedCollaboration} demo={session.demo} onBack={() => setSubview(null)} onChanged={() => setSubview(null)} onDemoStatusChanged={status => {
    const updated = { ...selectedCollaboration, status, updatedAt: new Date().toISOString() };
    setSelectedCollaboration(updated);
    setDemoCollaborations(current => current.map(item => item.id === updated.id ? updated : item));
  }} /></ScreenFrame>;

  const content = tab === 'home' ? <HomeScreen role={session.role} displayName={session.displayName} demo={session.demo} onOpenPreferences={() => {
    if (session.role === 'creator') setSubview('creator-dna');
    else { setStorePreferencesParent('home'); setSubview('store-preferences'); }
  }} onOpenRecommendation={item => { setSelectedRecommendation(item); setSubview('recommendation'); }} onOpenCollaboration={showCollaboration} />
    : tab === 'discover' ? <MatchingDiscoverScreen role={session.role} demo={session.demo} currentUserName={session.displayName} onOpenCurator={() => setSubview('curator')} onProposalCreated={openCollaboration} />
    : tab === 'chat' ? <ChatHubScreen role={session.role} demo={session.demo} demoItems={session.demo ? demoCollaborations : undefined} onOpenCurator={() => setSubview('curator')} onOpenCollaboration={showCollaboration} />
    : tab === 'management' ? <ManagementScreen role={session.role} demo={session.demo} onOpenQr={() => setSubview('qr-products')} onOpenPickup={() => setSubview('pickup')} onOpenProject={() => setSubview('creator-project')} onOpenSettlements={() => setSubview('settlements')} onOpenCollaboration={showCollaboration} />
    : <MyScreen role={session.role} displayName={session.displayName} onOpenProject={() => setSubview('creator-project')} onOpenProfile={() => setSubview('creator-profile')} onOpenDna={() => setSubview('creator-dna')} onOpenStore={() => setSubview('store-profile')} onOpenPreferences={() => { setStorePreferencesParent('home'); setSubview('store-preferences'); }} onOpenVerification={() => setSubview('verification')} onOpenNotifications={() => setSubview('notifications')} onOpenAccount={() => setSubview('account')} />;

  return <ScreenFrame footer={<BottomNav role={session.role} active={tab} onChange={setTab} />}>{content}</ScreenFrame>;
}
