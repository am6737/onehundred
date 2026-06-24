/* 宠物形象统一改用静态图 assets/pets/bear/icon.png。
   保留原有 props 签名（size/accessories/mood/tone/stage），以便所有调用方
   无需改动；这些参数当前不再影响渲染。 */

import React from 'react';
import { Image } from 'react-native';

const ICON = require('../../assets/pets/bear/icon.png');

export function Bear({ size = 120 }: any) {
  return <Image source={ICON} style={{ width: size, height: size }} resizeMode="contain" />;
}

export default Bear;
