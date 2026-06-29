/* rive 引擎：用 rive-react-native 的状态机驱动宠物。
   - emotion 经 Number 输入（0-8）推给状态机，切情绪
   - onTap（拍一拍）触发状态机的 tap Trigger
   对应物种 .riv 未就位（PET_RIVE 为 null）时回退到 <PetPlaceholder />，
   保证代码可跑通。素材命名/输入名约定见 rive-assets.ts，
   背景见 docs/pet-notification-system-plan.md 3.4 节。保持 PetViewProps 接口不变。 */

import { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import Rive, { Fit, type RiveRef } from 'rive-react-native';
import { PetPlaceholder } from './PetPlaceholder';
import {
  EMOTION_INPUT,
  PET_RIVE,
  RIVE_STATE_MACHINE,
  TAP_TRIGGER,
  emotionToNumber,
} from './rive-assets';
import type { PetViewProps } from './types';

export function RivePetRenderer({ species, emotion, size = 280, onTap }: PetViewProps) {
  const source = PET_RIVE[species];
  const riveRef = useRef<RiveRef>(null);

  // emotion 变化时推给状态机的 Number 输入（与 EMOTIONS 顺序一致）。
  useEffect(() => {
    if (source == null) return;
    riveRef.current?.setInputState(RIVE_STATE_MACHINE, EMOTION_INPUT, emotionToNumber(emotion));
  }, [emotion, source]);

  if (source == null) {
    return <PetPlaceholder species={species} emotion={emotion} size={size} onTap={onTap} label="rive" />;
  }

  const handleTap = () => {
    riveRef.current?.fireState(RIVE_STATE_MACHINE, TAP_TRIGGER);
    onTap?.();
  };

  return (
    <Pressable onPress={handleTap}>
      <Rive
        ref={riveRef}
        source={source}
        stateMachineName={RIVE_STATE_MACHINE}
        fit={Fit.Contain}
        autoplay
        style={{ width: size, height: size }}
      />
    </Pressable>
  );
}
