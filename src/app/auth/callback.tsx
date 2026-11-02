import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Button, CuritText, ScreenFrame } from '../../ui';
import { applyAuthRedirect } from '../../supabase';
import { colors } from '../../theme';

type CallbackState = 'loading' | 'success' | 'error';

export default function AuthCallbackScreen() {
  const incomingUrl = Linking.useURL();
  const handled = useRef(false);
  const [state, setState] = useState<CallbackState>('loading');
  const [message, setMessage] = useState('인증 정보를 확인하고 있습니다.');

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    let active = true;

    void (async () => {
      try {
        const url = incomingUrl ?? await Linking.getInitialURL();
        if (!url || !(await applyAuthRedirect(url))) throw new Error('인증 정보가 없거나 만료되었습니다. 새 인증 메일을 받아 다시 시도해 주세요.');
        if (!active) return;
        setState('success');
        setMessage('이메일 인증이 완료되었습니다. CURI:T을 시작할 수 있어요.');
      } catch (caught) {
        if (!active) return;
        setState('error');
        setMessage(caught instanceof Error ? caught.message : '이메일 인증을 완료하지 못했습니다.');
      }
    })();

    return () => { active = false; };
  }, [incomingUrl]);

  return <ScreenFrame><View style={{ flex: 1, padding: 28, justifyContent: 'center', gap: 18 }}>
    {state === 'loading' ? <ActivityIndicator color={colors.brand} size="large" /> : null}
    <CuritText weight="bold" style={{ fontSize: 24 }}>{state === 'success' ? '인증 완료' : state === 'error' ? '인증 확인 필요' : '이메일 인증 중'}</CuritText>
    <CuritText style={{ color: state === 'error' ? colors.danger : colors.muted }}>{message}</CuritText>
    {state !== 'loading' ? <Button label={state === 'success' ? 'CURI:T 시작하기' : '로그인으로 돌아가기'} onPress={() => router.replace('/')} /> : null}
  </View></ScreenFrame>;
}
