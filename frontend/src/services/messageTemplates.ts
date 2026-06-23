import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Fetches message templates from settings API.
 * Returns an object with joining, renewal, reminder templates + metadata.
 */
export const fetchMessageTemplates = async () => {
  try {
    const response = await api.get('/settings/');
    return {
      businessType: response.data.business_type || 'gym',
      enableHours: response.data.enable_hours_feature || false,
      gymName: response.data.gym_name || 'Gym',
      joiningTemplate: response.data.joining_msg_template || null,
      renewalTemplate: response.data.renewal_msg_template || null,
      reminderTemplate: response.data.reminder_msg_template || null,
      wifiNetworks: response.data.wifi_networks || [],
    };
  } catch {
    const gymName = await AsyncStorage.getItem('gymName') || 'Gym';
    const businessType = await AsyncStorage.getItem('businessType') || 'gym';
    return { businessType, enableHours: false, gymName, joiningTemplate: null, renewalTemplate: null, reminderTemplate: null, wifiNetworks: [] };
  }
};

/**
 * Returns raw default template strings based on business type.
 */
export const getDefaultTemplates = (businessType: string) => {
  if (businessType === 'library') {
    return {
      joining: `*{library_name} - MEMBERSHIP CONFIRMATION 📚*\n\nDear *{name}*,\n\nWelcome to {library_name}! Your membership has been successfully registered. We are committed to providing you with a silent and productive study environment.\n\n━━━━━━━━━━━━━━━━━━━━\n👤 *Member Phone:* {phone}\n📅 *Joining Date:* {joining_date}\n⏰ *Allotted Timings:* {hours} Hours/Day ({timing})\n🪑 *Assigned Seat:* {seat}\n📶 *Wi-Fi Details:* {wifi}\n💰 *Fees Paid:* ₹{fees}\n📅 *Valid Till:* {date}\n━━━━━━━━━━━━━━━━━━━━\n\nPlease maintain silence inside the premises. Happy studying! 🚀`,
      renewal: `*{library_name} - MEMBERSHIP RENEWED 📚*\n\nDear *{name}*,\n\nYour library membership has been successfully renewed.\n\n━━━━━━━━━━━━━━━━━━━━\n⏰ *Allotted Timings:* {hours} Hours/Day ({timing})\n🪑 *Assigned Seat:* {seat}\n📶 *Wi-Fi Details:* {wifi}\n💰 *Amount Paid:* ₹{fees}\n📅 *New Expiry Date:* {date}\n━━━━━━━━━━━━━━━━━━━━\n\nKeep reading, keep growing! 📖🚀`,
      reminder: `*{library_name} - RENEWAL REMINDER 🔔*\n\nDear *{name}* 📚,\n\nThis is a gentle reminder that your library membership is due for renewal.\n\n💰 *Pending Fees:* ₹{fees}\n📅 *Due Date:* {date}\n━━━━━━━━━━━━━━━━━━━━\n\nPlease renew your membership to continue accessing your assigned seat ({seat}) and Wi-Fi. Thank you! 🚀`
    };
  } else if (businessType === 'general') {
    return {
      joining: `*{business_name} - SERVICE ACTIVATED ✅*\n\nHello *{name}*!\n\n━━━━━━━━━━━━━━━━━━━━\n📅 *Date:* {joining_date}\n💰 *Amount Paid:* ₹{fees}\n📅 *Valid Till:* {date}\n━━━━━━━━━━━━━━━━━━━━\n\nThank you for choosing {business_name}! 🙏`,
      renewal: `*{business_name} - PLAN RENEWED ✅*\n\nHello *{name}*! Your plan has been renewed.\n\n━━━━━━━━━━━━━━━━━━━━\n💰 *Amount Paid:* ₹{fees}\n📅 *Valid Till:* {date}\n━━━━━━━━━━━━━━━━━━━━\n\nThank you for continuing with {business_name}! 🙏`,
      reminder: `*{business_name} - PAYMENT REMINDER 🔔*\n\nHello *{name}*,\n\nThis is a friendly reminder that your payment is due.\n\n*AMOUNT DUE:* ₹{fees}\n*DUE DATE:* {date}\n\nPlease contact us for renewal. Thank you! 🙏`
    };
  }
  return {
    joining: `*{gym_name} - WELCOME KIT 🧾*\n\nHello *{name}*, welcome to {gym_name}! 💪\n\n*MEMBERSHIP DETAILS:*\n━━━━━━━━━━━━━━━━━━━━\n📱 *Phone:* {phone}\n📅 *Joining Date:* {joining_date}\n💰 *Amount Paid:* ₹{fees}\n📅 *Expiry Date:* {date}\n━━━━━━━━━━━━━━━━━━━━\n\n*Stay Strong & Crush Your Goals!* 🚀`,
    renewal: `*{gym_name} - MEMBERSHIP RENEWED 🔄*\n\nHello *{name}*, thank you for continuing your journey! 💪\n\n*RENEWAL DETAILS:*\n━━━━━━━━━━━━━━━━━━━━\n💰 *Amount Paid:* ₹{fees}\n📅 *New Expiry:* {date}\n━━━━━━━━━━━━━━━━━━━━\n\n*Let's push your limits again!* 🚀`,
    reminder: `*{gym_name} - RENEWAL REMINDER 🔔*\n\nHello *{name}* 💪,\n\nYour membership is due for renewal.\n\n*PENDING FEES:* ₹{fees} 💰\n*DUE DATE:* {date} 📅\n━━━━━━━━━━━━━━━━━━━━\n\n*Don't break the momentum!* 🚀\n\nSee you at the gym! 🏋️‍♂️`
  };
};

/**
 * Fills placeholders in a template string.
 * Supported: {name}, {phone}, {date}, {joining_date}, {fees}, {hours}, {gym}
 */
export const fillTemplate = (template: string, vars: {
  name?: string;
  phone?: string;
  date?: string;
  joining_date?: string;
  fees?: string | number;
  hours?: string | number;
  timing?: string;
  gym?: string;
  seat?: string;
  wifi?: string;
}): string => {
  let result = template
    .replace(/\{name\}/g, vars.name || '')
    .replace(/\{phone\}/g, vars.phone || '')
    .replace(/\{date\}/g, vars.date || '')
    .replace(/\{joining_date\}/g, vars.joining_date || '')
    .replace(/\{fees\}/g, String(vars.fees || ''))
    .replace(/\{hours\}/g, String(vars.hours || ''))
    .replace(/\{timing\}/g, vars.timing || '')
    .replace(/\{seat\}/g, vars.seat || 'Unassigned')
    .replace(/\{wifi\}/g, vars.wifi || 'N/A')
    .replace(/\{gym\}|\{library_name\}|\{business_name\}|\{gym_name\}/g, vars.gym || '');

  // Auto-inject timing and hours if they exist but template is missing them
  if ((vars.timing && !template.includes('{timing}')) || (vars.hours && !template.includes('{hours}')) || (vars.seat && !template.includes('{seat}')) || (vars.wifi && !template.includes('{wifi}'))) {
    let extraStr = '';
    if (vars.hours && !template.includes('{hours}')) extraStr += `\n⏰ *Hours:* ${vars.hours} Hrs`;
    if (vars.timing && !template.includes('{timing}')) extraStr += `\n🌞 *Timing:* ${vars.timing}`;
    if (vars.seat && !template.includes('{seat}')) extraStr += `\n🪑 *Assigned Seat:* ${vars.seat}`;
    if (vars.wifi && !template.includes('{wifi}')) extraStr += `\n📶 *Wi-Fi Details:* ${vars.wifi}`;
    
    // Inject before "Amount Paid" or at the end of the list
    if (result.includes('💰 *Amount Paid')) {
      result = result.replace('💰 *Amount Paid', extraStr.trim() + '\n💰 *Amount Paid');
    } else if (result.includes('💰 *Amount')) {
      result = result.replace('💰 *Amount', extraStr.trim() + '\n💰 *Amount');
    } else if (result.includes('PENDING FEES')) {
      result = result.replace('*PENDING FEES', extraStr.trim() + '\n*PENDING FEES');
    } else {
      // Fallback injection if those aren't found
      result = result.replace('━━━━━━━━━━━━━━━━━━━━\n\n', extraStr + '\n━━━━━━━━━━━━━━━━━━━━\n\n');
    }
  }

  return result;
};

/**
 * Builds a joining/enrollment WhatsApp message using the custom template or
 * falls back to a default based on businessType.
 */
export const buildJoiningMessage = (
  template: string | null,
  businessType: string,
  vars: { name: string; phone: string; date: string; joining_date: string; fees: number | string; hours?: number; timing?: string; gym: string; durationDays?: number; seat?: string; wifi?: string; }
): string => {
  if (template) {
    return fillTemplate(template, vars);
  }
  // Fallback defaults
  const gymUp = vars.gym.toUpperCase();
  if (businessType === 'library') {
    return (
      `*{gymUp} - MEMBERSHIP CONFIRMATION 📚*\n\n` +
      `Dear *${vars.name}*,\n\n` +
      `Welcome to ${vars.gym}! Your membership has been successfully registered. We are committed to providing you with a silent and productive study environment.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Member Phone:* ${vars.phone}\n` +
      `📅 *Joining Date:* ${vars.joining_date}\n` +
      `⏰ *Allotted Timings:* ${vars.hours || '—'} Hours/Day (${vars.timing || 'N/A'})\n` +
      `🪑 *Assigned Seat:* ${vars.seat || 'Unassigned'}\n` +
      `📶 *Wi-Fi Details:* ${vars.wifi || 'N/A'}\n` +
      `💰 *Fees Paid:* ₹${vars.fees}\n` +
      `📅 *Valid Till:* ${vars.date}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Please maintain silence inside the premises. Happy studying! 🚀`
    );
  } else if (businessType === 'general') {
    return (
      `*${gymUp} - SERVICE ACTIVATED ✅*\n\n` +
      `Hello *${vars.name}*!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 *Date:* ${vars.joining_date}\n` +
      `💰 *Amount Paid:* ₹${vars.fees}\n` +
      `📅 *Valid Till:* ${vars.date}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Thank you for choosing ${vars.gym}! 🙏`
    );
  }
  // Default: gym
  return (
    `*${gymUp} - WELCOME KIT 🧾*\n\n` +
    `Hello *${vars.name}*, welcome to ${vars.gym}! 💪\n\n` +
    `*MEMBERSHIP DETAILS:*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📱 *Phone:* ${vars.phone}\n` +
    `📅 *Joining Date:* ${vars.joining_date}\n` +
    `🗓️ *Plan Duration:* ${vars.durationDays || ''} Days\n` +
    (vars.hours ? `⏰ *Hours:* ${vars.hours} Hrs\n` : '') +
    (vars.timing ? `🌞 *Timing:* ${vars.timing}\n` : '') +
    `💰 *Amount Paid:* ₹${vars.fees}\n` +
    `📅 *Expiry Date:* ${vars.date}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `*Stay Strong & Crush Your Goals!* 🚀`
  );
};

/**
 * Builds a renewal WhatsApp message using the custom template or fallback.
 */
export const buildRenewalMessage = (
  template: string | null,
  businessType: string,
  vars: { name: string; phone: string; date: string; fees: number | string; hours?: number; timing?: string; gym: string; durationMonths?: number; seat?: string; wifi?: string; }
): string => {
  if (template) {
    return fillTemplate(template, vars);
  }
  const gymUp = vars.gym.toUpperCase();
  if (businessType === 'library') {
    return (
      `*${gymUp} - MEMBERSHIP RENEWED 📚*\n\n` +
      `Dear *${vars.name}*,\n\n` +
      `Your library membership has been successfully renewed.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⏰ *Allotted Timings:* ${vars.hours || '—'} Hours/Day (${vars.timing || 'N/A'})\n` +
      `🪑 *Assigned Seat:* ${vars.seat || 'Unassigned'}\n` +
      `📶 *Wi-Fi Details:* ${vars.wifi || 'N/A'}\n` +
      `💰 *Amount Paid:* ₹${vars.fees}\n` +
      `📅 *New Expiry Date:* ${vars.date}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Keep reading, keep growing! 📖🚀`
    );
  } else if (businessType === 'general') {
    return (
      `*${gymUp} - PLAN RENEWED ✅*\n\n` +
      `Hello *${vars.name}*! Your plan has been renewed.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 *Amount Paid:* ₹${vars.fees}\n` +
      `📅 *Valid Till:* ${vars.date}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Thank you for continuing with ${vars.gym}! 🙏`
    );
  }
  return (
    `*${gymUp} - MEMBERSHIP RENEWED 🔄*\n\n` +
    `Hello *${vars.name}*, thank you for continuing your journey! 💪\n\n` +
    `*RENEWAL DETAILS:*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🗓️ *Plan:* ${vars.durationMonths || ''} Month(s)\n` +
    (vars.hours ? `⏰ *Hours:* ${vars.hours} Hrs\n` : '') +
    (vars.timing ? `🌞 *Timing:* ${vars.timing}\n` : '') +
    `💰 *Amount Paid:* ₹${vars.fees}\n` +
    `📅 *New Expiry:* ${vars.date}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `*Let's push your limits again!* 🚀`
  );
};

/**
 * Builds a reminder WhatsApp message using the custom template or fallback.
 */
export const buildReminderMessage = (
  template: string | null,
  businessType: string,
  vars: { name: string; date: string; fees: number | string; hours?: number; timing?: string; gym: string; seat?: string; }
): string => {
  if (template) {
    return fillTemplate(template, vars);
  }
  const gymUp = vars.gym.toUpperCase();
  if (businessType === 'library') {
    return (
      `*${gymUp} - RENEWAL REMINDER 🔔*\n\n` +
      `Dear *${vars.name}* 📚,\n\n` +
      `This is a gentle reminder that your library membership is due for renewal.\n\n` +
      `💰 *Pending Fees:* ₹${vars.fees}\n` +
      `📅 *Due Date:* ${vars.date}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Please renew your membership to continue accessing your assigned seat (${vars.seat || 'Unassigned'}) and Wi-Fi. Thank you! 🚀`
    );
  } else if (businessType === 'general') {
    return (
      `*${gymUp} - PAYMENT REMINDER 🔔*\n\n` +
      `Hello *${vars.name}*,\n\n` +
      `This is a friendly reminder that your payment is due.\n\n` +
      `*AMOUNT DUE:* ₹${vars.fees}\n` +
      `*DUE DATE:* ${vars.date}\n\n` +
      `Please contact us for renewal. Thank you! 🙏`
    );
  }
  return (
    `*${gymUp} - RENEWAL REMINDER 🔔*\n\n` +
    `Hello *${vars.name}* 💪,\n\n` +
    `Your membership is due for renewal.\n\n` +
    `*PENDING FEES:* ₹${vars.fees} 💰\n` +
    `*DUE DATE:* ${vars.date} 📅\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `*Don't break the momentum!* 🚀\n\n` +
    `See you at the gym! 🏋️‍♂️`
  );
};
