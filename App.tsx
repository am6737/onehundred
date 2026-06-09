import React, { useState, useCallback, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider, useTheme } from './src/theme/tokens';
import { DataProvider, useData } from './src/data/DataProvider';
import { DEFAULT_ME, meName } from './src/data';
import { getMe, setMe as persistMe } from './src/utils/storage';
import { getSession, onAuthStateChange } from './src/lib/auth';

import HomeFeed from './src/screens/HomeFeed';
import Drawer from './src/screens/Drawer';
import LevelDetail from './src/screens/LevelDetail';
import RecordFlow from './src/screens/RecordFlow';
import { MemoryPage, MemoryBook } from './src/screens/Memory';
import MascotPage, { UnlockMoment } from './src/screens/Mascot';
import SealedPage from './src/screens/SealedPage';
import RecordsCalendar from './src/screens/RecordsCalendar';
import YearReview from './src/screens/YearReview';
import InviteFlow, { JoinFlow } from './src/screens/InviteFlow';
import PhotobookSheet, { BookFlip } from './src/screens/BookPreview';
import { LoginWelcome, PhoneLogin, ForgotPassword } from './src/screens/Login';
import EmailLogin from './src/screens/EmailLogin';
import SettingsScreen from './src/screens/Settings';

const Stack = createNativeStackNavigator();

function HomeWithDrawer({ navigation }) {
  const { theme, setTheme } = useTheme();
  const { kidDone, profile } = useData();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [perspective, setPerspective] = useState('parent');
  const [kidId, setKidId] = useState('duo');
  const [me, setMeState] = useState(DEFAULT_ME);

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

function AppNavigator() {
  const { theme } = useTheme();
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    getSession().then(session => {
      setInitialRoute(session ? 'Home' : 'LoginWelcome');
    }).catch(() => {
      setInitialRoute('LoginWelcome');
    });
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAF3E6', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#DE8C57" />
      </View>
    );
  }

  return (
    <NavigationContainer>
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
        <Stack.Screen name="Home" component={HomeWithDrawer} />
        <Stack.Screen name="LevelDetail" component={LevelDetail} />
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
        <Stack.Screen name="Invite" component={InviteFlow} />
        <Stack.Screen name="Join" component={JoinFlow} />
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
    getSession().then(session => {
      setUserId(session?.user?.id || null);
      setChecking(false);
    }).catch(() => setChecking(false));

    const { data: { subscription } } = onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
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

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAF3E6', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#DE8C57" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider initialPreset="融合·暖" initialAccent="orange">
          <AuthGate />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
