import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Dimensions, Modal, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { Icon } from '../components/Icons';
import Svg, { Path } from 'react-native-svg';
import { signInAnonymously } from '../lib/auth';

const { width: SCREEN_W } = Dimensions.get('window');

/* ── Social Icons ── */

function WeChatIcon({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9.5 4C5.91 4 3 6.69 3 10c0 1.85 1 3.49 2.53 4.55L5 16.75l2.5-1.25c.63.2 1.3.3 2 .3.17 0 .33 0 .5-.02A5.57 5.57 0 0 1 9.5 14c0-3.04 2.69-5.5 6-5.5.17 0 .34 0 .5.02C15.07 5.8 12.53 4 9.5 4z" fill="#57A862" />
      <Path d="M21 14c0-2.49-2.46-4.5-5.5-4.5S10 11.51 10 14s2.46 4.5 5.5 4.5c.63 0 1.23-.09 1.8-.25l2.2 1.1-.5-1.72C20.17 16.72 21 15.44 21 14z" fill="#57A862" />
      <Path d="M8 9a.75.75 0 1 0 0-1.5A.75.75 0 0 0 8 9zM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM14 13.5a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2zM17.5 13.5a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2z" fill="white" />
    </Svg>
  );
}

function AppleIcon({ size = 22, color = '#3A332B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.51-3.23 0-1.44.64-2.2.45-3.06-.4C3.79 16.17 4.36 9.43 8.89 9.2c1.27.07 2.15.73 2.91.78.96-.18 1.88-.88 2.91-.8 1.23.1 2.16.58 2.78 1.49-2.55 1.53-1.95 4.89.49 5.83-.58 1.52-1.33 3.02-2.93 4.78zM12.05 9.15C11.9 7.15 13.5 5.5 15.36 5.35c.28 2.24-2.03 3.9-3.31 3.8z" />
    </Svg>
  );
}

/* ── Shared: Back Button ── */

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

/* ── Shared: Phone Input ── */

function PhoneInput({ value, onChangeText }) {
  const { theme } = useTheme();
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.paper,
      borderRadius: 16,
      paddingHorizontal: 18,
      height: 56,
    }}>
      <Text style={{
        fontFamily: theme.fonts.body,
        fontSize: 16,
        color: theme.ink,
      }}>+86</Text>
      <View style={{
        width: 1,
        height: 24,
        backgroundColor: theme.line,
        marginHorizontal: 14,
      }} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="请输入手机号"
        placeholderTextColor={theme.inkSoft}
        keyboardType="phone-pad"
        maxLength={11}
        style={{
          flex: 1,
          fontFamily: theme.fonts.body,
          fontSize: 16,
          color: theme.ink,
          padding: 0,
        }}
      />
    </View>
  );
}

/* ── Shared: Bottom Button ── */

function BottomButton({ label, enabled, onPress }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={enabled ? onPress : undefined}
      activeOpacity={0.8}
      style={{
        paddingVertical: 17,
        borderRadius: 999,
        backgroundColor: enabled ? theme.accent : theme.sand,
        alignItems: 'center',
      }}
    >
      <Text style={{
        fontFamily: theme.fonts.head,
        fontSize: 17,
        color: enabled ? '#FFFDF7' : theme.inkSoft,
      }}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── Shared: Agreement Row ── */

function AgreementRow({ checked, onToggle, onOpenAgreement, showCarrier = false }) {
  const { theme } = useTheme();
  const linkStyle = { color: theme.accent };
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <View style={{
          width: 20, height: 20, borderRadius: 10, marginTop: 1,
          borderWidth: checked ? 0 : 1.5,
          borderColor: theme.line,
          backgroundColor: checked ? theme.accent : 'transparent',
          justifyContent: 'center', alignItems: 'center',
        }}>
          {checked ? Icon.check('#FFFDF7', 13) : null}
        </View>
      </TouchableOpacity>
      <Text style={{
        flex: 1,
        fontFamily: theme.fonts.body,
        fontSize: 12.5,
        lineHeight: 20,
        color: theme.inkSoft,
      }}>
        已阅读并同意{' '}
        <Text style={linkStyle} onPress={() => onOpenAgreement?.('user')}>《用户协议》</Text>
        <Text style={linkStyle} onPress={() => onOpenAgreement?.('privacy')}>《隐私政策》</Text>
        {showCarrier ? (
          <>
            与<Text style={linkStyle} onPress={() => onOpenAgreement?.('carrier')}>《中国移动认证服务协议》</Text>
          </>
        ) : null}
      </Text>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════
   LoginWelcome — main login landing page
   ══════════════════════════════════════════════════════════ */

export function LoginWelcome({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.cream,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    }}>
      {/* Top branding section */}
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 30,
      }}>
        <Text style={{
          fontFamily: theme.fonts.hand,
          fontSize: 22,
          color: theme.accent,
          letterSpacing: 10,
        }}>一 百 件 事</Text>

        <Text style={{
          marginTop: 14,
          fontFamily: theme.fonts.head,
          fontSize: 28,
          color: theme.ink,
          textAlign: 'center',
          lineHeight: 44,
        }}>陪孩子长大的{'\n'}每一件事</Text>

        <View style={{
          marginTop: 20,
          width: 36,
          height: 3,
          borderRadius: 1.5,
          backgroundColor: theme.accentSoft,
        }} />
      </View>

      {/* Middle login section */}
      <View style={{ paddingHorizontal: 24 }}>
        {/* Phone number */}
        <View style={{ alignItems: 'center', marginBottom: 14 }}>
          <Text style={{
            fontFamily: theme.fonts.head,
            fontSize: 34,
            color: theme.ink,
            letterSpacing: 3,
          }}>188 **** 6066</Text>

          <View style={{
            marginTop: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 16,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: theme.sand,
          }}>
            {Icon.shieldCheck(theme.accent, 14)}
            <Text style={{
              fontFamily: theme.fonts.body,
              fontSize: 12,
              color: theme.inkSoft,
            }}>中国移动  提供认证服务</Text>
          </View>
        </View>

        {/* One-click login */}
        <TouchableOpacity
          onPress={() => navigation.replace('Home')}
          activeOpacity={0.8}
          style={{
            marginTop: 14,
            paddingVertical: 17,
            borderRadius: 999,
            backgroundColor: theme.accent,
            alignItems: 'center',
            shadowColor: theme.accent,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 4,
          }}
        >
          <Text style={{
            fontFamily: theme.fonts.head,
            fontSize: 17,
            color: '#FFFDF7',
          }}>本机号码一键登录</Text>
        </TouchableOpacity>

        {/* Guest login */}
        <TouchableOpacity
          onPress={async () => {
            if (!agreed) {
              Alert.alert('请先同意协议', '请阅读并勾选下方的用户协议与隐私政策');
              return;
            }
            if (loading) return;
            setLoading(true);
            try {
              await signInAnonymously();
              navigation.replace('Onboarding');
            } catch (e: any) {
              console.error('Guest login error:', e);
              Alert.alert('无法连接', '请检查网络后重试');
            } finally {
              setLoading(false);
            }
          }}
          activeOpacity={0.8}
          disabled={loading}
          style={{
            marginTop: 12,
            paddingVertical: 17,
            borderRadius: 999,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: agreed ? theme.accent : theme.line,
            alignItems: 'center',
          }}
        >
          {loading ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <Text style={{
              fontFamily: theme.fonts.head,
              fontSize: 17,
              color: agreed ? theme.accent : theme.inkSoft,
            }}>游客登录</Text>
          )}
        </TouchableOpacity>

        {/* Agreement */}
        <View style={{ marginTop: 16, paddingHorizontal: 10 }}>
          <AgreementRow
            checked={agreed}
            onToggle={() => setAgreed(!agreed)}
            onOpenAgreement={(type) => navigation.navigate('Agreement', { type })}
            showCarrier
          />
        </View>
      </View>

      {/* Bottom: login other account */}
      <TouchableOpacity
        onPress={() => navigation.navigate('PhoneLogin')}
        activeOpacity={0.7}
        style={{
          alignItems: 'center',
          paddingBottom: insets.bottom + 16,
          paddingTop: 20,
        }}
      >
        <Text style={{
          fontFamily: theme.fonts.body,
          fontSize: 14,
          color: theme.accent,
        }}>登录其他账号</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════
   PhoneLogin — SMS code / password login tabs
   ══════════════════════════════════════════════════════════ */

export function PhoneLogin({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('code');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [showSocial, setShowSocial] = useState(false);
  const timerRef = useRef(null);

  const canSendCode = phone.trim().length >= 11 && countdown === 0;
  const canLogin = phone.trim().length >= 11 && password.length > 0;

  const sendCode = () => {
    if (!canSendCode) return;
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.cream,
      paddingTop: insets.top,
    }}>
      {/* Back button */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      {/* Title */}
      <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
        <Text style={{
          fontFamily: theme.fonts.head,
          fontSize: 22,
          color: theme.ink,
        }}>{tab === 'code' ? '验证码登录' : '密码登录'}</Text>
      </View>

      {/* Content */}
      <View style={{ flex: 1, paddingHorizontal: 24, marginTop: 28 }}>
        <PhoneInput value={phone} onChangeText={setPhone} />

        {tab !== 'code' && (
          <View style={{
            marginTop: 14,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.paper,
            borderRadius: 16,
            paddingHorizontal: 18,
            height: 56,
          }}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="请输入密码"
              placeholderTextColor={theme.inkSoft}
              secureTextEntry
              style={{
                flex: 1,
                fontFamily: theme.fonts.body,
                fontSize: 16,
                color: theme.ink,
                padding: 0,
              }}
            />
          </View>
        )}

        {/* Toggle + forgot password row */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          paddingHorizontal: 4,
        }}>
          <TouchableOpacity
            onPress={() => setTab(tab === 'code' ? 'password' : 'code')}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Text style={{
              fontFamily: theme.fonts.body,
              fontSize: 14,
              color: theme.accent,
            }}>{tab === 'code' ? '密码登录' : '验证码登录'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            activeOpacity={0.7}
          >
            <Text style={{
              fontFamily: theme.fonts.body,
              fontSize: 14,
              color: theme.inkSoft,
            }}>忘记密码</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom */}
      <View style={{
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 12,
      }}>
        {tab === 'code' ? (
          <BottomButton
            label={countdown > 0 ? `${countdown}s 后重新获取` : '获取验证码'}
            enabled={canSendCode}
            onPress={sendCode}
          />
        ) : (
          <BottomButton
            label="登录"
            enabled={canLogin}
            onPress={() => navigation.replace('Home')}
          />
        )}

        <View style={{ marginTop: 16, paddingHorizontal: 10 }}>
          <AgreementRow
            checked={agreed}
            onToggle={() => setAgreed(!agreed)}
            onOpenAgreement={(type) => navigation.navigate('Agreement', { type })}
          />
        </View>

        {/* Bottom shortcuts */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 48,
          marginTop: 24,
        }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            activeOpacity={0.7}
            style={{ alignItems: 'center', gap: 8 }}
          >
            <View style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: theme.sand,
              justifyContent: 'center', alignItems: 'center',
            }}>
              {Icon.users(theme.inkSoft, 22)}
            </View>
            <Text style={{
              fontFamily: theme.fonts.body,
              fontSize: 12,
              color: theme.inkSoft,
            }}>找回账号</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowSocial(true)}
            activeOpacity={0.7}
            style={{ alignItems: 'center', gap: 8 }}
          >
            <View style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: theme.sand,
              justifyContent: 'center', alignItems: 'center',
            }}>
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={{
                    width: 5, height: 5, borderRadius: 2.5,
                    backgroundColor: theme.inkSoft,
                  }} />
                ))}
              </View>
            </View>
            <Text style={{
              fontFamily: theme.fonts.body,
              fontSize: 12,
              color: theme.inkSoft,
            }}>其他方式登录</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Social login sheet */}
      <Modal
        transparent
        visible={showSocial}
        animationType="fade"
        onRequestClose={() => setShowSocial(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
          onPress={() => setShowSocial(false)}
        >
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={{
              backgroundColor: theme.paper,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 10,
              paddingBottom: insets.bottom + 24,
              paddingHorizontal: 24,
            }}>
              <View style={{ alignItems: 'center', paddingBottom: 6 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.line }} />
              </View>
              <Text style={{
                fontFamily: theme.fonts.head,
                fontSize: 18,
                color: theme.ink,
                textAlign: 'center',
                paddingVertical: 16,
              }}>其他方式登录</Text>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 40,
                paddingVertical: 12,
              }}>
                <TouchableOpacity activeOpacity={0.7} style={{ alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: theme.cream,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <WeChatIcon size={30} />
                  </View>
                  <Text style={{
                    fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
                  }}>微信</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} style={{ alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: theme.cream,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <AppleIcon size={24} color={theme.ink} />
                  </View>
                  <Text style={{
                    fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
                  }}>Apple</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={{ alignItems: 'center', gap: 10 }}
                  onPress={() => { setShowSocial(false); navigation.navigate('EmailLogin'); }}
                >
                  <View style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: theme.cream,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    {Icon.mail(theme.ink, 24)}
                  </View>
                  <Text style={{
                    fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
                  }}>邮箱</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => setShowSocial(false)}
                activeOpacity={0.7}
                style={{ alignItems: 'center', marginTop: 12 }}
              >
                <Text style={{
                  fontFamily: theme.fonts.body, fontSize: 15, color: theme.inkSoft,
                }}>取消</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════
   ForgotPassword — phone verification for password recovery
   ══════════════════════════════════════════════════════════ */

export function ForgotPassword({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  const canSend = phone.trim().length >= 11 && countdown === 0;

  const sendCode = () => {
    if (!canSend) return;
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.cream,
      paddingTop: insets.top,
    }}>
      {/* Back button */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      {/* Title */}
      <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
        <Text style={{
          fontFamily: theme.fonts.head,
          fontSize: 28,
          color: theme.ink,
        }}>找回密码</Text>
        <Text style={{
          marginTop: 10,
          fontFamily: theme.fonts.body,
          fontSize: 15,
          color: theme.inkSoft,
          lineHeight: 24,
        }}>先验证手机号，确认是你本人。</Text>
      </View>

      {/* Phone input */}
      <View style={{ flex: 1, paddingHorizontal: 24, marginTop: 28 }}>
        <PhoneInput value={phone} onChangeText={setPhone} />
      </View>

      {/* Bottom button */}
      <View style={{
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 16,
      }}>
        <BottomButton
          label={countdown > 0 ? `${countdown}s 后重新获取` : '获取验证码'}
          enabled={canSend}
          onPress={sendCode}
        />
      </View>
    </View>
  );
}
