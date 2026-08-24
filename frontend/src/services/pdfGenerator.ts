import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { api } from './api';

export const generateReceiptPDF = async (member: any, payment: any, customSettings?: any) => {
  let settings = customSettings;
  if (!settings) {
    try {
      const res = await api.get('/settings/');
      settings = res.data;
    } catch (e) {
      console.log('Failed to fetch settings for PDF', e);
    }
  }

  // format dates
  const formatD = (dateStr: any) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const receiptDate = formatD(payment.payment_date || payment.date || new Date());
  const startDate = formatD(payment.start_date);
  const endDate = formatD(payment.end_date);
  
  const totalAmount = Number(payment.amount) || 0;
  const amountPaid = payment.amount_paid != null ? Number(payment.amount_paid) : totalAmount;
  const isPartial = amountPaid < totalAmount;
  const dueAmount = isPartial ? totalAmount - amountPaid : 0;

  const gymName = settings?.gym_name || 'My Gym';
  const gymAddress = settings?.address || '';
  const gymLogo = settings?.logo_url || '';
  const gymPhone = settings?.phone || '';
  
  const receiptId = `REC-${String(payment._id || payment.id || Date.now()).slice(-6).toUpperCase()}`;

  const payDays = (payment.start_date && payment.end_date)
    ? Math.max(0, Math.ceil((new Date(payment.end_date).getTime() - new Date(payment.start_date).getTime()) / 86400000))
    : 0;

  // Render a beautiful modern initials badge if no logo is available
  const gymInitials = gymName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Receipt - ${receiptId}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1F2937;
          margin: 0;
          padding: 50px;
          background-color: #ffffff;
          -webkit-print-color-adjust: exact;
        }
        
        .receipt-container {
          max-width: 800px;
          margin: 0 auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #F3F4F6;
          padding-bottom: 24px;
          margin-bottom: 35px;
        }
        
        .brand-section {
          display: flex;
          flex-direction: column;
        }
        
        .aetheron-logo {
          font-size: 24px;
          font-weight: 800;
          color: #4F46E5;
          letter-spacing: -0.8px;
          margin-bottom: 2px;
          display: flex;
          align-items: center;
        }
        
        .aetheron-logo span {
          color: #10B981;
        }
        
        .brand-sub {
          font-size: 10px;
          color: #9CA3AF;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          font-weight: 600;
        }
        
        .gym-section {
          display: flex;
          align-items: center;
          text-align: right;
        }
        
        .gym-info {
          margin-right: 14px;
        }
        
        .gym-name {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
        }
        
        .gym-details {
          font-size: 11px;
          color: #6B7280;
          margin-top: 3px;
          max-width: 220px;
          line-height: 1.4;
        }
        
        .logo-container {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          overflow: hidden;
          background-color: #EEF2F6;
          border: 1px solid #E5E7EB;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gym-logo {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .gym-placeholder {
          font-size: 16px;
          font-weight: 700;
          color: #4F46E5;
        }
        
        .receipt-title-section {
          margin-bottom: 45px;
          position: relative;
        }

        .receipt-badge {
          position: absolute;
          right: 0;
          top: 0;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .status-paid {
          background-color: #ECFDF5;
          color: #047857;
          border: 1px solid #A7F3D0;
        }
        
        .status-partial {
          background-color: #FFFBEB;
          color: #B45309;
          border: 1px solid #FDE68A;
        }
        
        .receipt-title-section h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
          color: #111827;
          letter-spacing: -0.5px;
        }
        
        .receipt-meta {
          font-size: 13px;
          color: #6B7280;
          margin-top: 6px;
          font-weight: 500;
        }

        .receipt-meta span {
          color: #111827;
          font-weight: 600;
        }
        
        .details-grid {
          display: flex;
          justify-content: space-between;
          gap: 50px;
          margin-bottom: 45px;
        }
        
        .details-block {
          flex: 1;
        }
        
        .section-title {
          font-size: 11px;
          font-weight: 700;
          color: #4F46E5;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          border-bottom: 2px solid #EEF2F6;
          padding-bottom: 8px;
          margin-bottom: 15px;
        }
        
        .info-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .info-table td {
          padding: 8px 0;
          font-size: 13px;
          line-height: 1.4;
        }
        
        .info-table td.label {
          color: #6B7280;
          width: 38%;
          font-weight: 500;
        }
        
        .info-table td.value {
          font-weight: 600;
          color: #111827;
        }
        
        .summary-section {
          margin-top: 25px;
        }
        
        .summary-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .summary-table th {
          text-align: left;
          padding-bottom: 12px;
          border-bottom: 2px solid #E5E7EB;
          color: #4B5563;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .summary-table td {
          padding: 18px 0;
          border-bottom: 1px solid #F3F4F6;
          font-size: 13.5px;
          vertical-align: top;
        }
        
        .plan-name-txt {
          font-size: 15px;
          font-weight: 700;
          color: #111827;
        }

        .plan-meta-txt {
          font-size: 11.5px;
          color: #6B7280;
          margin-top: 5px;
          font-weight: 500;
        }

        .offer-badge {
          display: inline-flex;
          align-items: center;
          background-color: #EEF2F6;
          color: #4F46E5;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 10.5px;
          font-weight: 600;
          margin-top: 8px;
        }

        .total-row {
          font-weight: 600;
        }
        
        .total-row td {
          border-bottom: none;
          padding: 12px 0;
          font-size: 13px;
          color: #4B5563;
        }
        
        .grand-total-row {
          font-weight: 800;
          border-top: 2px solid #F3F4F6;
        }

        .grand-total-row td {
          padding-top: 18px;
          font-size: 15px;
          color: #111827;
        }

        .grand-total-val {
          font-size: 20px;
          color: #4F46E5;
          font-weight: 800;
        }

        .footer {
          margin-top: 90px;
          text-align: center;
          color: #9CA3AF;
          font-size: 11px;
          border-top: 1px solid #F3F4F6;
          padding-top: 24px;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="header">
          <div class="brand-section">
            <div class="aetheron-logo">AETHERON<span>.</span></div>
            <div class="brand-sub">Management Systems</div>
          </div>
          <div class="gym-section">
            <div class="gym-info">
              <div class="gym-name">${gymName}</div>
              <div class="gym-details">
                ${gymAddress ? `${gymAddress}<br/>` : ''}
                ${gymPhone ? `Phone: ${gymPhone}` : ''}
              </div>
            </div>
            <div class="logo-container">
              ${gymLogo ? `<img src="${gymLogo}" class="gym-logo" />` : `<span class="gym-placeholder">${gymInitials}</span>`}
            </div>
          </div>
        </div>

        <div class="receipt-title-section">
          <h1>Payment Receipt</h1>
          <div class="receipt-meta">Receipt ID: <span>#${receiptId}</span> &nbsp;&bull;&nbsp; Date: <span>${receiptDate}</span></div>
          <div class="receipt-badge ${isPartial ? 'status-partial' : 'status-paid'}">
            ${isPartial ? 'Partial Payment' : 'Fully Paid'}
          </div>
        </div>

        <div class="details-grid">
          <div class="details-block">
            <div class="section-title">Billed To</div>
            <table class="info-table">
              <tr>
                <td class="label">Member Name:</td>
                <td class="value">${member.full_name || 'N/A'}</td>
              </tr>
              <tr>
                <td class="label">Phone:</td>
                <td class="value">${member.phone || 'N/A'}</td>
              </tr>
              <tr>
                <td class="label">Member ID:</td>
                <td class="value">${member.member_id || 'N/A'}</td>
              </tr>
              ${member.allocated_seat ? `
              <tr>
                <td class="label">Seat Number:</td>
                <td class="value">${member.allocated_seat}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          
          <div class="details-block">
            <div class="section-title">Payment Info</div>
            <table class="info-table">
              <tr>
                <td class="label">Payment Date:</td>
                <td class="value">${receiptDate}</td>
              </tr>
              <tr>
                <td class="label">Payment Mode:</td>
                <td class="value">${payment.payment_mode || 'Cash'}</td>
              </tr>
              <tr>
                <td class="label">Transaction Type:</td>
                <td class="value">Renewal Membership</td>
              </tr>
            </table>
          </div>
        </div>

        <div class="summary-section">
          <div class="section-title">Plan Summary</div>
          <table class="summary-table">
            <thead>
              <tr>
                <th style="width: 55%;">Plan Description</th>
                <th style="text-align: center; width: 20%;">Duration</th>
                <th style="text-align: right; width: 25%;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div class="plan-name-txt">${payment.plan_name || member.plan_name || 'Membership Plan'}</div>
                  <div class="plan-meta-txt">
                    Validity: <span>${startDate}</span> to <span>${endDate}</span>
                  </div>
                  ${payment.applied_offer_name || member.applied_offer_name ? `
                  <div class="offer-badge">
                    🎁 Applied Offer: ${payment.applied_offer_name || member.applied_offer_name}
                  </div>
                  ` : ''}
                </td>
                <td style="text-align: center; font-weight: 600; color: #4B5563;">${payDays} Days</td>
                <td style="text-align: right; font-weight: 700; color: #111827;">₹${totalAmount.toLocaleString('en-IN')}</td>
              </tr>
              
              <tr class="total-row" style="height: 15px;">
                <td colspan="3"></td>
              </tr>
              <tr class="total-row">
                <td colspan="2" style="text-align: right;">Subtotal:</td>
                <td style="text-align: right; font-weight: 600; color: #111827;">₹${totalAmount.toLocaleString('en-IN')}</td>
              </tr>
              <tr class="total-row">
                <td colspan="2" style="text-align: right;">Amount Paid:</td>
                <td style="text-align: right; font-weight: 700; color: #10B981;">₹${amountPaid.toLocaleString('en-IN')}</td>
              </tr>
              ${isPartial ? `
              <tr class="total-row" style="color: #EF4444;">
                <td colspan="2" style="text-align: right;">Balance Due:</td>
                <td style="text-align: right; font-weight: 700; color: #EF4444;">₹${dueAmount.toLocaleString('en-IN')}</td>
              </tr>
              ` : ''}
              
              <tr class="grand-total-row">
                <td colspan="2" style="text-align: right; font-weight: 700;">Grand Total:</td>
                <td style="text-align: right;" class="grand-total-val">₹${amountPaid.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p>Thank you for your business! This is a computer-generated receipt and does not require a physical signature.</p>
          <p style="margin-top: 6px; font-size: 10px; color: #9CA3AF;">Powered by Aetheron Management System</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    return true;
  } catch (error) {
    console.error('Error generating PDF receipt', error);
    return false;
  }
};
