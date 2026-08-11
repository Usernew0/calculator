import React, { useState, useEffect } from 'react';
import { CalculationResult } from '../types';
import { translations, Language } from '../data/translations';
import {
  X,
  Package,
  Upload,
  Trash2,
  Save,
  Tag,
  ImageIcon,
} from 'lucide-react';

interface ProductGroupInfo {
  key: string;
  title: string;
  sku: string;
  image?: string;
  records: CalculationResult[];
}

interface EditProductInfoModalProps {
  group: ProductGroupInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedRecords: CalculationResult[]) => void;
  t: typeof translations['en'];
  lang: Language;
}

export const EditProductInfoModal: React.FC<EditProductInfoModalProps> = ({
  group,
  isOpen,
  onClose,
  onSave,
  t,
  lang,
}) => {
  const [title, setTitle] = useState('');
  const [skuSupplier, setSkuSupplier] = useState('');
  const [invoiceImage, setInvoiceImage] = useState<string>('');

  useEffect(() => {
    if (group) {
      setTitle(group.title || '');
      setSkuSupplier(group.sku === 'N/A' ? '' : group.sku);
      setInvoiceImage(group.image || '');
    }
  }, [group]);

  if (!isOpen || !group) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert(lang === 'ar' ? 'حجم الصورة كبير جداً. الحد الأقصى 5 ميجابايت.' : 'Image file is too large. Max size is 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setInvoiceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedRecords: CalculationResult[] = group.records.map((record) => {
      return {
        ...record,
        input: {
          ...record.input,
          title: title.trim() || record.input.title || 'Untitled Product',
          skuSupplier: skuSupplier.trim() || 'N/A',
          invoiceImage: invoiceImage || undefined,
        },
      };
    });

    onSave(updatedRecords);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {t.editProductModalTitle || (lang === 'ar' ? 'تعديل بيانات الكتالوج للمنتج' : 'Edit Product Catalog Info')}
              </h3>
              <p className="text-xs text-slate-400">
                {t.editProductModalSubtitle || (lang === 'ar' ? 'تحديث اسم المنتج، رمز SKU، والصورة لجميع معاملات هذا المنتج.' : 'Update product title, SKU, or photo across all records in this product group.')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Product Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t.productTitleLabel || (lang === 'ar' ? 'اسم المنتج' : 'Product Name / Title')}
            </label>
            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 pl-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder={lang === 'ar' ? 'مثال: هاتف ذكي سامسونج' : 'e.g., Samsung Galaxy S24'}
              />
              <Package className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          {/* Product SKU */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t.skuSupplierLabel || (lang === 'ar' ? 'كود/رمز SKU المورد' : 'Supplier SKU / Code')}
            </label>
            <div className="relative">
              <input
                type="text"
                value={skuSupplier}
                onChange={(e) => setSkuSupplier(e.target.value)}
                className="w-full px-3.5 py-2.5 pl-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="SKU-10020"
              />
              <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          {/* Product Cargo Image */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t.imageUrlLabel || (lang === 'ar' ? 'صورة المنتج / الشحنة' : 'Product Image')}
            </label>

            {invoiceImage ? (
              <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-2 overflow-hidden flex items-center justify-between gap-3">
                <img
                  src={invoiceImage}
                  alt="Product preview"
                  className="w-16 h-16 object-cover rounded-lg border border-slate-800"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-emerald-400 truncate">{lang === 'ar' ? 'تم إرفاق صورة المنتج' : 'Product Image Attached'}</p>
                  <p className="text-[10px] text-slate-400 truncate">{lang === 'ar' ? 'ستُحفظ بجميع المعاملات' : 'Will update across all records'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInvoiceImage('')}
                  className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors border border-rose-500/30 cursor-pointer"
                  title={t.removeImageBtn}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all hover:bg-emerald-500/5">
                    <Upload className="w-4 h-4 text-emerald-500" />
                    <span>{t.uploadImageFile || (lang === 'ar' ? 'رفع صورة' : 'Upload Photo')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="relative">
                  <input
                    type="url"
                    value={invoiceImage}
                    onChange={(e) => setInvoiceImage(e.target.value)}
                    placeholder={lang === 'ar' ? 'أو أدخل رابط صورة مباشر (https://...)' : 'Or paste direct image URL (https://...)'}
                    className="w-full px-3 py-2 pl-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer transition-all"
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-md transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{t.saveChangesBtn}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
