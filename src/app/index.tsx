import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Keyboard, Platform, TextInput, View } from 'react-native';
import { BottomNav, Button, Empty, Header, ScreenFrame, SessionLockedContext } from '../ui';
import { AccountSettingsScreen, AccountSignupScreen, EmailConfirmationScreen, HomeScreen, LoginScreen, ManagementScreen, MyScreen, QrProductsScreen, RoleSelectionScreen, SettlementScreen } from '../screens';
import { ChatHubScreen, CollaborationDetailScreen, CuratorScreen, MatchingDiscoverScreen, RecommendationScreen } from '../curationScreens';
import { loadCollaborations } from '../curation';
import { CreatorProjectEditScreen, CreatorProjectScreen, initialCreatorProducts, StoreSignupScreen, type ProjectProduct } from '../detailScreens';
import { config } from '../config';
import { addProjectProduct, currentSession, deleteProjectProduct, friendlyError, loadCreatorProject, loadStoreOnboarding, resendSignupConfirmation, saveCreatorProject, signIn, signOut, signUp, storeOnboardingComplete, updateProjectProduct, type CreatorProjectDetails, type StoreOnboarding } from '../platform';
import { creatorOnboardingComplete, requestPasswordReset } from '../fullPlatform';
import { CreatorDnaScreen, CreatorProfileScreen, NotificationsScreen, PickupScreen, QrProductEditorScreen, StorePreferencesScreen, StoreProfileScreen, VerificationScreen } from '../fullPrototypeScreens';
import { getSupabase, isSupabaseConfigured } from '../supabase';
import { colors } from '../theme';
import { addPushResponseListener, deactivateNativePush, registerNativePush } from '../pushNotifications';
import type { CollaborationSummary, MatchRecommendation, QrProduct, Role, Session, TabKey } from '../types';
import { demoCollaboration, demoCollaborationList, demoProposalCollaboration, demoStoreOnboarding } from '../demoContent';
import type { ExhibitionPeriod } from '../exhibitionPeriod';

type AuthView = 'login' | 'role' | 'account-signup' | 'store-signup' | 'confirmation';

export default function AppIndex() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLocked, setSessionLocked] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [signupRole, setSignupRole] = useState<Role>('creator');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [pendingStoreSession, setPendingStoreSession] = useState<Session | null>(null);
  const [pendingStoreOnboarding, setPendingStoreOnboarding] = useState<StoreOnboarding | null>(null);
  const [tab, setTab] = useState<TabKey>('home');
  const [discoverVisited, setDiscoverVisited] = useState(false);
  const [pickupParent, setPickupParent] = useState<'settlements' | 'notifications' | null>(null);
  const [pickupOrderId, setPickupOrderId] = useState<string>();
  const [qrParent, setQrParent] = useState<'pickup' | 'collaboration' | null>(null);
  const [subview, setSubview] = useState<'qr-products' | 'qr-editor' | 'pickup' | 'creator-dna' | 'creator-profile' | 'creator-profile-edit' | 'creator-project' | 'creator-project-edit' | 'store-profile' | 'store-edit' | 'store-photos' | 'store-preferences' | 'verification' | 'notifications' | 'settlements' | 'account' | 'curator' | 'collaboration' | 'recommendation' | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<MatchRecommendation | null>(null);
  const [selectedCollaboration, setSelectedCollaboration] = useState<CollaborationSummary | null>(null);
  const [noticeCollaborationId, setNoticeCollaborationId] = useState<string | null>(null);
  const [noticeCollaborationError, setNoticeCollaborationError] = useState('');
  const [noticeCollaborationAttempt, setNoticeCollaborationAttempt] = useState(0);
  const [collaborationDrafts, setCollaborationDrafts] = useState<Record<string, string>>({});
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
    if (!isSupabaseConfigured || Platform.OS === 'web') return;
    const { auth } = getSupabase();
    const update = (state: string | null) => {
      if (state === 'active') void auth.startAutoRefresh();
      else if (state) void auth.stopAutoRefresh();
    };
    update(AppState.currentState ?? null);
    const subscription = AppState.addEventListener('change', update);
    return () => { subscription.remove(); void auth.stopAutoRefresh(); };
  }, []);

  const authenticatedUser = session && !session.demo ? session.userId : null;
  useEffect(() => {
    if (!authenticatedUser) return;
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !next) || (next && next.user.id !== authenticatedUser)) {
        Keyboard.dismiss();
        setSessionLocked(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [authenticatedUser]);

  useEffect(() => {
    if (!session || session.demo || sessionLocked) return;
    void registerNativePush(session.userId).catch(() => undefined);
  }, [session, sessionLocked]);

  const openNoticeCollaboration = useCallback((id: string) => {
    setSelectedCollaboration(null);
    setNoticeCollaborationId(id);
    setNoticeCollaborationError('');
    setNoticeCollaborationAttempt(current => current + 1);
    setSubview('collaboration');
  }, []);

  useEffect(() => {
    if (!session || session.demo || subview !== 'collaboration' || selectedCollaboration || !noticeCollaborationId) return;
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      if (active) setNoticeCollaborationError('연결이 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.');
    }, 10_000);
    void loadCollaborations(session.role, noticeCollaborationId, controller.signal)
      .then(([item]) => {
        if (!active || timedOut) return;
        if (item) setSelectedCollaboration(item);
        else setNoticeCollaborationError('이 협업 대화를 찾지 못했어요. 내 소식으로 돌아갈 수 있습니다.');
      })
      .catch(error => { if (active && !timedOut) setNoticeCollaborationError(friendlyError(error)); })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [noticeCollaborationAttempt, noticeCollaborationId, selectedCollaboration, session, subview]);

  const pushUser = sessionLocked ? null : authenticatedUser;
  const pushRole = pushUser ? session?.role ?? null : null;
  useEffect(() => {
    if (!pushRole || !pushUser) return;
    const subscription = addPushResponseListener(pushUser, data => {
      if (data.kind === 'order' && pushRole === 'store') {
        setPickupParent(null);
        setPickupOrderId(typeof data.orderId === 'string' && /^QR-[0-9a-f-]{36}$/i.test(data.orderId) ? data.orderId : undefined);
        setSubview('pickup');
      } else if (data.kind === 'collaboration' && typeof data.entityId === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.entityId)) {
        openNoticeCollaboration(data.entityId);
      } else setSubview('notifications');
    });
    return () => subscription.remove();
  }, [openNoticeCollaboration, pushRole, pushUser]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sessionLocked) {
        Keyboard.dismiss();
        return true;
      }
      // Android may report that the IME is hidden before the back event reaches JS.
      const focusedInSearchOrChat = (subview === 'collaboration' || (!subview && tab === 'discover')) && TextInput.State.currentlyFocusedInput();
      if (Keyboard.isVisible() || focusedInSearchOrChat) {
        Keyboard.dismiss();
        return true;
      }
      if (subview === 'creator-project-edit' || subview === 'store-edit' || subview === 'store-photos' || (!session && authView === 'store-signup')) return false;
      if (subview) {
        if (subview === 'creator-dna' && creatorOnboardingFlow) setCreatorOnboardingFlow(false);
        const parentSubview = subview === 'pickup'
          ? pickupParent
          : subview === 'qr-products'
            ? qrParent
            : subview === 'collaboration' && noticeCollaborationId
              ? 'notifications'
            : subview === 'creator-profile-edit'
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
  }, [authView, creatorOnboardingFlow, noticeCollaborationId, pickupParent, qrParent, session, sessionLocked, storePreferencesParent, subview, tab]);

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
    if (session && !sessionLocked && !wasDemo && isSupabaseConfigured) await deactivateNativePush(session.userId).catch(() => undefined);
    setSession(null); setPendingStoreSession(null); setDemoCollaborations([]); setCollaborationDrafts({}); setSelectedCollaboration(null); setNoticeCollaborationId(null); setDiscoverVisited(false); setTab('home'); setSubview(null);
    setSessionLocked(false);
    if (!wasDemo && isSupabaseConfigured) {
      if (sessionLocked) {
        const { error } = await getSupabase().auth.signOut({ scope: 'local' });
        if (error) throw new Error(error.message);
      } else await signOut();
    }
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
    setNoticeCollaborationId(null);
    setSelectedCollaboration(item);
    setSubview('collaboration');
  };

  const openCollaboration = async (id: string, period?: ExhibitionPeriod) => {
    if (!session) throw new Error('로그인이 필요합니다.');
    if (session.demo) {
      const next = id === 'demo-proposal'
        ? { ...demoProposalCollaboration(session.role), ...period }
        : demoCollaborations.find(item => item.id === id) ?? demoCollaboration(session.role);
      if (id === 'demo-proposal') setDemoCollaborations(current => [next, ...current.filter(item => item.id !== next.id)]);
      setTab('chat');
      showCollaboration(next);
      return;
    }
    const [item] = await loadCollaborations(session.role, id);
    if (!item) throw new Error('이 협업 대화를 찾지 못했어요. 잠시 후 다시 시도해 주세요.');
    setTab('chat');
    showCollaboration(item);
  };

  const finishStoreEdit = (store: StoreOnboarding) => {
    setStoreOnboarding(store);
    setSession(current => current ? { ...current, displayName: store.name.trim() } : current);
    setSubview('store-profile');
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
          : <StoreSignupScreen initial={pendingStoreOnboarding} onBack={() => { void leaveStoreOnboarding(); }} onComplete={store => { if (pendingStoreSession) { setStoreOnboarding(store); setSession({ ...pendingStoreSession, displayName: store.name.trim() }); setPendingStoreSession(null); setPendingStoreOnboarding(null); setAuthView('login'); } }} />}</ScreenFrame>;
  function renderAuthenticated(session: Session) {
    if (subview === 'creator-dna') return <ScreenFrame><CreatorDnaScreen demo={session.demo} onBack={() => { setCreatorOnboardingFlow(false); setSubview(null); }} onNext={creatorOnboardingFlow ? () => { setCreatorOnboardingFlow(false); setSubview('creator-profile-edit'); } : undefined} /></ScreenFrame>;
    if (subview === 'creator-profile') return <ScreenFrame><CreatorProfileScreen demo={session.demo} mode="view" project={creatorProject} onBack={() => setSubview(null)} onEdit={() => setSubview('creator-profile-edit')} onOpenProject={() => setSubview('creator-project')} /></ScreenFrame>;
    if (subview === 'creator-profile-edit') return <ScreenFrame><CreatorProfileScreen demo={session.demo} mode="edit" onBack={() => setSubview('creator-profile')} onSaved={profile => {
      setSession(current => current ? { ...current, displayName: profile.displayName } : current);
      setSubview('creator-profile');
    }} /></ScreenFrame>;
    if (subview === 'store-profile') return <ScreenFrame><StoreProfileScreen sample={session.demo ? storeOnboarding ?? demoStoreOnboarding : undefined} userId={session.userId} onBack={() => setSubview(null)} onEdit={store => { setStoreOnboarding(store); setSubview('store-edit'); }} onEditPhotos={store => { setStoreOnboarding(store); setSubview('store-photos'); }} onPreferences={() => { setStorePreferencesParent('profile'); setSubview('store-preferences'); }} /></ScreenFrame>;
    if ((subview === 'store-edit' || subview === 'store-photos') && storeOnboarding) {
      const photosOnly = subview === 'store-photos';
      return <ScreenFrame><StoreSignupScreen demo={session.demo} initial={{ ...storeOnboarding, step: photosOnly ? 3 : 1 }} photosOnly={photosOnly} onBack={() => setSubview('store-profile')} onComplete={finishStoreEdit} /></ScreenFrame>;
    }
    if (subview === 'store-preferences') return <ScreenFrame><StorePreferencesScreen sample={session.demo ? storeOnboarding ?? demoStoreOnboarding : undefined} userId={session.userId} onSaved={setStoreOnboarding} onBack={() => setSubview(storePreferencesParent === 'profile' ? 'store-profile' : null)} /></ScreenFrame>;
    if (subview === 'verification') return <ScreenFrame><VerificationScreen kind={session.role === 'creator' ? 'creator_activity' : 'store_operation'} demo={session.demo} onBack={() => setSubview(null)} /></ScreenFrame>;
    if (subview === 'notifications') return <ScreenFrame><NotificationsScreen demo={session.demo}
      onOpenCollaboration={id => {
        if (!session.demo) { openNoticeCollaboration(id); return; }
        const sample = demoCollaborations.find(item => item.id === id);
        if (sample) {
          showCollaboration(sample);
          setNoticeCollaborationId(id);
        }
      }}
      onOpenOrder={session.role === 'store' ? id => { setPickupParent('notifications'); setPickupOrderId(id); setSubview('pickup'); } : undefined}
      onBack={() => setSubview(null)} /></ScreenFrame>;
    if (subview === 'account') return <ScreenFrame><AccountSettingsScreen userId={session.userId} email={session.email} role={session.role} demo={session.demo} onBack={() => setSubview(null)} onResetPassword={() => requestPasswordReset(session.email)} onLogout={logout} /></ScreenFrame>;
    if (subview === 'qr-products') return <ScreenFrame><QrProductsScreen demo={session.demo} collaborationId={qrParent === 'collaboration' ? selectedCollaboration?.id : undefined} onBack={() => setSubview(qrParent)} onSelect={item => { setSelectedQrProduct(item); setSubview('qr-editor'); }} /></ScreenFrame>;
    if (subview === 'qr-editor' && selectedQrProduct) return <ScreenFrame><QrProductEditorScreen demo={session.demo} item={selectedQrProduct} onBack={() => setSubview('qr-products')} onSaved={setSelectedQrProduct} /></ScreenFrame>;
    if (subview === 'pickup') return <ScreenFrame><PickupScreen key={pickupOrderId ?? 'list'} demo={session.demo} orderId={pickupOrderId} onBack={() => setSubview(pickupParent)} onOpenList={() => setPickupOrderId(undefined)} onOpenQr={() => { setQrParent('pickup'); setSubview('qr-products'); }} /></ScreenFrame>;
    if (subview === 'settlements') return <ScreenFrame><SettlementScreen role={session.role} demo={session.demo} onOpenPickup={session.role === 'store' ? () => { setPickupParent('settlements'); setPickupOrderId(undefined); setSubview('pickup'); } : undefined} onBack={() => setSubview(null)} onOpenCollaboration={id => { void openCollaboration(id).catch(error => Alert.alert('협업 대화를 열 수 없어요', friendlyError(error))); }} /></ScreenFrame>;
    if (subview === 'creator-project') return <ScreenFrame><CreatorProjectScreen project={creatorProject} products={creatorProducts} onBack={() => setSubview(null)} onEdit={() => setSubview('creator-project-edit')} /></ScreenFrame>;
    if (subview === 'creator-project-edit') return <ScreenFrame><CreatorProjectEditScreen project={creatorProject} products={creatorProducts} onSaveProject={saveProject} onSaveProduct={saveCreatorProduct} onUpdateProduct={saveCreatorProductUpdate} onDeleteProduct={removeCreatorProduct} onBack={() => setSubview('creator-project')} /></ScreenFrame>;
    if (subview === 'curator') return <ScreenFrame><CuratorScreen role={session.role} demo={session.demo} onBack={() => setSubview(null)} onProposalCreated={openCollaboration} /></ScreenFrame>;
    if (subview === 'recommendation' && selectedRecommendation) return <ScreenFrame><RecommendationScreen item={selectedRecommendation} demo={session.demo} onBack={() => setSubview(null)} onOpenCollaboration={openCollaboration} /></ScreenFrame>;
    if (subview === 'collaboration' && !selectedCollaboration && noticeCollaborationId) return <ScreenFrame>
      <Header title="협업 대화" back={() => setSubview('notifications')} />
      {noticeCollaborationError ? <View style={{ flex: 1, padding: 20 }}>
        <Empty title="협업 대화를 열 수 없어요" description={noticeCollaborationError} />
        <Button label="다시 시도" variant="secondary" onPress={() => openNoticeCollaboration(noticeCollaborationId)} />
      </View> : <ActivityIndicator accessibilityLabel="협업 대화를 불러오고 있어요" color={colors.brand} style={{ marginTop: 40 }} />}
    </ScreenFrame>;
    if (subview === 'collaboration' && selectedCollaboration) {
      const draftKey = `${session.userId}:${selectedCollaboration.id}`;
      return <ScreenFrame><CollaborationDetailScreen key={draftKey} role={session.role} userId={session.userId} item={selectedCollaboration} demo={session.demo}
        input={collaborationDrafts[draftKey] ?? ''}
        setInput={next => setCollaborationDrafts(current => ({
          ...current,
          [draftKey]: typeof next === 'function' ? next(current[draftKey] ?? '') : next,
        }))}
        onBack={() => setSubview(noticeCollaborationId ? 'notifications' : null)} onOpenQr={session.role === 'store' && !session.demo ? () => { setQrParent('collaboration'); setSubview('qr-products'); } : undefined}
        onUpdated={updated => {
          setSelectedCollaboration(updated);
          if (session.demo) setDemoCollaborations(current => current.map(item => item.id === updated.id ? updated : item));
        }} /></ScreenFrame>;
    }

    const content = tab === 'home' ? <HomeScreen role={session.role} displayName={session.displayName} demo={session.demo} onOpenPreferences={() => {
      if (session.role === 'creator') setSubview('creator-dna');
      else { setStorePreferencesParent('home'); setSubview('store-preferences'); }
    }} onOpenRecommendation={item => { setSelectedRecommendation(item); setSubview('recommendation'); }} onOpenCollaboration={showCollaboration} />
      : tab === 'discover' ? null
      : tab === 'chat' ? <ChatHubScreen role={session.role} demo={session.demo} demoItems={session.demo ? demoCollaborations : undefined} onOpenCurator={() => setSubview('curator')} onOpenCollaboration={showCollaboration} />
      : tab === 'management' ? <ManagementScreen role={session.role} demo={session.demo} onOpenQr={() => { setQrParent(null); setSubview('qr-products'); }} onOpenPickup={() => { setPickupParent(null); setPickupOrderId(undefined); setSubview('pickup'); }} onOpenSettlements={() => setSubview('settlements')} onOpenCollaboration={showCollaboration} />
      : <MyScreen role={session.role} displayName={session.displayName} sampleCollaborations={session.demo ? demoCollaborations : undefined} onOpenProject={() => setSubview('creator-project')} onOpenProfile={() => setSubview('creator-profile')} onOpenDna={() => setSubview('creator-dna')} onOpenStore={() => setSubview('store-profile')} onOpenPreferences={() => { setStorePreferencesParent('home'); setSubview('store-preferences'); }} onOpenVerification={() => setSubview('verification')} onOpenNotifications={() => setSubview('notifications')} onOpenAccount={() => setSubview('account')} />;

    return <ScreenFrame footer={<BottomNav role={session.role} active={tab} onChange={next => {
      if (next === tab) return;
      Keyboard.dismiss();
      if (next === 'discover') setDiscoverVisited(true);
      setTab(next);
    }} />}>
      {content}
      {discoverVisited ? <View style={tab === 'discover' ? { flex: 1 } : { flex: 1, position: 'absolute', inset: 0, opacity: 0 }} pointerEvents={tab === 'discover' ? 'auto' : 'none'} accessibilityElementsHidden={tab !== 'discover'} importantForAccessibility={tab === 'discover' ? 'auto' : 'no-hide-descendants'}>
        <MatchingDiscoverScreen role={session.role} demo={session.demo} currentUserName={session.displayName} onOpenCurator={() => setSubview('curator')} onProposalCreated={openCollaboration} />
      </View> : null}
    </ScreenFrame>;
  }

  const resumeSession = async (email: string, password: string) => {
    try {
      const next = await signIn(email, password);
      if (next.userId !== session.userId || next.role !== session.role) {
        await getSupabase().auth.signOut({ scope: 'local' });
        throw new Error('작성 중인 화면을 열려면 이전과 같은 계정으로 로그인해 주세요.');
      }
      setSession(next);
      setSessionLocked(false);
    } catch (error) {
      throw new Error(friendlyError(error));
    }
  };

  return <SessionLockedContext.Provider value={sessionLocked}>
    <View style={sessionLocked ? { display: 'none' } : { flex: 1 }}>
      {renderAuthenticated(session)}
    </View>
    {sessionLocked ? <ScreenFrame><LoginScreen onLogin={resumeSession} configured={isSupabaseConfigured}
        recovery={{ email: session.email, onExit: logout }}
        onResetPassword={async email => { try { await requestPasswordReset(email); } catch (error) { throw new Error(friendlyError(error)); } }} />
      </ScreenFrame> : null}
  </SessionLockedContext.Provider>;
}
