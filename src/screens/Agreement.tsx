import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { useI18n } from '../i18n';
import { Icon } from '../components/Icons';

export default function Agreement({ route, navigation }) {
  const { theme } = useTheme();
  const { t, tRaw } = useI18n();
  const insets = useSafeAreaInsets();
  const type = ['user', 'privacy', 'carrier'].includes(route.params?.type)
    ? route.params.type : 'user';
  const doc = tRaw(`agreement.${type}`) || {};
  const sections = Array.isArray(doc.sections) ? doc.sections : null;

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
        }}>{doc.title}</Text>
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
        {doc.updated ? (
          <Text style={{
            fontFamily: theme.fonts.body,
            fontSize: 12.5,
            color: theme.inkSoft,
            marginBottom: 18,
          }}>{t('agreement.updatedLabel', { date: doc.updated })}</Text>
        ) : null}

        {sections ? (
          sections.map((s, i) => (
            <View key={i} style={{ marginTop: i === 0 ? 0 : 22 }}>
              {s.h ? (
                <Text style={{
                  fontFamily: theme.fonts.head,
                  fontSize: 16,
                  color: theme.ink,
                  marginBottom: 6,
                }}>{s.h}</Text>
              ) : null}
              {(s.p || []).map((para, j) => (
                <Text key={j} style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 14.5,
                  lineHeight: 25,
                  color: theme.ink,
                  marginTop: j === 0 ? 0 : 8,
                }}>{para}</Text>
              ))}
            </View>
          ))
        ) : (
          <View>
            <Text style={{
              fontFamily: theme.fonts.body,
              fontSize: 15,
              lineHeight: 26,
              color: theme.ink,
            }}>{doc.note || (typeof doc === 'string' ? doc : '')}</Text>
            {doc.url ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(doc.url)}
                activeOpacity={0.8}
                style={{
                  marginTop: 22, minHeight: 52, paddingVertical: 14, borderRadius: 999,
                  backgroundColor: theme.accent,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{
                  fontFamily: theme.fonts.head,
                  fontSize: 16,
                  color: '#FFFDF7',
                }}>{doc.openLabel || t('common.ok')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
