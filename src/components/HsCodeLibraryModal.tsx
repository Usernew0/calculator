import React, { useState, useEffect } from 'react';
import { INITIAL_HS_CODES, HsCodeItem } from '../data/hsCodes';
import { Language } from '../data/translations';
import { Search, X, Plus, BookOpen, Check, Trash2, Tag, Percent, ArrowRight } from 'lucide-react';

interface HsCodeLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectHsCode: (item: HsCodeItem) => void;
  lang: Language;
}

export const HsCodeLibraryModal: React.FC<HsCodeLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectHsCode,
  lang,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hsCodes, setHsCodes] = useState<HsCodeItem[]>([]);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);

  // New Custom HS Code form inputs
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newDescEn, setNewDescEn] = useState('');
  const [newDescAr, setNewDescAr] = useState('');
  const [newDuty, setNewDuty] = useState<number | ''>('');
  const [newCatEn, setNewCatEn] = useState('Custom Category');
  const [newCatAr, setNewCatAr] = useState('تصنيف مخصص');

  // Load custom codes from localStorage on mount
  useEffect(() => {
    try {
      const savedCustom = localStorage.getItem('cargo_custom_hscodes');
      let customList: HsCodeItem[] = [];
      if (savedCustom) {
        customList = JSON.parse(savedCustom);
      }
      setHsCodes([...INITIAL_HS_CODES, ...customList]);
    } catch {
      setHsCodes(INITIAL_HS_CODES);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Extract distinct categories
  const categories = Array.from(
    new Set(hsCodes.map((item) => (lang === 'ar' ? item.categoryAr : item.categoryEn)))
  );

  // Filter list by search term & category
  const filteredCodes = hsCodes.filter((item) => {
    const cat = lang === 'ar' ? item.categoryAr : item.categoryEn;
    const matchesCategory = selectedCategory === 'all' || cat === selectedCategory;

    const term = searchTerm.toLowerCase().trim();
    if (!term) return matchesCategory;

    const matchesTerm =
      (item.code || '').toLowerCase().includes(term) ||
      (item.descriptionEn || '').toLowerCase().includes(term) ||
      (item.descriptionAr || '').toLowerCase().includes(term) ||
      (item.categoryEn || '').toLowerCase().includes(term) ||
      (item.categoryAr || '').toLowerCase().includes(term);

    return matchesCategory && matchesTerm;
  });

  const handleAddCustomHsCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || newDuty === '') return;

    const customItem: HsCodeItem = {
      code: newCode.trim(),
      categoryEn: newCatEn || 'Custom',
      categoryAr: newCatAr || 'مخصص',
      descriptionEn: newDescEn.trim() || newCode,
      descriptionAr: newDescAr.trim() || newDescEn || newCode,
      dutyRate: typeof newDuty === 'number' ? newDuty : parseFloat(newDuty) || 0,
      isCustom: true,
    };

    const updated = [customItem, ...hsCodes];
    setHsCodes(updated);

    // Save only custom ones to localStorage
    const onlyCustom = updated.filter((x) => x.isCustom);
    localStorage.setItem('cargo_custom_hscodes', JSON.stringify(onlyCustom));

    // Reset Form
    setNewCode('');
    setNewDescEn('');
    setNewDescAr('');
    setNewDuty('');
    setShowAddForm(false);
  };

  const handleDeleteCustomHsCode = (codeToDelete: string) => {
    const updated = hsCodes.filter((x) => x.code !== codeToDelete || !x.isCustom);
    setHsCodes(updated);
    const onlyCustom = updated.filter((x) => x.isCustom);
    localStorage.setItem('cargo_custom_hscodes', JSON.stringify(onlyCustom));
  };

  const handleApply = (item: HsCodeItem) => {
    setAppliedCode(item.code);
    onSelectHsCode(item);
    setTimeout(() => {
      setAppliedCode(null);
      onClose();
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{lang === 'ar' ? 'مكتبة التعريفة الجمركية وأكواد الـ HS Code' : 'HS Code & Customs Duty Library'}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar'
                  ? 'ابحث عن كود البند الجمركي وطبق نسبة الجمرك مباشرة على الحاسبة'
                  : 'Search tariff codes & apply duty percentages directly to your freight calculation'}
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

        {/* Search & Filter Control Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  lang === 'ar'
                    ? 'ابحث بالكود (مثال: 8517) أو الوصف (مثال: هواتف، قهوة، ملابس)...'
                    : 'Search by HS code (e.g. 8517) or product keyword (e.g. phones, coffee)...'
                }
                className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
            >
              <option value="all">{lang === 'ar' ? 'جميع التصنيفات' : 'All Categories'}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Add Custom Button */}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إضافة بند مخصص' : 'Add Custom Code'}</span>
            </button>
          </div>

          {/* Inline Add Custom HS Code Form */}
          {showAddForm && (
            <form onSubmit={handleAddCustomHsCode} className="p-3.5 rounded-xl bg-slate-900 text-white space-y-3 border border-amber-500/40 shadow-inner">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إضافة بند جمركي مخصص للمكتبة' : 'Add Custom Duty Tariff Code'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] text-slate-300 font-bold mb-1">
                    {lang === 'ar' ? 'كود الـ HS Code' : 'HS Code Number'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 8517.13"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-300 font-bold mb-1">
                    {lang === 'ar' ? 'الوصف (عربي / إنجليزي)' : 'Product Description'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={lang === 'ar' ? 'وصف المنتج' : 'Item description'}
                    value={lang === 'ar' ? newDescAr : newDescEn}
                    onChange={(e) => {
                      setNewDescAr(e.target.value);
                      setNewDescEn(e.target.value);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-300 font-bold mb-1">
                    {lang === 'ar' ? 'نسبة الجمرك (%)' : 'Duty Rate (%)'} *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    placeholder="0%"
                    value={newDuty}
                    onChange={(e) => setNewDuty(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-amber-300 font-bold"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    className="w-full py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer transition-colors"
                  >
                    {lang === 'ar' ? 'حفظ الكود' : 'Save Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                  >
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Results List Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar">
          {filteredCodes.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2 stroke-[1.5]" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                {lang === 'ar' ? 'لم يتم العثور على أي بند جمركي يطابق البحث' : 'No matching tariff codes found'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {lang === 'ar'
                  ? 'جرب البحث بكلمة أخرى أو أضف بنداً مخصصاً جديداً'
                  : 'Try adjusting your search terms or add a new custom tariff code.'}
              </p>
            </div>
          ) : (
            filteredCodes.map((item) => {
              const isApplied = appliedCode === item.code;
              return (
                <div
                  key={item.code}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-500/50 dark:hover:border-amber-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-slate-900 dark:bg-slate-950 text-amber-400 border border-slate-700">
                        HS {item.code}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {lang === 'ar' ? item.categoryAr : item.categoryEn}
                      </span>
                      {item.isCustom && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {lang === 'ar' ? 'مخصص' : 'Custom'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {lang === 'ar' ? item.descriptionAr : item.descriptionEn}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        {lang === 'ar' ? 'نسبة الجمرك' : 'Duty Tariff'}
                      </span>
                      <span className="text-base font-black text-amber-600 dark:text-amber-400 flex items-center justify-end gap-0.5">
                        <Percent className="w-3.5 h-3.5 stroke-[3]" />
                        {item.dutyRate}%
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomHsCode(item.code)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title={lang === 'ar' ? 'حذف البند المخصص' : 'Delete custom code'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleApply(item)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                          isApplied
                            ? 'bg-emerald-500 text-slate-950 scale-105'
                            : 'bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white dark:bg-slate-800 dark:hover:bg-amber-500 dark:hover:text-slate-950'
                        }`}
                      >
                        {isApplied ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>{lang === 'ar' ? 'تم التطبيق!' : 'Applied!'}</span>
                          </>
                        ) : (
                          <>
                            <span>{lang === 'ar' ? 'تطبيق الجمرك' : 'Apply Tariff'}</span>
                            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span>
            {lang === 'ar'
              ? `إجمالي الأكواد المتوفرة: ${hsCodes.length}`
              : `Total Available Tariff Codes: ${hsCodes.length}`}
          </span>
          <span className="font-bold text-amber-600 dark:text-amber-400">
            {lang === 'ar' ? 'تطبيق تلقائي للحاسبة' : 'Auto-Sync Duty Rate'}
          </span>
        </div>
      </div>
    </div>
  );
};
