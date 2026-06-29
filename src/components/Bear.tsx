/* 遗留入口：进度条小图标 / YearReview / Drawer 仍以 <Bear /> 调用。
   现统一走 Rive 渲染（PetView），不再用静态图。保留原有 props 签名
   （size/accessories/mood/tone/stage），调用方无需改动：
   - mood 映射为 PetView 情绪（非法/缺省回退 waiting）
   - accessories/tone/stage 当前不参与渲染，由 .riv 状态机自行表现。 */

import { EMOTIONS, PetView, type Emotion } from './PetView';

export function Bear({ size = 120, mood }: any) {
  const emotion: Emotion = (EMOTIONS as readonly string[]).includes(mood)
    ? (mood as Emotion)
    : 'waiting';
  return <PetView species="bear" emotion={emotion} size={size} />;
}

export default Bear;
