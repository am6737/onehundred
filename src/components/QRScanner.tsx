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

/** 取二维码的中心点（优先角点，其次 bounds）；拿不到有效坐标返回 null。 */
function centerOf(r: BarcodeScanningResult): { x: number; y: number } | null {
  const pts = r.cornerPoints;
  if (pts && pts.length) {
    let sx = 0, sy = 0;
    for (const p of pts) { sx += p.x; sy += p.y; }
    return { x: sx / pts.length, y: sy / pts.length };
  }
  const b = r.bounds;
  if (b && b.size && (b.size.width > 0 || b.size.height > 0)) {
    return { x: b.origin.x + b.size.width / 2, y: b.origin.y + b.size.height / 2 };
  }
  return null;
}

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
  const maskFade = useRef(new Animated.Value(0)).current;
  const frameRef = useRef<View>(null);
  const [hitRect, setHitRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const measureFrame = () => {
    frameRef.current?.measureInWindow((x, y, w, h) => {
      if (w && h) setHitRect({ x, y, w, h });
    });
  };

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
    // 只认取景框内的二维码：能拿到坐标就判断中心是否落在框内，拿不到就放行
    const c = centerOf(result);
    if (c && hitRect) {
      const pad = 36;
      const inside =
        c.x >= hitRect.x - pad && c.x <= hitRect.x + hitRect.w + pad &&
        c.y >= hitRect.y - pad && c.y <= hitRect.y + hitRect.h + pad;
      if (!inside) return; // 码在框外，忽略继续扫
    }
    setHandled(true);
    setOk(true);
    // 干脆的单次震动，和遮罩淡入、loading 一起进入，节奏统一
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.timing(maskFade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    // 停留一会儿再整层淡出、回调
    setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true })
        .start(() => onScanned(code));
    }, 900);
  }, [handled, onScanned, fade, maskFade, hitRect]);

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
          <View ref={frameRef} onLayout={measureFrame} style={styles.frame} />
          <Text style={[styles.hint, { fontFamily: theme.fonts.body }]}>{t('scan.hint')}</Text>
        </View>
      )}

      {/* 顶部标题栏 + 关闭 */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.7} style={styles.closeBtn}>
          {Icon.chevL('#FFFDF7', 22)}
        </TouchableOpacity>
        <Text style={[styles.title, { fontFamily: theme.fonts.head }]}>{t('scan.title')}</Text>
      </View>

      {/* 扫中后：轻遮罩 + loading，给"正在加入"的过场 */}
      {ok && (
        <Animated.View style={[styles.okOverlay, { opacity: maskFade }]}>
          {hitRect ? (
            <View style={{
              position: 'absolute',
              left: hitRect.x + hitRect.w / 2 - 30,
              top: hitRect.y + hitRect.h / 2 - 30,
              width: 60, height: 60, justifyContent: 'center', alignItems: 'center',
            }}>
              <ActivityIndicator color="#FFFDF7" size="large" />
            </View>
          ) : (
            <ActivityIndicator color="#FFFDF7" size="large" />
          )}
        </Animated.View>
      )}
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
  },
  okOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
