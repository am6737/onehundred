import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import QRScanner from '../components/QRScanner';
import { useT } from '../i18n';
import { approveQrLogin, parseQrApprovalCode } from '../lib/qrLogin';
import { isAnonymous } from '../lib/auth';

export default function ApproveQRLogin({ navigation }) {
  const t = useT();
  const [attempt, setAttempt] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    isAnonymous().then(anonymous => {
      if (anonymous) {
        Alert.alert(t('settings.qrGuestTitle'), t('settings.qrGuestBody'), [
          { text: t('common.confirm'), onPress: () => navigation.goBack() },
        ]);
        return;
      }
      setCheckingAccount(false);
    }).catch(() => {
      Alert.alert(t('settings.qrApproveFailTitle'), t('settings.qrApproveFailBody'), [
        { text: t('common.confirm'), onPress: () => navigation.goBack() },
      ]);
    });
  }, [navigation, t]);

  const resetScanner = () => {
    setProcessing(false);
    setAttempt(value => value + 1);
  };

  const approve = async (raw: string) => {
    setProcessing(true);
    try {
      await approveQrLogin(raw);
      Alert.alert(t('settings.qrApprovedTitle'), t('settings.qrApprovedBody'), [
        { text: t('common.done'), onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.warn('[qr-login] Approval failed', error);
      Alert.alert(t('settings.qrApproveFailTitle'), t('settings.qrApproveFailBody'), [
        { text: t('common.confirm'), onPress: resetScanner },
      ]);
    }
  };

  const handleScanned = (raw: string) => {
    setProcessing(true);
    Alert.alert(t('settings.qrApproveTitle'), t('settings.qrApproveBody'), [
      { text: t('common.cancel'), style: 'cancel', onPress: resetScanner },
      { text: t('settings.qrApproveConfirm'), onPress: () => approve(raw) },
    ]);
  };

  return (
    <View style={styles.root}>
      {(processing || checkingAccount) ? <ActivityIndicator color="#FFFDF7" size="large" /> : (
        <QRScanner
          key={attempt}
          onClose={() => navigation.goBack()}
          onScanned={handleScanned}
          parseValue={parseQrApprovalCode}
          title={t('settings.qrScanTitle')}
          hint={t('settings.qrScanHint')}
          invalidHint={t('settings.qrScanInvalid')}
          permissionTitle={t('settings.qrPermissionTitle')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
