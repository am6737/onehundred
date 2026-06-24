/* 点击弹跳交互——三种引擎共用，保证 onTap 手感一致。 */

import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export function TapBounce({
  onTap,
  children,
}: {
  onTap?: () => void;
  children: ReactNode;
}) {
  const translateY = useSharedValue(0);

  const handleTap = () => {
    translateY.value = withSequence(
      withTiming(-20, { duration: 100 }),
      withTiming(0, { duration: 200, easing: Easing.bounce }),
    );
    onTap?.();
  };

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Pressable onPress={handleTap}>
      <Animated.View style={style}>{children}</Animated.View>
    </Pressable>
  );
}
