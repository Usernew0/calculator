import React, { useState, useRef, useMemo, useEffect } from 'react';
import { CalculationResult, FlightConsignment } from '../types';
import { formatCurrency } from '../data/currencies';
import { Language } from '../data/translations';
import {
  Plane,
  Building2,
  Calendar,
  Compass,
  Globe,
  FileSpreadsheet,
  Upload,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Edit3,
  Link2,
  Unlink2,
  Plus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Search,
  Check,
} from 'lucide-react';
import { saveFlightConsignmentApi } from '../lib/api';
import { saveFlightConsignmentToFirestore, saveCalculationToFirestore } from '../lib/firebase';
import { saveCalculationApi } from '../lib/api';
import {
  getCalculationGrossWeightKg,
  getCalculationChargeableWeightKg,
  getCalculationVolumeCBM,
  getCalculationPieces,
  getCalculationLandedCost,
  getCalculationRevenue,
  getCalculationProfit,
} from '../utils/calculator';

interface FlightConsignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: CalculationResult[];
  onFlightSaved: (flight: FlightConsignment, updatedCalculations: CalculationResult[]) => void;
  existingFlights?: FlightConsignment[];
  allHistoryCalculations?: CalculationResult[];
  initialFlight?: FlightConsignment | null;
  lang: Language;
  currentUser?: any;
}

export const FlightConsignmentModal: React.FC<FlightConsignmentModalProps> = ({
  isOpen,
  onClose,
  selectedItems,
  onFlightSaved,
  existingFlights = [],
  allHistoryCalculations = [],
  initialFlight = null,
  lang,
  currentUser,
}) => {
  const isArabic = lang === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active top-level mode
  const [modalMode, setModalMode] = useState<'link_existing' | 'create_new' | 'unlink'>(() => {
    if (initialFlight) return 'create_new';
    if (existingFlights && existingFlights.length > 0 && selectedItems.length > 0) return 'link_existing';
    return 'create_new';
  });

  // Mode for Create New (AI vs Manual)
  const [creationMethod, setCreationMethod] = useState<'manual' | 'ai'>('manual');

  // Existing flight search in Link Existing tab
  const [existingSearchQuery, setExistingSearchQuery] = useState('');
  const [selectedExistingFlightId, setSelectedExistingFlightId] = useState<string>(() => {
    return existingFlights.length > 0 ? existingFlights[0].id : '';
  });

  // Items to link in Create New / Edit mode
  const [itemsToLink, setItemsToLink] = useState<CalculationResult[]>(selectedItems);

  useEffect(() => {
    if (initialFlight) {
      // Find all calculation records that belong to this initial flight
      const flightItems = allHistoryCalculations.filter((c) =>
        initialFlight.calculationIds?.includes(c.id)
      );
      setItemsToLink(flightItems.length > 0 ? flightItems : selectedItems);
    } else {
      setItemsToLink(selectedItems);
    }
  }, [initialFlight, selectedItems, allHistoryCalculations]);

  // Form fields for New/Edit Flight
  const [flightNumber, setFlightNumber] = useState(initialFlight?.flightNumber || '');
  const [flightName, setFlightName] = useState(initialFlight?.flightName || '');
  const [airline, setAirline] = useState(initialFlight?.airline || '');
  const [flightDate, setFlightDate] = useState(
    initialFlight?.flightDate || new Date().toISOString().split('T')[0]
  );
  const [originAirport, setOriginAirport] = useState(initialFlight?.originAirport || '');
  const [originCountry, setOriginCountry] = useState(initialFlight?.originCountry || '');
  const [destinationAirport, setDestinationAirport] = useState(
    initialFlight?.destinationAirport || ''
  );
  const [destinationCountry, setDestinationCountry] = useState(
    initialFlight?.destinationCountry || ''
  );
  const [awbNumber, setAwbNumber] = useState(
    initialFlight?.masterAwbNumber || initialFlight?.awbNumber || ''
  );
  const [status, setStatus] = useState<
    'scheduled' | 'in_transit' | 'customs_clearing' | 'delivered' | 'cancelled'
  >(initialFlight?.status || 'scheduled');
  const [notes, setNotes] = useState(initialFlight?.notes || '');

  // AI OCR state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any | null>(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Determine primary target currency from items
  const primaryCurrency = useMemo(() => {
    if (itemsToLink.length > 0) {
      return itemsToLink[0].input.targetCurrency || 'EGP';
    }
    if (selectedItems.length > 0) {
      return selectedItems[0].input.targetCurrency || 'EGP';
    }
    return 'EGP';
  }, [itemsToLink, selectedItems]);

  // Financial aggregates of items to link
  const financialTotals = useMemo(() => {
    const totalCost = itemsToLink.reduce((sum, item) => sum + getCalculationLandedCost(item), 0);
    const totalRevenue = itemsToLink.reduce((sum, item) => sum + getCalculationRevenue(item), 0);
    const totalProfit = totalRevenue - totalCost;
    const totalWeight = itemsToLink.reduce((sum, item) => sum + getCalculationGrossWeightKg(item), 0);
    const totalChargeableWeight = itemsToLink.reduce((sum, item) => sum + getCalculationChargeableWeightKg(item), 0);
    const totalVolume = itemsToLink.reduce((sum, item) => sum + getCalculationVolumeCBM(item), 0);
    const totalUnits = itemsToLink.reduce((sum, item) => sum + getCalculationPieces(item), 0);
    const marginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const roiPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    return {
      totalCost,
      totalRevenue,
      totalProfit,
      totalWeight,
      totalChargeableWeight,
      totalVolume,
      totalUnits,
      marginPct,
      roiPct,
    };
  }, [itemsToLink]);

  // Selected items which are already linked to flights
  const alreadyLinkedSelectedItems = useMemo(() => {
    return selectedItems.filter(
      (item) => item.input.flightConsignmentId || item.input.flightNumber
    );
  }, [selectedItems]);

  // Filtered existing flights for Link Existing tab
  const filteredExistingFlights = useMemo(() => {
    if (!existingSearchQuery.trim()) return existingFlights;
    const q = existingSearchQuery.toLowerCase();
    return existingFlights.filter(
      (f) =>
        f.flightNumber.toLowerCase().includes(q) ||
        f.airline.toLowerCase().includes(q) ||
        f.originAirport.toLowerCase().includes(q) ||
        f.destinationAirport.toLowerCase().includes(q) ||
        (f.awbNumber && f.awbNumber.toLowerCase().includes(q))
    );
  }, [existingFlights, existingSearchQuery]);

  // Selected target existing flight object
  const targetExistingFlight = useMemo(() => {
    return existingFlights.find((f) => f.id === selectedExistingFlightId) || existingFlights[0] || null;
  }, [existingFlights, selectedExistingFlightId]);

  // Simulated P&L for target existing flight after adding selectedItems
  const simulatedFlightPL = useMemo(() => {
    if (!targetExistingFlight) return null;

    // Get current items linked to target existing flight
    const currentFlightItems = allHistoryCalculations.filter((c) =>
      targetExistingFlight.calculationIds?.includes(c.id)
    );

    // Merge with selectedItems (avoiding duplicates)
    const existingIds = new Set(targetExistingFlight.calculationIds || []);
    const newItemsToAdd = selectedItems.filter((item) => !existingIds.has(item.id));
    const combinedItems = [...currentFlightItems, ...newItemsToAdd];

    const currentCost = currentFlightItems.reduce((sum, item) => sum + getCalculationLandedCost(item), 0);
    const currentRevenue = currentFlightItems.reduce((sum, item) => sum + getCalculationRevenue(item), 0);
    const currentProfit = currentRevenue - currentCost;

    const newTotalCost = combinedItems.reduce((sum, item) => sum + getCalculationLandedCost(item), 0);
    const newTotalRevenue = combinedItems.reduce((sum, item) => sum + getCalculationRevenue(item), 0);
    const newTotalProfit = newTotalRevenue - newTotalCost;
    const newTotalWeight = combinedItems.reduce((sum, item) => sum + getCalculationGrossWeightKg(item), 0);
    const newTotalChargeableWeight = combinedItems.reduce((sum, item) => sum + getCalculationChargeableWeightKg(item), 0);
    const newTotalVolume = combinedItems.reduce((sum, item) => sum + getCalculationVolumeCBM(item), 0);
    const newMarginPct = newTotalRevenue > 0 ? (newTotalProfit / newTotalRevenue) * 100 : 0;
    const newRoiPct = newTotalCost > 0 ? (newTotalProfit / newTotalCost) * 100 : 0;

    return {
      currentCount: currentFlightItems.length,
      currentCost,
      currentRevenue,
      currentProfit,
      newCount: combinedItems.length,
      addedCount: newItemsToAdd.length,
      newTotalCost,
      newTotalRevenue,
      newTotalProfit,
      newTotalWeight,
      newTotalChargeableWeight,
      newTotalVolume,
      newMarginPct,
      newRoiPct,
      combinedItems,
    };
  }, [targetExistingFlight, allHistoryCalculations, selectedItems]);

  if (!isOpen) return null;

  // Handle AI Document Upload & Extraction
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsUploading(true);
    setOcrError(null);
    setExtractedData(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const mimeType = file.type || 'application/pdf';

          const response = await fetch('/api/gemini/extract-flight-manifest', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('cargo_auth_token') || ''}`,
            },
            body: JSON.stringify({
              base64Data,
              mimeType,
              fileName: file.name,
            }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to extract data from flight document');
          }

          const resData = await response.json();
          const parsed = resData.data;

          if (parsed) {
            setExtractedData(parsed);
            if (parsed.flightNumber) setFlightNumber(parsed.flightNumber);
            if (parsed.airline) setAirline(parsed.airline);
            if (parsed.flightDate) setFlightDate(parsed.flightDate);
            if (parsed.originAirport) setOriginAirport(parsed.originAirport);
            if (parsed.originCountry) setOriginCountry(parsed.originCountry);
            if (parsed.destinationAirport) setDestinationAirport(parsed.destinationAirport);
            if (parsed.destinationCountry) setDestinationCountry(parsed.destinationCountry);
            if (parsed.awbNumber || parsed.masterAwbNumber)
              setAwbNumber(parsed.awbNumber || parsed.masterAwbNumber);
            if (parsed.notes) setNotes(parsed.notes);
          }
        } catch (err: any) {
          console.error('OCR Error:', err);
          setOcrError(err?.message || 'Error processing document with AI.');
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setOcrError(err?.message || 'Could not read file.');
      setIsUploading(false);
    }
  };

  // 1. EXECUTE: Link selected items to an existing flight
  const handleLinkToExistingFlight = async () => {
    if (!targetExistingFlight) {
      alert(isArabic ? 'يرجى اختيار رحلة طيران أولاً' : 'Please select a flight first');
      return;
    }

    setIsSaving(true);
    try {
      const existingIds = new Set(targetExistingFlight.calculationIds || []);
      selectedItems.forEach((item) => existingIds.add(item.id));
      const updatedCalculationIds = Array.from(existingIds);

      // Fetch all items that will be linked to this flight to recalculate exact P&L totals
      const allLinkedRecords = allHistoryCalculations.filter((c) =>
        updatedCalculationIds.includes(c.id)
      );
      // Ensure all selected items are in the list
      selectedItems.forEach((selItem) => {
        if (!allLinkedRecords.some((r) => r.id === selItem.id)) {
          allLinkedRecords.push(selItem);
        }
      });

      const totalLandedCost = allLinkedRecords.reduce((sum, item) => sum + getCalculationLandedCost(item), 0);
      const totalRevenue = allLinkedRecords.reduce((sum, item) => sum + getCalculationRevenue(item), 0);
      const totalProfit = totalRevenue - totalLandedCost;
      const totalGrossWeightKg = allLinkedRecords.reduce((sum, item) => sum + getCalculationGrossWeightKg(item), 0);
      const totalChargeableWeightKg = allLinkedRecords.reduce((sum, item) => sum + getCalculationChargeableWeightKg(item), 0);
      const totalVolumeCbm = allLinkedRecords.reduce((sum, item) => sum + getCalculationVolumeCBM(item), 0);
      const totalPackagesCount = allLinkedRecords.reduce((sum, item) => sum + getCalculationPieces(item), 0);

      const updatedFlight: FlightConsignment = {
        ...targetExistingFlight,
        calculationIds: updatedCalculationIds,
        totalLandedCost,
        totalLandedCostEGP: totalLandedCost,
        totalRevenue,
        totalRevenueEGP: totalRevenue,
        totalProfit,
        totalProfitEGP: totalProfit,
        totalGrossWeightKg,
        totalWeightKg: totalGrossWeightKg,
        totalChargeableWeightKg,
        totalVolumeCbm,
        totalPackagesCount,
        totalPieces: totalPackagesCount,
        updatedAt: new Date().toISOString(),
      };

      // 1. Save Flight Consignment (API + Firestore)
      await saveFlightConsignmentApi(updatedFlight);
      await saveFlightConsignmentToFirestore(updatedFlight);

      // 2. Update each selected calculation record with flight metadata
      const updatedCalculations: CalculationResult[] = selectedItems.map((item) => {
        return {
          ...item,
          input: {
            ...item.input,
            flightConsignmentId: updatedFlight.id,
            flightNumber: updatedFlight.flightNumber,
            flightName: updatedFlight.flightName || updatedFlight.flightNumber,
            airline: updatedFlight.airline,
            flightDate: updatedFlight.flightDate,
            originAirport: updatedFlight.originAirport,
            destinationAirport: updatedFlight.destinationAirport,
            awbNumber: updatedFlight.awbNumber || updatedFlight.masterAwbNumber,
          },
        };
      });

      // Save updated calculation records
      for (const calc of updatedCalculations) {
        try {
          await saveCalculationApi(calc);
          await saveCalculationToFirestore(calc);
        } catch (calcErr) {
          console.warn('Calculation flight tag save notice:', calcErr);
        }
      }

      onFlightSaved(updatedFlight, updatedCalculations);
      onClose();
    } catch (err: any) {
      console.error('Failed to link items to flight:', err);
      alert(
        err?.message ||
          (isArabic ? 'فشل ربط المنتجات بالرحلة' : 'Failed to link products to flight')
      );
    } finally {
      setIsSaving(false);
    }
  };

  // 2. EXECUTE: Create a new flight & link items
  const handleSaveNewFlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flightNumber.trim()) {
      alert(isArabic ? 'يرجى إدخال رقم الرحلة الجوية' : 'Please enter flight number');
      return;
    }

    setIsSaving(true);
    try {
      const flightId = initialFlight?.id || `FLIGHT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const calcIds = itemsToLink.map((i) => i.id);

      const flightPayload: FlightConsignment = {
        id: flightId,
        userId: initialFlight?.userId || currentUser?.userId || currentUser?.username || 'admin',
        flightNumber: flightNumber.trim().toUpperCase(),
        flightName: flightName.trim() || flightNumber.trim().toUpperCase(),
        airline: airline.trim(),
        flightDate,
        originAirport: originAirport.trim().toUpperCase(),
        originCountry: originCountry.trim(),
        destinationAirport: destinationAirport.trim().toUpperCase(),
        destinationCountry: destinationCountry.trim(),
        awbNumber: awbNumber.trim(),
        masterAwbNumber: awbNumber.trim(),
        status,
        notes: notes.trim(),
        calculationIds: calcIds,
        totalLandedCost: financialTotals.totalCost,
        totalLandedCostEGP: financialTotals.totalCost,
        totalRevenue: financialTotals.totalRevenue,
        totalRevenueEGP: financialTotals.totalRevenue,
        totalProfit: financialTotals.totalProfit,
        totalProfitEGP: financialTotals.totalProfit,
        totalGrossWeightKg: financialTotals.totalWeight,
        totalWeightKg: financialTotals.totalWeight,
        totalChargeableWeightKg: financialTotals.totalChargeableWeight,
        totalVolumeCbm: financialTotals.totalVolume,
        totalPackagesCount: financialTotals.totalUnits,
        totalPieces: financialTotals.totalUnits,
        createdAt: initialFlight?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1. Save Flight to API & Firestore
      await saveFlightConsignmentApi(flightPayload);
      await saveFlightConsignmentToFirestore(flightPayload);

      // 2. Update each linked calculation record with flight metadata
      const updatedCalculations: CalculationResult[] = itemsToLink.map((item) => {
        return {
          ...item,
          input: {
            ...item.input,
            flightConsignmentId: flightPayload.id,
            flightNumber: flightPayload.flightNumber,
            flightName: flightPayload.flightName,
            airline: flightPayload.airline,
            flightDate: flightPayload.flightDate,
            originAirport: flightPayload.originAirport,
            destinationAirport: flightPayload.destinationAirport,
            awbNumber: flightPayload.awbNumber,
          },
        };
      });

      for (const calc of updatedCalculations) {
        try {
          await saveCalculationApi(calc);
          await saveCalculationToFirestore(calc);
        } catch (calcErr) {
          console.warn('Calculation flight tag save notice:', calcErr);
        }
      }

      onFlightSaved(flightPayload, updatedCalculations);
      onClose();
    } catch (err: any) {
      console.error('Failed to save flight consignment:', err);
      alert(
        err?.message ||
          (isArabic ? 'فشل حفظ وتوثيق الرحلة الجوية' : 'Failed to save flight consignment')
      );
    } finally {
      setIsSaving(false);
    }
  };

  // 3. EXECUTE: Unlink selected items from their respective flights
  const handleUnlinkSelectedItems = async () => {
    if (selectedItems.length === 0) return;

    if (
      !window.confirm(
        isArabic
          ? `هل أنت متأكد من رغبتك في إلغاء ربط (${selectedItems.length}) سجل من رحلات الطيران؟`
          : `Are you sure you want to unlink (${selectedItems.length}) records from their flights?`
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      const selectedIdSet = new Set(selectedItems.map((i) => i.id));

      // 1. Update calculation records to remove flight metadata
      const updatedCalculations: CalculationResult[] = selectedItems.map((item) => ({
        ...item,
        input: {
          ...item.input,
          flightConsignmentId: undefined,
          flightNumber: undefined,
          flightName: undefined,
          airline: undefined,
          flightDate: undefined,
          originAirport: undefined,
          destinationAirport: undefined,
          awbNumber: undefined,
        },
      }));

      for (const calc of updatedCalculations) {
        await saveCalculationApi(calc);
        await saveCalculationToFirestore(calc);
      }

      // 2. Recalculate and update affected flights
      for (const flight of existingFlights) {
        const hasAffectedItems = flight.calculationIds?.some((id) => selectedIdSet.has(id));
        if (hasAffectedItems) {
          const remainingIds = flight.calculationIds.filter((id) => !selectedIdSet.has(id));
          const remainingRecords = allHistoryCalculations.filter(
            (c) => remainingIds.includes(c.id) && !selectedIdSet.has(c.id)
          );

          const totalLandedCost = remainingRecords.reduce((sum, item) => sum + getCalculationLandedCost(item), 0);
          const totalRevenue = remainingRecords.reduce((sum, item) => sum + getCalculationRevenue(item), 0);
          const totalProfit = totalRevenue - totalLandedCost;
          const totalGrossWeightKg = remainingRecords.reduce((sum, item) => sum + getCalculationGrossWeightKg(item), 0);
          const totalChargeableWeightKg = remainingRecords.reduce((sum, item) => sum + getCalculationChargeableWeightKg(item), 0);
          const totalVolumeCbm = remainingRecords.reduce((sum, item) => sum + getCalculationVolumeCBM(item), 0);
          const totalPackagesCount = remainingRecords.reduce((sum, item) => sum + getCalculationPieces(item), 0);

          const updatedFlight: FlightConsignment = {
            ...flight,
            calculationIds: remainingIds,
            totalLandedCost,
            totalLandedCostEGP: totalLandedCost,
            totalRevenue,
            totalRevenueEGP: totalRevenue,
            totalProfit,
            totalProfitEGP: totalProfit,
            totalGrossWeightKg,
            totalWeightKg: totalGrossWeightKg,
            totalChargeableWeightKg,
            totalVolumeCbm,
            totalPackagesCount,
            totalPieces: totalPackagesCount,
            updatedAt: new Date().toISOString(),
          };

          await saveFlightConsignmentApi(updatedFlight);
          await saveFlightConsignmentToFirestore(updatedFlight);
        }
      }

      // Pass first dummy or trigger callback
      if (existingFlights.length > 0) {
        onFlightSaved(existingFlights[0], updatedCalculations);
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to unlink records:', err);
      alert(
        err?.message ||
          (isArabic ? 'فشل إلغاء ربط السجلات بالرحلات' : 'Failed to unlink records from flights')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-600/30">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                {initialFlight
                  ? isArabic
                    ? `تعديل بيانات الرحلة: ${initialFlight.flightNumber}`
                    : `Edit Flight: ${initialFlight.flightNumber}`
                  : isArabic
                  ? 'ربط وتوحيد الحسبات برحلة طيران ومتابعة الأرباح'
                  : 'Link Products to Flight & Analyze Profit/Loss'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isArabic
                  ? `ربط (${selectedItems.length}) منتج برحلة لمعاينة صافي الربح والخسارة الإجمالي للبوليصة`
                  : `Consolidate (${selectedItems.length}) records to inspect flight-level P&L and profit margin`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top-Level Mode Selector (Only when not editing a specific existing flight) */}
        {!initialFlight && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/40 p-1.5 gap-1.5 shrink-0">
            {existingFlights.length > 0 && (
              <button
                type="button"
                onClick={() => setModalMode('link_existing')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  modalMode === 'link_existing'
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Link2 className="w-4 h-4" />
                <span>
                  {isArabic
                    ? `ربط برحلة موجودة (${existingFlights.length})`
                    : `Link to Existing Flight (${existingFlights.length})`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setModalMode('create_new')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all ${
                modalMode === 'create_new'
                  ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{isArabic ? 'إنشاء رحلة جديدة وربط المنتجات' : 'Create New Flight & Link'}</span>
            </button>

            {alreadyLinkedSelectedItems.length > 0 && (
              <button
                type="button"
                onClick={() => setModalMode('unlink')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  modalMode === 'unlink'
                    ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
                }`}
              >
                <Unlink2 className="w-4 h-4 text-rose-500" />
                <span>
                  {isArabic
                    ? `إلغاء الربط (${alreadyLinkedSelectedItems.length})`
                    : `Unlink (${alreadyLinkedSelectedItems.length})`}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* ======================================================== */}
          {/* MODE 1: LINK TO EXISTING FLIGHT WITH LIVE P&L SIMULATION */}
          {/* ======================================================== */}
          {modalMode === 'link_existing' && (
            <div className="space-y-4">
              
              {/* Search Flights */}
              <div className="relative">
                <Search className={`w-4 h-4 absolute top-3 text-slate-400 ${isArabic ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  placeholder={
                    isArabic
                      ? 'بحث في الرحلات المسجلة برقم الرحلة، شركة الطيران، أو بوليصة الشحن...'
                      : 'Search registered flights by flight #, airline, or AWB...'
                  }
                  value={existingSearchQuery}
                  onChange={(e) => setExistingSearchQuery(e.target.value)}
                  className={`w-full text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                    isArabic ? 'pr-9' : 'pl-9'
                  }`}
                />
              </div>

              {/* Flights Grid Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                {filteredExistingFlights.map((flight) => {
                  const isSelected = flight.id === selectedExistingFlightId;
                  const isProfit = (flight.totalProfit || 0) >= 0;
                  const marginPct =
                    (flight.totalRevenue || 0) > 0
                      ? ((flight.totalProfit || 0) / flight.totalRevenue!) * 100
                      : 0;

                  return (
                    <div
                      key={flight.id}
                      onClick={() => setSelectedExistingFlightId(flight.id)}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 shadow-md ring-2 ring-sky-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                            <Plane className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                              {flight.flightNumber}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {flight.airline || (isArabic ? 'طيران عام' : 'General Air')}
                            </div>
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {flight.calculationIds?.length || 0} {isArabic ? 'منتجات' : 'items'}
                          </span>
                        )}
                      </div>

                      {/* Route & Date */}
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between mb-2">
                        <span>
                          {flight.originAirport || 'N/A'} ➔ {flight.destinationAirport || 'N/A'}
                        </span>
                        <span className="text-[10px] text-slate-400">{flight.flightDate || ''}</span>
                      </div>

                      {/* Current P&L badge */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">
                          {isArabic ? 'الربح الحالي:' : 'Current P&L:'}
                        </span>
                        <span
                          className={`font-black flex items-center gap-1 ${
                            isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isProfit ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {formatCurrency(flight.totalProfit || 0, primaryCurrency)} ({marginPct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* LIVE SIMULATED P&L IMPACT BANNER */}
              {simulatedFlightPL && targetExistingFlight && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-black text-slate-200">
                        {isArabic
                          ? `محاكاة الأرباح والخسائر للرحلة [${targetExistingFlight.flightNumber}] بعد ربط الأصناف:`
                          : `Simulated P&L for Flight [${targetExistingFlight.flightNumber}] after linking:`}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-sky-400 px-2 py-0.5 bg-sky-950/80 rounded-lg border border-sky-800">
                      +{simulatedFlightPL.addedCount} {isArabic ? 'منتجات جديدة' : 'new items'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        {isArabic ? 'إجمالي تكلفة الوصول' : 'Total Landed Cost'}
                      </div>
                      <div className="text-xs sm:text-sm font-black text-slate-100 mt-0.5">
                        {formatCurrency(simulatedFlightPL.newTotalCost, primaryCurrency)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        {isArabic ? 'الإيرادات المتوقعة' : 'Projected Revenue'}
                      </div>
                      <div className="text-xs sm:text-sm font-black text-slate-100 mt-0.5">
                        {formatCurrency(simulatedFlightPL.newTotalRevenue, primaryCurrency)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        {isArabic ? 'صافي الأرباح / الخسائر' : 'Net Profit / Loss'}
                      </div>
                      <div
                        className={`text-xs sm:text-sm font-black mt-0.5 flex items-center justify-center gap-1 ${
                          simulatedFlightPL.newTotalProfit >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {simulatedFlightPL.newTotalProfit >= 0 ? '+' : ''}
                        {formatCurrency(simulatedFlightPL.newTotalProfit, primaryCurrency)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        {isArabic ? 'هامش الربح / ROI' : 'Margin / ROI'}
                      </div>
                      <div
                        className={`text-xs sm:text-sm font-black mt-0.5 ${
                          simulatedFlightPL.newTotalProfit >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {simulatedFlightPL.newMarginPct.toFixed(1)}% ({simulatedFlightPL.newRoiPct.toFixed(1)}% ROI)
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleLinkToExistingFlight}
                    disabled={isSaving}
                    className="w-full py-3 px-4 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-sky-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Link2 className="w-4 h-4" />
                    )}
                    <span>
                      {isArabic
                        ? `تأكيد ربط (${selectedItems.length}) منتجات بالرحلة ${targetExistingFlight.flightNumber}`
                        : `Confirm Link (${selectedItems.length}) Items to Flight ${targetExistingFlight.flightNumber}`}
                    </span>
                  </button>
                </div>
              )}

            </div>
          )}

          {/* ======================================================== */}
          {/* MODE 2: CREATE NEW FLIGHT & LINK SELECTED ITEMS          */}
          {/* ======================================================== */}
          {modalMode === 'create_new' && (
            <div className="space-y-5">
              
              {/* Financial Summary Ribbon for the New Flight */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg border border-slate-700/60">
                <div className="text-[11px] font-black text-sky-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>{isArabic ? 'المؤشرات المالية للرحلة الجوية الجديدة:' : 'New Flight Financial Matrix & P&L:'}</span>
                  <span className="text-slate-300 font-normal">
                    {itemsToLink.length} {isArabic ? 'أصناف محددة' : 'selected items'} ({financialTotals.totalUnits.toLocaleString()} pcs)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase">{isArabic ? 'الوزن القائم' : 'Gross Weight'}</div>
                    <div className="text-xs sm:text-sm font-bold text-sky-300">{financialTotals.totalWeight.toFixed(1)} kg</div>
                  </div>
                  <div className="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase">{isArabic ? 'تكلفة الوصول' : 'Total Landed Cost'}</div>
                    <div className="text-xs sm:text-sm font-bold text-slate-100">
                      {formatCurrency(financialTotals.totalCost, primaryCurrency)}
                    </div>
                  </div>
                  <div className="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase">{isArabic ? 'الإيراد المتوقع' : 'Projected Revenue'}</div>
                    <div className="text-xs sm:text-sm font-bold text-slate-100">
                      {formatCurrency(financialTotals.totalRevenue, primaryCurrency)}
                    </div>
                  </div>
                  <div className="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase">{isArabic ? 'صافي الربح / الخسارة' : 'Net Profit / Loss'}</div>
                    <div
                      className={`text-xs sm:text-sm font-black ${
                        financialTotals.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {financialTotals.totalProfit >= 0 ? '+' : ''}
                      {formatCurrency(financialTotals.totalProfit, primaryCurrency)} ({financialTotals.marginPct.toFixed(1)}%)
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-tab: Manual vs AI Upload */}
              <div className="flex border-b border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreationMethod('manual')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
                    creationMethod === 'manual'
                      ? 'border-sky-600 text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  {isArabic ? 'الإدخال اليدوي لبيانات الرحلة' : 'Manual Flight Details'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMethod('ai')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
                    creationMethod === 'ai'
                      ? 'border-sky-600 text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-sky-500" />
                  {isArabic ? 'استخراج ذكي من ملف AWB / PDF' : 'AI PDF Manifest Extraction'}
                </button>
              </div>

              {/* AI OCR Upload Component */}
              {creationMethod === 'ai' && (
                <div className="space-y-3">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-sky-300 dark:border-sky-800 hover:border-sky-500 bg-sky-50/40 dark:bg-sky-950/10 rounded-2xl p-5 text-center cursor-pointer transition-all hover:bg-sky-50/80 group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 mx-auto flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      {isUploading ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5" />
                      )}
                    </div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                      {isUploading
                        ? isArabic
                          ? 'جاري تحليل بوليصة الشحن والرحلة بالذكاء الاصطناعي...'
                          : 'Extracting Flight Manifest with AI...'
                        : isArabic
                        ? 'اضغط لرفع ملف PDF أو صورة بوليصة الشحن (AWB)'
                        : 'Upload Air Waybill (AWB) or Flight Manifest PDF'}
                    </div>
                    {uploadedFileName && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 rounded-full border border-sky-200 dark:border-sky-700">
                        <FileText className="w-3 h-3" />
                        {uploadedFileName}
                      </div>
                    )}
                  </div>

                  {ocrError && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>{ocrError}</div>
                    </div>
                  )}

                  {extractedData && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        {isArabic
                          ? `تم استخراج البيانات: ${extractedData.airline || ''} ${extractedData.flightNumber || ''} (${extractedData.originAirport || ''} ➔ ${extractedData.destinationAirport || ''})`
                          : `Extracted: ${extractedData.airline || ''} ${extractedData.flightNumber || ''} (${extractedData.originAirport || ''} ➔ ${extractedData.destinationAirport || ''})`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Flight Form */}
              <form id="new-flight-form" onSubmit={handleSaveNewFlight} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
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
                        className={`w-full text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold ${
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

                  {/* Origin Airport */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isArabic ? 'مطار الإقلاع (المصدر)' : 'Origin Airport'}
                    </label>
                    <div className="relative">
                      <Compass className={`w-4 h-4 absolute top-3 text-slate-400 ${isArabic ? 'right-3' : 'left-3'}`} />
                      <input
                        type="text"
                        placeholder="e.g. CAN - Guangzhou"
                        value={originAirport}
                        onChange={(e) => setOriginAirport(e.target.value)}
                        className={`w-full text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                          isArabic ? 'pr-9' : 'pl-9'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Destination Airport */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isArabic ? 'مطار الوصول (الوجهة)' : 'Destination Airport'}
                    </label>
                    <div className="relative">
                      <Globe className={`w-4 h-4 absolute top-3 text-slate-400 ${isArabic ? 'right-3' : 'left-3'}`} />
                      <input
                        type="text"
                        placeholder="e.g. CAI - Cairo"
                        value={destinationAirport}
                        onChange={(e) => setDestinationAirport(e.target.value)}
                        className={`w-full text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                          isArabic ? 'pr-9' : 'pl-9'
                        }`}
                      />
                    </div>
                  </div>

                  {/* AWB Number */}
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

                  {/* Consignment Status */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isArabic ? 'حالة الشحنة الجوية' : 'Flight Status'}
                    </label>
                    <select
                      value={status}
                      onChange={(e: any) => setStatus(e.target.value)}
                      className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
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
                      {isArabic ? 'ملاحظات وتوجيهات الشحنة' : 'Handling & Routing Notes'}
                    </label>
                    <input
                      type="text"
                      placeholder={isArabic ? 'أية تعليمات تخليص أو تفاصيل إضافية...' : 'Special clearance instructions, agent remarks...'}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </form>

              {/* Items Table */}
              <div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                  <span>{isArabic ? 'المنتجات التي سيتم ربطها بهذه الرحلة:' : 'Products to be Linked to this Flight:'}</span>
                  <span className="text-[11px] text-slate-400">
                    {itemsToLink.length} {isArabic ? 'سجل' : 'records'}
                  </span>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto max-h-40">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">{isArabic ? 'المنتج' : 'Product'}</th>
                          <th className="py-2 px-3 text-center">{isArabic ? 'الكمية' : 'Qty'}</th>
                          <th className="py-2 px-3 text-center">{isArabic ? 'الوزن' : 'Weight'}</th>
                          <th className="py-2 px-3 text-right">{isArabic ? 'تكلفة الوصول' : 'Landed Cost'}</th>
                          <th className="py-2 px-3 text-right">{isArabic ? 'الإيراد' : 'Revenue'}</th>
                          <th className="py-2 px-3 text-right">{isArabic ? 'الربح' : 'Profit'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {itemsToLink.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                              <div>{item.input.title}</div>
                              <div className="text-[10px] text-slate-400">{item.input.skuSupplier || 'SKU'}</div>
                            </td>
                            <td className="py-2 px-3 text-center">{item.input.quantity.toLocaleString()}</td>
                            <td className="py-2 px-3 text-center text-slate-500">
                              {(item.chargeableWeightKg || 0).toFixed(1)} kg
                            </td>
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
          )}

          {/* ======================================================== */}
          {/* MODE 3: UNLINK SELECTED ITEMS FROM FLIGHTS               */}
          {/* ======================================================== */}
          {modalMode === 'unlink' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-black text-xs sm:text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    {isArabic
                      ? `إلغاء ربط (${alreadyLinkedSelectedItems.length}) منتج من رحلات الطيران`
                      : `Unlink (${alreadyLinkedSelectedItems.length}) products from flights`}
                  </span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  {isArabic
                    ? 'سيؤدي هذا الإجراء إلى إزالة هذه السجلات من بيانات الرحلة المعنية، وإعادة احتساب تكاليف الوصول والأرباح الصافية لتلك الرحلات تلقائياً.'
                    : 'This will remove the selected records from their assigned flight consignments and automatically recalculate their financial P&L.'}
                </p>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-56">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="py-2.5 px-3">{isArabic ? 'المنتج' : 'Product'}</th>
                        <th className="py-2.5 px-3">{isArabic ? 'الرحلة المرتبطة' : 'Linked Flight'}</th>
                        <th className="py-2.5 px-3 text-right">{isArabic ? 'تكلفة الوصول' : 'Landed Cost'}</th>
                        <th className="py-2.5 px-3 text-right">{isArabic ? 'صافي الربح' : 'Net Profit'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {alreadyLinkedSelectedItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                            <div>{item.input.title}</div>
                            <div className="text-[10px] text-slate-400">{item.input.skuSupplier}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-lg border border-sky-200 dark:border-sky-800">
                              <Plane className="w-3 h-3" />
                              {item.input.flightNumber || 'Flight'} ({item.input.airline || 'Carrier'})
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                            {formatCurrency(item.totalLandedCostTarget, item.input.targetCurrency)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.totalProfitTarget, item.input.targetCurrency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                type="button"
                onClick={handleUnlinkSelectedItems}
                disabled={isSaving}
                className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-rose-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlink2 className="w-4 h-4" />
                )}
                <span>
                  {isArabic
                    ? `تأكيد إلغاء ربط (${alreadyLinkedSelectedItems.length}) منتجات من الرحلات`
                    : `Confirm Unlinking (${alreadyLinkedSelectedItems.length}) Items from Flights`}
                </span>
              </button>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>

          {modalMode === 'create_new' && (
            <button
              type="submit"
              form="new-flight-form"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-black text-white bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 active:scale-98 rounded-xl shadow-lg shadow-sky-600/30 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {isArabic ? 'حفظ وتوثيق الرحلة الجوية' : 'Save Flight Consignment'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
