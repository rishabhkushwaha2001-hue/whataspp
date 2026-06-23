import { useState, useCallback } from 'react';
import React from 'react';
import { AppAlertModal, AppAlertConfig } from '../components/AppAlertModal';

/**
 * useAppAlert — drop-in replacement for Alert.alert across the app.
 *
 * Usage:
 *   const { showAlert, AlertModal } = useAppAlert();
 *
 *   // In JSX — place once at the bottom of your component's return:
 *   <AlertModal />
 *
 *   // Trigger anywhere in your component:
 *   showAlert({ type: 'error', title: 'Error', message: 'Something went wrong' });
 *
 *   showAlert({
 *     type: 'confirm', title: 'Delete?', message: 'This cannot be undone.',
 *     buttons: [
 *       { text: 'Cancel', style: 'cancel' },
 *       { text: 'Delete', style: 'destructive', onPress: () => doDelete() },
 *     ],
 *   });
 */
export function useAppAlert() {
  const [config, setConfig] = useState<AppAlertConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const showAlert = useCallback((cfg: AppAlertConfig) => {
    setConfig(cfg);
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
  }, []);

  /** Simple one-button success toast */
  const showSuccess = useCallback((title: string, message?: string, onOk?: () => void) => {
    setConfig({
      type: 'success', title, message,
      buttons: [{ text: 'OK', style: 'default', onPress: onOk }],
    });
    setVisible(true);
  }, []);

  /** Simple one-button error message */
  const showError = useCallback((title: string, message?: string) => {
    setConfig({ type: 'error', title, message });
    setVisible(true);
  }, []);

  /** Simple one-button warning */
  const showWarning = useCallback((title: string, message?: string) => {
    setConfig({ type: 'warning', title, message });
    setVisible(true);
  }, []);

  /** Two-button confirm dialog (Cancel + destructive action) */
  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = 'Confirm',
    destructive = true,
  ) => {
    setConfig({
      type: destructive ? 'confirm' : 'info',
      title,
      message,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
      ],
    });
    setVisible(true);
  }, []);

  /** Render this component once at the bottom of your screen's JSX */
  function AlertModal() {
    if (!config) return null;
    return React.createElement(AppAlertModal, {
      visible,
      onClose: hideAlert,
      ...config,
    });
  }

  return { showAlert, showSuccess, showError, showWarning, showConfirm, AlertModal, hideAlert };
}
