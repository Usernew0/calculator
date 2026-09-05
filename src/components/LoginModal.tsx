import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import {
  updateSelfProfileApi,
  loginUserApi,
  setup2FaApi,
  enable2FaApi,
  disable2FaApi,
  regenerateBackupCodesApi,
} from '../lib/api';
import { updateActiveUserProfileIfCurrent, setStoredUserProfile, getSessionToken, setSessionToken } from '../lib/session';
import { generateQrCodeDataUrl, formatTotpSecret } from '../lib/totp';
import { Language, translations } from '../data/translations';
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
  ShieldOff,
  IdCard,
  Eye,
  EyeOff,
  Save,
  KeyRound,
  AlertCircle,
  QrCode,
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  Key,
  Phone,
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
  const t = translations[lang];

  const [username, setUsername] = useState(currentUser?.username || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [company, setCompany] = useState(currentUser?.company || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 2FA Management State
  const [is2FaEnabled, setIs2FaEnabled] = useState(currentUser?.twoFactorEnabled || false);
  const [isConfirmingDisable2Fa, setIsConfirmingDisable2Fa] = useState(false);
  const [show2FaSetup, setShow2FaSetup] = useState(false);
  const [setupSecret, setSetupSecret] = useState('');
  const [setupUri, setSetupUri] = useState('');
  const [setupQrUrl, setSetupQrUrl] = useState('');
  const [setupBackupCodes, setSetupBackupCodes] = useState<string[]>([]);
  const [verifyTotpCode, setVerifyTotpCode] = useState('');
  const [is2FaLoading, setIs2FaLoading] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [backupCodesList, setBackupCodesList] = useState<string[]>(currentUser?.twoFactorBackupCodes || []);

  // Sync component state when currentUser changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setUsername(currentUser?.username || '');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setName(currentUser?.name || '');
      setEmail(currentUser?.email || '');
      setPhone(currentUser?.phone || '');
      setCompany(currentUser?.company || '');
      setIs2FaEnabled(currentUser?.twoFactorEnabled || false);
      setBackupCodesList(currentUser?.twoFactorBackupCodes || []);
      setShow2FaSetup(false);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, currentUser]);

  const handleStart2FaSetup = async () => {
    const targetUsername = currentUser?.username || currentUser?.userId;
    if (!targetUsername) return;
    setIs2FaLoading(true);
    setErrorMsg(null);
    try {
      const data = await setup2FaApi(targetUsername);
      setSetupSecret(data.secret);
      setSetupUri(data.uri);
      setSetupBackupCodes(data.backupCodes);

      const qr = await generateQrCodeDataUrl(data.uri);
      setSetupQrUrl(qr);
      setShow2FaSetup(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize 2FA setup');
    } finally {
      setIs2FaLoading(false);
    }
  };

  const handleConfirmEnable2Fa = async (isDirect: boolean = false) => {
    const targetUsername = currentUser?.username || currentUser?.userId;
    if (!targetUsername) return;
    if (!isDirect && !verifyTotpCode.trim()) {
      setErrorMsg(lang === 'ar' ? 'يرجى إدخال رمز الأمان المكون من 6 أرقام للتأكيد' : 'Please enter the 6-digit code to verify');
      return;
    }
    setIs2FaLoading(true);
    setErrorMsg(null);
    try {
      const res = await enable2FaApi({
        secret: setupSecret,
        code: isDirect ? undefined : verifyTotpCode.trim(),
        backupCodes: setupBackupCodes,
        username: targetUsername,
        direct: isDirect,
      });
      setIs2FaEnabled(true);
      setShow2FaSetup(false);
      setBackupCodesList(res.backupCodes || setupBackupCodes);
      setSuccessMsg(lang === 'ar' ? 'تم تفعيل المصادقة الثنائية وحفظها في قاعدة البيانات بنجاح!' : 'Two-factor authentication enabled and saved to database successfully!');

      if (res.user) {
        updateActiveUserProfileIfCurrent(currentUser, res.user);
        setStoredUserProfile(res.user);
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setErrorMsg(err.message || (lang === 'ar' ? 'رمز التحقق غير صحيح. يرجى المحاولة مرة أخرى.' : 'Invalid verification code. Please try again.'));
    } finally {
      setIs2FaLoading(false);
    }
  };

  const handleDisable2Fa = async () => {
    const targetUsername = currentUser?.username || currentUser?.userId;
    if (!targetUsername) return;

    setIs2FaLoading(true);
    setErrorMsg(null);
    try {
      const res = await disable2FaApi({
        username: targetUsername,
        password: oldPassword.trim() || undefined,
      });
      setIs2FaEnabled(false);
      setShow2FaSetup(false);
      setIsConfirmingDisable2Fa(false);
      setBackupCodesList([]);
      setSuccessMsg(lang === 'ar' ? 'تم تعطيل المصادقة الثنائية بنجاح' : 'Two-factor authentication disabled successfully');

      if (res.user) {
        updateActiveUserProfileIfCurrent(currentUser, res.user);
        setStoredUserProfile(res.user);
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setErrorMsg(err.message || (lang === 'ar' ? 'تعذر تعطيل المصادقة الثنائية' : 'Failed to disable 2FA'));
    } finally {
      setIs2FaLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    const targetUsername = currentUser?.username || currentUser?.userId;
    if (!targetUsername) return;
    setIs2FaLoading(true);
    setErrorMsg(null);
    try {
      const res = await regenerateBackupCodesApi(targetUsername);
      setBackupCodesList(res.backupCodes);
      setSuccessMsg(lang === 'ar' ? 'تم توليد رموز استرداد جديدة بنجاح' : 'Backup recovery codes regenerated successfully');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to regenerate backup codes');
    } finally {
      setIs2FaLoading(false);
    }
  };

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

    if (cleanUsername.length < 3) {
      setErrorMsg(
        lang === 'ar'
          ? 'يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل'
          : 'Username must be at least 3 characters long'
      );
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      setErrorMsg(
        lang === 'ar'
          ? 'اسم المستخدم يمكن أن يحتوي فقط على أحرف وأرقام وشرطة ونقطة'
          : 'Username can only contain alphanumeric characters, underscores, dashes, and dots'
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
      // New login / registration flow when not authenticated
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

    // If not authenticated, execute user login directly
    if (!currentUser) {
      try {
        const loginRes = await loginUserApi(cleanUsername, finalPassword);
        if ('requires2FA' in loginRes && loginRes.requires2FA) {
          setErrorMsg(
            lang === 'ar'
              ? 'هذا الحساب يتطلب التحقق بخطوتين (2FA). يرجى تسجيل الدخول من الشاشة الرئيسية.'
              : 'This account requires Two-Factor Authentication. Please sign in via the main screen.'
          );
          setIsSubmitting(false);
          return;
        }
        if ('user' in loginRes && loginRes.user) {
          onLoginSuccess(loginRes.user);
          setIsSubmitting(false);
          onClose();
          return;
        }
      } catch (loginErr: any) {
        setIsSubmitting(false);
        setErrorMsg(
          loginErr?.message ||
          (lang === 'ar' ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'Invalid username or password')
        );
        return;
      }
    }

    try {
      const oldUsername = (currentUser?.username || currentUser?.userId || '').trim().toLowerCase();

      // Ensure active session token exists before updating profile
      const activeToken = getSessionToken();
      if (!activeToken && currentUser) {
        const fallbackToken = `client_${currentUser.username || currentUser.userId}_${Date.now()}`;
        setSessionToken(fallbackToken, true);
      }

      // Update profile securely via backend API and persist to database
      const res = await updateSelfProfileApi({
        oldPassword: oldPassword.trim() || undefined,
        newPassword: newPassword.trim() || undefined,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company: company.trim(),
        username: cleanUsername,
        oldUsername: oldUsername || undefined,
        twoFactorEnabled: is2FaEnabled,
        twoFactorSecret: is2FaEnabled ? (currentUser?.twoFactorSecret || setupSecret || undefined) : undefined,
        twoFactorBackupCodes: is2FaEnabled ? (backupCodesList.length > 0 ? backupCodesList : setupBackupCodes) : [],
        twoFactorConfirmedAt: is2FaEnabled ? (currentUser?.twoFactorConfirmedAt || new Date().toISOString()) : undefined,
      });

      const updatedUser = res.user;

      const profileToSave: UserProfile = {
        ...updatedUser,
        username: cleanUsername,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company: company.trim(),
        password: finalPassword || currentUser?.password || undefined,
        twoFactorEnabled: is2FaEnabled,
        twoFactorSecret: is2FaEnabled ? (currentUser?.twoFactorSecret || setupSecret || undefined) : undefined,
        twoFactorBackupCodes: is2FaEnabled ? (backupCodesList.length > 0 ? backupCodesList : setupBackupCodes) : [],
        updatedAt: new Date().toISOString(),
      };

      // Persist in User Profile storage slot (Session Token preserved intact)
      updateActiveUserProfileIfCurrent(currentUser, profileToSave, oldUsername);
      setStoredUserProfile(profileToSave);

      const successTxt = lang === 'ar'
        ? 'تم حفظ جميع البيانات وتحديث اسم المستخدم بنجاح في قاعدة البيانات!'
        : 'All profile inputs and username updated successfully in the database!';

      setSuccessMsg(successTxt);

      setTimeout(() => {
        onLoginSuccess(profileToSave);
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
            {currentUser && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {lang === 'ar'
                  ? 'يمكنك تعديل اسم المستخدم؛ سيتم تحديث هويتك في قاعدة البيانات وجلستك فوراً.'
                  : 'You can change your username; your account identity will update in the database immediately.'}
              </p>
            )}
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

          {/* Grid: Email, Phone & Company Name */}
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
                {lang === 'ar' ? 'رقم الهاتف / الجوال' : 'Phone Number'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-3 rtl:pr-3 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={lang === 'ar' ? '0501234567 أو +966' : '+1 (555) 012-3456'}
                  className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
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

          {/* 2FA Security Management Section (When User is Logged In) */}
          {currentUser && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                      {t.twoFactorTitle}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {is2FaEnabled ? t.twoFactorEnabledBadge : t.twoFactorDisabledBadge}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {is2FaEnabled ? (
                    isConfirmingDisable2Fa ? (
                      <div className="flex items-center gap-1.5 animate-in fade-in">
                        <button
                          type="button"
                          disabled={is2FaLoading}
                          onClick={handleDisable2Fa}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                        >
                          {is2FaLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldOff className="w-3 h-3" />}
                          <span>{lang === 'ar' ? 'تأكيد التعطيل' : 'Confirm'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={is2FaLoading}
                          onClick={() => setIsConfirmingDisable2Fa(false)}
                          className="px-2 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                        >
                          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={is2FaLoading}
                        onClick={() => setIsConfirmingDisable2Fa(true)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <ShieldOff className="w-3.5 h-3.5" />
                        <span>{t.twoFactorDisableBtn}</span>
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      disabled={is2FaLoading}
                      onClick={handleStart2FaSetup}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {is2FaLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
                      <span>{t.twoFactorEnableBtn}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 2FA Setup Flow (QR Code & Secret Key) */}
              {show2FaSetup && (
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/40 space-y-3 animate-in fade-in">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-emerald-500" />
                    <span>{t.twoFactorSetupTitle}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {t.twoFactorSetupSub}
                  </p>

                  {setupQrUrl && (
                    <div className="flex justify-center p-2 bg-white rounded-xl shadow-xs border border-slate-200 w-fit mx-auto">
                      <img src={setupQrUrl} alt="2FA Setup QR" className="w-36 h-36 object-contain" referrerPolicy="no-referrer" />
                    </div>
                  )}

                  {setupSecret && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t.twoFactorSecretKeyLabel}</span>
                      <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-xs text-emerald-700 dark:text-emerald-400">
                        <span className="tracking-wider select-all">{formatTotpSecret(setupSecret)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(setupSecret);
                            setCopiedSecret(true);
                            setTimeout(() => setCopiedSecret(false), 2000);
                          }}
                          className="px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          {copiedSecret ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedSecret ? t.twoFactorCopied : t.twoFactorCopySecret}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Verification Input to finalize activation */}
                  <div className="pt-1 space-y-2">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {t.twoFactorCodeLabel} <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={verifyTotpCode}
                        onChange={(e) => setVerifyTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        className="flex-1 px-3 py-2 text-center text-lg font-mono font-bold tracking-widest rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40"
                      />
                      <button
                        type="button"
                        disabled={is2FaLoading || verifyTotpCode.length < 6}
                        onClick={() => handleConfirmEnable2Fa(false)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {is2FaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>{lang === 'ar' ? 'تأكيد وتفعيل' : 'Confirm & Enable'}</span>
                      </button>
                    </div>

                    <div className="pt-1 text-center">
                      <button
                        type="button"
                        disabled={is2FaLoading}
                        onClick={() => handleConfirmEnable2Fa(true)}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>{t.twoFactorInstantEnableBtn || (lang === 'ar' ? 'تفعيل فوري وحفظ الرموز' : 'Instant Enable & Save Codes')}</span>
                      </button>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        {t.twoFactorInstantEnableSub || (lang === 'ar' ? 'تفعيل فوري وتخزين المفتاح والرموز الاحتياطية في قاعدة البيانات' : 'Instantly activate 2FA and store secret keys and recovery codes to your account')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Emergency Backup Codes Section */}
              {is2FaEnabled && backupCodesList && backupCodesList.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-500" />
                      {t.twoFactorBackupCodesTitle}
                    </span>
                    <button
                      type="button"
                      disabled={is2FaLoading}
                      onClick={handleRegenerateBackupCodes}
                      className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{t.twoFactorRegenerateBackup}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[11px] text-amber-950 dark:text-amber-200 font-bold">
                    {backupCodesList.map((code, idx) => (
                      <div key={idx} className="p-1.5 text-center bg-white dark:bg-slate-900 rounded-md border border-amber-200 dark:border-amber-900/50">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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
