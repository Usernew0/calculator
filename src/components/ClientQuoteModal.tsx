import React, { useState } from 'react';
import { CalculationResult } from '../types';
import { formatCurrency } from '../data/currencies';
import { Language } from '../data/translations';
import { exportClientQuotePDF, shareClientQuotePDFWhatsApp, ClientQuoteData } from '../utils/quotePdfExport';
import { X, FileText, Download, Copy, Check, Printer, Building2, User, Calendar, ShieldCheck, Mail, Phone, FileCheck, Loader2 } from 'lucide-react';

const WhatsappIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12.012 2c-5.506 0-9.989 4.478-9.989 9.984 0 1.762.459 3.48 1.332 5.001L2 22l5.132-1.333c1.472.793 3.125 1.213 4.88 1.213 5.505 0 9.988-4.478 9.988-9.984 0-5.506-4.483-9.996-9.988-9.996zm0 18.293c-1.53 0-3.031-.412-4.348-1.192l-.312-.186-3.23.839.854-3.149-.204-.325A8.258 8.258 0 013.72 11.98c0-4.57 3.719-8.287 8.292-8.287 4.57 0 8.287 3.717 8.287 8.287 0 4.57-3.717 8.288-8.287 8.288zm4.542-6.208c-.249-.124-1.472-.727-1.7-.81-.228-.083-.394-.124-.56.124-.166.249-.643.81-.788.976-.145.166-.29.187-.539.062-.249-.124-1.053-.388-2.006-1.238-.742-.662-1.243-1.48-1.388-1.729-.145-.249-.015-.384.109-.507.112-.111.249-.29.373-.435.124-.145.166-.249.249-.415.083-.166.042-.311-.021-.435-.062-.124-.56-1.349-.768-1.847-.203-.486-.41-.42-.56-.428l-.478-.009c-.166 0-.435.062-.663.311-.228.249-.871.851-.871 2.076 0 1.225.892 2.408 1.016 2.574.124.166 1.756 2.682 4.255 3.762.595.257 1.06.41 1.423.526.598.19 1.142.163 1.572.099.48-.071 1.472-.602 1.679-1.183.208-.581.208-1.079.145-1.183-.062-.104-.228-.166-.477-.29z"/>
  </svg>
);

interface ClientQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: CalculationResult;
  lang: Language;
  currentUserCompany?: string;
}

export const ClientQuoteModal: React.FC<ClientQuoteModalProps> = ({
  isOpen,
  onClose,
  result,
  lang,
  currentUserCompany = '',
}) => {
  const [quoteData, setQuoteData] = useState<ClientQuoteData>(() => {
    const randomRef = `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const today = new Date().toISOString().split('T')[0];
    return {
      quoteRef: randomRef,
      quoteDate: today,
      validityDays: 14,
      clientName: '',
      clientCompany: '',
      clientEmail: '',
      sellerCompany: currentUserCompany || 'Global Trade & Cargo Logistics',
      sellerAddress: 'Egypt',
      sellerTaxId: '',
      sellerPhone: '',
      incoterms: 'DDP',
      paymentTerms: '50% Advance / 50% On Clearance',
      includeBreakdown: false,
      notes: lang === 'ar' ? 'العرض شامل لكافة رسوم الشحن والتخليص والتسليم النهائي.' : 'Quote includes freight, customs clearance, and final client delivery.',
    };
  });

  const [isCopySuccess, setIsCopySuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);

  if (!isOpen) return null;

  const targetCurr = result.input.targetCurrency;
  const unitPrice = result.suggestedSellingPricePerUnitTarget;
  const totalPrice = result.totalRevenueTarget;

  const handleChange = <K extends keyof ClientQuoteData>(key: K, value: ClientQuoteData[K]) => {
    setQuoteData((prev) => ({ ...prev, [key]: value }));
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await exportClientQuotePDF(result, quoteData, lang);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareWhatsApp = async () => {
    setIsSharingWhatsApp(true);
    try {
      await shareClientQuotePDFWhatsApp(result, quoteData, lang);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  const handleCopySummary = () => {
    const isAr = lang === 'ar';
    const text = isAr
      ? `📄 *عرض سعر تجاري رسمي*
رقم العرض: ${quoteData.quoteRef}
المستفيد: ${quoteData.clientName || 'العميل'} (${quoteData.clientCompany || 'شركة العميل'})
المورد: ${quoteData.sellerCompany}

📦 *تفاصيل الشحنة:*
المنتج: ${result.input.title || 'شحنة تجارية'}
الكمية: ${result.input.quantity.toLocaleString()} قطعة
شروط التسليم (Incoterms): ${quoteData.incoterms}

💰 *القيمة المالية:*
سعر القطعة: ${formatCurrency(unitPrice, targetCurr)}
إجمالي عرض السعر الشامل: ${formatCurrency(totalPrice, targetCurr)}

⏱️ *الصلاحية:* ${quoteData.validityDays} يوم من تاريخ ${quoteData.quoteDate}
💳 *شروط الدفع:* ${quoteData.paymentTerms}

نرحب بتأكيد الطلب للاستبدال والبدء بالتجهيز.`
      : `📄 *COMMERCIAL FREIGHT QUOTATION*
Quote Ref: ${quoteData.quoteRef}
Client: ${quoteData.clientName || 'Valued Client'} (${quoteData.clientCompany || 'Client Co'})
Issuer: ${quoteData.sellerCompany}

📦 *CARGO DETAILS:*
Item: ${result.input.title || 'Cargo Shipment'}
Quantity: ${result.input.quantity.toLocaleString()} units
Incoterms: ${quoteData.incoterms}

💰 *OFFER PRICING:*
Unit Price: ${formatCurrency(unitPrice, targetCurr)}
Total Quotation Price: ${formatCurrency(totalPrice, targetCurr)}

⏱️ *Validity:* ${quoteData.validityDays} Days from ${quoteData.quoteDate}
💳 *Payment Terms:* ${quoteData.paymentTerms}`;

    navigator.clipboard.writeText(text);
    setIsCopySuccess(true);
    setTimeout(() => setIsCopySuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{lang === 'ar' ? 'إنشاء عرض سعر تجاري للعميل (Commercial Quotation)' : 'Generate Commercial Client Quote'}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar'
                  ? 'خصص بيانات العميل وشروط التسليم واطبع عرض سعر برسمي موثق للعميل'
                  : 'Customize client proposal details, Incoterms, and download a branded formal PDF'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
          {/* Quote Configuration Form */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-4">
            <div className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span>{lang === 'ar' ? 'بيانات العميل والعقد' : 'Client & Proposal Configuration'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'اسم العميل / المسؤول' : 'Client Name / Attn'} *
                </label>
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'أحمد محمود' : 'John Smith'}
                  value={quoteData.clientName}
                  onChange={(e) => handleChange('clientName', e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'شركة العميل' : 'Client Company'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'شركة الاستيراد الدولية' : 'Apex Trading Co.'}
                  value={quoteData.clientCompany}
                  onChange={(e) => handleChange('clientCompany', e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'البريد الإلكتروني للعميل' : 'Client Email'}
                </label>
                <input
                  type="email"
                  placeholder="client@company.com"
                  value={quoteData.clientEmail}
                  onChange={(e) => handleChange('clientEmail', e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'شرط التسليم (Incoterms)' : 'Incoterms Delivery'}
                </label>
                <select
                  value={quoteData.incoterms}
                  onChange={(e) => handleChange('incoterms', e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 cursor-pointer"
                >
                  {lang === 'ar' ? (
                    <>
                      <option value="DDP">DDP - تسليم خالص الرسوم والجمرك (موقع المشتري)</option>
                      <option value="CIF">CIF - التكلفة والتأمين والشحن (ميناء الوصول)</option>
                      <option value="FOB">FOB - تسليم على ظهر السفينة (ميناء الشحن)</option>
                      <option value="EXW">EXW - تسليم مصنع المورد (منشأة البائع)</option>
                      <option value="CFR">CFR - التكلفة والشحن (ميناء الوصول)</option>
                      <option value="FCA">FCA - تسليم للناقل المعين (مكان البائع)</option>
                      <option value="CPT">CPT - أجور النقل مدفوعة إلى (مكان الوصول)</option>
                      <option value="CIP">CIP - أجور النقل والتأمين مدفوعة إلى</option>
                      <option value="DAP">DAP - تسليم في المكان المحدد (موقع الوصول)</option>
                      <option value="DPU">DPU - تسليم في المكان أفرغت البضاعة</option>
                    </>
                  ) : (
                    <>
                      <option value="DDP">DDP - Delivered Duty Paid (Buyer Destination)</option>
                      <option value="CIF">CIF - Cost, Insurance & Freight (Destination Port)</option>
                      <option value="FOB">FOB - Free On Board (Origin Port)</option>
                      <option value="EXW">EXW - Ex Works (Supplier Factory)</option>
                      <option value="CFR">CFR - Cost & Freight (Destination Port)</option>
                      <option value="FCA">FCA - Free Carrier (Named Place)</option>
                      <option value="CPT">CPT - Carriage Paid To (Destination)</option>
                      <option value="CIP">CIP - Carriage & Insurance Paid To</option>
                      <option value="DAP">DAP - Delivered At Place (Destination)</option>
                      <option value="DPU">DPU - Delivered At Place Unloaded</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'صلاحية العرض (أيام)' : 'Quote Validity (Days)'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={quoteData.validityDays}
                  onChange={(e) => handleChange('validityDays', parseInt(e.target.value, 10) || 7)}
                  className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'شروط الدفع' : 'Payment Terms'}
                </label>
                <input
                  type="text"
                  value={quoteData.paymentTerms}
                  onChange={(e) => handleChange('paymentTerms', e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'اسم شركتك (الجهة المصدرة للطلب)' : 'Your Company Name'}
                </label>
                <input
                  type="text"
                  value={quoteData.sellerCompany}
                  onChange={(e) => handleChange('sellerCompany', e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'عنوان الشركة (اختياري)' : 'Company Address (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'مثال: مصر، القاهرة' : 'e.g. Cairo, Egypt'}
                  value={quoteData.sellerAddress}
                  onChange={(e) => handleChange('sellerAddress', e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'الرقم الضريبي (sellerTaxId) (اختياري)' : 'Tax ID / Registration (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'مثال: 902-881-300' : 'e.g. TRN-902-881'}
                  value={quoteData.sellerTaxId}
                  onChange={(e) => handleChange('sellerTaxId', e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'رقم الهاتف (sellerPhone) (اختياري)' : 'Contact Phone (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'مثال: 01000000000+' : 'e.g. +20 100 0000000'}
                  value={quoteData.sellerPhone}
                  onChange={(e) => handleChange('sellerPhone', e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'ملاحظات وتوجيهات للعميل' : 'Notes & Instructions'}
                </label>
                <input
                  type="text"
                  value={quoteData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={quoteData.includeBreakdown}
                  onChange={(e) => handleChange('includeBreakdown', e.target.checked)}
                  className="w-4 h-4 rounded-md text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>{lang === 'ar' ? 'إظهار ملخص تفكيك التكاليف (الشحن والجمارك)' : 'Include estimated freight/customs breakdown in PDF'}</span>
              </label>
            </div>
          </div>

          {/* Live Quote Document Card Preview */}
          <div className="border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-white text-slate-900 p-6 space-y-4 shadow-sm">
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-200">
              <div>
                <div className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  {quoteData.sellerCompany || 'YOUR CARGO COMPANY'}
                </div>
                {quoteData.sellerAddress && (
                  <div className="text-xs text-slate-500">{quoteData.sellerAddress}</div>
                )}
                {(quoteData.sellerTaxId || quoteData.sellerPhone) && (
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {[
                      quoteData.sellerTaxId ? `Tax: ${quoteData.sellerTaxId}` : '',
                      quoteData.sellerPhone ? `Tel: ${quoteData.sellerPhone}` : ''
                    ].filter(Boolean).join(' | ')}
                  </div>
                )}
              </div>

              <div className="text-right">
                <span className="px-3 py-1 rounded bg-blue-600 text-white font-black text-xs uppercase tracking-wider">
                  {lang === 'ar' ? 'عرض سعر تجاري' : 'COMMERCIAL QUOTATION'}
                </span>
                <div className="text-xs font-bold font-mono text-blue-600 mt-2">{quoteData.quoteRef}</div>
                <div className="text-[10px] text-slate-400">{quoteData.quoteDate}</div>
              </div>
            </div>

            {/* Client & Offer Table */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">
                  {lang === 'ar' ? 'العميل المستلم:' : 'PREPARED FOR:'}
                </div>
                <div className="font-extrabold text-slate-900">{quoteData.clientName || 'Valued Client'}</div>
                <div className="text-slate-600">{quoteData.clientCompany || 'Corporate Procurement'}</div>
                <div className="text-slate-400">{quoteData.clientEmail}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">
                  {lang === 'ar' ? 'الشروط والصلاحية:' : 'TERMS & INCOTERMS:'}
                </div>
                <div><strong>Incoterms:</strong> {quoteData.incoterms}</div>
                <div><strong>Payment:</strong> {quoteData.paymentTerms}</div>
                <div className="text-rose-600 font-bold mt-0.5"><strong>Validity:</strong> {quoteData.validityDays} Days</div>
              </div>
            </div>

            {/* Price Preview */}
            <div className="p-4 rounded-xl bg-slate-900 text-white flex justify-between items-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-blue-400">
                  {lang === 'ar' ? 'إجمالي قيمة العرض الشامل' : 'TOTAL QUOTATION OFFER'}
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  {result.input.quantity.toLocaleString()} units × {formatCurrency(unitPrice, targetCurr)} / unit
                </div>
              </div>

              <div className="text-2xl font-black text-blue-400 font-mono">
                {formatCurrency(totalPrice, targetCurr)}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSharingWhatsApp}
              onClick={handleShareWhatsApp}
              className="px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/30 active:scale-95 disabled:opacity-50"
            >
              {isSharingWhatsApp ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <WhatsappIcon className="w-4 h-4" />
              )}
              <span>
                {isSharingWhatsApp
                  ? (lang === 'ar' ? 'جاري تجهيز PDF للواتساب...' : 'Preparing PDF for WhatsApp...')
                  : (lang === 'ar' ? 'مشاركة عرض السعر PDF عبر واتساب' : 'Share PDF Offer to WhatsApp')}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                isCopySuccess
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title={lang === 'ar' ? 'نسخ نص ملخص العرض' : 'Copy text summary'}
            >
              {isCopySuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isCopySuccess ? (lang === 'ar' ? 'تم نسخ النص!' : 'Copied!') : (lang === 'ar' ? 'نسخ النص' : 'Copy Text')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer transition-colors"
            >
              {lang === 'ar' ? 'إلغاء' : 'Close'}
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={handleExportPdf}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black text-xs cursor-pointer transition-all flex items-center gap-2 shadow-md shadow-blue-950/40 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? (lang === 'ar' ? 'جاري التصدير...' : 'Exporting PDF...') : (lang === 'ar' ? 'تنزيل PDF' : 'Download PDF')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
