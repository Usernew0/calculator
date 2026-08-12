import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { updateSelfProfileApi } from '../lib/api';
import { Language } from '../data/translations';
import {
  UserCheck,
  Building,
  Mail,
  User,
  X,
  Lock,
  CheckCircle2,
  Database,
  Loader2,
  ShieldCheck,
  IdCard,
  Eye,
  EyeOff,
  Save,
  KeyRound,
  AlertCircle,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onLoginSuccess: (user: UserProfile) => void;
  currentUser?: UserProfile | null;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  lang,
  onLoginSuccess,
  currentUser,
}) => {
  const [username, setUsername] = useState(currentUser?.username || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [company, setCompany] = useState(currentUser?.company || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync component state when currentUser changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setUsername(currentUser?.username || '');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setName(currentUser?.name || '');
      setEmail(currentUser?.email || '');
      setCompany(currentUser?.company || '');
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى إدخال اسم المستخدم'
          : 'Please enter Username'
      );
      return;
    }

    let finalPassword = currentUser?.password || '';

    // Validation for changing password
    if (currentUser) {
      // User is logged in and editing their profile
      if (newPassword.trim() || confirmPassword.trim()) {
        // Old password check
        if (!oldPassword.trim()) {
          setErrorMsg(
            lang === 'ar'
              ? 'يرجى إدخال كلمة المرور القديمة لتغيير كلمة المرور'
              : 'Please enter your Old Password to update password'
          );
          return;
        }

        if (currentUser.password && oldPassword.trim() !== currentUser.password) {
          setErrorMsg(
            lang === 'ar'
              ? 'كلمة المرور القديمة غير صحيحة'
              : 'Old Password is incorrect'
          );
          return;
        }

        if (newPassword.trim() !== confirmPassword.trim()) {
          setErrorMsg(
            lang === 'ar'
              ? 'كلمتا المرور الجديدة والتأكيد غير متطابقتين'
              : 'New password and confirm password do not match'
          );
          return;
        }

        finalPassword = newPassword.trim();
      } else if (oldPassword.trim()) {
        // If only old password entered without new password, check match
        if (currentUser.password && oldPassword.trim() !== currentUser.password) {
          setErrorMsg(
            lang === 'ar'
              ? 'كلمة المرور القديمة غير صحيحة'
              : 'Old Password is incorrect'
          );
          return;
        }
      }
    } else {
      // New login / registration flow
      if (newPassword.trim() || confirmPassword.trim()) {
        if (newPassword.trim() !== confirmPassword.trim()) {
          setErrorMsg(
            lang === 'ar'
              ? 'كلمتا المرور الجديدة والتأكيد غير متطابقتين'
              : 'New password and confirm password do not match'
          );
          return;
        }
        finalPassword = newPassword.trim();
      } else if (oldPassword.trim()) {
        finalPassword = oldPassword.trim();
      } else {
        setErrorMsg(
          lang === 'ar'
            ? 'يرجى إدخال كلمة المرور'
            : 'Please enter a Password'
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Update profile securely via backend API
      const updatedUser = await updateSelfProfileApi({
        oldPassword: oldPassword.trim() || undefined,
        newPassword: newPassword.trim() || undefined,
        name: name.trim(),
        email: email.trim(),
        company: company.trim(),
      });

      // Persist in localStorage
      localStorage.setItem('cargo_user_profile', JSON.stringify(updatedUser));

      const successTxt = lang === 'ar'
        ? 'تم حفظ التغييرات والبيانات بنجاح !'
        : 'User information and changes saved successfully!';

      setSuccessMsg(successTxt);

      setTimeout(() => {
        onLoginSuccess(updatedUser);
        setIsSubmitting(false);
        setSuccessMsg(null);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Error saving user profile:', err);
      setErrorMsg(
        err?.message ||
        (lang === 'ar' ? 'فشل حفظ التغييرات.' : 'Failed to save changes.')
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-all animate-fadeIn">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Header Banner */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <IdCard className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">
                {currentUser
                  ? (lang === 'ar' ? 'تعديل بيانات ملف المستخدم' : 'User Information & Account Settings')
                  : (lang === 'ar' ? 'تسجيل الدخول / إدارة بيانات الحساب' : 'User Sign In & Profile Management')}
              </h2>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                {lang === 'ar'
                  ? 'قم بتعديل وتحديث بياناتك الشخصية وتغيير كلمة المرور'
                  : 'Manage your profile details and set a new password.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
          {/* Username Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              {lang === 'ar' ? 'اسم المستخدم' : 'Username'} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-3 rtl:pr-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4 text-emerald-500" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={lang === 'ar' ? 'أدخل اسم المستخدم' : 'e.g. trader_ebrahim'}
                className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>

          {/* Password Section */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              <KeyRound className="w-4 h-4 text-amber-500" />
              <span>{lang === 'ar' ? 'إعدادات كلمة المرور' : 'Password Management'}</span>
            </div>

            {/* Old Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {lang === 'ar' ? 'كلمة المرور القديمة' : 'Old Password'}
                </label>
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {showOldPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showOldPassword ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'إظهار' : 'Show')}</span>
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-3 rtl:pr-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder={lang === 'ar' ? 'أدخل كلمة المرور القديمة/الحالية' : 'Enter current/old password'}
                  className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-9 rtl:pl-9 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </div>

            {/* Grid for New Password & Confirm New Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* New Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    {lang === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="text-[10px] text-slate-500 hover:text-emerald-500 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-2.5 rtl:pr-2.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={lang === 'ar' ? 'كلمة المرور الجديدة' : 'Enter new password'}
                    className="w-full ltr:pl-8 rtl:pr-8 ltr:pr-8 rtl:pl-8 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              {/* Confirm New Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    {lang === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Pass'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-[10px] text-slate-500 hover:text-emerald-500 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-2.5 rtl:pr-2.5 flex items-center pointer-events-none text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={lang === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm new password'}
                    className="w-full ltr:pl-8 rtl:pr-8 ltr:pr-8 rtl:pl-8 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Full Name Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              {lang === 'ar' ? 'الاسم الكامل' : 'Full Name'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-3 rtl:pr-3 flex items-center pointer-events-none text-slate-400">
                <IdCard className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={lang === 'ar' ? 'أدخل الاسم الكامل' : 'e.g. Ebrahim Ayman'}
                className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>

          {/* Grid: Email & Company Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                {lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-3 rtl:pr-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={lang === 'ar' ? 'example@company.com' : 'trader@company.com'}
                  className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                {lang === 'ar' ? 'اسم الشركة' : 'Company Name'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-3 rtl:pr-3 flex items-center pointer-events-none text-slate-400">
                  <Building className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder={lang === 'ar' ? 'اسم الشركة أو المؤسسة' : 'e.g. Global Logistics Co.'}
                  className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </div>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Save Changes Submit Button */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-all cursor-pointer"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
