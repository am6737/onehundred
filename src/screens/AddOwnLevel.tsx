import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, Image,
  StyleSheet, Alert, ActivityIndicator, Keyboard, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE } from '../theme/tokens';
import { useData } from '../data/DataProvider';
import { uploadIllustration } from '../data';
import { Icon } from '../components/Icons';
import { SceneSlot } from '../components/Motifs';
import { LayerHeader } from '../components/common';

const { height: SCREEN_H } = Dimensions.get('window');
const TONE_BY_P = { parent: 'orange', child: 'green', together: 'pink' };
const PERSPS = [['parent', '为孩子做'], ['child', '孩子为你做'], ['together', '一起做']];
const SUGGESTS = [
  ['photo', '拍照', (c: string) => Icon.camera(c, 18)],
  ['video', '视频', (c: string) => Icon.video(c, 18)],
  ['voice', '语音', (c: string) => Icon.mic(c, 18)],
  ['text', '文字', (c: string) => Icon.pen(c, 18)],
] as const;

export default function AddOwnLevel({ route, navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { addCustomLevel, editCustomLevel, removeCustomLevel } = useData();
  const { onCreated, level: editing } = route.params || {};
  const isEdit = !!editing;

  const [title, setTitle] = useState(editing?.title || '');
  const [persp, setPersp] = useState(editing?.perspective || 'together');
  const [why, setWhy] = useState(editing?.why || '');
  const [how, setHow] = useState(editing?.how || '');
  const [record, setRecord] = useState(editing?.record || '');
  const [suggest, setSuggest] = useState(editing?.suggest || 'photo');
  // coverUri：本次新挑的本地封面；coverRemoved：把原有封面去掉了
  const [coverUri, setCoverUri] = useState(null);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 是否还留着原有封面（编辑态、没换新图、也没移除）
  const keptOldCover = isEdit && !coverUri && !coverRemoved && !!editing.illustrationPath;
  const hasCover = !!coverUri || keptOldCover;

  const tone = TONE_BY_P[persp];
  const toneSoft = (TONE[tone] || TONE.orange).soft;
  const ready = title.trim().length > 0 && !saving && !deleting;

  const launch = async (fromCamera) => {
    try {
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3],
      };
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('需要相机权限才能拍照'); return; }
        const r = await ImagePicker.launchCameraAsync(opts);
        if (!r.canceled && r.assets?.[0]) { setCoverUri(r.assets[0].uri); setCoverRemoved(false); }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('需要相册权限才能选图'); return; }
        const r = await ImagePicker.launchImageLibraryAsync(opts);
        if (!r.canceled && r.assets?.[0]) { setCoverUri(r.assets[0].uri); setCoverRemoved(false); }
      }
    } catch (e) {
      Alert.alert('选择图片失败', '请再试一次');
    }
  };

  const pickCover = () => {
    Keyboard.dismiss();
    Alert.alert('设置封面', '', [
      { text: '拍一张', onPress: () => launch(true) },
      { text: '从相册选择', onPress: () => launch(false) },
      ...(hasCover ? [{ text: '移除封面', style: 'destructive' as const, onPress: () => { setCoverUri(null); setCoverRemoved(true); } }] : []),
      { text: '取消', style: 'cancel' },
    ]);
  };

  const save = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      const base = {
        title: title.trim(),
        perspective: persp,
        tone,
        why: why.trim(),
        how: how.trim(),
        record: record.trim(),
        suggest,
      };
      if (isEdit) {
        // 封面：换了新图就传新图；移除了就置空；都没动就保持原样（undefined → 不更新该字段）
        let illustrationPath: string | null | undefined;
        if (coverUri) illustrationPath = await uploadIllustration(coverUri);
        else if (coverRemoved) illustrationPath = null;
        else illustrationPath = undefined;
        await editCustomLevel(editing.id, { ...base, illustrationPath });
      } else {
        let illustrationPath = null;
        if (coverUri) illustrationPath = await uploadIllustration(coverUri);
        await addCustomLevel({ ...base, illustrationPath });
      }
      onCreated && onCreated();
      navigation.goBack();
    } catch (e) {
      setSaving(false);
      Alert.alert(isEdit ? '没能保存' : '没能加进去', '请稍后再试一次');
    }
  };

  const confirmDelete = () => {
    if (!isEdit) return;
    Keyboard.dismiss();
    Alert.alert(
      '删掉这件事？',
      `「${editing.title}」会从你们家自己的事里移除。已经记下的回忆还在。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await removeCustomLevel(editing.id, editing.illustrationPath);
              onCreated && onCreated();
              navigation.goBack();
            } catch (e) {
              setDeleting(false);
              Alert.alert('删除失败', '没能删掉，稍后再试一次。');
            }
          },
        },
      ],
    );
  };

  // 编辑态：右上角放一个删除入口
  const deleteButton = isEdit ? (
    <TouchableOpacity
      onPress={confirmDelete}
      disabled={saving || deleting}
      activeOpacity={0.7}
      style={[styles.headerDelete, { backgroundColor: theme.paper, borderColor: theme.line }]}
    >
      {deleting ? <ActivityIndicator color={theme.danger} /> : Icon.trash(theme.danger, 19)}
    </TouchableOpacity>
  ) : null;

  // 封面没设时：编辑态若还留着原封面就显示它，否则回退到 motif 插画（和首页卡片一致）
  const previewLevel = {
    title: title.trim() || '我们家自己的事',
    tone,
    illustrationPath: keptOldCover ? editing.illustrationPath : undefined,
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.cream }]}>
      <LayerHeader title={isEdit ? '改一件我们家自己的事' : '加一件我们家自己的事'} onBack={() => navigation.goBack()} right={deleteButton} />

      <ScrollView
        style={styles.scroller}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
          {/* 封面 —— 尺寸/圆角/底色与首页卡片一致 */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={pickCover}
            style={[styles.cover, { borderColor: theme.line, backgroundColor: toneSoft }]}
          >
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={styles.coverFill} resizeMode="cover" />
            ) : (
              <SceneSlot level={previewLevel} tone={tone} size={160} />
            )}
            <View style={[styles.coverPill, { backgroundColor: theme.paper, borderColor: theme.line }]}>
              {Icon.camera(theme.ink, 15)}
              <Text style={[styles.coverPillText, { color: theme.ink, fontFamily: theme.fonts.head }]}>
                {hasCover ? '换封面' : '设置封面'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 标题 */}
          <TextInput
            value={title}
            onChangeText={setTitle}
            multiline
            placeholder="给这件事起个名字"
            placeholderTextColor={theme.inkSoft}
            style={[styles.titleInput, { color: theme.ink, fontFamily: theme.fonts.head }]}
          />

          {/* 这是谁为谁做的 */}
          <Field label="这是谁为谁做的" theme={theme}>
            <View style={styles.chipRow}>
              {PERSPS.map(([k, label]) => {
                const on = persp === k;
                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => { Keyboard.dismiss(); setPersp(k); }}
                    style={[styles.choiceChip, {
                      backgroundColor: on ? theme.accent : theme.paper,
                      borderColor: on ? theme.accent : theme.line,
                    }]}
                  >
                    <Text style={{ fontFamily: theme.fonts.head, fontSize: 14, color: on ? '#FFFDF7' : theme.ink }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          <EditField label="为什么值得做" value={why} onChange={setWhy}
            placeholder="写给以后的自己——为什么想记下这件事？" theme={theme} />
          <EditField label="可以怎么做" value={how} onChange={setHow}
            placeholder="可以怎么开始？有什么小点子？" theme={theme} />
          <EditField label="记录些什么" value={record} onChange={setRecord}
            placeholder="拍下什么、说点什么、或写下哪一句话？" theme={theme} />

          {/* 适合什么记录 */}
          <Field label="适合什么记录" theme={theme}>
            <View style={styles.chipRow}>
              {SUGGESTS.map(([k, label, icon]) => {
                const on = suggest === k;
                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => { Keyboard.dismiss(); setSuggest(k); }}
                    style={[styles.suggestChip, {
                      backgroundColor: on ? theme.accent : theme.paper,
                      borderColor: on ? theme.accent : theme.line,
                    }]}
                  >
                    {icon(on ? '#FFFDF7' : theme.ink)}
                    <Text style={{ fontFamily: theme.fonts.head, fontSize: 14, color: on ? '#FFFDF7' : theme.ink }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          {/* 加进按钮：作为页面内容的一部分，跟随滚动，不浮在键盘上 */}
          <TouchableOpacity
            disabled={!ready}
            onPress={save}
            activeOpacity={0.85}
            style={[styles.saveBtn, {
              backgroundColor: ready ? theme.accent : theme.sand,
              shadowColor: ready ? theme.accent : 'transparent',
              shadowOpacity: ready ? 0.35 : 0,
            }]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFDF7" />
            ) : (
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 17, color: ready ? '#FFFDF7' : theme.inkSoft }}>
                {isEdit ? '保存修改' : '加进我们的一百件事'}
              </Text>
            )}
          </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* ── 维度小节：强调点 + 标题 ── */
function Field({ label, theme, children }) {
  return (
    <View style={styles.block}>
      <View style={styles.kickerRow}>
        <View style={[styles.kickerDot, { backgroundColor: theme.accent }]} />
        <Text style={[styles.kicker, { color: theme.accent, fontFamily: theme.fonts.head }]}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

function EditField({ label, value, onChange, placeholder, theme }) {
  return (
    <Field label={label} theme={theme}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.inkSoft}
        multiline
        style={[styles.input, {
          borderColor: theme.line,
          color: theme.ink,
          backgroundColor: theme.paper,
          fontFamily: theme.fonts.body,
        }]}
      />
    </Field>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerDelete: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  scroller: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 26,
    paddingTop: 12,
    paddingBottom: 40,
  },

  /* 封面 —— 与首页卡片同款：约 40% 屏高、圆角 30、tone.soft 底色 */
  cover: {
    height: SCREEN_H * 0.4,
    minHeight: 208,
    borderRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFill: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  coverPill: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  coverPillText: { fontSize: 14 },

  /* 标题 */
  titleInput: {
    fontSize: 26,
    lineHeight: 36,
    marginTop: 22,
    paddingVertical: 4,
  },

  /* 小节 */
  block: { marginTop: 26 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  kickerDot: { width: 7, height: 7, borderRadius: 999, marginRight: 10 },
  kicker: { fontSize: 15, letterSpacing: 0.5 },

  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 15,
    fontSize: 16,
    lineHeight: 25.6,
    minHeight: 88,
    textAlignVertical: 'top',
  },

  chipRow: { flexDirection: 'row', gap: 8 },
  choiceChip: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  suggestChip: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 加进按钮 */
  saveBtn: {
    width: '100%',
    marginTop: 34,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 6 },
  },
});
