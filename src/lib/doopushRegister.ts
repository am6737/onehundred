import * as Network from 'expo-network';
import { DooPush } from 'doopush-react-native-sdk';
type PushRegistration = { token: string; deviceId: string; vendor?: string };

let registerInFlight: Promise<PushRegistration> | null = null;

async function getCachedRegistration(): Promise<PushRegistration | null> {
  const [token, deviceId] = await Promise.all([
    DooPush.getDeviceToken().catch(() => null),
    DooPush.getDeviceId().catch(() => null),
  ]);

  if (!token || !deviceId) return null;
  // The native getters do not expose the vendor consistently; callers in this app only need
  // token + deviceId. Use fcm as Android/default-compatible fallback for the SDK result shape.
  return { token, deviceId, vendor: 'fcm' };
}

async function assertNetworkAvailable() {
  const state = await Network.getNetworkStateAsync().catch(() => null);
  if (state && state.isConnected === false) {
    throw new Error('当前网络不可用，跳过推送注册');
  }
  if (state && state.isInternetReachable === false) {
    throw new Error('当前网络无法访问互联网，跳过推送注册');
  }
}

/**
 * App-side guard for DooPush.register().
 *
 * The Android SDK can leave duplicate register callers pending, and slow native registration
 * may later invoke callbacks more than once. Keep the app to one register attempt at a time
 * and reuse cached registration whenever native already has token + deviceId.
 */
export async function safeDooPushRegister(): Promise<PushRegistration> {
  if (registerInFlight) return registerInFlight;

  registerInFlight = (async () => {
    const cached = await getCachedRegistration();
    if (cached) return cached;

    await assertNetworkAvailable();
    return DooPush.register();
  })();

  try {
    return await registerInFlight;
  } finally {
    registerInFlight = null;
  }
}
