import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { useT } from '../i18n';
import { Icon } from '../components/Icons';

export default function Agreement({ route, navigation }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const type = ['user', 'privacy', 'carrier'].includes(route.params?.type)
    ? route.params.type : 'user';
  const agreement = { title: t(`agreement.${type}.title`), content: t(`agreement.${type}.content`) };

  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.cream,
      paddingTop: insets.top,
    }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
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
          flex: 1,
          textAlign: 'center',
          fontFamily: theme.fonts.head,
          fontSize: 18,
          color: theme.ink,
          marginRight: 42,
        }}>{agreement.title}</Text>
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Text style={{
          fontFamily: theme.fonts.body,
          fontSize: 15,
          lineHeight: 26,
          color: theme.ink,
        }}>{agreement.content}</Text>
      </ScrollView>
    </View>
  );
}
