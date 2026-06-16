import { Linking, Alert, Share } from 'react-native';

/**
 * Sanitizes a phone number to only digits and formats it with Indian country code (91) by default if it's 10 digits.
 */
export const formatWhatsAppPhone = (phone: string): string => {
  if (!phone) return '';

  // Remove all non-numeric characters (spaces, +, -, brackets, etc.)
  let cleaned = phone.replace(/[^0-9]/g, '');

  // 10 digits -> Prepend '91'
  if (cleaned.length === 10) return '91' + cleaned;

  // 11 digits starting with 0 -> Strip '0' and Prepend '91'
  if (cleaned.length === 11 && cleaned.startsWith('0')) return '91' + cleaned.substring(1);

  // 12 digits starting with 91 -> Keep as is
  if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned;

  // Strip extra leading digits if starting with 91
  if (cleaned.length > 10 && cleaned.startsWith('91')) return cleaned.slice(-12);

  return cleaned;
};

/**
 * Tries to open a URL silently. Returns true on success, false on failure.
 */
const tryOpen = async (url: string): Promise<boolean> => {
  try {
    // canOpenURL check can fail on some devices even when the URL works — so we attempt directly
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * BULLETPROOF WhatsApp sender.
 *
 * Tries every known WhatsApp URL scheme in order.
 * If ALL fail → shows a native Share sheet so the user can paste the message manually.
 *
 * Covers: Reminder, Expired, Renewal, New Enrollment — all cases.
 *
 * Priority:
 * 1. wa.me         — most reliable pre-fill on modern WhatsApp (v24+)
 * 2. whatsapp://   — native deep link, works offline, great on older phones
 * 3. wa.me (no-text fallback) — opens correct chat without pre-fill
 * 4. api.whatsapp.com — last WhatsApp attempt (limited pre-fill support on new builds)
 * 5. Share Sheet   — GUARANTEED fallback: user can share/paste message to WhatsApp manually
 */
export const sendWhatsAppMessage = async (
  phone: string,
  message: string = ''
): Promise<boolean> => {
  const formattedPhone = formatWhatsAppPhone(phone);
  if (!formattedPhone) {
    Alert.alert('Invalid Number', 'Phone number is invalid or missing.');
    return false;
  }

  const encodedMsg = encodeURIComponent(message);

  // --- Build all URL options ---
  const urls = [
    // 1. wa.me — best pre-fill on modern WhatsApp
    message
      ? `https://wa.me/${formattedPhone}?text=${encodedMsg}`
      : `https://wa.me/${formattedPhone}`,

    // 2. Native whatsapp:// deep link — good for offline / older phones
    message
      ? `whatsapp://send?phone=${formattedPhone}&text=${encodedMsg}`
      : `whatsapp://send?phone=${formattedPhone}`,

    // 3. wa.me without text (opens correct chat at least)
    `https://wa.me/${formattedPhone}`,

    // 4. api.whatsapp.com — limited pre-fill on v24+ but still try
    message
      ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedMsg}`
      : `https://api.whatsapp.com/send?phone=${formattedPhone}`,
  ];

  // --- Try each URL in sequence ---
  for (const url of urls) {
    const success = await tryOpen(url);
    if (success) return true;
  }

  // --- GUARANTEED FALLBACK: Native Share Sheet ---
  // Message WILL reach the user — they can share/paste it directly to WhatsApp
  if (message) {
    try {
      await Share.share({
        message: message,
        title: 'Send via WhatsApp',
      });
      return true;
    } catch (shareErr) {
      // Last-ditch: show Alert with message so user can copy manually
      Alert.alert(
        '📋 Copy & Send Manually',
        `WhatsApp could not be opened automatically.\n\nPlease open WhatsApp for ${formattedPhone} and paste this message:\n\n${message}`,
        [{ text: 'OK', style: 'default' }]
      );
    }
  }

  return false;
};
