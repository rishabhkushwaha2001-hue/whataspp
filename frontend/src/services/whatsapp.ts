import { Linking } from 'react-native';

/**
 * Sanitizes a phone number to only digits and formats it with Indian country code (91) by default if it's 10 digits.
 */
export const formatWhatsAppPhone = (phone: string): string => {
  if (!phone) return '';
  
  // Remove all non-numeric characters (spaces, +, -, brackets, etc.)
  let cleaned = phone.replace(/[^0-9]/g, '');
  
  // 10 digits -> Prepend '91'
  if (cleaned.length === 10) {
    return '91' + cleaned;
  }
  
  // 11 digits starting with 0 -> Strip '0' and Prepend '91'
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return '91' + cleaned.substring(1);
  }
  
  // 12 digits starting with 91 -> Keep as is (already correctly formatted)
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return cleaned;
  }
  
  // If it has country code prefix like 91 but has extra leading digits, clean it
  if (cleaned.length > 10 && cleaned.startsWith('91')) {
    return cleaned.slice(-12);
  }
  
  return cleaned;
};

/**
 * Attempts to launch WhatsApp with a prefilled message.
 * Automatically falls back to HTTPS (wa.me) universal link if the native whatsapp:// scheme is blocked or fails.
 */
export const sendWhatsAppMessage = async (phone: string, message: string = ''): Promise<boolean> => {
  const formattedPhone = formatWhatsAppPhone(phone);
  if (!formattedPhone) return false;
  
  // Use api.whatsapp.com universal link as the primary method.
  // This natively opens the WhatsApp app and guarantees the message is pre-filled on both Android & iOS.
  const primaryUrl = message
    ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`
    : `https://api.whatsapp.com/send?phone=${formattedPhone}`;
    
  const fallbackUrl = message
    ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${formattedPhone}`;
  
  try {
    await Linking.openURL(primaryUrl);
    return true;
  } catch (primaryErr) {
    try {
      // Fallback to wa.me link if api.whatsapp.com fails
      await Linking.openURL(fallbackUrl);
      return true;
    } catch (fallbackErr) {
      console.warn('Failed to open WhatsApp URL', fallbackErr);
      return false;
    }
  }
};
