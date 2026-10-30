import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { BottomNav, ScreenFrame } from '../ui';
import { ChatScreen, DiscoverScreen, HomeScreen, LoginScreen, ManagementScreen, MyScreen, QrProductsScreen, RoleSelectionScreen } from '../screens';
import { CreatorProjectEditScreen, CreatorProjectScreen, initialCreatorProducts, StoreSignupScreen, type ProjectProduct } from '../detailScreens';
import { clearSession, loadSession, saveSession } from '../session';
import { colors } from '../theme';
import type { Role, Session, TabKey } from '../types';

type AuthView = 'login' | 'role' | 'store-signup';

export default function AppIndex() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [tab, setTab] = useState<TabKey>('home');
  const [subview, setSubview] = useState<'qr-products' | 'creator-project' | 'creator-project-edit' | null>(null);
  const [creatorProducts, setCreatorProducts] = useState<ProjectProduct[]>(initialCreatorProducts);

  useEffect(() => { void loadSession().then(value => { setSession(value); setLoading(false); }); }, []);

  const login = async (role: Role) => {
    const next = { role, displayName: role === 'creator' ? '김서연' : '아늑한 서울' } satisfies Session;
    setSession(next); setTab('home'); setAuthView('login');
    await saveSession(next);
  };

  const logout = async () => { setSession(null); setTab('home'); setSubview(null); await clearSession(); };

  if (loading) return <ScreenFrame><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.brand} /></View></ScreenFrame>;
  if (!session) return <ScreenFrame>{authView === 'login'
    ? <LoginScreen onLogin={login} onSignUp={() => setAuthView('role')} />
    : authView === 'role'
      ? <RoleSelectionScreen onBack={() => setAuthView('login')} onSelect={role => role === 'store' ? setAuthView('store-signup') : void login('creator')} />
      : <StoreSignupScreen onBack={() => setAuthView('role')} onComplete={() => { void login('store'); }} />}</ScreenFrame>;
  if (subview === 'qr-products') return <ScreenFrame><QrProductsScreen onBack={() => setSubview(null)} /></ScreenFrame>;
  if (subview === 'creator-project') return <ScreenFrame><CreatorProjectScreen products={creatorProducts} onBack={() => setSubview(null)} onEdit={() => setSubview('creator-project-edit')} /></ScreenFrame>;
  if (subview === 'creator-project-edit') return <ScreenFrame><CreatorProjectEditScreen products={creatorProducts} onChange={setCreatorProducts} onBack={() => setSubview('creator-project')} /></ScreenFrame>;

  const content = tab === 'home' ? <HomeScreen role={session.role} onMove={target => setTab(target as TabKey)} />
    : tab === 'discover' ? <DiscoverScreen role={session.role} />
    : tab === 'chat' ? <ChatScreen />
    : tab === 'management' ? <ManagementScreen role={session.role} onOpenQr={() => setSubview('qr-products')} />
    : <MyScreen role={session.role} onLogout={logout} onOpenProject={() => setSubview('creator-project')} />;

  return <ScreenFrame footer={<BottomNav role={session.role} active={tab} onChange={setTab} />}>{content}</ScreenFrame>;
}
