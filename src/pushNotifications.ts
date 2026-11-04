import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';
import { managementRequest } from './platform';

export type PushRegistrationResult =
  | { status: 'registered'; token: string }
  | { status: 'unsupported' | 'denied' | 'superseded'; message: string };

const PUSH_TOKEN_KEY = 'curit.mobile.expo-push-token.v1';
let generation = 0;
let pendingWrite = Promise.resolve();
const superseded = { status: 'superseded', message: '' } as const;

async function withPushTimeout<T>(request: (signal: AbortSignal) => PromiseLike<T>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try { return await request(controller.signal); }
  finally { clearTimeout(timer); }
}

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

export async function registerNativePush(userId: string): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web' || (Platform.OS === 'ios' && !Device.isDevice)) {
    return { status: 'unsupported', message: '푸시 알림은 지원되는 iOS·Android 앱에서 사용할 수 있습니다.' };
  }
  const attempt = generation;
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
  if (generation !== attempt) return superseded;

  const write = pendingWrite.then(async () => {
    if (generation !== attempt) return superseded;
    await withPushTimeout(signal => managementRequest('/api/push/device', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName || Device.modelName || '',
      }),
      signal,
    }));
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    return { status: 'registered', token } as const;
  });
  pendingWrite = write.then(() => undefined, () => undefined);
  return write;
}

export async function deactivateNativePush(userId: string) {
  if (Platform.OS === 'web' || (Platform.OS === 'ios' && !Device.isDevice)) return;
  generation += 1;
  await pendingWrite;
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
  Notifications.clearLastNotificationResponse();
  if (!token) return;

  const { error } = await withPushTimeout(signal => getSupabase()
    .from('push_devices')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('expo_push_token', token)
    .abortSignal(signal));
  if (error) throw new Error(error.message);
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}

export function addPushResponseListener(userId: string, listener: (data: Record<string, unknown>) => void) {
  if (Platform.OS === 'web') return { remove() {} };
  let handledResponseId: string | null = null;
  const handleResponse = (response: Notifications.NotificationResponse) => {
    const id = response.notification.request.identifier;
    if (id === handledResponseId) return;
    handledResponseId = id;
    Notifications.clearLastNotificationResponse();
    const data = response.notification.request.content.data as Record<string, unknown>;
    if (data?.recipientId === userId) listener(data);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
  const launchResponse = Notifications.getLastNotificationResponse();
  if (launchResponse) handleResponse(launchResponse);
  return subscription;
}
