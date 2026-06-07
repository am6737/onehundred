import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Dimensions,
  Modal, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { Icon } from './Icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export function LayerHeader({ title, onBack, right = null }) {
  const { theme } = useTheme();
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

export function Sheet({ visible, onClose, children, title }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;

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
    }).start(() => onClose && onClose());
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable onPress={e => e.stopPropagation()}>
          <Animated.View style={[styles.sheetContainer, {
            backgroundColor: theme.paper,
            paddingBottom: insets.bottom + 20,
            transform: [{ translateY: slideAnim }],
          }]}>
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
            <ScrollView
              style={{ maxHeight: SCREEN_H * 0.7 }}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function Chip({ label, active, onPress, color = undefined, style = undefined }) {
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

export function PrimaryButton({ label, onPress, icon = null, style = undefined }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: 16, borderRadius: 999,
        backgroundColor: theme.accent,
      }, style]}
    >
      {icon}
      <Text style={{
        fontFamily: theme.fonts.head,
        fontSize: 17, color: '#FFFDF7',
      }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, style }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        padding: 16, borderRadius: 999,
        backgroundColor: theme.paper,
        borderWidth: 1, borderColor: theme.line,
      }, style]}
    >
      <Text style={{
        fontFamily: theme.fonts.head,
        fontSize: 17, color: theme.ink,
      }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Section({ title, children, style }) {
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

export function Card({ children, style = undefined, onPress = null }) {
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
