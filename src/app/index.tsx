import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { BottomNav, ScreenFrame } from '../ui';
import { AccountSignupScreen, EmailConfirmationScreen, HomeScreen, LoginScreen, ManagementScreen, MyScreen, QrProductsScreen, RoleSelectionScreen, SettlementScreen } from '../screens';
import { ChatHubScreen, CollaborationDetailScreen, CuratorScreen, MatchingDiscoverScreen } from '../curationScreens';
import { loadCollaborations } from '../curation';
import { CreatorProjectEditScreen, CreatorProjectScreen, initialCreatorProducts, StoreSignupScreen, type ProjectProduct } from '../detailScreens';
import { config } from '../config';
import { addProjectProduct, currentSession, deleteProjectProduct, friendlyError, loadCreatorProject, loadStoreOnboarding, saveCreatorProject, signIn, signOut, signUp, storeOnboardingComplete, updateProjectProduct, type CreatorProjectDetails, type StoreOnboarding } from '../platform';
import { creatorOnboardingComplete, requestPasswordReset } from '../fullPlatform';
import { CreatorDnaScreen, CreatorProfileScreen, NotificationsScreen, PickupScreen, QrProductEditorScreen, StorePreferencesScreen, StoreProfileScreen } from '../fullPrototypeScreens';
import { isSupabaseConfigured } from '../supabase';
import { colors } from '../theme';
import type { CollaborationSummary, QrProduct, Role, Session, TabKey } from '../types';

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
  const [subview, setSubview] = useState<'qr-products' | 'qr-editor' | 'pickup' | 'creator-dna' | 'creator-profile' | 'creator-profile-edit' | 'creator-project' | 'creator-project-edit' | 'store-profile' | 'store-edit' | 'store-preferences' | 'notifications' | 'settlements' | 'curator' | 'collaboration' | null>(null);
  const [selectedCollaboration, setSelectedCollaboration] = useState<CollaborationSummary | null>(null);
  const [creatorProducts, setCreatorProducts] = useState<ProjectProduct[]>(initialCreatorProducts);
  const [creatorProjectId, setCreatorProjectId] = useState('');
  const [creatorProject, setCreatorProject] = useState<CreatorProjectDetails>({ id: 'demo-project', title: '흙의 기억', story: '흙이 일상에 머무는 순간을 담았습니다.', concept: '따뜻한 생활 도예 컬렉션', region: '서울', purpose: '작품 전시 및 판매', status: 'recruiting', coverPath: '', coverUrl: '', creatorSharePercent: 80 });
  const [selectedQrProduct, setSelectedQrProduct] = useState<QrProduct | null>(null);
  const [storeOnboarding, setStoreOnboarding] = useState<StoreOnboarding | null>(null);

  const hydrateCreator = useCallback(async () => {
    const result = await loadCreatorProject();
    setCreatorProjectId(result.projectId);
    setCreatorProject(result.project);
    setCreatorProducts(result.products);
  }, []);

  const hydrateStore = useCallback(async (userId: string) => setStoreOnboarding(await loadStoreOnboarding(userId)), []);

  const enterSession = useCallback(async (next: Session) => {
    setSession(next); setTab('home'); setAuthView('login');
    if (next.role === 'creator') {
      await hydrateCreator();
      if (!next.demo && !(await creatorOnboardingComplete(next.userId))) setSubview('creator-dna');
    } else if (!next.demo) await hydrateStore(next.userId);
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
    const next = { userId: `demo-${role}`, email: `demo-${role}@curit.local`, role, displayName: role === 'creator' ? '김서연' : '아늑한 서울', demo: true } satisfies Session;
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
    setSession(null); setPendingStoreSession(null); setTab('home'); setSubview(null);
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
    const result = await updateProjectProduct(id, product);
    setCreatorProducts(result.products); setCreatorProject(result.project);
  };

  const removeCreatorProduct = async (id: string) => {
    const result = await deleteProjectProduct(id);
    setCreatorProducts(result.products); setCreatorProject(result.project);
  };

  const saveProject = async (value: Omit<CreatorProjectDetails, 'id' | 'coverUrl'> & { coverUri?: string }) => {
    const result = await saveCreatorProject(creatorProjectId, value);
    setCreatorProject(result.project); setCreatorProducts(result.products);
  };

  const openCollaboration = async (id: string) => {
    if (!session) return;
    setTab('chat');
    setSubview(null);
    try {
      const items = session.demo ? [] : await loadCollaborations(session.role);
      const item = items.find(candidate => candidate.id === id);
      if (!item) return;
      setSelectedCollaboration(item);
      setSubview('collaboration');
    } catch {
      // The chat hub remains available when the detail refresh fails.
    }
  };

  if (loading) return <ScreenFrame><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.brand} /></View></ScreenFrame>;
  if (!session) return <ScreenFrame>{authView === 'login'
    ? <LoginScreen onLogin={login} onSignUp={() => setAuthView('role')} onDemo={demoLogin} onResetPassword={async email => { try { await requestPasswordReset(email); } catch (error) { throw new Error(friendlyError(error)); } }} demoEnabled={config.demoMode} configured={isSupabaseConfigured} />
    : authView === 'role'
      ? <RoleSelectionScreen onBack={() => setAuthView('login')} onSelect={role => { setSignupRole(role); setAuthView('account-signup'); }} />
      : authView === 'account-signup'
        ? <AccountSignupScreen role={signupRole} onBack={() => setAuthView('role')} onSubmit={createAccount} />
        : authView === 'confirmation'
          ? <EmailConfirmationScreen email={confirmationEmail} onLogin={() => setAuthView('login')} />
          : <StoreSignupScreen initial={pendingStoreOnboarding} onBack={() => { void leaveStoreOnboarding(); }} onComplete={storeName => { if (pendingStoreSession) { setSession({ ...pendingStoreSession, displayName: storeName }); setPendingStoreSession(null); setPendingStoreOnboarding(null); setAuthView('login'); } }} />}</ScreenFrame>;
  if (subview === 'creator-dna') return <ScreenFrame><CreatorDnaScreen onBack={() => setSubview(null)} onNext={() => setSubview('creator-profile-edit')} /></ScreenFrame>;
  if (subview === 'creator-profile') return <ScreenFrame><CreatorProfileScreen mode="view" onBack={() => setSubview(null)} onEdit={() => setSubview('creator-profile-edit')} /></ScreenFrame>;
  if (subview === 'creator-profile-edit') return <ScreenFrame><CreatorProfileScreen mode="edit" onBack={() => setSubview('creator-profile')} onSaved={() => setSubview('creator-profile')} /></ScreenFrame>;
  if (subview === 'store-profile') return <ScreenFrame><StoreProfileScreen userId={session.userId} onBack={() => setSubview(null)} onEdit={() => setSubview('store-edit')} onPreferences={() => setSubview('store-preferences')} /></ScreenFrame>;
  if (subview === 'store-edit') return <ScreenFrame><StoreSignupScreen initial={storeOnboarding ? { ...storeOnboarding, step: 1 } : null} onBack={() => setSubview('store-profile')} onComplete={storeName => { setSession(current => current ? { ...current, displayName: storeName } : current); void hydrateStore(session.userId).then(() => setSubview('store-profile')); }} /></ScreenFrame>;
  if (subview === 'store-preferences') return <ScreenFrame><StorePreferencesScreen userId={session.userId} onBack={() => { void hydrateStore(session.userId); setSubview('store-profile'); }} /></ScreenFrame>;
  if (subview === 'notifications') return <ScreenFrame><NotificationsScreen onBack={() => setSubview(null)} /></ScreenFrame>;
  if (subview === 'qr-products') return <ScreenFrame><QrProductsScreen demo={session.demo} onBack={() => setSubview(null)} onSelect={item => { setSelectedQrProduct(item); setSubview('qr-editor'); }} /></ScreenFrame>;
  if (subview === 'qr-editor' && selectedQrProduct) return <ScreenFrame><QrProductEditorScreen item={selectedQrProduct} onBack={() => setSubview('qr-products')} onSaved={setSelectedQrProduct} /></ScreenFrame>;
  if (subview === 'pickup') return <ScreenFrame><PickupScreen demo={session.demo} onBack={() => setSubview(null)} onOpenQr={() => setSubview('qr-products')} /></ScreenFrame>;
  if (subview === 'settlements') return <ScreenFrame><SettlementScreen role={session.role} demo={session.demo} onBack={() => setSubview(null)} /></ScreenFrame>;
  if (subview === 'creator-project') return <ScreenFrame><CreatorProjectScreen project={creatorProject} products={creatorProducts} onBack={() => setSubview(null)} onEdit={() => setSubview('creator-project-edit')} /></ScreenFrame>;
  if (subview === 'creator-project-edit') return <ScreenFrame><CreatorProjectEditScreen project={creatorProject} products={creatorProducts} onSaveProject={saveProject} onSaveProduct={saveCreatorProduct} onUpdateProduct={saveCreatorProductUpdate} onDeleteProduct={removeCreatorProduct} onBack={() => setSubview('creator-project')} /></ScreenFrame>;
  if (subview === 'curator') return <ScreenFrame><CuratorScreen role={session.role} demo={session.demo} onBack={() => setSubview(null)} onProposalCreated={id => { void openCollaboration(id); }} /></ScreenFrame>;
  if (subview === 'collaboration' && selectedCollaboration) return <ScreenFrame><CollaborationDetailScreen role={session.role} userId={session.userId} item={selectedCollaboration} demo={session.demo} onBack={() => setSubview(null)} onChanged={() => setSubview(null)} /></ScreenFrame>;

  const content = tab === 'home' ? <HomeScreen role={session.role} displayName={session.displayName} demo={session.demo} onMove={target => setTab(target as TabKey)} />
    : tab === 'discover' ? <MatchingDiscoverScreen role={session.role} demo={session.demo} onOpenCurator={() => setSubview('curator')} onProposalCreated={id => { void openCollaboration(id); }} />
    : tab === 'chat' ? <ChatHubScreen role={session.role} demo={session.demo} onOpenCurator={() => setSubview('curator')} onOpenCollaboration={item => { setSelectedCollaboration(item); setSubview('collaboration'); }} />
    : tab === 'management' ? <ManagementScreen role={session.role} demo={session.demo} onOpenQr={() => setSubview('qr-products')} onOpenPickup={() => setSubview('pickup')} onOpenSettlements={() => setSubview('settlements')} onOpenCollaboration={item => { setSelectedCollaboration(item); setSubview('collaboration'); }} />
    : <MyScreen role={session.role} displayName={session.displayName} onLogout={logout} onOpenProject={() => setSubview('creator-project')} onOpenProfile={() => setSubview('creator-profile')} onOpenDna={() => setSubview('creator-dna')} onOpenStore={() => setSubview('store-profile')} onOpenPreferences={() => setSubview('store-preferences')} onOpenNotifications={() => setSubview('notifications')} onOpenSettlements={() => setSubview('settlements')} />;

  return <ScreenFrame footer={<BottomNav role={session.role} active={tab} onChange={setTab} />}>{content}</ScreenFrame>;
}
