// SealDateSheet — 给"时间胶囊"这类可封存活动选一个未来的开启日（年 + 月）。
// 风格沿用 Settings 的 ReminderTimeSheet：全屏 Modal + LayerHeader + 选格 + 预览。
// onConfirm 回传已算好的 { sealUntil, sealLabel }，调用方直接落库。

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { Icon } from './Icons';
import { LayerHeader } from './common';
import { makeSealDate } from '../data';

const SCREEN_W = Dimensions.get('window').width;
const NOW = new Date();
const CUR_Y = NOW.getFullYear();
const CUR_M = NOW.getMonth() + 1;

export default function SealDateSheet({ visible, onClose, onConfirm, title = '约定一个开启的日子' }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [year, setYear] = useState(CUR_Y + 5);
  const [month, setMonth] = useState(CUR_M);

  if (!visible) return null;

  const years = Array.from({ length: 25 }, (_, i) => CUR_Y + 1 + i); // 明年起 25 年
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const colW = (SCREEN_W - 44 - 27) / 4; // 四列带间隙

  const confirm = () => {
    onConfirm(makeSealDate(year, month));
    onClose && onClose();
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader
          title={title}
          onBack={onClose}
          right={
            <TouchableOpacity onPress={confirm} activeOpacity={0.7} style={{
              paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: theme.accent,
            }}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 14, color: '#FFFDF7' }}>封存</Text>
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            选一个未来的日子。在那天到来前，连你自己也打不开它。
          </Text>

          {/* Year */}
          <Text style={{
            marginTop: 22, paddingHorizontal: 4, paddingBottom: 10,
            fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
          }}>哪一年</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            {years.map(y => {
              const on = year === y;
              return (
                <TouchableOpacity
                  key={y}
                  onPress={() => setYear(y)}
                  activeOpacity={0.7}
                  style={{
                    width: colW, paddingVertical: 12, borderRadius: 16, alignItems: 'center',
                    backgroundColor: on ? theme.accent : theme.paper,
                    borderWidth: 1.5, borderColor: on ? theme.accent : theme.line,
                  }}
                >
                  <Text style={{
                    fontFamily: theme.fonts.body, fontSize: 14.5, color: on ? '#FFFDF7' : theme.ink,
                  }}>{y}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Month */}
          <Text style={{
            marginTop: 24, paddingHorizontal: 4, paddingBottom: 10,
            fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
          }}>哪个月</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            {months.map(m => {
              const on = month === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMonth(m)}
                  activeOpacity={0.7}
                  style={{
                    width: colW, paddingVertical: 13, borderRadius: 16, alignItems: 'center',
                    backgroundColor: on ? theme.accent : theme.paper,
                    borderWidth: 1.5, borderColor: on ? theme.accent : theme.line,
                  }}
                >
                  <Text style={{
                    fontFamily: theme.fonts.body, fontSize: 14.5, color: on ? '#FFFDF7' : theme.ink,
                  }}>{m} 月</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Preview */}
          <View style={{
            marginTop: 26, padding: 20, borderRadius: 22, backgroundColor: theme.sand, alignItems: 'center',
          }}>
            {Icon.lock(theme.accent, 22)}
            <Text style={{
              marginTop: 10, fontFamily: theme.fonts.head, fontSize: 21, color: theme.ink,
            }}>{year} 年 {month} 月</Text>
            <Text style={{
              marginTop: 6, fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
            }}>到了那天，它会自己回来找你们</Text>
          </View>

          {/* 仅开发期：快速测试解封 */}
          {__DEV__ && (
            <TouchableOpacity
              onPress={() => {
                onConfirm({ sealUntil: new Date(Date.now() + 60000).toISOString(), sealLabel: '1 分钟后(测试)' });
                onClose && onClose();
              }}
              activeOpacity={0.7}
              style={{ marginTop: 18, alignItems: 'center', paddingVertical: 10 }}
            >
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>
                · 测试：1 分钟后解封 ·
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
