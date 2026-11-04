import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, CuritText, Field, ScreenFrame } from '../../ui';
import { AUTH_REDIRECT_URL, parseAuthRedirect } from '../../authRedirect';
import { applyAuthRedirect, completePasswordReset } from '../../supabase';
import { colors } from '../../theme';

type CallbackState = 'loading' | 'success' | 'reset' | 'reset-complete' | 'error';

export default function AuthCallbackScreen() {
  const incomingUrl = Linking.useURL();
  const searchParams = useLocalSearchParams<Record<string, string | string[]>>();
  const routedUrl = (() => {
    const query = new URLSearchParams();
    for (const key of ['code', 'flow', 'type', 'error', 'error_description', 'access_token', 'refresh_token']) {
      const raw = searchParams[key];
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (value) query.set(key, value);
    }
    return query.size ? `${AUTH_REDIRECT_URL}?${query.toString()}` : null;
  })();
  const pendingRedirect = useRef<{ key: string; result: Promise<boolean> } | null>(null);
  const [state, setState] = useState<CallbackState>('loading');
  const [message, setMessage] = useState('인증 정보를 확인하고 있습니다.');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const url = routedUrl ?? incomingUrl ?? await Linking.getInitialURL();
        if (!active) return;
        if (!url) throw new Error('인증 정보가 없거나 만료되었습니다. 새 인증 메일을 받아 다시 시도해 주세요.');
        const payload = parseAuthRedirect(url);
        const key = payload.code ?? payload.accessToken ?? url;
        // Expo can report one callback through both route params and Linking.
        // Share the exchange so a later effect can still consume its result.
        if (pendingRedirect.current?.key !== key) {
          pendingRedirect.current = { key, result: applyAuthRedirect(url) };
        }
        if (!(await pendingRedirect.current.result)) throw new Error('인증 정보가 없거나 만료되었습니다. 새 인증 메일을 받아 다시 시도해 주세요.');
        if (!active) return;
        if (payload.type === 'recovery') {
          setState('reset');
          setMessage('새 비밀번호를 설정해 주세요.');
          return;
        }
        setState('success');
        setMessage('이메일 인증이 완료되었습니다. CURI:T을 시작할 수 있어요.');
      } catch (caught) {
        if (!active) return;
        setState('error');
        setMessage(caught instanceof Error ? caught.message : '이메일 인증을 완료하지 못했습니다.');
      }
    })();

    return () => { active = false; };
  }, [incomingUrl, routedUrl]);

  const savePassword = async () => {
    if (saving || password.length < 8 || password !== passwordConfirm) return;
    setSaving(true);
    setMessage('');
    try {
      await completePasswordReset(password);
      Keyboard.dismiss();
      setState('reset-complete');
      setMessage('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '비밀번호를 변경하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return <ScreenFrame><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 28, justifyContent: 'center', gap: 18 }}>
    {state === 'loading' ? <ActivityIndicator color={colors.brand} size="large" /> : null}
    <CuritText weight="bold" style={{ fontSize: 24 }}>{state === 'success' ? '인증 완료' : state === 'reset' ? '새 비밀번호 설정' : state === 'reset-complete' ? '변경 완료' : state === 'error' ? '인증 확인 필요' : '이메일 인증 중'}</CuritText>
    <CuritText style={{ color: state === 'error' ? colors.danger : colors.muted }}>{message}</CuritText>
    {state === 'reset' ? <View style={{ gap: 14 }}>
      <Field label="새 비밀번호 *" value={password} onChangeText={setPassword} placeholder="8자 이상" secureTextEntry />
      <Field label="새 비밀번호 확인 *" value={passwordConfirm} onChangeText={setPasswordConfirm} placeholder="한 번 더 입력" secureTextEntry />
      {passwordConfirm && password !== passwordConfirm ? <CuritText style={{ color: colors.danger }}>비밀번호가 일치하지 않습니다.</CuritText> : null}
      <Button label={saving ? '변경 중…' : '비밀번호 변경'} disabled={saving || password.length < 8 || password !== passwordConfirm} onPress={() => { void savePassword(); }} />
    </View> : null}
    {state !== 'loading' && state !== 'reset' ? <Button label={state === 'success' ? 'CURI:T 시작하기' : '로그인으로 돌아가기'} onPress={() => router.replace('/')} /> : null}
  </ScrollView></KeyboardAvoidingView></ScreenFrame>;
}
