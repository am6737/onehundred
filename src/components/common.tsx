import React, { useRef, useEffect, useState, useMemo, useImperativeHandle } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Dimensions,
  Modal, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import WheelPicker from '@quidone/react-native-wheel-picker';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { useT } from '../i18n';
import { Icon } from './Icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');


export function LayerHeader({ title, onBack, right = null }: any) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: insets.top + 6,
      paddingHorizontal: 10,
      paddingBottom: 8,
      backgroundColor: theme.cream,
    }}>
      <TouchableOpacity
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('common.a11y.back')}
        style={{
          width: 42, height: 42, borderRadius: 21,
          backgroundColor: theme.paper,
          borderWidth: 1, borderColor: theme.line,
          justifyContent: 'center', alignItems: 'center',
        }}
      >
        {Icon.chevL(theme.ink, 20)}
      </TouchableOpacity>
      <Text style={{
        flex: 1, textAlign: 'center',
        fontFamily: theme.fonts.head, fontSize: 18, color: theme.ink,
        marginHorizontal: 8,
      }} numberOfLines={1}>
        {title}
      </Text>
      {right || <View style={{ width: 42 }} />}
    </View>
  );
}

export function Sheet({ visible, onClose, children, title, swipeFromHandleOnly = false }: any) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      slideAnim.setValue(SCREEN_H);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_H,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onCloseRef.current && onCloseRef.current());
  };

  // 整个弹层支持下滑关闭。用 gesture-handler 的原生 Pan 手势
  // （RN 新架构下 Modal 里的 JS PanResponder 收不到事件，必须走原生手势）：
  // 下拉 12px 激活、跟手下移，松手超过阈值或甩动即收起，否则弹回。
  const scrollYRef = useRef(0);
  const [contentH, setContentH] = useState(0);
  const needScroll = contentH > SCREEN_H * 0.7;
  // swipeFromHandleOnly=true 时，下滑关闭只挂在抓手/标题区，卡片主体（如时间滚轮）的纵向
  // 手势完全让给内部滚动，互不相抢。
  const panGesture = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY(12)   // 明确的下拉才激活
    .failOffsetY(-12)    // 上滑让位给内容滚动
    .onUpdate(e => {
      if (e.translationY > 0 && scrollYRef.current <= 0) {
        slideAnim.setValue(e.translationY);
      }
    })
    .onEnd(e => {
      if (scrollYRef.current <= 0 && (e.translationY > 120 || e.velocityY > 800)) {
        handleClose();
      } else {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }).start();
      }
    }), []);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
      {/* Modal 是独立原生根，gesture-handler 需要自己的 RootView 才能工作 */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <Pressable style={styles.overlay} onPress={handleClose} accessibilityLabel={t('common.a11y.close')} accessibilityRole="button">
        <Pressable onPress={e => e.stopPropagation()}>
          {(() => {
            const dragZone = (
              <>
                <View style={styles.sheetHandle}>
                  <View style={[styles.handle, { backgroundColor: theme.line }]} />
                </View>
                {title && (
                  <View style={styles.sheetHeader}>
                    <Text style={{
                      fontFamily: theme.fonts.head,
                      fontSize: 20,
                      color: theme.ink,
                      textAlign: 'center',
                    }}>{title}</Text>
                  </View>
                )}
              </>
            );
            const body = (
              <ScrollView
                style={{ maxHeight: SCREEN_H * 0.7 }}
                showsVerticalScrollIndicator={false}
                bounces={false}
                // 内容不超高就关掉滚动，避免原生滚动手势和下滑关闭抢触摸
                scrollEnabled={needScroll}
                onContentSizeChange={(_, h) => setContentH(h)}
                scrollEventThrottle={16}
                onScroll={e => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
              >
                {children}
              </ScrollView>
            );
            const card = (
              <Animated.View
                style={[styles.sheetContainer, {
                  backgroundColor: theme.paper,
                  // 安全区已经留白了，再加一点点呼吸感即可；无安全区机型保底 16
                  paddingBottom: Math.max(insets.bottom + 6, 16),
                  transform: [{ translateY: slideAnim }],
                }]}
              >
                {swipeFromHandleOnly ? (
                  <>
                    <GestureDetector gesture={panGesture}>
                      <View>{dragZone}</View>
                    </GestureDetector>
                    {body}
                  </>
                ) : (
                  <>
                    {dragZone}
                    {body}
                  </>
                )}
              </Animated.View>
            );
            return swipeFromHandleOnly
              ? card
              : <GestureDetector gesture={panGesture}>{card}</GestureDetector>;
          })()}
        </Pressable>
      </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

export function Chip({ label, active, onPress, color = undefined, style = undefined }: any) {
  const { theme } = useTheme();
  const bg = active ? (color || theme.accent) : theme.sand;
  const fg = active ? '#FFFDF7' : theme.ink;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[{
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 999, backgroundColor: bg,
      }, style]}
    >
      <Text style={{
        fontFamily: theme.fonts.head,
        fontSize: 13.5, color: fg,
      }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function PrimaryButton({ label, onPress, icon = null, style = undefined }: any) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      style={[{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: 16, borderRadius: 999,
        backgroundColor: theme.accent,
      }, style]}
    >
      {icon}
      <Text numberOfLines={1} style={{
        fontFamily: theme.fonts.head,
        fontSize: 17, color: '#FFFDF7',
      }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, style }: any) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      style={[{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        padding: 16, borderRadius: 999,
        backgroundColor: theme.paper,
        borderWidth: 1, borderColor: theme.line,
      }, style]}
    >
      <Text numberOfLines={1} style={{
        fontFamily: theme.fonts.head,
        fontSize: 17, color: theme.ink,
      }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Section({ title, children, style }: any) {
  const { theme } = useTheme();
  return (
    <View style={[{ marginTop: 22 }, style]}>
      {title && (
        <Text style={{
          fontFamily: theme.fonts.head,
          fontSize: 17, color: theme.ink,
          marginBottom: 12,
        }}>{title}</Text>
      )}
      {children}
    </View>
  );
}

export function Card({ children, style = undefined, onPress = null }: any) {
  const { theme } = useTheme();
  const content = (
    <View style={[{
      borderRadius: 22,
      backgroundColor: theme.paper,
      borderWidth: 1, borderColor: theme.line,
      padding: 18,
    }, style]}>
      {children}
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{content}</TouchableOpacity>;
  }
  return content;
}

/* ── WheelColumn ─────────────────────────────────────────────
   单列滚轮选择器，与「设置 · 免打扰时段」同款手感：@quidone 的 WheelPicker，
   但把内部 renderList 换成套了 RNGH Gesture.Native() 的 Animated.ScrollView。
   因为新架构下没登记进 RNGH 的普通 ScrollView（尤其 Modal / Sheet 里）收不到触摸，
   套上 Native 手势后滚轮才滚得动。data 传 [{ value, label }]。
   注意：GestureDetector 需要 GestureHandlerRootView 作祖先——Modal 里要自己套一层。 */

function wheelTick() {
  // 滚轮每跨过一格触发一次「选择」轻震；原生模块缺失时静默降级。
  try { Haptics.selectionAsync().catch(() => {}); } catch {}
}

function WheelScrollList({
  listMethodsRef, data, keyExtractor, renderItem, itemHeight, pickerHeight,
  readOnly, scrollOffset, initialIndex, contentContainerStyle,
  onTouchStart, onTouchEnd, onTouchCancel, onScrollStart, onScrollEnd,
}: any) {
  const scrollRef = useRef<any>(null);
  const activeRef = useRef(false);
  const endTimer = useRef<any>(null);
  const native = useMemo(() => Gesture.Native(), []);

  useImperativeHandle(listMethodsRef, () => ({
    scrollToIndex: ({ index, animated }: any) =>
      scrollRef.current?.scrollTo({ x: 0, y: index * itemHeight, animated }),
  }), [itemHeight]);

  const snapToOffsets = useMemo(() => data.map((_: any, i: number) => i * itemHeight), [data, itemHeight]);
  const onScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollOffset } } }],
    { useNativeDriver: true },
  ), [scrollOffset]);
  const ccStyle = useMemo(
    () => [{ paddingVertical: (pickerHeight - itemHeight) / 2 }, contentContainerStyle],
    [pickerHeight, itemHeight, contentContainerStyle],
  );

  // quidone 用 onValueChanged 依赖 onScrollEnd 收尾：滚动开始触发一次 start，
  // 停下（含甩动惯性结束、慢放无惯性）后触发 end。
  const start = () => {
    if (endTimer.current) { clearTimeout(endTimer.current); endTimer.current = null; }
    if (!activeRef.current) { activeRef.current = true; onScrollStart?.(); }
  };
  const end = () => {
    if (activeRef.current) { activeRef.current = false; onScrollEnd?.(); }
  };

  return (
    <GestureDetector gesture={native}>
      <Animated.ScrollView
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        scrollEnabled={!readOnly}
        contentOffset={{ x: 0, y: initialIndex * itemHeight }}
        onScroll={onScroll}
        snapToOffsets={snapToOffsets}
        nestedScrollEnabled
        removeClippedSubviews={false}
        style={{ width: '100%', overflow: 'visible' }}
        contentContainerStyle={ccStyle}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onScrollBeginDrag={start}
        onMomentumScrollBegin={start}
        onScrollEndDrag={() => {
          if (endTimer.current) clearTimeout(endTimer.current);
          endTimer.current = setTimeout(end, 60); // 无惯性时的收尾兜底
        }}
        onMomentumScrollEnd={end}
      >
        {data.map((item: any, index: number) => renderItem({ key: keyExtractor(item, index), item, index }))}
      </Animated.ScrollView>
    </GestureDetector>
  );
}

export function WheelColumn({ data, value, onChange, itemHeight, visibleCount, textStyle, style }: any) {
  const { theme } = useTheme();
  return (
    <WheelPicker
      data={data}
      value={value}
      onValueChanged={({ item }: any) => onChange(item.value)}
      onValueChanging={wheelTick}
      itemHeight={itemHeight}
      visibleItemCount={visibleCount}
      style={{ flex: 1, ...(style || {}) }}
      itemTextStyle={{ fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink, ...(textStyle || {}) }}
      renderOverlay={null}
      renderList={({ ref, ...listProps }: any) => <WheelScrollList listMethodsRef={ref} {...listProps} />}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
  },
  sheetHandle: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    paddingVertical: 10,
  },
});
