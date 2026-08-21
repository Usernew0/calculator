import React, { useState, useRef } from 'react';
import {
  X,
  Plane,
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  DollarSign,
  ArrowRight,
  TrendingUp,
  Package,
  Building2,
  FileSpreadsheet,
  RefreshCw,
  Edit3,
  Globe,
  Compass
} from 'lucide-react';
import { CalculationResult, FlightConsignment, FlightManifestParsedData } from '../types';
import { Language } from '../data/translations';
import { formatCurrency } from '../data/currencies';
import { parseFlightManifestApi, saveFlightApi } from '../lib/api';

interface FlightConsignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: CalculationResult[];
  currentUser: any;
  lang: Language;
  onFlightSaved: (flight: FlightConsignment) => void;
}

export const FlightConsignmentModal: React.FC<FlightConsignmentModalProps> = ({
  isOpen,
  onClose,
  selectedItems,
  currentUser,
  lang,
  onFlightSaved,
}) => {
  const isArabic = lang === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [flightNumber, setFlightNumber] = useState('');
  const [flightName, setFlightName] = useState('');
  const [airline, setAirline] = useState('');
  const [flightDate, setFlightDate] = useState(new Date().toISOString().slice(0, 10));
  const [originAirport, setOriginAirport] = useState('');
  const [originCountry, setOriginCountry] = useState('');
  const [destinationAirport, setDestinationAirport] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [awbNumber, setAwbNumber] = useState('');
  const [status, setStatus] = useState<'scheduled' | 'in_transit' | 'customs_clearing' | 'delivered' | 'cancelled'>('scheduled');
  const [notes, setNotes] = useState('');

  // AI OCR State
  const [isUploading, setIsUploading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<FlightManifestParsedData | null>(null);
  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('ai');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  // Aggregated totals of selected items
  const primaryCurrency = selectedItems[0]?.input.targetCurrency || 'USD';
  const totalCost = selectedItems.reduce((acc, i) => acc + (i.totalLandedCostTarget || 0), 0);
  const totalRevenue = selectedItems.reduce((acc, i) => acc + (i.totalRevenueTarget || 0), 0);
  const totalProfit = selectedItems.reduce((acc, i) => acc + (i.totalProfitTarget || 0), 0);
  const totalWeight = selectedItems.reduce((acc, i) => acc + (i.chargeableWeightKg || (i.input.weight * i.input.quantity) || 0), 0);
  const totalQuantity = selectedItems.reduce((acc, i) => acc + (i.input.quantity || 0), 0);
  const marginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsUploading(true);
    setOcrError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

          const extracted = await parseFlightManifestApi(base64Data, mimeType, file.name);
          setExtractedData(extracted);

          // Populate Form with extracted parameters
          if (extracted.flightNumber) {
            setFlightNumber(extracted.flightNumber);
            setFlightName(extracted.flightNumber);
          }
          if (extracted.airline) setAirline(extracted.airline);
          if (extracted.flightDate) setFlightDate(extracted.flightDate.slice(0, 10));
          if (extracted.originAirport) setOriginAirport(extracted.originAirport);
          if (extracted.originCountry) setOriginCountry(extracted.originCountry);
          if (extracted.destinationAirport) setDestinationAirport(extracted.destinationAirport);
          if (extracted.destinationCountry) setDestinationCountry(extracted.destinationCountry);
          if (extracted.awbNumber) setAwbNumber(extracted.awbNumber);
          if (extracted.notes) setNotes(extracted.notes);
        } catch (err: any) {
          console.error('AI PDF Extraction failed:', err);
          setOcrError(
            err?.message ||
            (isArabic
              ? 'تعذر استخراج البيانات آلياً من ملف الـ PDF. يمكنك إدخال البيانات يدوياً أدناه.'
              : 'Failed to extract data via AI. You can enter the flight details manually below.')
          );
        } finally {
          setIsUploading(false);
        }
      };
      reader.onerror = () => {
        setOcrError(isArabic ? 'فشل قراءة الملف' : 'Failed to read file');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setOcrError(err?.message || 'Upload failed');
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flightNumber.trim()) {
      alert(isArabic ? 'يرجى إدخال رقم الرحلة الجوية' : 'Please enter the flight number');
      return;
    }

    setIsSaving(true);
    try {
      const newFlight: FlightConsignment = {
        id: `FLIGHT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: currentUser?.userId || currentUser?.username || 'admin',
        flightNumber: flightNumber.trim().toUpperCase(),
        flightName: (flightName.trim() || flightNumber.trim()).toUpperCase(),
        airline: airline.trim(),
        flightDate: flightDate || new Date().toISOString().slice(0, 10),
        originAirport: originAirport.trim(),
        originCountry: originCountry.trim(),
        destinationAirport: destinationAirport.trim(),
        destinationCountry: destinationCountry.trim(),
        awbNumber: awbNumber.trim(),
        status,
        calculationIds: selectedItems.map((i) => i.id),
        totalGrossWeightKg: totalWeight,
        totalChargeableWeightKg: totalWeight,
        totalLandedCost: totalCost,
        totalRevenue: totalRevenue,
        totalProfit: totalProfit,
        targetCurrency: primaryCurrency,
        totalPackagesCount: selectedItems.length,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveFlightApi(newFlight);
      onFlightSaved(saved);
      onClose();
    } catch (err: any) {
      console.error('Failed to save flight:', err);
      alert(err?.message || (isArabic ? 'فشل حفظ الرحلة' : 'Failed to save flight consignment'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {isArabic ? 'ربط الحسابات برحلة جوية وشحنة (Flight Consignment)' : 'Consolidate to Flight Manifest'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {isArabic
                  ? `تجميع ${selectedItems.length} سجل حسابات وتوثيق بيانات بوليصة الشحن الجوي والربحية`
                  : `Group ${selectedItems.length} calculation records under a flight consignment & manifest`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* Selected Products KPI Ribbon */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white rounded-xl p-4 shadow-md border border-slate-700">
            <div className="text-xs font-semibold uppercase tracking-wider text-sky-300 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              {isArabic ? 'ملخص المنتجات والبضائع المحددة للرحلة' : 'Selected Cargo Summary for Flight'}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-1">
              <div>
                <div className="text-[11px] text-slate-400">{isArabic ? 'عدد الأصناف' : 'Total Items'}</div>
                <div className="text-sm sm:text-base font-bold text-white">{selectedItems.length} {isArabic ? 'بند' : 'SKUs'}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">{isArabic ? 'إجمالي الكمية' : 'Total Qty'}</div>
                <div className="text-sm sm:text-base font-bold text-white">{totalQuantity.toLocaleString()} {isArabic ? 'قطعة' : 'pcs'}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">{isArabic ? 'إجمالي الوزن' : 'Est. Weight'}</div>
                <div className="text-sm sm:text-base font-bold text-sky-300">{totalWeight.toFixed(1)} kg</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">{isArabic ? 'تكلفة الوصول' : 'Landed Cost'}</div>
                <div className="text-sm sm:text-base font-bold text-amber-300">{formatCurrency(totalCost, primaryCurrency)}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">{isArabic ? 'الإيراد المتوقع' : 'Revenue'}</div>
                <div className="text-sm sm:text-base font-bold text-emerald-400">{formatCurrency(totalRevenue, primaryCurrency)}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">{isArabic ? 'صافي الربح' : 'Net Profit'}</div>
                <div className={`text-sm sm:text-base font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(totalProfit, primaryCurrency)} ({marginPct.toFixed(1)}%)
                </div>
              </div>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'ai'
                  ? 'border-sky-600 text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Sparkles className="w-4 h-4 text-sky-500" />
              {isArabic ? 'استخراج ذكي من ملف الرحلة / المانيفست (AI PDF)' : 'AI Flight PDF Manifest Extraction'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'manual'
                  ? 'border-sky-600 text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              {isArabic ? 'الإدخال اليدوي لبيانات الرحلة' : 'Manual Flight Entry'}
            </button>
          </div>

          {/* AI Upload Section */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-sky-300 dark:border-sky-800 hover:border-sky-500 bg-sky-50/40 dark:bg-sky-950/10 rounded-2xl p-6 text-center cursor-pointer transition-all hover:bg-sky-50/80 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 mx-auto flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  {isUploading ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>
                <div className="font-bold text-slate-800 dark:text-slate-200 text-sm sm:text-base">
                  {isUploading
                    ? (isArabic ? 'جاري تحليل بوليصة الشحن والرحلة عبر الذكاء الاصطناعي...' : 'Analyzing Air Waybill & Flight Manifest via AI...')
                    : (isArabic ? 'اضغط لرفع ملف الـ PDF الخاص بالرحلة أو بوليصة الشحن (AWB)' : 'Click or drop Air Waybill (AWB) / Flight Manifest PDF or Image')}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  {isArabic
                    ? 'يقوم الذكاء الاصطناعي باستخراج رقم الرحلة، اسم شركة الطيران، خط السير (المطار والبلد)، التاريخ، ورقم بوليصة الشحن آلياً'
                    : 'Gemini AI automatically extracts Flight #, Airline, Route, Airports, Date, and AWB # into the fields below'}
                </p>
                {uploadedFileName && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 rounded-full border border-sky-200 dark:border-sky-700">
                    <FileText className="w-3.5 h-3.5" />
                    {uploadedFileName}
                  </div>
                )}
              </div>

              {ocrError && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs sm:text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold">{isArabic ? 'تنبيه الاستخراج الآلي' : 'AI Extraction Notice'}</div>
                    <div>{ocrError}</div>
                  </div>
                </div>
              )}

              {extractedData && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      {isArabic
                        ? `تم استخراج بيانات الرحلة بنجاح: ${extractedData.airline || ''} ${extractedData.flightNumber || ''} (${extractedData.originAirport || ''} ➔ ${extractedData.destinationAirport || ''})`
                        : `Successfully extracted flight data: ${extractedData.airline || ''} ${extractedData.flightNumber || ''} (${extractedData.originAirport || ''} ➔ ${extractedData.destinationAirport || ''})`}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 rounded">AI Verified</span>
                </div>
              )}
            </div>
          )}

          {/* Flight Details Form */}
          <form id="flight-form" onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              
              {/* Flight Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isArabic ? 'رقم الرحلة الجوية *' : 'Flight Number *'}
                </label>
                <div className="relative">
                  <Plane className={`w-4 h-4 absolute top-3 text-slate-400 ${isArabic ? 'right-3' : 'left-3'}`} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. MS 777 / EK 923"
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value)}
                    className={`w-full text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold ${
                      isArabic ? 'pr-9' : 'pl-9'
                    }`}
                  />
                </div>
              </div>

              {/* Airline */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isArabic ? 'شركة الطيران الناقلة' : 'Airline Carrier'}
                </label>
                <div className="relative">
                  <Building2 className={`w-4 h-4 absolute top-3 text-slate-400 ${isArabic ? 'right-3' : 'left-3'}`} />
                  <input
                    type="text"
                    placeholder="e.g. EgyptAir, Emirates SkyCargo"
                    value={airline}
                    onChange={(e) => setAirline(e.target.value)}
                    className={`w-full text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isArabic ? 'pr-9' : 'pl-9'
                    }`}
                  />
                </div>
              </div>

              {/* Flight Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isArabic ? 'تاريخ الرحلة *' : 'Flight Date *'}
                </label>
                <div className="relative">
                  <Calendar className={`w-4 h-4 absolute top-3 text-slate-400 ${isArabic ? 'right-3' : 'left-3'}`} />
                  <input
                    type="date"
                    required
                    value={flightDate}
                    onChange={(e) => setFlightDate(e.target.value)}
                    className={`w-full text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isArabic ? 'pr-9' : 'pl-9'
                    }`}
                  />
                </div>
              </div>

              {/* Origin Airport & Country */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isArabic ? 'مطار الإقلاع (المصدر) / الدولة' : 'Origin Airport & Country'}
                </label>
                <div className="relative">
                  <Compass className={`w-4 h-4 absolute top-3 text-slate-400 ${isArabic ? 'right-3' : 'left-3'}`} />
                  <input
                    type="text"
                    placeholder="e.g. CAN - Guangzhou / China"
                    value={originAirport}
                    onChange={(e) => setOriginAirport(e.target.value)}
                    className={`w-full text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isArabic ? 'pr-9' : 'pl-9'
                    }`}
                  />
                </div>
              </div>

              {/* Destination Airport & Country */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isArabic ? 'مطار الوصول (الوجهة) / الدولة' : 'Destination Airport & Country'}
                </label>
                <div className="relative">
                  <Globe className={`w-4 h-4 absolute top-3 text-slate-400 ${isArabic ? 'right-3' : 'left-3'}`} />
                  <input
                    type="text"
                    placeholder="e.g. CAI - Cairo / Egypt"
                    value={destinationAirport}
                    onChange={(e) => setDestinationAirport(e.target.value)}
                    className={`w-full text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isArabic ? 'pr-9' : 'pl-9'
                    }`}
                  />
                </div>
              </div>

              {/* Air Waybill (AWB) # */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isArabic ? 'رقم بوليصة الشحن (AWB #)' : 'Air Waybill # (AWB)'}
                </label>
                <div className="relative">
                  <FileSpreadsheet className={`w-4 h-4 absolute top-3 text-slate-400 ${isArabic ? 'right-3' : 'left-3'}`} />
                  <input
                    type="text"
                    placeholder="e.g. 077-98765432"
                    value={awbNumber}
                    onChange={(e) => setAwbNumber(e.target.value)}
                    className={`w-full text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isArabic ? 'pr-9' : 'pl-9'
                    }`}
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isArabic ? 'حالة الشحنة الجوية' : 'Consignment Status'}
                </label>
                <select
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="scheduled">{isArabic ? 'مجدولة (Scheduled)' : 'Scheduled'}</option>
                  <option value="in_transit">{isArabic ? 'في طريقها جوياً (In Transit)' : 'In Transit'}</option>
                  <option value="customs_clearing">{isArabic ? 'تحت التخليص الجمركي (Customs Clearance)' : 'Customs Clearing'}</option>
                  <option value="delivered">{isArabic ? 'تم التسليم والتوزيع (Delivered)' : 'Delivered'}</option>
                  <option value="cancelled">{isArabic ? 'ملغاة (Cancelled)' : 'Cancelled'}</option>
                </select>
              </div>

              {/* Notes */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isArabic ? 'ملاحظات وتوجيهات الشحنة' : 'Consignment Notes & Instructions'}
                </label>
                <input
                  type="text"
                  placeholder={isArabic ? 'أية تعليمات تخليص أو تفاصيل إضافية...' : 'Any special handling, agent, or routing notes...'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                </input>
              </div>

            </div>
          </form>

          {/* Table of Linked Calculations */}
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
              <span>{isArabic ? 'قائمة المنتجات المربوطة بهذه الرحلة:' : 'Cargo Items Linked to this Flight:'}</span>
              <span className="text-[11px] text-slate-400">{selectedItems.length} {isArabic ? 'سجل' : 'records'}</span>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">{isArabic ? 'المنتج' : 'Item Name'}</th>
                      <th className="py-2 px-3 text-center">{isArabic ? 'الكمية' : 'Qty'}</th>
                      <th className="py-2 px-3 text-center">{isArabic ? 'الوزن' : 'Weight'}</th>
                      <th className="py-2 px-3 text-right">{isArabic ? 'تكلفة الوصول' : 'Landed Cost'}</th>
                      <th className="py-2 px-3 text-right">{isArabic ? 'الإيراد' : 'Revenue'}</th>
                      <th className="py-2 px-3 text-right">{isArabic ? 'الربح' : 'Profit'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                          <div>{item.input.title}</div>
                          <div className="text-[10px] text-slate-400">{item.input.skuSupplier || item.input.category || 'SKU'}</div>
                        </td>
                        <td className="py-2 px-3 text-center">{item.input.quantity.toLocaleString()}</td>
                        <td className="py-2 px-3 text-center text-slate-500">{(item.chargeableWeightKg || 0).toFixed(1)} kg</td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                          {formatCurrency(item.totalLandedCostTarget, item.input.targetCurrency)}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(item.totalRevenueTarget, item.input.targetCurrency)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(item.totalProfitTarget, item.input.targetCurrency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              form="flight-form"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 active:scale-98 rounded-xl shadow-md shadow-sky-600/20 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {isArabic ? 'حفظ وتوثيق الرحلة الجوية' : 'Save Flight Consignment'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
