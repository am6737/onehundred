/* rive 引擎：空壳占位。
   待 @rive-app/react-native 安装 + 各物种 .riv 文件到位后补全：
   RiveView + 状态机 emotion(Number 0-8) + onTap(Trigger)，参见
   docs/pet-notification-system-plan.md 3.4 节。保持 PetViewProps 接口不变。 */

import { PetPlaceholder } from './PetPlaceholder';
import type { PetViewProps } from './types';

export function RivePetRenderer(props: PetViewProps) {
  return <PetPlaceholder {...props} label="rive · soon" />;
}
