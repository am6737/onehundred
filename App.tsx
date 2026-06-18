import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ActivityIndicator, Linking, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getLocales } from 'expo-localization';

import { ThemeProvider, useTheme } from './src/theme/tokens';
import { I18nProvider, loadSavedLang, type Lang } from './src/i18n';
import { DataProvider, useData } from './src/data/DataProvider';
import { DEFAULT_ME, meName } from './src/data';
import { getMe, setMe as persistMe } from './src/utils/storage';
import { getSession, getValidSession, onAuthStateChange } from './src/lib/auth';

import HomeFeed from './src/screens/HomeFeed';
import Drawer from './src/screens/Drawer';
import LevelDetail from './src/screens/LevelDetail';
import AddOwnLevel from './src/screens/AddOwnLevel';
import OwnLevels from './src/screens/OwnLevels';
import LevelTimeline from './src/screens/SpotTimeline';
import SpotCompare from './src/screens/SpotCompare';
import RecordFlow from './src/screens/RecordFlow';
import { MemoryPage, MemoryBook } from './src/screens/Memory';
import MascotPage, { UnlockMoment } from './src/screens/Mascot';
import SealedPage from './src/screens/SealedPage';
import RecordsCalendar from './src/screens/RecordsCalendar';
import YearReview from './src/screens/YearReview';
import InviteFlow from './src/screens/InviteFlow';
import JoinFamily from './src/screens/JoinFamily';
import PhotobookSheet, { BookFlip } from './src/screens/BookPreview';
import { LoginWelcome, PhoneLogin, ForgotPassword } from './src/screens/Login';
import EmailLogin from './src/screens/EmailLogin';
import SettingsScreen from './src/screens/Settings';
import Agreement from './src/screens/Agreement';
import OnboardingScreen from './src/screens/Onboarding';
import InviteRecord from './src/screens/InviteRecord';

const Stack = createNativeStackNavigator();
export const navigationRef = createNavigationContainerRef();

function isZh() {
  try { return getLocales()[0]?.languageCode === 'zh'; } catch { return true; }
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const zh = isZh();
    return (
      <View style={{ flex: 1, backgroundColor: '#FAF3E6', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>😵</Text>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#3B2E1E', textAlign: 'center', marginBottom: 8 }}>
          {zh ? '哎呀，出了点问题' : 'Oops, something went wrong'}
        </Text>
        <Text style={{ fontSize: 14, color: '#8B7355', textAlign: 'center', marginBottom: 24 }}>
          {zh ? '应用遇到了一个意外错误，请重试' : 'The app encountered an unexpected error. Please retry.'}
        </Text>
        <Pressable
          onPress={() => this.setState({ hasError: false })}
          accessibilityRole="button"
          accessibilityLabel={zh ? '重试' : 'Retry'}
          style={{ backgroundColor: '#DE8C57', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24 }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            {zh ? '重试' : 'Retry'}
          </Text>
        </Pressable>
      </View>
    );
  }
}

function HomeWithDrawer({ navigation }) {
  const { theme, setTheme } = useTheme();
  const { kids, kidDone, profile, loading, loaded } = useData();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [perspective, setPerspective] = useState('parent');
  const [kidId, setKidId] = useState('all');
  const [me, setMeState] = useState(DEFAULT_ME);

  useEffect(() => {
    if (kids.length > 0 && kidId === 'all') {
      setKidId(kids[0].id);
    }
  }, [kids]);

  useEffect(() => {
    if (loaded && !loading && kids.length === 0) {
      navigation.replace('Onboarding');
    }
  }, [loaded, loading, kids]);

  useEffect(() => {
    if (profile) {
      setMeState({ role: profile.role, custom: profile.custom_role });
    }
  }, [profile]);

  const updateMe = useCallback(async (m) => {
    setMeState(m);
    await persistMe(m);
  }, []);

  const handleDrawerNavigate = useCallback((route) => {
    setDrawerVisible(false);
    const params = { kidId, me };
    switch (route) {
      case 'mascot':
        navigation.navigate('Mascot', params);
        break;
      case 'records':
        navigation.navigate('RecordsCalendar', params);
        break;
      case 'sealed':
        navigation.navigate('Sealed', params);
        break;
      case 'ownlevels':
        navigation.navigate('OwnLevels', params);
        break;
      case 'book':
        navigation.navigate('MemoryBook', params);
        break;
      case 'yearreview':
        navigation.navigate('YearReview', params);
        break;
      case 'settings':
        navigation.navigate('Settings', { me, setMe: updateMe });
        break;
      case 'invite':
        navigation.navigate('Invite', params);
        break;
      default:
        break;
    }
  }, [navigation, kidId, me, updateMe]);

  const selectKid = useCallback((id) => {
    setKidId(id);
    if (id === 'all') setPerspective('together');
  }, []);

  const empty = kidDone(kidId) === 0;

  return (
    <View style={{ flex: 1 }}>
      <HomeFeed
        navigation={navigation}
        onOpenDrawer={() => setDrawerVisible(true)}
        perspective={perspective}
        setPerspective={setPerspective}
        kidId={kidId}
        setKidId={selectKid}
        me={me}
      />
      <Drawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onNavigate={handleDrawerNavigate}
        kidId={kidId}
        me={me}
      />
    </View>
  );
}

function parseJoinUrl(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:100moments:\/\/|https:\/\/yibaijianshi\.app\/)join\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

function AppNavigator() {
  const { theme } = useTheme();
  const { kids, loading } = useData();
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    if (loading || initialRoute) return;
    getSession().then(session => {
      if (!session) {
        setInitialRoute('LoginWelcome');
      } else if (kids.length === 0) {
        setInitialRoute('Onboarding');
      } else {
        setInitialRoute('Home');
      }
    }).catch(() => {
      setInitialRoute('LoginWelcome');
    });
  }, [loading, initialRoute]);

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      const code = parseJoinUrl(url);
      if (code && navigationRef.isReady()) {
        (navigationRef as any).navigate('JoinFamily', { code });
      }
    };
    Linking.getInitialURL().then(url => { if (url) handleUrl({ url }); });
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAF3E6', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#DE8C57" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack.Navigator
        id="root"
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.cream },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="LoginWelcome" component={LoginWelcome} />
        <Stack.Screen name="PhoneLogin" component={PhoneLogin} />
        <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
        <Stack.Screen name="EmailLogin" component={EmailLogin} />
        <Stack.Screen name="Agreement" component={Agreement} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Home" component={HomeWithDrawer} />
        <Stack.Screen name="LevelDetail" component={LevelDetail} />
        <Stack.Screen
          name="AddOwnLevel"
          component={AddOwnLevel}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="OwnLevels" component={OwnLevels} />
        <Stack.Screen name="LevelTimeline" component={LevelTimeline} />
        <Stack.Screen
          name="SpotCompare"
          component={SpotCompare}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Record"
          component={RecordFlow}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="Memory" component={MemoryPage} />
        <Stack.Screen name="MemoryBook" component={MemoryBook} />
        <Stack.Screen name="Mascot" component={MascotPage} />
        <Stack.Screen name="Sealed" component={SealedPage} />
        <Stack.Screen name="RecordsCalendar" component={RecordsCalendar} />
        <Stack.Screen
          name="YearReview"
          component={YearReview}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen
          name="InviteRecord"
          component={InviteRecord}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="Invite" component={InviteFlow} />
        <Stack.Screen name="JoinFamily" component={JoinFamily} />
        <Stack.Screen name="Photobook" component={PhotobookSheet} />
        <Stack.Screen name="BookFlip" component={BookFlip} />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AuthGate() {
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // 用 getValidSession：本地库重置后设备里的旧 JWT 仍“有效”，必须向服务端确认
    // 用户是否还存在，否则会带着幽灵 uid 进 onboarding 触发 create_family 外键报错。
    getValidSession().then(session => {
      setUserId(session?.user?.id || null);
      setChecking(false);
    }).catch(() => { setUserId(null); setChecking(false); });

    const { data: { subscription } } = onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
      // 退出登录 / 注销账户后，把整个导航栈重置回登录页。
      // 只在 SIGNED_OUT 时做，避免影响游客登录等其它会话变化。
      if (_event === 'SIGNED_OUT' && navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'LoginWelcome' }] });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAF3E6', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#DE8C57" />
      </View>
    );
  }

  return (
    <DataProvider userId={userId}>
      <AppNavigator />
    </DataProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    ZCOOLKuaiLe: require('./assets/fonts/ZCOOLKuaiLe-Regular.ttf'),
    NotoSerifSC: require('./assets/fonts/NotoSerifSC-Regular.ttf'),
    MaShanZheng: require('./assets/fonts/MaShanZheng-Regular.ttf'),
  });

  // 首帧前确定语言（已保存的偏好；没有则跟随系统），避免文案闪烁
  const [lang, setLang] = useState<Lang | null>(null);
  useEffect(() => {
    loadSavedLang().then(setLang);
  }, []);

  if (!fontsLoaded || !lang) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAF3E6', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#DE8C57" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <I18nProvider initialLang={lang}>
            <ThemeProvider initialPreset="融合·暖" initialAccent="orange">
              <AuthGate />
            </ThemeProvider>
          </I18nProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
