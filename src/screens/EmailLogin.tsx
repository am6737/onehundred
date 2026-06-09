import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { Icon } from '../components/Icons';
import { signIn, signUp } from '../lib/auth';

function BackButton({ onPress }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: theme.paper,
        borderWidth: 1, borderColor: theme.line,
        justifyContent: 'center', alignItems: 'center',
      }}
    >
      {Icon.chevL(theme.ink, 20)}
    </TouchableOpacity>
  );
}

export default function EmailLogin({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = email.includes('@') && password.length >= 6
    && (mode === 'login' || password === confirmPassword);

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'register') {
        await signUp(email, password);
      }
      await signIn(email, password);
      navigation.replace('Home');
    } catch (e: any) {
      setError(e.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: 16,
    color: theme.ink,
    padding: 0,
  };

  const inputBox = {
    backgroundColor: theme.paper,
    borderRadius: 16,
    paddingHorizontal: 18,
    height: 56,
    justifyContent: 'center' as const,
  };

  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.cream,
      paddingTop: insets.top,
    }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
        <Text style={{
          fontFamily: theme.fonts.head,
          fontSize: 22,
          color: theme.ink,
        }}>{mode === 'login' ? '邮箱登录' : '注册账号'}</Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 24, marginTop: 28, gap: 14 }}>
        <View style={inputBox}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="请输入邮箱"
            placeholderTextColor={theme.inkSoft}
            keyboardType="email-address"
            autoCapitalize="none"
            style={inputStyle}
          />
        </View>

        <View style={inputBox}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="请输入密码（至少 6 位）"
            placeholderTextColor={theme.inkSoft}
            secureTextEntry
            style={inputStyle}
          />
        </View>

        {mode === 'register' && (
          <View style={inputBox}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="确认密码"
              placeholderTextColor={theme.inkSoft}
              secureTextEntry
              style={inputStyle}
            />
          </View>
        )}

        {error ? (
          <Text style={{
            fontFamily: theme.fonts.body,
            fontSize: 14,
            color: '#E25C5C',
            paddingHorizontal: 4,
          }}>{error}</Text>
        ) : null}

        <TouchableOpacity
          onPress={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
          activeOpacity={0.7}
          style={{ paddingHorizontal: 4 }}
        >
          <Text style={{
            fontFamily: theme.fonts.body,
            fontSize: 14,
            color: theme.accent,
          }}>{mode === 'login' ? '没有账号？注册' : '已有账号？登录'}</Text>
        </TouchableOpacity>
      </View>

      <View style={{
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 16,
      }}>
        <TouchableOpacity
          onPress={handleSubmit}
          activeOpacity={0.8}
          style={{
            paddingVertical: 17,
            borderRadius: 999,
            backgroundColor: canSubmit && !loading ? theme.accent : theme.sand,
            alignItems: 'center',
          }}
        >
          <Text style={{
            fontFamily: theme.fonts.head,
            fontSize: 17,
            color: canSubmit && !loading ? '#FFFDF7' : theme.inkSoft,
          }}>{loading ? '请稍候...' : (mode === 'login' ? '登录' : '注册')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
