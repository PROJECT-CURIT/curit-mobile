import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';

export type PushRegistrationResult =
  | { status: 'registered'; token: string }
  | { status: 'unsupported' | 'denied'; message: string };

const PUSH_TOKEN_KEY = 'curit.mobile.expo-push-token.v1';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function projectId() {
  return Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
}

export async function registerNativePush(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return { status: 'unsupported', message: '푸시 알림은 설치된 iOS·Android 앱의 실제 기기에서 사용할 수 있습니다.' };
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('curit-updates', {
      name: 'CURI:T 주요 소식',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: '#4A6338',
      sound: 'default',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted'
    ? current
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') {
    return { status: 'denied', message: '기기 설정에서 CURI:T 알림 권한을 허용해 주세요.' };
  }
  const easProjectId = projectId();
  if (!easProjectId) throw new Error('EAS 프로젝트 식별자가 설정되지 않았습니다.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
  const supabase = getSupabase();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('푸시 알림을 연결하려면 로그인이 필요합니다.');
  const { error } = await supabase.from('push_devices').upsert({
    user_id: auth.user.id,
    expo_push_token: token,
    platform: Platform.OS,
    device_name: Device.deviceName || Device.modelName || '',
    active: true,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,expo_push_token' });
  if (error) throw new Error(error.message);
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  return { status: 'registered', token };
}

export async function deactivateNativePush() {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const easProjectId = projectId();
  if (!easProjectId) return;
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  let token = await AsyncStorage.getItem(PUSH_TOKEN_KEY) || '';
  if (!token) {
    try { token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data; }
    catch { return; }
  }
  await supabase
    .from('push_devices')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('user_id', auth.user.id)
    .eq('expo_push_token', token);
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}

export function addPushResponseListener(listener: (data: Record<string, unknown>) => void) {
  if (Platform.OS === 'web') return { remove() {} };
  return Notifications.addNotificationResponseReceivedListener(response => {
    listener(response.notification.request.content.data as Record<string, unknown>);
  });
}
