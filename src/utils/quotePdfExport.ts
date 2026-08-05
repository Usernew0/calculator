import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CalculationResult } from '../types';
import { formatCurrency } from '../data/currencies';
import { Language } from '../data/translations';

export interface ClientQuoteData {
  quoteRef: string;
  quoteDate: string;
  validityDays: number;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  sellerCompany: string;
  sellerAddress: string;
  sellerTaxId: string;
  sellerPhone: string;
  incoterms: string;
  paymentTerms: string;
  includeBreakdown: boolean;
  notes: string;
}

export async function generateClientQuotePDFBlob(
  result: CalculationResult,
  quote: ClientQuoteData,
  lang: Language = 'en'
): Promise<{ blob: Blob; fileName: string; pdf: jsPDF }> {
  const isArabic = lang === 'ar';
  const input = result.input;
  const targetCurr = input.targetCurrency;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '800px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Cairo, Tajawal, "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  container.style.direction = isArabic ? 'rtl' : 'ltr';
  container.style.padding = '32px';
  container.style.boxSizing = 'border-box';

  const expiryDate = new Date(new Date(quote.quoteDate).getTime() + quote.validityDays * 24 * 60 * 60 * 1000).toLocaleDateString(
    isArabic ? 'ar-EG' : 'en-US'
  );

  container.innerHTML = `
    <div style="border: 2px solid #0f172a; border-radius: 16px; overflow: hidden; background: #ffffff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
      <!-- Top Brand Header -->
      <div style="background: #0f172a; color: #ffffff; padding: 28px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-size: 22px; font-weight: 900; color: #38bdf8; letter-spacing: -0.5px;">${quote.sellerCompany || 'GLOBAL CARGO LOGISTICS LTD'}</div>
          ${quote.sellerAddress ? `<div style="font-size: 11px; color: #cbd5e1; margin-top: 4px;">${quote.sellerAddress}</div>` : ''}
          ${(quote.sellerTaxId || quote.sellerPhone) ? `
            <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
              ${[
                quote.sellerTaxId ? `Tax Reg: ${quote.sellerTaxId}` : '',
                quote.sellerPhone ? `Tel: ${quote.sellerPhone}` : ''
              ].filter(Boolean).join(' | ')}
            </div>
          ` : ''}
        </div>
        <div style="text-align: ${isArabic ? 'left' : 'right'}; font-family: monospace;">
          <div style="background: #0284c7; color: #ffffff; padding: 4px 12px; border-radius: 6px; font-[900]; font-size: 14px; text-transform: uppercase; display: inline-block;">
            ${isArabic ? 'عرض سعر تجاري' : 'COMMERCIAL QUOTATION'}
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #38bdf8; margin-top: 8px;">${quote.quoteRef}</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">${isArabic ? 'التاريخ:' : 'Date:'} ${quote.quoteDate}</div>
        </div>
      </div>

      <div style="padding: 24px;">
        <!-- Client & Meta Info Card -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px;">
            <div style="font-size: 10px; font-weight: 800; color: #0284c7; text-transform: uppercase; margin-bottom: 6px;">${isArabic ? 'بيانات العميل (Prepared For):' : 'PREPARED FOR CLIENT:'}</div>
            <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${quote.clientName || (isArabic ? 'عميل كريم' : 'Valued Client')}</div>
            <div style="font-size: 12px; font-weight: 700; color: #334155;">${quote.clientCompany || 'Corporate Procurement Dept'}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${quote.clientEmail || 'procurement@client.com'}</div>
          </div>

          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px;">
            <div style="font-size: 10px; font-weight: 800; color: #0284c7; text-transform: uppercase; margin-bottom: 6px;">${isArabic ? 'شروط العرض والتسليم:' : 'TERMS & INCOTERMS:'}</div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a;">Incoterms: <span style="color: #0284c7;">${quote.incoterms}</span></div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px;">${isArabic ? 'شروط الدفع:' : 'Payment:'} ${quote.paymentTerms}</div>
            <div style="font-size: 11px; color: #e11d48; font-weight: 800; margin-top: 4px;">${isArabic ? 'صلاحية العرض حتى:' : 'Valid Until:'} ${expiryDate} (${quote.validityDays} ${isArabic ? 'يوم' : 'Days'})</div>
          </div>
        </div>

        <!-- Product Details -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 8px;">${isArabic ? 'تفاصيل البضاعة والكمية المطلوب عرضها:' : 'OFFERED ITEM & FREIGHT SPECIFICATIONS:'}</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: ${isArabic ? 'right' : 'left'};">
            <thead>
              <tr style="background: #0f172a; color: #ffffff;">
                <th style="padding: 10px; border: 1px solid #1e293b;">${isArabic ? 'الوصف والمنتج' : 'Item Description'}</th>
                <th style="padding: 10px; border: 1px solid #1e293b; text-align: center;">${isArabic ? 'الكمية' : 'Qty'}</th>
                <th style="padding: 10px; border: 1px solid #1e293b; text-align: center;">${isArabic ? 'وسيلة الشحن' : 'Freight Mode'}</th>
                <th style="padding: 10px; border: 1px solid #1e293b; text-align: ${isArabic ? 'left' : 'right'};">${isArabic ? 'السعر الفردي للقطعة' : 'Unit Price'}</th>
                <th style="padding: 10px; border: 1px solid #1e293b; text-align: ${isArabic ? 'left' : 'right'};">${isArabic ? 'إجمالي قيمة العرض' : 'Total Quote Price'}</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: #ffffff;">
                <td style="padding: 12px 10px; border: 1px solid #e2e8f0; font-weight: 800; font-size: 12px;">
                  ${input.title || (isArabic ? 'شحنة بضائع' : 'General Cargo Line Item')}
                  <div style="font-size: 10px; font-weight: 500; color: #64748b; margin-top: 2px;">SKU: ${input.skuSupplier || 'GENERAL-SKU'} | Category: ${input.category || 'General Cargo'}</div>
                </td>
                <td style="padding: 12px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; font-size: 13px;">${input.quantity.toLocaleString()}</td>
                <td style="padding: 12px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 700;">${input.freightMethod.toUpperCase().replace('_', ' ')}</td>
                <td style="padding: 12px 10px; border: 1px solid #e2e8f0; font-weight: 800; text-align: ${isArabic ? 'left' : 'right'}; color: #0284c7;">
                  ${formatCurrency(result.suggestedSellingPricePerUnitTarget, targetCurr)}
                </td>
                <td style="padding: 12px 10px; border: 1px solid #e2e8f0; font-weight: 900; text-align: ${isArabic ? 'left' : 'right'}; color: #0f172a; font-size: 13px;">
                  ${formatCurrency(result.totalRevenueTarget, targetCurr)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        ${quote.includeBreakdown ? `
          <!-- Optional Itemized Breakdown Table -->
          <div style="margin-bottom: 20px;">
            <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 6px;">${isArabic ? 'تحليل التكلفة التقديرية المشمولة بالعرض:' : 'INCLUDED COST BREAKDOWN COMPONENTS:'}</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 10px; background: #f1f5f9; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1;">
              <div>• Base Product Cost: <strong>${formatCurrency(result.totalOriginalPriceTarget, targetCurr)}</strong></div>
              <div>• Freight & Transport: <strong>${formatCurrency(result.freightCostTarget, targetCurr)}</strong></div>
              <div>• Customs Duties & Fees: <strong>${formatCurrency(result.dutyCostTarget + result.customsClearanceTarget, targetCurr)}</strong></div>
            </div>
          </div>
        ` : ''}

        <!-- Total Grand Summary Highlight -->
        <div style="background: #0f172a; color: #ffffff; padding: 16px 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <div style="font-size: 10px; font-weight: 800; color: #38bdf8; text-transform: uppercase;">${isArabic ? 'إجمالي قيمة العقد / العرض الشامل' : 'TOTAL OFFER VALUE (ALL INCLUSIVE)'}</div>
            <div style="font-size: 11px; color: #cbd5e1; margin-top: 2px;">Incoterms (${quote.incoterms}) - Delivery included to client destination</div>
          </div>
          <div style="font-size: 22px; font-weight: 900; color: #38bdf8; font-family: monospace;">
            ${formatCurrency(result.totalRevenueTarget, targetCurr)}
          </div>
        </div>

        <!-- Notes and Authorization Signatures -->
        <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; border-t: 1px solid #e2e8f0; padding-top: 16px;">
          <div style="font-size: 10px; color: #475569;">
            <strong style="color: #0f172a; text-transform: uppercase;">${isArabic ? 'ملاحظات وأحكام العرض:' : 'TERMS & SPECIAL NOTES:'}</strong>
            <p style="margin-top: 4px; line-height: 1.5;">${quote.notes || (isArabic ? 'أسعار الشحن والجمارك خاضعة لتقلبات السوق وتأكيدات خطوط الملاحة.' : 'Prices subject to market exchange rate stability & carrier space availability.')}</p>
          </div>

          <div style="text-align: center; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px;">
            <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">${isArabic ? 'التوقيع والاعتماد الرسمي' : 'AUTHORIZED SIGNATURE & STAMP'}</div>
            <div style="height: 36px; margin: 8px 0; border-b: 1px solid #cbd5e1;"></div>
            <div style="font-size: 10px; font-weight: 700; color: #0f172a;">${quote.sellerCompany || 'Sales & Trade Operations'}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    if (document.fonts) {
      await document.fonts.ready;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = 210;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    const cleanClientName = (quote.clientName || 'Client').replace(/[^\w\u0600-\u06FF]/g, '_');
    const fileName = `Commercial_Quote_${quote.quoteRef}_${cleanClientName}.pdf`;
    const blob = pdf.output('blob');

    return { blob, fileName, pdf };
  } finally {
    document.body.removeChild(container);
  }
}

export async function exportClientQuotePDF(
  result: CalculationResult,
  quote: ClientQuoteData,
  lang: Language = 'en'
): Promise<void> {
  try {
    const { pdf, fileName } = await generateClientQuotePDFBlob(result, quote, lang);
    pdf.save(fileName);
  } catch (error) {
    console.error('Error generating Quote PDF:', error);
  }
}

export async function shareClientQuotePDFWhatsApp(
  result: CalculationResult,
  quote: ClientQuoteData,
  lang: Language = 'en'
): Promise<void> {
  const isArabic = lang === 'ar';
  try {
    const { blob, fileName, pdf } = await generateClientQuotePDFBlob(result, quote, lang);
    const file = new File([blob], fileName, { type: 'application/pdf' });
    const targetCurr = result.input.targetCurrency;
    const totalPriceFormatted = formatCurrency(result.totalRevenueTarget, targetCurr);

    const summaryText = isArabic
      ? `📄 *عرض سعر تجاري - ${quote.sellerCompany || 'Global Trade'}*\n` +
        `• رقم العرض: ${quote.quoteRef}\n` +
        `• العميل: ${quote.clientName || 'عميل كريم'} (${quote.clientCompany || '-'})\n` +
        `• الصنف: ${result.input.title || 'شحنة بضائع'} (${result.input.quantity.toLocaleString()} قطعة)\n` +
        `• إجمالي قيمة العرض: ${totalPriceFormatted}\n` +
        `• شرط التسليم: ${quote.incoterms} | الصلاحية: ${quote.validityDays} يوم`
      : `📄 *COMMERCIAL QUOTATION - ${quote.sellerCompany || 'Global Trade'}*\n` +
        `• Ref: ${quote.quoteRef}\n` +
        `• Client: ${quote.clientName || 'Valued Client'} (${quote.clientCompany || '-'})\n` +
        `• Item: ${result.input.title || 'Cargo Shipment'} (${result.input.quantity.toLocaleString()} units)\n` +
        `• Total Offer: ${totalPriceFormatted}\n` +
        `• Incoterms: ${quote.incoterms} | Validity: ${quote.validityDays} Days`;

    // Try Web Share API with PDF file
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: isArabic ? `عرض سعر تجاري ${quote.quoteRef}` : `Commercial Quotation ${quote.quoteRef}`,
          text: summaryText,
          files: [file],
        });
        return;
      } catch (shareError: any) {
        if (shareError.name === 'AbortError') return; // User cancelled share dialog
        console.warn('Web share error, falling back to direct download + WhatsApp text', shareError);
      }
    }

    // Fallback for browsers that don't support file sharing via Web Share API:
    // 1. Download the PDF file automatically
    pdf.save(fileName);

    // 2. Open WhatsApp link with pre-filled message + notification that PDF has been saved
    const attachmentNotice = isArabic
      ? `\n\n*(ملاحظة: تم حفظ ملف الـ PDF الخاص بعرض السعر على جهازك لإرفاقه مباشرة بالمحادثة)*`
      : `\n\n*(Note: PDF Quote file has been saved to your downloads to attach directly to this chat)*`;

    const fullWhatsappMessage = encodeURIComponent(summaryText + attachmentNotice);
    window.open(`https://api.whatsapp.com/send?text=${fullWhatsappMessage}`, '_blank');
  } catch (error) {
    console.error('Error sharing Quote PDF to WhatsApp:', error);
    alert(isArabic ? 'حدث خطأ أثناء إعداد عرض السعر' : 'Error generating quote PDF for WhatsApp');
  }
}
