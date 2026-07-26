import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Fetches message templates from settings API.
 * Returns an object with joining, renewal, reminder templates + metadata.
 */
export const fetchMessageTemplates = async () => {
  try {
    const response = await api.get('/settings/');
    let joiningTemplate = response.data.joining_msg_template || null;
    let renewalTemplate = response.data.renewal_msg_template || null;
    let reminderTemplate = response.data.reminder_msg_template || null;

    const isLegacy = (t: string | null) => {
      if (!t) return true;
      return t.includes('RENEWAL REMINDER 🔔') || 
             t.includes('PAYMENT REMINDER 🔔') || 
             t.includes('MEMBERSHIP CONFIRMATION 📚') || 
             t.includes('SERVICE ACTIVATED ✅') || 
             t.includes('WELCOME KIT 🧾') || 
             t.includes('MEMBERSHIP RENEWED 🔄') || 
             t.includes('MEMBERSHIP RENEWED 📚') || 
             t.includes('PLAN RENEWED ✅');
    };

    if (isLegacy(joiningTemplate)) joiningTemplate = null;
    if (isLegacy(renewalTemplate)) renewalTemplate = null;
    if (isLegacy(reminderTemplate)) reminderTemplate = null;

    return {
      businessType: response.data.business_type || 'gym',
      enableHours: response.data.enable_hours_feature || false,
      gymName: response.data.gym_name || 'Gym',
      joiningTemplate: null as string | null, // Force premium format
      renewalTemplate: null as string | null, // Force premium format
      reminderTemplate: null as string | null, // Force premium format
      wifiNetworks: response.data.wifi_networks || [],
    };
  } catch {
    const gymName = await AsyncStorage.getItem('gymName') || 'Gym';
    const businessType = await AsyncStorage.getItem('businessType') || 'gym';
    return { businessType, enableHours: false, gymName, joiningTemplate: null as string | null, renewalTemplate: null as string | null, reminderTemplate: null as string | null, wifiNetworks: [] };
  }
};

/**
 * Returns raw default template strings based on business type.
 */
export const getDefaultTemplates = (businessType: string) => {
  if (businessType === 'library') {
    return {
      joining: `*{library_name} - MEMBERSHIP CONFIRMATION 📚*\n\nDear *{name}*,\n\nWelcome to {library_name}! Your membership has been successfully registered. We are committed to providing you with a silent and productive study environment.\n\n━━━━━━━━━━━━━━━━━━━━\n👤 *Member Phone:* {phone}\n📅 *Joining Date:* {joining_date}\n⏰ *Allotted Timings:* {hours} Hours/Day ({timing})\n🪑 *Assigned Seat:* {seat}\n📶 *Wi-Fi Details:* {wifi}\n💰 *Fees Paid:* ₹{fees}\n📅 *Valid Till:* {date}\n━━━━━━━━━━━━━━━━━━━━\n\nPlease maintain silence inside the premises. Happy studying! 🚀`,
      renewal: `*{library_name} - MEMBERSHIP RENEWED 📚*\n\nDear *{name}*,\n\nYour library membership has been successfully renewed.\n\n━━━━━━━━━━━━━━━━━━━━\n📅 *Renewed From:* {joining_date}\n⏰ *Allotted Timings:* {hours} Hours/Day ({timing})\n🪑 *Assigned Seat:* {seat}\n📶 *Wi-Fi Details:* {wifi}\n💰 *Amount Paid:* ₹{fees}\n📅 *New Expiry Date:* {date}\n━━━━━━━━━━━━━━━━━━━━\n\nKeep reading, keep growing! 📖🚀`,
      reminder: `*{library_name} - RENEWAL REMINDER 🔔*\n\nDear *{name}* 📚,\n\nThis is a gentle reminder that your library membership is due for renewal.\n\n💰 *Pending Fees:* ₹{fees}\n📅 *Due Date:* {date}\n━━━━━━━━━━━━━━━━━━━━\n\nPlease renew your membership to continue accessing your assigned seat ({seat}) and Wi-Fi. Thank you! 🚀`
    };
  } else if (businessType === 'general') {
    return {
      joining: `*{business_name} - SERVICE ACTIVATED ✅*\n\nHello *{name}*!\n\n━━━━━━━━━━━━━━━━━━━━\n📅 *Date:* {joining_date}\n⭐ *Plan:* {plan_name}\n💰 *Amount Paid:* ₹{fees}\n📅 *Valid Till:* {date}\n━━━━━━━━━━━━━━━━━━━━\n\nThank you for choosing {business_name}! 🙏`,
      renewal: `*{business_name} - PLAN RENEWED ✅*\n\nHello *{name}*! Your plan has been renewed.\n\n━━━━━━━━━━━━━━━━━━━━\n📅 *Renewed From:* {joining_date}\n⭐ *Plan:* {plan_name}\n💰 *Amount Paid:* ₹{fees}\n📅 *Valid Till:* {date}\n━━━━━━━━━━━━━━━━━━━━\n\nThank you for continuing with {business_name}! 🙏`,
      reminder: `*{business_name} - PAYMENT REMINDER 🔔*\n\nHello *{name}*,\n\nThis is a friendly reminder that your payment is due.\n\n*AMOUNT DUE:* ₹{fees}\n*DUE DATE:* {date}\n\nPlease contact us for renewal. Thank you! 🙏`
    };
  }
  return {
    joining: `*{gym_name} - WELCOME KIT 🧾*\n\nHello *{name}*, welcome to {gym_name}! 💪\n\n*MEMBERSHIP DETAILS:*\n━━━━━━━━━━━━━━━━━━━━\n📱 *Phone:* {phone}\n📅 *Joining Date:* {joining_date}\n⭐ *Plan:* {plan_name}\n💰 *Amount Paid:* ₹{fees}\n📅 *Expiry Date:* {date}\n━━━━━━━━━━━━━━━━━━━━\n\n*Stay Strong & Crush Your Goals!* 🚀`,
    renewal: `*{gym_name} - MEMBERSHIP RENEWED 🔄*\n\nHello *{name}*, thank you for continuing your journey! 💪\n\n*RENEWAL DETAILS:*\n━━━━━━━━━━━━━━━━━━━━\n📅 *Renewed From:* {joining_date}\n⭐ *Plan:* {plan_name}\n💰 *Amount Paid:* ₹{fees}\n📅 *New Expiry:* {date}\n━━━━━━━━━━━━━━━━━━━━\n\n*Let's push your limits again!* 🚀`,
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
  plan_name?: string;
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
    .replace(/\{plan_name\}/g, vars.plan_name && vars.plan_name !== 'Custom' ? vars.plan_name : 'Custom Plan')
    .replace(/\{gym\}|\{library_name\}|\{business_name\}|\{gym_name\}/g, vars.gym || '');

  // Auto-inject joining_date, timing, and hours if they exist but template is missing them
  if ((vars.joining_date && !template.includes('{joining_date}')) || (vars.timing && !template.includes('{timing}')) || (vars.hours && !template.includes('{hours}')) || (vars.seat && !template.includes('{seat}')) || (vars.wifi && !template.includes('{wifi}')) || (vars.plan_name && vars.plan_name !== 'Custom' && !template.includes('{plan_name}'))) {
    let extraStr = '';
    if (vars.joining_date && !template.includes('{joining_date}')) extraStr += `\n📅 *Date:* ${vars.joining_date}`;
    if (vars.plan_name && vars.plan_name !== 'Custom' && !template.includes('{plan_name}')) extraStr += `\n⭐ *Plan:* ${vars.plan_name}`;
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
 * Builds a joining/enrollment WhatsApp message.
 * If partial payment → separate message format showing total, paid, and due.
 * If full payment → no partial fields shown at all.
 */
export const buildJoiningMessage = (
  template: string | null,
  businessType: string,
  vars: {
    name: string;
    phone: string;
    date: string;
    joining_date: string;
    paid_date?: string;
    fees: number | string;        // total plan amount
    amountPaid?: number | string; // paid amount (undefined = full payment)
    hours?: number;
    timing?: string;
    gym: string;
    durationDays?: number;
    seat?: string;
    wifi?: string;
    plan_name?: string;
  }
): string => {
  const totalAmount = Number(vars.fees);
  const paidAmount = vars.amountPaid != null ? Number(vars.amountPaid) : totalAmount;
  const isPartial = paidAmount < totalAmount;
  const dueAmount = isPartial ? (totalAmount - paidAmount).toFixed(0) : 0;

  if (!isPartial && template) {
    return fillTemplate(template, { ...vars, fees: totalAmount });
  }

  const gymUp = vars.gym.toUpperCase();
  const receiptId = `ENR-${Date.now().toString().slice(-6)}`;

  const header = businessType === 'library'
    ? `📚 *${gymUp}*`
    : businessType === 'general'
    ? `🏢 *${gymUp}*`
    : `🏋️ *${gymUp}*`;

  const footer = businessType === 'library'
    ? `Happy studying! 📖🚀`
    : businessType === 'general'
    ? `Thank you for choosing us! 🙏`
    : `Stay strong & crush your goals! 💪🚀`;

  return (
    `${header}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎉 *MEMBERSHIP CONFIRMATION*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Dear *${vars.name}*,\n` +
    `Welcome to ${vars.gym}! Your membership has been successfully registered.\n\n` +
    `📋 *Enrollment ID:* #${receiptId}\n` +
    `📅 *Joining Date:* ${vars.joining_date}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *MEMBER DETAILS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📱 *Phone:* ${vars.phone}\n` +
    (vars.seat ? `🪑 *Seat:* ${vars.seat}\n` : '') +
    (vars.hours ? `⏰ *Timing:* ${vars.hours} Hrs/Day (${vars.timing || 'N/A'})\n` : '') +
    (vars.wifi ? `📶 *Wi-Fi:* ${vars.wifi}\n` : '') +
    `\n━━━━━━━━━━━━━━━━━━━━\n` +
    `📆 *PLAN DETAILS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    (vars.plan_name && vars.plan_name !== 'Custom' ? `⭐ *Plan:* ${vars.plan_name}\n` : '') +
    (vars.durationDays ? `🗓️ *Plan Period:* ${vars.durationDays} Days\n` : '') +
    `🔚 *Valid Till:* ${vars.date}\n` +
    `\n━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *PAYMENT SUMMARY*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏷️ *Total Amount:* ₹${totalAmount}\n` +
    `✅ *Amount Paid:* ₹${paidAmount}\n` +
    (isPartial ? `⚠️ *Balance Due:* ₹${dueAmount}\n` : `🎉 *Status:* Fully Paid ✔️\n`) +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${footer}`
  );
};

/**
 * Builds a renewal WhatsApp message.
 * If partial payment → separate message format showing renewal date, expiry date, total, paid, due.
 * If full payment → shows renewal date + expiry date, no partial fields.
 */
export const buildRenewalMessage = (
  template: string | null,
  businessType: string,
  vars: {
    name: string;
    phone: string;
    date: string;           // expiry date
    joining_date?: string;  // renewal/start date
    paid_date?: string;
    fees: number | string;  // total plan amount
    amountPaid?: number | string; // paid amount (undefined = full payment)
    hours?: number;
    timing?: string;
    gym: string;
    durationMonths?: number;
    seat?: string;
    wifi?: string;
    plan_name?: string;
  }
): string => {
  const totalAmount = Number(vars.fees);
  const paidAmount = vars.amountPaid != null ? Number(vars.amountPaid) : totalAmount;
  const isPartial = paidAmount < totalAmount;
  const dueAmount = isPartial ? (totalAmount - paidAmount).toFixed(0) : 0;

  if (!isPartial && template) {
    return fillTemplate(template, { ...vars, fees: totalAmount });
  }

  const gymUp = vars.gym.toUpperCase();
  const receiptId = `REN-${Date.now().toString().slice(-6)}`;
  const renewalDate = vars.joining_date || 'N/A';
  const expiryDate = vars.date;

  const header = businessType === 'library'
    ? `📚 *${gymUp}*`
    : businessType === 'general'
    ? `🏢 *${gymUp}*`
    : `🏋️ *${gymUp}*`;

  const footer = businessType === 'library'
    ? `Keep reading, keep growing! 📖🚀`
    : businessType === 'general'
    ? `Thank you for continuing with us! 🙏`
    : `Let's push your limits again! 💪🚀`;

  return (
    `${header}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔄 *MEMBERSHIP RENEWED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Dear *${vars.name}*,\n` +
    `Your membership has been successfully renewed. Thank you for continuing your journey!\n\n` +
    `📋 *Renewal ID:* #${receiptId}\n` +
    `📅 *Renewal Date:* ${renewalDate}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *MEMBER DETAILS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📱 *Phone:* ${vars.phone}\n` +
    (vars.seat ? `🪑 *Seat:* ${vars.seat}\n` : '') +
    (vars.hours ? `⏰ *Timing:* ${vars.hours} Hrs/Day (${vars.timing || 'N/A'})\n` : '') +
    (vars.wifi ? `📶 *Wi-Fi:* ${vars.wifi}\n` : '') +
    `\n━━━━━━━━━━━━━━━━━━━━\n` +
    `📆 *PLAN DETAILS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    (vars.plan_name && vars.plan_name !== 'Custom' ? `⭐ *Plan:* ${vars.plan_name}\n` : '') +
    (vars.durationMonths ? `🗓️ *Plan Period:* ${vars.durationMonths} Month(s)\n` : '') +
    `▶️ *Start Date:* ${renewalDate}\n` +
    `🔚 *Expiry Date:* ${expiryDate}\n` +
    `\n━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *PAYMENT SUMMARY*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏷️ *Total Amount:* ₹${totalAmount}\n` +
    `✅ *Amount Paid:* ₹${paidAmount}\n` +
    (isPartial ? `⚠️ *Balance Due:* ₹${dueAmount}\n` : `🎉 *Status:* Fully Paid ✔️\n`) +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${footer}`
  );
};

/**
 * Builds a premium PAYMENT RECEIPT WhatsApp message.
 * Used from Payment History → "Send Receipt".
 * Looks like a formal invoice/receipt — not a renewal message.
 */
export const buildPaymentReceiptMessage = (
  businessType: string,
  vars: {
    name: string;
    phone: string;
    gym: string;
    paymentDate: string;      // date payment was made
    startDate: string;        // plan start date
    expiryDate: string;       // plan expiry date
    totalAmount: number | string;
    amountPaid: number | string;
    paymentMode: string;
    durationDays: number;
    hours?: number;
    timing?: string;
    seat?: string;
    wifi?: string;
    plan_name?: string;
  }
): string => {
  const gymUp = vars.gym.toUpperCase();
  const total = Number(vars.totalAmount);
  const paid = Number(vars.amountPaid);
  const due = Math.max(0, total - paid);
  const isPartial = due > 0;
  const receiptId = `RCP-${Date.now().toString().slice(-6)}`;

  const header = businessType === 'library'
    ? `📚 *${gymUp}*`
    : businessType === 'general'
    ? `🏢 *${gymUp}*`
    : `🏋️ *${gymUp}*`;

  const footer = businessType === 'library'
    ? `Keep reading, keep growing! 📖`
    : businessType === 'general'
    ? `Thank you for your continued trust! 🙏`
    : `Stay strong & crush your goals! 💪`;

  return (
    `${header}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🧾 *PAYMENT RECEIPT*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Dear *${vars.name}*,\n` +
    `We have received your payment. Here are the details:\n\n` +
    `📋 *Receipt ID:* #${receiptId}\n` +
    `📅 *Payment Date:* ${vars.paymentDate}\n` +
    `💳 *Payment Mode:* ${vars.paymentMode}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *MEMBER DETAILS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📱 *Phone:* ${vars.phone}\n` +
    (vars.seat ? `🪑 *Seat:* ${vars.seat}\n` : '') +
    (vars.hours ? `⏰ *Timing:* ${vars.hours} Hrs/Day (${vars.timing || 'N/A'})\n` : '') +
    (vars.wifi ? `📶 *Wi-Fi:* ${vars.wifi}\n` : '') +
    `\n━━━━━━━━━━━━━━━━━━━━\n` +
    `📆 *PLAN DETAILS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    (vars.plan_name && vars.plan_name !== 'Custom' ? `⭐ *Plan:* ${vars.plan_name}\n` : '') +
    `🗓️ *Plan Period:* ${vars.durationDays} Days\n` +
    `▶️ *Start Date:* ${vars.startDate}\n` +
    `🔚 *Expiry Date:* ${vars.expiryDate}\n` +
    `\n━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *PAYMENT SUMMARY*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏷️ *Total Amount:* ₹${total}\n` +
    `✅ *Amount Paid:* ₹${paid}\n` +
    (isPartial ? `⚠️ *Balance Due:* ₹${due}\n` : `🎉 *Status:* Fully Paid ✔️\n`) +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${footer}`
  );
};

/**
 * Builds a reminder WhatsApp message using the custom template or fallback.
 */
export const buildReminderMessage = (
  template: string | null,
  businessType: string,
  vars: { name: string; date: string; fees: number | string; hours?: number; timing?: string; gym: string; seat?: string; isExpired?: boolean; }
): string => {
  if (template) {
    return fillTemplate(template, vars);
  }
  const gymUp = vars.gym.toUpperCase();
  const header = businessType === 'library'
    ? `📚 *${gymUp}*`
    : businessType === 'general'
    ? `🏢 *${gymUp}*`
    : `🏋️ *${gymUp}*`;

  const footer = businessType === 'library'
    ? `Please renew soon to keep your seat! 📖`
    : businessType === 'general'
    ? `Please contact us for renewal. 🙏`
    : `Don't break the momentum! See you at the gym! 💪`;

  const statusTitle = vars.isExpired ? `🚨 *MEMBERSHIP EXPIRED*` : `🔔 *RENEWAL REMINDER*`;
  const introText = vars.isExpired 
    ? `Your membership expired on ${vars.date}. Please renew it to continue your services.`
    : `This is a gentle reminder that your membership is due for renewal on ${vars.date}.`;

  return (
    `${header}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${statusTitle}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Dear *${vars.name}*,\n` +
    `${introText}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *MEMBER DETAILS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    (vars.seat ? `🪑 *Seat:* ${vars.seat}\n` : '') +
    (vars.hours ? `⏰ *Timing:* ${vars.hours} Hrs/Day (${vars.timing || 'N/A'})\n` : '') +
    `\n━━━━━━━━━━━━━━━━━━━━\n` +
    `⚠️ *DUE DETAILS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📅 *Due Date:* ${vars.date}\n` +
    `💰 *Pending Fees:* ₹${vars.fees}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${footer}`
  );
};
