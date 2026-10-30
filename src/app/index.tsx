import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { BottomNav, ScreenFrame } from '../ui';
import { AccountSignupScreen, EmailConfirmationScreen, HomeScreen, LoginScreen, ManagementScreen, MyScreen, QrProductsScreen, RoleSelectionScreen, SettlementScreen } from '../screens';
import { ChatHubScreen, CollaborationDetailScreen, CuratorScreen, MatchingDiscoverScreen } from '../curationScreens';
import { CreatorProjectEditScreen, CreatorProjectScreen, initialCreatorProducts, StoreSignupScreen, type ProjectProduct } from '../detailScreens';
import { config } from '../config';
import { addProjectProduct, currentSession, friendlyError, loadCreatorProject, loadStoreOnboarding, signIn, signOut, signUp, storeOnboardingComplete, type StoreOnboarding } from '../platform';
import { isSupabaseConfigured } from '../supabase';
import { colors } from '../theme';
import type { CollaborationSummary, Role, Session, TabKey } from '../types';

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
  const [subview, setSubview] = useState<'qr-products' | 'creator-project' | 'creator-project-edit' | 'settlements' | 'curator' | 'collaboration' | null>(null);
  const [selectedCollaboration, setSelectedCollaboration] = useState<CollaborationSummary | null>(null);
  const [creatorProducts, setCreatorProducts] = useState<ProjectProduct[]>(initialCreatorProducts);
  const [creatorProjectId, setCreatorProjectId] = useState('');

  const hydrateCreator = async () => {
    const result = await loadCreatorProject();
    setCreatorProjectId(result.projectId);
    setCreatorProducts(result.products);
  };

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
        setSession(value);
        if (value.role === 'creator') await hydrateCreator();
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const next = await signIn(email, password);
      if (next.role === 'store' && !(await storeOnboardingComplete(next.userId))) {
        setPendingStoreSession(next);
        setPendingStoreOnboarding(await loadStoreOnboarding(next.userId));
        setAuthView('store-signup');
        return;
      }
      setSession(next); setTab('home'); setAuthView('login');
      if (next.role === 'creator') await hydrateCreator();
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
        setSession(result.session);
        setAuthView('login');
        await hydrateCreator();
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
  };

  if (loading) return <ScreenFrame><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.brand} /></View></ScreenFrame>;
  if (!session) return <ScreenFrame>{authView === 'login'
    ? <LoginScreen onLogin={login} onSignUp={() => setAuthView('role')} onDemo={demoLogin} demoEnabled={config.demoMode} configured={isSupabaseConfigured} />
    : authView === 'role'
      ? <RoleSelectionScreen onBack={() => setAuthView('login')} onSelect={role => { setSignupRole(role); setAuthView('account-signup'); }} />
      : authView === 'account-signup'
        ? <AccountSignupScreen role={signupRole} onBack={() => setAuthView('role')} onSubmit={createAccount} />
        : authView === 'confirmation'
          ? <EmailConfirmationScreen email={confirmationEmail} onLogin={() => setAuthView('login')} />
          : <StoreSignupScreen initial={pendingStoreOnboarding} onBack={() => { void leaveStoreOnboarding(); }} onComplete={storeName => { if (pendingStoreSession) { setSession({ ...pendingStoreSession, displayName: storeName }); setPendingStoreSession(null); setPendingStoreOnboarding(null); setAuthView('login'); } }} />}</ScreenFrame>;
  if (subview === 'qr-products') return <ScreenFrame><QrProductsScreen demo={session.demo} onBack={() => setSubview(null)} /></ScreenFrame>;
  if (subview === 'settlements') return <ScreenFrame><SettlementScreen role={session.role} demo={session.demo} onBack={() => setSubview(null)} /></ScreenFrame>;
  if (subview === 'creator-project') return <ScreenFrame><CreatorProjectScreen products={creatorProducts} onBack={() => setSubview(null)} onEdit={() => setSubview('creator-project-edit')} /></ScreenFrame>;
  if (subview === 'creator-project-edit') return <ScreenFrame><CreatorProjectEditScreen products={creatorProducts} onSaveProduct={saveCreatorProduct} onBack={() => setSubview('creator-project')} /></ScreenFrame>;
  if (subview === 'curator') return <ScreenFrame><CuratorScreen role={session.role} demo={session.demo} onBack={() => setSubview(null)} onProposalCreated={() => { setSubview(null); setTab('chat'); }} /></ScreenFrame>;
  if (subview === 'collaboration' && selectedCollaboration) return <ScreenFrame><CollaborationDetailScreen role={session.role} userId={session.userId} item={selectedCollaboration} demo={session.demo} onBack={() => setSubview(null)} onChanged={() => setSubview(null)} /></ScreenFrame>;

  const content = tab === 'home' ? <HomeScreen role={session.role} displayName={session.displayName} demo={session.demo} onMove={target => setTab(target as TabKey)} />
    : tab === 'discover' ? <MatchingDiscoverScreen role={session.role} demo={session.demo} onOpenCurator={() => setSubview('curator')} onProposalCreated={() => setTab('chat')} />
    : tab === 'chat' ? <ChatHubScreen role={session.role} demo={session.demo} onOpenCurator={() => setSubview('curator')} onOpenCollaboration={item => { setSelectedCollaboration(item); setSubview('collaboration'); }} />
    : tab === 'management' ? <ManagementScreen role={session.role} demo={session.demo} onOpenQr={() => setSubview('qr-products')} onOpenSettlements={() => setSubview('settlements')} onOpenCollaboration={item => { setSelectedCollaboration(item); setSubview('collaboration'); }} />
    : <MyScreen role={session.role} displayName={session.displayName} onLogout={logout} onOpenProject={() => setSubview('creator-project')} />;

  return <ScreenFrame footer={<BottomNav role={session.role} active={tab} onChange={setTab} />}>{content}</ScreenFrame>;
}
