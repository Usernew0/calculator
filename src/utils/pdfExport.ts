import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalculationResult } from '../types';
import { formatCurrency } from '../data/currencies';

export function exportSingleCalculationPDF(result: CalculationResult): void {
  const doc = new jsPDF();
  const input = result.input;
  const targetCurr = input.targetCurrency;

  // Header Branding
  doc.setFillColor(15, 23, 42); // slate-900 background
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FREIGHT & TRADE LANDED COST REPORT', 14, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Report Ref: #${result.id.slice(-8).toUpperCase()}`, 14, 26);
  doc.text(`Generated: ${new Date(result.createdAt).toLocaleString()}`, 130, 26);

  let yPos = 42;

  // Overview Box
  doc.setFillColor(248, 250, 252);
  doc.rect(14, yPos, 182, 30, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, yPos, 182, 30, 'S');

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(input.title || 'Untitled Calculation', 18, yPos + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`SKU / Supplier: ${input.skuSupplier || 'N/A'}`, 18, yPos + 16);
  doc.text(`Category: ${input.category || 'General Cargo'}`, 18, yPos + 22);
  doc.text(`Freight Mode: ${input.freightMethod.toUpperCase().replace('_', ' ')}`, 110, yPos + 16);
  doc.text(`Quantity: ${input.quantity.toLocaleString()} units`, 110, yPos + 22);

  yPos += 36;

  // Key Financial KPIs Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('FINANCIAL SUMMARY', 14, yPos);
  yPos += 4;

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Per Unit', 'Total']],
    body: [
      ['Original Item Price', formatCurrency(result.originalPriceTarget, targetCurr), formatCurrency(result.totalOriginalPriceTarget, targetCurr)],
      ['Transport & Logistics Fees', formatCurrency(result.totalTransportFeesTarget / input.quantity, targetCurr), formatCurrency(result.totalTransportFeesTarget, targetCurr)],
      ['Total Landed Cost', formatCurrency(result.landedCostPerUnitTarget, targetCurr), formatCurrency(result.totalLandedCostTarget, targetCurr)],
      ['Suggested Selling Price', formatCurrency(result.suggestedSellingPricePerUnitTarget, targetCurr), formatCurrency(result.totalRevenueTarget, targetCurr)],
      ['Estimated Net Profit', formatCurrency(result.profitPerUnitTarget, targetCurr), formatCurrency(result.totalProfitTarget, targetCurr)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  // Get final Y from last table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Detailed Cost Itemization
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DETAILED COST BREAKDOWN', 14, yPos);
  yPos += 4;

  autoTable(doc, {
    startY: yPos,
    head: [['Cost Component', 'Calculation Basis', `Amount (${targetCurr})`]],
    body: [
      ['Original Purchase Price', `${input.originalPrice} ${input.originalCurrency} x FX (${result.exchangeRate.toFixed(4)})`, formatCurrency(result.totalOriginalPriceTarget, targetCurr)],
      ['Freight Cost', `Rate: ${input.freightRatePerUnit} ${input.freightCurrency || input.originalCurrency} / ${input.freightRateBasis ? input.freightRateBasis.replace('per_', '') : input.weightUnit}`, formatCurrency(result.freightCostTarget, targetCurr)],
      ['Customs Import Duty', `${input.dutyPercentage}% on CIF value`, formatCurrency(result.dutyCostTarget, targetCurr)],
      ['Insurance', `${input.insurancePercentage}% on FOB value`, formatCurrency(result.insuranceCostTarget, targetCurr)],
      ['Origin & Destination Handling', 'Port / Terminal fees', formatCurrency(result.originHandlingTarget + result.destinationHandlingTarget, targetCurr)],
      ['Customs Clearance & Inland', 'Brokerage + Final Delivery', formatCurrency(result.customsClearanceTarget + result.inlandDeliveryTarget, targetCurr)],
      ['Extra Fees / Charges', 'Custom added line items', formatCurrency(result.extraFeesTotalTarget, targetCurr)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255] },
    styles: { fontSize: 8, cellPadding: 2.5 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Profitability Metrics
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PROFIT & MARGIN METRICS', 14, yPos);
  yPos += 4;

  autoTable(doc, {
    startY: yPos,
    head: [['Profit Metric', 'Value']],
    body: [
      ['Profit Strategy', input.pricingStrategy.toUpperCase()],
      ['Target Profit Margin', `${result.actualMarginPercentage.toFixed(2)}%`],
      ['Markup over Landed Cost', `${result.actualMarkupPercentage.toFixed(2)}%`],
      ['Return on Investment (ROI)', `${result.roiPercentage.toFixed(2)}%`],
      ['Total Expected Revenue', formatCurrency(result.totalRevenueTarget, targetCurr)],
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.1, lineColor: [200, 200, 200] },
  });

  // Footer Note
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Global Trade & Freight Landed Cost Report - Generated automatically with live exchange rate verification.', 14, 285);

  doc.save(`Landed_Cost_${input.title.replace(/[^a-zA-Z0-9]/g, '_') || 'Report'}.pdf`);
}

export function exportHistoricalSummaryPDF(results: CalculationResult[], defaultCurrency = 'USD'): void {
  const doc = new jsPDF('landscape');

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('HISTORICAL SHIPMENT & LANDED COST REPORT', 14, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Records: ${results.length} | Date: ${new Date().toLocaleDateString()}`, 200, 18);

  const tableRows = results.map((r, idx) => {
    const title = r.input.title || 'Shipment';
    const curr = r.input.targetCurrency || defaultCurrency;
    const qty = r.input.quantity;
    const landedCost = formatCurrency(r.totalLandedCostTarget, curr);
    const revenue = formatCurrency(r.totalRevenueTarget, curr);
    const profit = formatCurrency(r.totalProfitTarget, curr);
    const margin = `${r.actualMarginPercentage.toFixed(1)}%`;
    const mode = r.input.freightMethod.toUpperCase().replace('_', ' ');

    return [
      idx + 1,
      new Date(r.createdAt).toLocaleDateString(),
      title,
      mode,
      qty,
      landedCost,
      revenue,
      profit,
      margin,
    ];
  });

  autoTable(doc, {
    startY: 34,
    head: [['#', 'Date', 'Product Title', 'Freight Mode', 'Qty', 'Total Cost', 'Total Revenue', 'Net Profit', 'Margin']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
  });

  doc.save(`Historical_Trade_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
