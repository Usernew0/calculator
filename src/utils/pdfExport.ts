import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CalculationResult, FlightConsignment } from '../types';
import { formatCurrency } from '../data/currencies';
import { Language } from '../data/translations';
import {
  getCalculationGrossWeightKg,
  getCalculationChargeableWeightKg,
  getCalculationVolumeCBM,
  getCalculationPieces,
  getCalculationLandedCost,
  getCalculationRevenue,
  getCalculationProfit,
} from './calculator';

export async function exportSingleCalculationPDF(result: CalculationResult, lang: Language = 'en'): Promise<void> {
  const isArabic = lang === 'ar';
  const input = result.input;
  const targetCurr = input.targetCurrency;

  // Create temporary container
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

  const reportRef = `#REF-${result.id.slice(-8).toUpperCase()}`;
  const formattedDate = new Date(result.createdAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US');

  const titleText = isArabic ? 'تقرير تكلفة الشحن والوصول والأرباح' : 'FREIGHT & TRADE LANDED COST REPORT';
  const overviewTitle = isArabic ? 'ملخص مواصفات الشحنة والمنتج' : 'SHIPMENT & PRODUCT OVERVIEW';
  const financialSummaryTitle = isArabic ? 'الملخص المالي الرئيسي' : 'KEY FINANCIAL SUMMARY';
  const costBreakdownTitle = isArabic ? 'تفاصيل مكونات التكلفة التفصيلية' : 'DETAILED COST BREAKDOWN';
  const profitMetricsTitle = isArabic ? 'مؤشرات الأرباح والعائد' : 'PROFIT & ROI METRICS';

  container.innerHTML = `
    <div style="border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <!-- Header Banner -->
      <div style="background: #0f172a; color: #ffffff; padding: 24px 28px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; color: #10b981; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
            <span>❖</span> Elegant FX • OFFICIAL REPORT
          </div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">${titleText}</h1>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${isArabic ? 'تقرير رسمي حسابي موثق للتبادل التجاري' : 'Automated Official Multi-Currency Landed Cost Verification'}</div>
        </div>
        <div style="text-align: ${isArabic ? 'left' : 'right'}; font-size: 11px; color: #cbd5e1; font-family: monospace;">
          <div style="font-weight: 700; color: #34d399; font-size: 13px;">${reportRef}</div>
          <div style="margin-top: 4px;">${formattedDate}</div>
        </div>
      </div>

      <div style="padding: 24px;">
        <!-- Overview Box -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">${overviewTitle}</div>
          <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">${input.title || (isArabic ? 'شحنة بضائع عامة' : 'Untitled Cargo Shipment')}</div>
          
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 12px; color: #334155;">
            <div><strong>${isArabic ? 'رمز المنتج / المورد:' : 'SKU / Supplier:'}</strong> ${input.skuSupplier || 'N/A'}</div>
            <div><strong>${isArabic ? 'الفئة:' : 'Category:'}</strong> ${input.category || (isArabic ? 'بضائع عامة' : 'General Cargo')}</div>
            <div><strong>${isArabic ? 'نوع العملية التجارية:' : 'Trade Operation:'}</strong> ${input.tradeDirection === 'export' ? (isArabic ? 'شحنة تصدير (Export)' : 'Export Shipment') : (isArabic ? 'شحنة استيراد (Import)' : 'Import Shipment')}</div>
            <div><strong>${isArabic ? 'طريقة الشحن:' : 'Freight Mode:'}</strong> ${input.freightMethod.toUpperCase().replace('_', ' ')}</div>
            <div><strong>${isArabic ? 'الكمية الإجمالية:' : 'Total Quantity:'}</strong> ${input.quantity.toLocaleString()} ${isArabic ? 'وحدة' : 'units'}</div>
            <div><strong>${isArabic ? 'الوزن الإجمالي القائم:' : 'Gross Weight:'}</strong> ${getCalculationGrossWeightKg(result).toFixed(1)} kg (${input.weight} ${input.weightUnit}/${isArabic ? 'قطعة' : 'pc'})</div>
            <div><strong>${isArabic ? 'الوزن القابل للاحتساب:' : 'Chargeable Weight:'}</strong> ${getCalculationChargeableWeightKg(result).toFixed(1)} kg</div>
            <div><strong>${isArabic ? 'الحجم التكعيبي:' : 'Volumetric CBM:'}</strong> ${getCalculationVolumeCBM(result).toFixed(3)} CBM</div>
          </div>

          ${input.invoiceImage ? `
            <div style="margin-top: 14px; padding: 10px 14px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; display: flex; align-items: center; gap: 14px;">
              <img src="${input.invoiceImage}" style="max-height: 110px; max-width: 180px; object-fit: contain; border-radius: 6px; border: 1px solid #e2e8f0;" />
              <div style="font-size: 11px; color: #334155;">
                <strong style="color: #0f172a;">${isArabic ? 'مستند / صورة الشحنة المرفقة:' : 'Attached Invoice / Cargo Picture:'}</strong>
                <div style="font-size: 10px; color: #64748b; margin-top: 4px;">${isArabic ? 'صورة موثقة محفوظة مع السجل الحسابي' : 'Verified attached document image logged with record'}</div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- KPI 4 Card Grid -->
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 10px;">${financialSummaryTitle}</div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
          <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase;">${isArabic ? 'تكلفة الوصول / وحدة' : 'Landed Cost / Unit'}</div>
            <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 4px;">${formatCurrency(result.landedCostPerUnitTarget, targetCurr)}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${isArabic ? 'الإجمالي:' : 'Total:'} ${formatCurrency(result.totalLandedCostTarget, targetCurr)}</div>
          </div>

          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #047857; text-transform: uppercase;">${isArabic ? 'سعر البيع المقترح' : 'Suggested Selling Price'}</div>
            <div style="font-size: 15px; font-weight: 800; color: #059669; margin-top: 4px;">${formatCurrency(result.suggestedSellingPricePerUnitTarget, targetCurr)}</div>
            <div style="font-size: 10px; color: #047857; margin-top: 2px;">${isArabic ? 'الإيراد المتوقع:' : 'Revenue:'} ${formatCurrency(result.totalRevenueTarget, targetCurr)}</div>
          </div>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #15803d; text-transform: uppercase;">${isArabic ? 'صافي الربح / وحدة' : 'Net Profit / Unit'}</div>
            <div style="font-size: 15px; font-weight: 800; color: #16a34a; margin-top: 4px;">${formatCurrency(result.profitPerUnitTarget, targetCurr)}</div>
            <div style="font-size: 10px; color: #15803d; margin-top: 2px;">${isArabic ? 'إجمالي الربح:' : 'Total Profit:'} ${formatCurrency(result.totalProfitTarget, targetCurr)}</div>
          </div>

          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #1d4ed8; text-transform: uppercase;">${isArabic ? 'هامش الربح %' : 'Profit Margin %'}</div>
            <div style="font-size: 15px; font-weight: 800; color: #2563eb; margin-top: 4px;">${result.actualMarginPercentage.toFixed(2)}%</div>
            <div style="font-size: 10px; color: #1d4ed8; margin-top: 2px;">${isArabic ? 'الهامش على التكلفة:' : 'Markup:'} ${result.actualMarkupPercentage.toFixed(2)}%</div>
          </div>
        </div>

        <!-- Detailed Breakdown Table -->
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">${costBreakdownTitle}</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px; text-align: ${isArabic ? 'right' : 'left'};">
          <thead>
            <tr style="background: #1e293b; color: #ffffff; font-weight: 700;">
              <th style="padding: 10px 12px; border: 1px solid #334155;">${isArabic ? 'بند التكلفة' : 'Cost Component'}</th>
              <th style="padding: 10px 12px; border: 1px solid #334155;">${isArabic ? 'أساس الاحتساب والعملة' : 'Calculation Basis'}</th>
              <th style="padding: 10px 12px; border: 1px solid #334155; text-align: ${isArabic ? 'left' : 'right'};">${isArabic ? 'المبلغ بالعملة المستهدفة' : `Amount (${targetCurr})`}</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: #ffffff;">
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600;">${isArabic ? 'سعر شراء المنتج الأصلي' : 'Original Purchase Price'}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${input.originalPrice} ${input.originalCurrency} × ${result.exchangeRate.toFixed(4)} FX</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 700; text-align: ${isArabic ? 'left' : 'right'};">${formatCurrency(result.totalOriginalPriceTarget, targetCurr)}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600;">${isArabic ? 'تكاليف الشحن اللوجستي' : 'Freight & Logistics Shipping'}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${input.freightRatePerUnit} ${input.freightCurrency || input.originalCurrency} / ${input.freightRateBasis ? input.freightRateBasis.replace('per_', '') : input.weightUnit}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 700; text-align: ${isArabic ? 'left' : 'right'};">${formatCurrency(result.freightCostTarget, targetCurr)}</td>
            </tr>
            <tr style="background: #ffffff;">
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600;">${isArabic ? 'رسوم الجمارك والاستيراد' : 'Customs Import Duty'}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${input.dutyPercentage}% CIF</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 700; text-align: ${isArabic ? 'left' : 'right'};">${formatCurrency(result.dutyCostTarget, targetCurr)}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600;">${isArabic ? 'التأمين على الشحنة' : 'Cargo Insurance'}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${input.insurancePercentage}% FOB</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 700; text-align: ${isArabic ? 'left' : 'right'};">${formatCurrency(result.insuranceCostTarget, targetCurr)}</td>
            </tr>
            <tr style="background: #ffffff;">
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600;">${isArabic ? 'رسوم الموانئ والمناولات' : 'Origin & Destination Port Handling'}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${isArabic ? 'رسوم مناولة وتفريغ' : 'Terminal / Port charges'}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 700; text-align: ${isArabic ? 'left' : 'right'};">${formatCurrency(result.originHandlingTarget + result.destinationHandlingTarget, targetCurr)}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600;">${isArabic ? 'التخليص الجمركي والنقل الداخلي' : 'Customs Clearance & Inland Transport'}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${isArabic ? 'تخليص ونقل نهائي' : 'Brokerage & final delivery'}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 700; text-align: ${isArabic ? 'left' : 'right'};">${formatCurrency(result.customsClearanceTarget + result.inlandDeliveryTarget, targetCurr)}</td>
            </tr>
            <tr style="background: #ffffff;">
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600;">${isArabic ? 'مصاريف إضافية مخصصة' : 'Extra Custom Added Fees'}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${isArabic ? 'بنود إضافية' : 'Custom added line items'}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 700; text-align: ${isArabic ? 'left' : 'right'};">${formatCurrency(result.extraFeesTotalTarget, targetCurr)}</td>
            </tr>
            <tr style="background: #0f172a; color: #ffffff; font-weight: 800;">
              <td style="padding: 10px 12px; border: 1px solid #0f172a;" colspan="2">${isArabic ? 'إجمالي تكلفة الوصول الإجمالية (LANDED COST)' : 'TOTAL LANDED COST'}</td>
              <td style="padding: 10px 12px; border: 1px solid #0f172a; color: #34d399; font-size: 13px; text-align: ${isArabic ? 'left' : 'right'};">${formatCurrency(result.totalLandedCostTarget, targetCurr)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Profitability Summary Table -->
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">${profitMetricsTitle}</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; text-align: ${isArabic ? 'right' : 'left'};">
          <tbody>
            <tr style="background: #f8fafc;">
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600;">${isArabic ? 'استراتيجية التسعير الأرباح' : 'Pricing Goal Strategy'}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 700;">${input.pricingStrategy.toUpperCase()}</td>
            </tr>
            <tr style="background: #ffffff;">
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600;">${isArabic ? 'العائد على الاستثمار (ROI %)' : 'Return on Investment (ROI %)'}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 700; color: #059669;">${result.roiPercentage.toFixed(2)}%</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600;">${isArabic ? 'إجمالي المبيعات المتوقعة' : 'Total Projected Revenue'}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 800; color: #0f172a;">${formatCurrency(result.totalRevenueTarget, targetCurr)}</td>
            </tr>
          </tbody>
        </table>

        <div style="border-t: 1px border #e2e8f0; padding-top: 12px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8;">
          <div>Elegant FX • Global Freight & Landed Cost Intelligence</div>
          <div>Page 1 of 1</div>
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

    const filenameTitle = (input.title || 'Report').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
    pdf.save(`Elegant_${filenameTitle}_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (error) {
    console.error('Error generating PDF report:', error);
  } finally {
    document.body.removeChild(container);
  }
}

export async function exportHistoricalSummaryPDF(results: CalculationResult[], lang: Language = 'en', defaultCurrency = 'EGP'): Promise<void> {
  const isArabic = lang === 'ar';

  // Create temporary container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '1100px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Cairo, Tajawal, "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  container.style.direction = isArabic ? 'rtl' : 'ltr';
  container.style.padding = '32px';
  container.style.boxSizing = 'border-box';

  const titleText = isArabic ? 'تقرير سجل حسابات التكاليف والشحنات التاريخية' : 'HISTORICAL SHIPMENT & LANDED COST SUMMARY REPORT';
  const totalLandedSum = results.reduce((acc, curr) => acc + curr.totalLandedCostTarget, 0);
  const totalProfitSum = results.reduce((acc, curr) => acc + curr.totalProfitTarget, 0);
  const totalGrossWeightSum = results.reduce((acc, curr) => acc + getCalculationGrossWeightKg(curr), 0);

  const tableRowsHtml = results
    .map((r, idx) => {
      const title = r.input.title || (isArabic ? 'شحنة' : 'Shipment');
      const curr = r.input.targetCurrency || defaultCurrency;
      const qty = r.input.quantity;
      const weightKg = getCalculationGrossWeightKg(r).toFixed(1);
      const landedCost = formatCurrency(r.totalLandedCostTarget, curr);
      const revenue = formatCurrency(r.totalRevenueTarget, curr);
      const profit = formatCurrency(r.totalProfitTarget, curr);
      const margin = `${r.actualMarginPercentage.toFixed(1)}%`;
      const mode = r.input.freightMethod.toUpperCase().replace('_', ' ');
      const dateStr = new Date(r.createdAt).toLocaleDateString(isArabic ? 'ar-EG' : 'en-US');

      return `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 700;">${idx + 1}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${dateStr}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700;">${title}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${mode}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${qty}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 700; color: #0284c7;">${weightKg} kg</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700; text-align: ${isArabic ? 'left' : 'right'};">${landedCost}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; color: #059669; font-weight: 700; text-align: ${isArabic ? 'left' : 'right'};">${revenue}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; color: #16a34a; font-weight: 800; text-align: ${isArabic ? 'left' : 'right'};">${profit}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700; text-align: center;">${margin}</td>
      </tr>
    `;
    })
    .join('');

  container.innerHTML = `
    <div style="border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
      <div style="background: #0f172a; color: #ffffff; padding: 24px 28px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; color: #10b981; font-weight: 800; font-size: 11px; text-transform: uppercase;">
            <span>❖</span> Elegant FX • HISTORICAL SUMMARY
          </div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800;">${titleText}</h1>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${isArabic ? 'تقرير تحليلي تراكمي لكافة الشحنات المجهزة' : 'Cumulative Multi-Shipment Analytical Performance Summary'}</div>
        </div>
        <div style="text-align: ${isArabic ? 'left' : 'right'}; font-size: 11px; color: #cbd5e1;">
          <div>${isArabic ? 'إجمالي السجلات:' : 'Total Records:'} <strong>${results.length}</strong></div>
          <div>${new Date().toLocaleDateString(isArabic ? 'ar-EG' : 'en-US')}</div>
        </div>
      </div>

      <div style="padding: 24px;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 10px;">
            <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">${isArabic ? 'إجمالي قيمة الشحنات التراكمية' : 'Combined Total Landed Cost'}</div>
            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px;">${formatCurrency(totalLandedSum, defaultCurrency)}</div>
          </div>
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 12px 16px; border-radius: 10px;">
            <div style="font-size: 11px; color: #0284c7; font-weight: 700; text-transform: uppercase;">${isArabic ? 'إجمالي الوزن القائم التراكمي' : 'Combined Total Gross Weight'}</div>
            <div style="font-size: 18px; font-weight: 800; color: #0369a1; margin-top: 2px;">${totalGrossWeightSum.toFixed(1)} KG</div>
          </div>
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px 16px; border-radius: 10px;">
            <div style="font-size: 11px; color: #047857; font-weight: 700; text-transform: uppercase;">${isArabic ? 'إجمالي الأرباح الصافية المحققة' : 'Combined Net Projected Profit'}</div>
            <div style="font-size: 18px; font-weight: 800; color: #059669; margin-top: 2px;">${formatCurrency(totalProfitSum, defaultCurrency)}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: ${isArabic ? 'right' : 'left'};">
          <thead>
            <tr style="background: #1e293b; color: #ffffff; font-weight: 700;">
              <th style="padding: 10px 8px; border: 1px solid #334155; text-align: center;">#</th>
              <th style="padding: 10px 8px; border: 1px solid #334155;">${isArabic ? 'التاريخ' : 'Date'}</th>
              <th style="padding: 10px 8px; border: 1px solid #334155;">${isArabic ? 'اسم الشحنة / المنتج' : 'Product / Shipment Title'}</th>
              <th style="padding: 10px 8px; border: 1px solid #334155;">${isArabic ? 'طريقة الشحن' : 'Freight Mode'}</th>
              <th style="padding: 10px 8px; border: 1px solid #334155; text-align: center;">${isArabic ? 'الكمية' : 'Qty'}</th>
              <th style="padding: 10px 8px; border: 1px solid #334155; text-align: center;">${isArabic ? 'الوزن (كجم)' : 'Weight (kg)'}</th>
              <th style="padding: 10px 8px; border: 1px solid #334155; text-align: ${isArabic ? 'left' : 'right'};">${isArabic ? 'التكلفة الإجمالية' : 'Total Landed Cost'}</th>
              <th style="padding: 10px 8px; border: 1px solid #334155; text-align: ${isArabic ? 'left' : 'right'};">${isArabic ? 'الإيراد المتوقع' : 'Total Revenue'}</th>
              <th style="padding: 10px 8px; border: 1px solid #334155; text-align: ${isArabic ? 'left' : 'right'};">${isArabic ? 'صافي الربح' : 'Net Profit'}</th>
              <th style="padding: 10px 8px; border: 1px solid #334155; text-align: center;">${isArabic ? 'الهامش' : 'Margin'}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = 297;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Elegant_Historical_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (error) {
    console.error('Error generating summary PDF:', error);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Export Official Air Cargo Flight Manifest & Landed Cost Consolidation Report (PDF)
 */
export async function exportFlightManifestPDF(
  flight: FlightConsignment,
  items: CalculationResult[],
  lang: Language = 'en'
): Promise<void> {
  const isArabic = lang === 'ar';
  const targetCurr = flight.targetCurrency || items[0]?.input.targetCurrency || 'USD';

  // Calculate aggregates using standardized helpers
  const totalCost = (flight.totalLandedCostEGP && flight.totalLandedCostEGP > 0)
    ? flight.totalLandedCostEGP
    : (flight.totalLandedCost && flight.totalLandedCost > 0)
    ? flight.totalLandedCost
    : items.reduce((sum, item) => sum + getCalculationLandedCost(item), 0);

  const totalRevenue = (flight.totalRevenueEGP && flight.totalRevenueEGP > 0)
    ? flight.totalRevenueEGP
    : (flight.totalRevenue && flight.totalRevenue > 0)
    ? flight.totalRevenue
    : items.reduce((sum, item) => sum + getCalculationRevenue(item), 0);

  const totalProfit = (flight.totalProfitEGP !== undefined && flight.totalProfitEGP !== 0)
    ? flight.totalProfitEGP
    : (flight.totalProfit !== undefined && flight.totalProfit !== 0)
    ? flight.totalProfit
    : totalRevenue - totalCost;

  const totalGrossWeight = (flight.totalWeightKg && flight.totalWeightKg > 0)
    ? flight.totalWeightKg
    : (flight.totalGrossWeightKg && flight.totalGrossWeightKg > 0)
    ? flight.totalGrossWeightKg
    : items.reduce((sum, item) => sum + getCalculationGrossWeightKg(item), 0);

  const totalChargeableWeight = (flight.totalChargeableWeightKg && flight.totalChargeableWeightKg > 0)
    ? flight.totalChargeableWeightKg
    : items.reduce((sum, item) => sum + getCalculationChargeableWeightKg(item), 0);

  const totalQty = (flight.totalPieces && flight.totalPieces > 0)
    ? flight.totalPieces
    : items.reduce((sum, item) => sum + getCalculationPieces(item), 0);

  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const flightCode = flight.flightNumber || 'FLIGHT';
  const flightRoute = `${flight.originAirport || 'ORIGIN'} ➔ ${flight.destinationAirport || 'DEST'}`;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '1000px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Cairo, Tajawal, "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  container.style.direction = isArabic ? 'rtl' : 'ltr';
  container.style.padding = '28px';
  container.style.boxSizing = 'border-box';

  const tableRowsHtml = items
    .map((item, idx) => {
      const input = item.input;
      const rowCurr = input.targetCurrency || targetCurr;
      const itemGrossWeight = getCalculationGrossWeightKg(item);
      const itemChargeable = getCalculationChargeableWeightKg(item);
      const itemLanded = getCalculationLandedCost(item);
      const itemRev = getCalculationRevenue(item);
      const itemProf = getCalculationProfit(item);
      const profitColor = itemProf >= 0 ? '#16a34a' : '#dc2626';
      const marginPct = itemRev > 0 ? ((itemProf / itemRev) * 100).toFixed(1) : '0.0';

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 10px 8px; font-weight: 700; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 10px 8px; font-weight: 700; color: #0f172a;">
            <div>${input.title}</div>
            <div style="font-size: 10px; color: #64748b;">SKU: ${input.skuSupplier || 'N/A'} | ${input.category || 'General Cargo'}</div>
          </td>
          <td style="padding: 10px 8px; text-align: center; font-weight: 600;">${input.quantity.toLocaleString()}</td>
          <td style="padding: 10px 8px; text-align: center; font-weight: 600;">${itemGrossWeight.toFixed(1)} kg</td>
          <td style="padding: 10px 8px; text-align: ${isArabic ? 'left' : 'right'}; font-weight: 700; color: #334155;">
            ${formatCurrency(itemLanded, rowCurr)}
          </td>
          <td style="padding: 10px 8px; text-align: ${isArabic ? 'left' : 'right'}; font-weight: 700; color: #059669;">
            ${formatCurrency(itemRev, rowCurr)}
          </td>
          <td style="padding: 10px 8px; text-align: ${isArabic ? 'left' : 'right'}; font-weight: 800; color: ${profitColor};">
            ${formatCurrency(itemProf, rowCurr)}
          </td>
          <td style="padding: 10px 8px; text-align: center; font-weight: 700; color: #2563eb;">
            ${marginPct}%
          </td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <div style="border: 1px solid #cbd5e1; border-radius: 14px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <!-- Header Banner -->
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 24px 28px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; color: #38bdf8; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px;">
            <span>✈</span> AIR FREIGHT CARGO MANIFEST & LANDED COST CONSOLIDATION
          </div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
            ${flight.flightName || flight.flightNumber}
          </h1>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px; display: flex; gap: 16px;">
            <span><strong>${isArabic ? 'الناقل الجوي:' : 'Airline:'}</strong> ${flight.airline || 'N/A'}</span>
            <span><strong>${isArabic ? 'خط السير:' : 'Route:'}</strong> ${flightRoute}</span>
            <span><strong>${isArabic ? 'تاريخ الرحلة:' : 'Date:'}</strong> ${flight.flightDate || 'N/A'}</span>
          </div>
        </div>
        <div style="text-align: ${isArabic ? 'left' : 'right'}; font-size: 11px; color: #cbd5e1; font-family: monospace;">
          <div style="font-weight: 800; color: #38bdf8; font-size: 14px;">AWB: ${flight.awbNumber || 'PENDING'}</div>
          <div style="margin-top: 4px; color: #94a3b8;">${new Date().toLocaleDateString(isArabic ? 'ar-EG' : 'en-US')}</div>
        </div>
      </div>

      <div style="padding: 24px;">
        <!-- Flight KPI Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 22px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">${isArabic ? 'إجمالي المنتجات' : 'Total Items / Qty'}</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">${items.length} ${isArabic ? 'بند' : 'SKUs'} (${totalQty.toLocaleString()} pcs)</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">${isArabic ? 'الوزن (قائم / قابل للاحتساب)' : 'Gross / Chargeable Weight'}</div>
            <div style="font-size: 15px; font-weight: 800; color: #0284c7; margin-top: 4px;">${totalGrossWeight.toFixed(1)} kg / ${totalChargeableWeight.toFixed(1)} kg</div>
            <div style="font-size: 9px; color: #64748b; margin-top: 2px;">${isArabic ? 'إجمالي الأوزان المحسوبة' : 'Calculated Manifest Weights'}</div>
          </div>
          <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase;">${isArabic ? 'إجمالي تكلفة الوصول' : 'Total Landed Cost'}</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">${formatCurrency(totalCost, targetCurr)}</div>
          </div>
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #047857; text-transform: uppercase;">${isArabic ? 'الإيراد المتوقع' : 'Total Revenue'}</div>
            <div style="font-size: 16px; font-weight: 800; color: #059669; margin-top: 4px;">${formatCurrency(totalRevenue, targetCurr)}</div>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #15803d; text-transform: uppercase;">${isArabic ? 'صافي أرباح الرحلة' : 'Net Profit (Margin)'}</div>
            <div style="font-size: 16px; font-weight: 800; color: #16a34a; margin-top: 4px;">${formatCurrency(totalProfit, targetCurr)} (${overallMargin.toFixed(1)}%)</div>
          </div>
        </div>

        <!-- Manifest Cargo Table -->
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">
          ${isArabic ? 'بيان حمولة الرحلة وتفاصيل التكلفة والأرباح للبضائع' : 'ITEMIZED FLIGHT MANIFEST & FINANCIAL BREAKDOWN'}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; text-align: ${isArabic ? 'right' : 'left'};">
          <thead>
            <tr style="background: #1e293b; color: #ffffff; font-weight: 700;">
              <th style="padding: 10px 8px; border: 1px solid #334155; text-align: center;">#</th>
              <th style="padding: 10px 8px; border: 1px solid #334155;">${isArabic ? 'اسم الصنف / البضاعة' : 'Cargo Description / SKU'}</th>
              <th style="padding: 10px 8px; border: 1px solid #334155; text-align: center;">${isArabic ? 'الكمية' : 'Qty'}</th>
              <th style="padding: 10px 8px; border: 1px solid #334155; text-align: center;">${isArabic ? 'الوزن' : 'Weight (kg)'}</th>
              <th style="padding: 10px 8px; border: 1px solid #334155; text-align: ${isArabic ? 'left' : 'right'};">${isArabic ? 'تكلفة الوصول' : 'Landed Cost'}</th>
              <th style="padding: 10px 8px; border: 1px solid #334155; text-align: ${isArabic ? 'left' : 'right'};">${isArabic ? 'الإيراد المتوقع' : 'Revenue'}</th>
              <th style="padding: 10px 8px; border: 1px solid #334155; text-align: ${isArabic ? 'left' : 'right'};">${isArabic ? 'صافي الربح' : 'Net Profit'}</th>
              <th style="padding: 10px 8px; border: 1px solid #334155; text-align: center;">${isArabic ? 'الهامش' : 'Margin'}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml || `<tr><td colspan="8" style="padding: 16px; text-align: center; color: #64748b;">${isArabic ? 'لا توجد منتجات مسجلة في هذه الرحلة' : 'No cargo items linked to this flight'}</td></tr>`}
          </tbody>
        </table>

        ${flight.notes ? `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 11px; color: #475569;">
            <strong style="color: #0f172a;">${isArabic ? 'ملاحظات وتوجيهات الشحنة:' : 'Handling & Routing Remarks:'}</strong> ${flight.notes}
          </div>
        ` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = 297;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Flight_Manifest_${flightCode}_${flight.flightDate || 'Export'}.pdf`);
  } catch (error) {
    console.error('Error generating flight manifest PDF:', error);
  } finally {
    document.body.removeChild(container);
  }
}

