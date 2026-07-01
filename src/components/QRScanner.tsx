import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking as RNLinking, Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { useT } from '../i18n';
import { Icon } from './Icons';
import { parseInviteCode } from '../lib/invite';

type Props = {
  onClose: () => void;
  /** 扫到有效邀请码时回调，已解析成纯邀请码 */
  onScanned: (code: string) => void;
};

/**
 * 全屏相机扫码遮罩。用绝对定位覆盖层而非 RN Modal，
 * 规避本项目在新架构（Fabric）下 Modal 的一些坑。
 */
export default function QRScanner({ onClose, onScanned }: Props) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);
  const [ok, setOk] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  // 挂载时若权限未决定，主动申请一次
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleScan = useCallback((result: BarcodeScanningResult) => {
    if (handled) return;
    const code = parseInviteCode(result.data);
    if (!code) return; // 不是我们的邀请码，忽略继续扫
    setHandled(true);
    setOk(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // 先让"已识别"的成功态停留一下，再淡出回调，避免瞬间硬切、显得丝滑
    setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true })
        .start(() => onScanned(code));
    }, 420);
  }, [handled, onScanned, fade]);

  const granted = !!permission?.granted;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}>
      {granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handled ? undefined : handleScan}
        />
      ) : (
        <View style={styles.center}>
          {!permission ? (
            <ActivityIndicator color="#FFFDF7" />
          ) : (
            <>
              <Text style={[styles.permText, { fontFamily: theme.fonts.body }]}>
                {t('scan.permTitle')}
              </Text>
              <TouchableOpacity
                onPress={() => (permission.canAskAgain ? requestPermission() : RNLinking.openSettings())}
                activeOpacity={0.85}
                style={[styles.permBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={[styles.permBtnText, { fontFamily: theme.fonts.head }]}>
                  {permission.canAskAgain ? t('scan.permGrant') : t('scan.permSettings')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* 取景框 + 提示 */}
      {granted && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
          <View style={[styles.frame, ok && { borderColor: theme.accent }]}>
            {ok && (
              <View style={[styles.okBadge, { backgroundColor: theme.accent }]}>
                {Icon.check('#FFFDF7', 34)}
              </View>
            )}
          </View>
          <Text style={[styles.hint, { fontFamily: theme.fonts.body }]}>
            {ok ? t('scan.recognized') : t('scan.hint')}
          </Text>
        </View>
      )}

      {/* 顶部标题栏 + 关闭 */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.7} style={styles.closeBtn}>
          {Icon.chevL('#FFFDF7', 22)}
        </TouchableOpacity>
        <Text style={[styles.title, { fontFamily: theme.fonts.head }]}>{t('scan.title')}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#000', zIndex: 100 },
  center: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  permText: { color: '#FFFDF7', fontSize: 16, textAlign: 'center', lineHeight: 25, marginBottom: 22 },
  permBtn: { paddingVertical: 13, paddingHorizontal: 26, borderRadius: 999 },
  permBtnText: { color: '#FFFDF7', fontSize: 15 },
  frame: {
    width: 240, height: 240, borderRadius: 26,
    borderWidth: 3, borderColor: '#FFFDF7',
    backgroundColor: 'transparent',
    justifyContent: 'center', alignItems: 'center',
  },
  okBadge: {
    width: 74, height: 74, borderRadius: 37,
    justifyContent: 'center', alignItems: 'center',
  },
  hint: { marginTop: 26, color: '#FFFDF7', fontSize: 15, textAlign: 'center' },
  topBar: {
    position: 'absolute', left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  title: {
    flex: 1, textAlign: 'center', color: '#FFFDF7', fontSize: 16, marginRight: 40,
  },
});
