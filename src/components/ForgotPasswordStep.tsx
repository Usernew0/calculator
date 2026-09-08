import React, { useState, useEffect, useRef } from 'react';
import { Language, translations } from '../data/translations';
import {
  forgotPasswordLookupApi,
  sendForgotPasswordPhoneOtpApi,
  sendForgotPasswordEmailOtpApi,
  sendFirebasePasswordResetApi,
  resetPasswordApi,
  ForgotPasswordLookupResponse,
} from '../lib/api';
import { verifyTotpCode } from '../lib/totp';
import {
  Smartphone,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  RotateCcw,
  User,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';

interface ForgotPasswordStepProps {
  lang: Language;
  initialIdentifier?: string;
  onSuccess: (newPassword?: string) => void;
  onBackToLogin: () => void;
}

type ResetStep =
  | 'lookup'
  | 'method_select'
  | 'email_sent'
  | 'verify_email_otp'
  | 'verify_phone_otp'
  | 'verify_2fa'
  | 'new_password'
  | 'success';

export const ForgotPasswordStep: React.FC<ForgotPasswordStepProps> = ({
  lang,
  initialIdentifier = '',
  onSuccess,
  onBackToLogin,
}) => {
  const t = translations[lang];

  // Flow State
  const [currentStep, setCurrentStep] = useState<ResetStep>('lookup');
  const [identifier, setIdentifier] = useState<string>(initialIdentifier);
  const [lookupData, setLookupData] = useState<ForgotPasswordLookupResponse | null>(null);

  // Method Selection
  const [selectedMethod, setSelectedMethod] = useState<'email' | 'phone_otp' | '2fa'>('email');

  // Email OTP Verification State
  const [emailOtpDigits, setEmailOtpDigits] = useState<string[]>(['', '', '', '', '', '']);

  // Phone OTP Verification State
  const [phoneOtpDigits, setPhoneOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState<number>(60);
  const [verifiedResetToken, setVerifiedResetToken] = useState<string | null>(null);

  // 2FA TOTP Verification State
  const [twoFactorCode, setTwoFactorCode] = useState<string[]>(['', '', '', '', '', '']);
  const [isBackupCodeMode, setIsBackupCodeMode] = useState<boolean>(false);
  const [backupCodeInput, setBackupCodeInput] = useState<string>('');

  // New Password State
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Segmented input refs
  const emailOtpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const phoneOtpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const totpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer countdown for OTP and email resend
  useEffect(() => {
    let timer: any = null;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  // Focus helper for OTP inputs
  const handleDigitChange = (
    index: number,
    value: string,
    stateArray: string[],
    setStateArray: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    // Handle paste event (multi-char)
    const sanitized = value.replace(/\D/g, '');
    if (sanitized.length > 1) {
      const newDigits = [...stateArray];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = sanitized[i] || '';
      }
      setStateArray(newDigits);
      const nextIndex = Math.min(sanitized.length, 5);
      refs.current[nextIndex]?.focus();
      return;
    }

    const singleDigit = sanitized.slice(-1);
    const updated = [...stateArray];
    updated[index] = singleDigit;
    setStateArray(updated);

    if (singleDigit && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
    stateArray: string[],
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (e.key === 'Backspace' && !stateArray[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  // STEP 1: Lookup User & Detect Available Reset Channels
  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = identifier.trim();
    if (!trimmed) {
      setErrorMsg(t.forgotPasswordIdentifierRequired);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const res = await forgotPasswordLookupApi(trimmed);
      if (!res.success) {
        setErrorMsg(res.error || t.forgotPasswordUserNotFound);
        return;
      }

      setLookupData(res);

      if (!res.hasEmail && !res.hasPhone && !res.has2Fa) {
        setErrorMsg(t.forgotPasswordNoMethods);
        return;
      }

      const availableCount = (res.hasEmail ? 1 : 0) + (res.hasPhone ? 1 : 0) + (res.has2Fa ? 1 : 0);

      // If user has more than 1 method, show method selection
      if (availableCount > 1) {
        if (res.hasEmail) {
          setSelectedMethod('email');
        } else if (res.hasPhone) {
          setSelectedMethod('phone_otp');
        } else {
          setSelectedMethod('2fa');
        }
        setCurrentStep('method_select');
      } else if (res.hasEmail) {
        // Automatically dispatch Firebase Auth email reset
        await triggerSendEmailReset(res.email || trimmed);
      } else if (res.hasPhone) {
        // Automatically send SMS OTP
        await triggerSendPhoneOtp(res.username);
      } else if (res.has2Fa) {
        setSelectedMethod('2fa');
        setCurrentStep('verify_2fa');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || t.forgotPasswordUserNotFound);
    } finally {
      setIsLoading(false);
    }
  };

  // Send Firebase Auth Password Reset Email & Dispatch Email OTP
  const triggerSendEmailReset = async (emailAddr?: string) => {
    const targetEmail = emailAddr || lookupData?.email || (identifier.includes('@') ? identifier : undefined);
    if (!targetEmail || !targetEmail.includes('@')) {
      setErrorMsg(lang === 'ar' ? 'لم يتم العثور على بريد إلكتروني مسجل لهذا الحساب' : 'No registered email found for this account.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      // 1. Dispatch Firebase Auth email
      const firebaseRes = await sendFirebasePasswordResetApi(targetEmail);

      // 2. Dispatch Email OTP fallback via backend to allow instant verification code reset
      const targetUser = lookupData?.username || identifier;
      const otpRes = await sendForgotPasswordEmailOtpApi(targetUser, targetEmail);

      if (!firebaseRes.success && !otpRes.success) {
        setErrorMsg(firebaseRes.message || firebaseRes.error || (lang === 'ar' ? 'فشل إرسال بريد الاستعادة' : 'Failed to send password reset email'));
        return;
      }

      setResendCooldown(60);
      setCurrentStep('email_sent');
      setInfoMsg(t.forgotPasswordEmailSent);
    } catch (err: any) {
      setErrorMsg(err?.message || (lang === 'ar' ? 'فشل إرسال بريد الاستعادة' : 'Failed to send password reset email'));
    } finally {
      setIsLoading(false);
    }
  };

  // Resend Email handler with clear feedback and cooldown reset
  const handleResendEmail = async () => {
    if (resendCooldown > 0 || isLoading) return;
    await triggerSendEmailReset(lookupData?.email);
    setInfoMsg(t.forgotPasswordEmailResent);
  };

  // Send Phone SMS OTP
  const triggerSendPhoneOtp = async (targetUsername: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const res = await sendForgotPasswordPhoneOtpApi(targetUsername);
      if (!res.success) {
        setErrorMsg(res.error || t.forgotPasswordOtpFailed);
        return;
      }

      setResendCooldown(res.expiresInSeconds ? Math.min(res.expiresInSeconds, 60) : 60);
      setPhoneOtpDigits(['', '', '', '', '', '']);
      setCurrentStep('verify_phone_otp');
      setInfoMsg(t.forgotPasswordOtpSent);

      // Focus first OTP field
      setTimeout(() => {
        phoneOtpRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      setErrorMsg(err?.message || t.forgotPasswordOtpFailed);
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 2: Proceed from Method Select
  const handleProceedMethod = async () => {
    if (!lookupData) return;
    if (selectedMethod === 'email') {
      await triggerSendEmailReset(lookupData.email);
    } else if (selectedMethod === 'phone_otp') {
      await triggerSendPhoneOtp(lookupData.username);
    } else {
      setTwoFactorCode(['', '', '', '', '', '']);
      setCurrentStep('verify_2fa');
      setTimeout(() => {
        totpRefs.current[0]?.focus();
      }, 150);
    }
  };

  // STEP 3A: Verify Email OTP
  const handleVerifyEmailOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = emailOtpDigits.join('').trim();
    if (code.length !== 6) {
      setErrorMsg(lang === 'ar' ? 'يرجى إدخال رمز التحقق المكون من 6 أرقام بالكامل' : 'Please enter the complete 6-digit OTP code');
      return;
    }

    // Move to New Password step with code as reset verification
    setErrorMsg(null);
    setVerifiedResetToken(code);
    setCurrentStep('new_password');
  };

  // STEP 3B: Verify Phone SMS OTP
  const handleVerifyPhoneOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = phoneOtpDigits.join('').trim();
    if (code.length !== 6) {
      setErrorMsg(lang === 'ar' ? 'يرجى إدخال رمز التحقق المكون من 6 أرقام بالكامل' : 'Please enter the complete 6-digit OTP code');
      return;
    }

    // Move to New Password step with code as reset verification
    setErrorMsg(null);
    setVerifiedResetToken(code);
    setCurrentStep('new_password');
  };

  // STEP 3C: Verify 2FA TOTP or Backup Code
  const handleVerify2Fa = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const code = isBackupCodeMode
      ? backupCodeInput.trim().toUpperCase()
      : twoFactorCode.join('').trim();

    if (!code) {
      setErrorMsg(lang === 'ar' ? 'يرجى إدخال رمز المصادقة الثأنية' : 'Please enter the 2FA security code');
      return;
    }

    if (!isBackupCodeMode && code.length !== 6) {
      setErrorMsg(lang === 'ar' ? 'رمز المصادقة الثنائية يتكون من 6 أرقام' : '2FA code must be 6 digits');
      return;
    }

    // Ready to proceed to new password creation
    setVerifiedResetToken(code);
    setCurrentStep('new_password');
  };

  // STEP 4: Set New Password & Submit Reset Request
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupData) return;

    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedNew) {
      setErrorMsg(lang === 'ar' ? 'يرجى إدخال كلمة المرور الجديدة' : 'Please enter a new password');
      return;
    }

    if (trimmedNew.length < 4) {
      setErrorMsg(t.forgotPasswordMinLength);
      return;
    }

    if (trimmedNew !== trimmedConfirm) {
      setErrorMsg(t.forgotPasswordMismatch);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const resetMethodToUse =
        selectedMethod === 'phone_otp'
          ? 'phone_otp'
          : selectedMethod === 'email'
          ? 'email_otp'
          : '2fa';

      const res = await resetPasswordApi({
        username: lookupData.username,
        newPassword: trimmedNew,
        resetMethod: resetMethodToUse,
        resetCode: verifiedResetToken || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.error || t.forgotPasswordResetFailed);
        return;
      }

      setCurrentStep('success');
      setTimeout(() => {
        onSuccess(trimmedNew);
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err?.message || t.forgotPasswordResetFailed);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Dynamic Error & Info Notices */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-600/60 text-rose-200 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="leading-snug">{errorMsg}</span>
        </div>
      )}

      {infoMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-600/50 text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{infoMsg}</span>
        </div>
      )}

      {/* STEP 1: USER IDENTIFIER LOOKUP */}
      {currentStep === 'lookup' && (
        <form onSubmit={handleLookup} className="space-y-4">
          <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
            {t.forgotPasswordLookupHint}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {t.forgotPasswordIdentifierLabel} <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-3.5 rtl:pr-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4 text-emerald-400" />
              </div>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t.forgotPasswordIdentifierPlaceholder}
                className="w-full ltr:pl-10 rtl:pr-10 ltr:pr-3.5 rtl:pl-3.5 py-3 text-sm rounded-xl border border-slate-600 bg-slate-900/80 text-white font-semibold placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onBackToLogin}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              <span>{t.forgotPasswordBackToLogin}</span>
            </button>

            <button
              type="submit"
              disabled={isLoading || !identifier.trim()}
              className="flex-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              <span>{t.forgotPasswordLookupBtn}</span>
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: METHOD SELECTION (Email vs. Phone SMS vs. 2FA) */}
      {currentStep === 'method_select' && lookupData && (
        <div className="space-y-4">
          <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
            {t.forgotPasswordChooseMethod}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {lookupData.hasEmail && (
              <label
                onClick={() => setSelectedMethod('email')}
                className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                  selectedMethod === 'email'
                    ? 'bg-sky-950/40 border-sky-500 text-white ring-1 ring-sky-500'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold">{t.forgotPasswordMethodEmail}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {lookupData.maskedEmail || lookupData.email || 'e••••@••••.com'}
                  </div>
                </div>
                <input
                  type="radio"
                  name="reset_method"
                  checked={selectedMethod === 'email'}
                  onChange={() => setSelectedMethod('email')}
                  className="w-4 h-4 text-sky-500 accent-sky-500 cursor-pointer"
                />
              </label>
            )}

            {lookupData.hasPhone && (
              <label
                onClick={() => setSelectedMethod('phone_otp')}
                className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                  selectedMethod === 'phone_otp'
                    ? 'bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold">{t.forgotPasswordMethodPhone}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {lookupData.maskedPhone || '•••-•••-••••'}
                  </div>
                </div>
                <input
                  type="radio"
                  name="reset_method"
                  checked={selectedMethod === 'phone_otp'}
                  onChange={() => setSelectedMethod('phone_otp')}
                  className="w-4 h-4 text-emerald-500 accent-emerald-500 cursor-pointer"
                />
              </label>
            )}

            {lookupData.has2Fa && (
              <label
                onClick={() => setSelectedMethod('2fa')}
                className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                  selectedMethod === '2fa'
                    ? 'bg-indigo-950/40 border-indigo-500 text-white ring-1 ring-indigo-500'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold">{t.forgotPasswordMethod2Fa}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Google Authenticator / Authy / Backup Codes
                  </div>
                </div>
                <input
                  type="radio"
                  name="reset_method"
                  checked={selectedMethod === '2fa'}
                  onChange={() => setSelectedMethod('2fa')}
                  className="w-4 h-4 text-indigo-500 accent-indigo-500 cursor-pointer"
                />
              </label>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setCurrentStep('lookup')}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              <span>{lang === 'ar' ? 'رجوع' : 'Back'}</span>
            </button>

            <button
              type="button"
              onClick={handleProceedMethod}
              disabled={isLoading}
              className="flex-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              )}
              <span>{lang === 'ar' ? 'متابعة التحقق' : 'Continue Verification'}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3A: EMAIL RESET CONFIRMATION SCREEN (Firebase Auth) */}
      {currentStep === 'email_sent' && (
        <div className="space-y-4">
          <div className="text-center py-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-sky-500/10">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">{t.forgotPasswordEmailSentTitle}</h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
              {t.forgotPasswordEmailSentMsg}
            </p>
            <div className="mt-3 inline-block px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-sky-300 font-mono text-xs">
              {lookupData?.maskedEmail || lookupData?.email || identifier}
            </div>
          </div>

          {/* Notice & Tip */}
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-slate-300 text-[11px] leading-relaxed flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <span>{t.forgotPasswordEmailNotice}</span>
          </div>

          {/* Enter 6-digit Code Option */}
          <button
            type="button"
            onClick={() => {
              setEmailOtpDigits(['', '', '', '', '', '']);
              setCurrentStep('verify_email_otp');
              setTimeout(() => emailOtpRefs.current[0]?.focus(), 150);
            }}
            className="w-full py-2.5 px-3 rounded-xl border border-sky-500/30 bg-sky-950/40 hover:bg-sky-900/50 text-sky-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <KeyRound className="w-4 h-4 text-sky-400" />
            <span>{t.forgotPasswordEnterCodeInstead}</span>
          </button>

          {/* Resend button & countdown */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
            <button
              type="button"
              disabled={resendCooldown > 0 || isLoading}
              onClick={handleResendEmail}
              className="text-sky-400 hover:text-sky-300 font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{t.forgotPasswordResendEmailBtn}</span>
            </button>

            {resendCooldown > 0 ? (
              <span className="text-slate-400 font-mono text-[11px]">
                {lang === 'ar' ? `إعادة الإرسال بعد ${resendCooldown} ثانية` : `Resend in ${resendCooldown}s`}
              </span>
            ) : (
              <span className="text-emerald-400 text-[11px] font-medium">
                {lang === 'ar' ? 'جاهز لإعادة الإرسال' : 'Ready to resend'}
              </span>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setCurrentStep('lookup')}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              <span>{lang === 'ar' ? 'طريقة أخرى' : 'Try Another Method'}</span>
            </button>

            <button
              type="button"
              onClick={onBackToLogin}
              className="flex-1 py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t.forgotPasswordBackToLogin}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3B: VERIFY EMAIL 6-DIGIT OTP */}
      {currentStep === 'verify_email_otp' && (
        <form onSubmit={handleVerifyEmailOtp} className="space-y-4">
          <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block mb-0.5">{t.forgotPasswordVerifyEmailOtpLabel}</span>
              <span className="text-slate-400 font-mono">
                {lookupData?.maskedEmail || lookupData?.email || identifier}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
              <Mail className="w-5 h-5" />
            </div>
          </div>

          {/* 6-Digit Segmented OTP Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider text-center">
              {t.forgotPasswordVerifyEmailOtpLabel}
            </label>

            <div className="flex items-center justify-center gap-2" dir="ltr">
              {emailOtpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (emailOtpRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) =>
                    handleDigitChange(idx, e.target.value, emailOtpDigits, setEmailOtpDigits, emailOtpRefs)
                  }
                  onKeyDown={(e) => handleKeyDown(idx, e.key as any, emailOtpDigits, emailOtpRefs)}
                  className="w-11 h-12 text-center text-lg font-mono font-bold rounded-xl border border-slate-600 bg-slate-900/90 text-sky-400 focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                />
              ))}
            </div>
          </div>

          {/* Resend OTP Button & Countdown */}
          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              disabled={resendCooldown > 0 || isLoading}
              onClick={handleResendEmail}
              className="text-sky-400 hover:text-sky-300 font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{t.forgotPasswordResendBtn}</span>
            </button>

            {resendCooldown > 0 ? (
              <span className="text-slate-400 font-mono text-[11px]">
                {lang === 'ar' ? `إعادة الإرسال بعد ${resendCooldown} ثانية` : `Resend in ${resendCooldown}s`}
              </span>
            ) : (
              <span className="text-emerald-400 text-[11px] font-medium">
                {lang === 'ar' ? 'جاهز لإعادة الإرسال' : 'Ready to resend'}
              </span>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setCurrentStep('email_sent')}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              <span>{lang === 'ar' ? 'رجوع' : 'Back'}</span>
            </button>

            <button
              type="submit"
              disabled={emailOtpDigits.join('').length !== 6 || isLoading}
              className="flex-2 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              )}
              <span>{t.forgotPasswordVerifyBtn}</span>
            </button>
          </div>
        </form>
      )}

      {/* STEP 3B: VERIFY PHONE SMS OTP */}
      {currentStep === 'verify_phone_otp' && (
        <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
          <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block mb-0.5">{t.forgotPasswordOtpSent}</span>
              <span className="text-slate-400 font-mono">
                {lookupData?.maskedPhone || identifier}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>

          {/* 6-Digit Segmented OTP Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider text-center">
              {t.forgotPasswordOtpLabel}
            </label>

            <div className="flex items-center justify-center gap-2" dir="ltr">
              {phoneOtpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (phoneOtpRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) =>
                    handleDigitChange(idx, e.target.value, phoneOtpDigits, setPhoneOtpDigits, phoneOtpRefs)
                  }
                  onKeyDown={(e) => handleKeyDown(idx, e.key as any, phoneOtpDigits, phoneOtpRefs)}
                  className="w-11 h-12 text-center text-lg font-mono font-bold rounded-xl border border-slate-600 bg-slate-900/90 text-emerald-400 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40"
                />
              ))}
            </div>
          </div>

          {/* Resend OTP Button & Countdown */}
          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              disabled={resendCooldown > 0 || isLoading}
              onClick={() => lookupData && triggerSendPhoneOtp(lookupData.username)}
              className="text-emerald-400 hover:text-emerald-300 font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.forgotPasswordResendBtn}</span>
            </button>

            {resendCooldown > 0 && (
              <span className="text-slate-400 font-mono text-[11px]">
                {lang === 'ar' ? `إعادة الإرسال بعد ${resendCooldown} ثانية` : `Resend in ${resendCooldown}s`}
              </span>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setCurrentStep('lookup')}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              <span>{lang === 'ar' ? 'رجوع' : 'Back'}</span>
            </button>

            <button
              type="submit"
              disabled={phoneOtpDigits.join('').length !== 6 || isLoading}
              className="flex-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>{t.forgotPasswordVerifyBtn}</span>
            </button>
          </div>
        </form>
      )}

      {/* STEP 3B: VERIFY 2FA TOTP / BACKUP CODE */}
      {currentStep === 'verify_2fa' && (
        <form onSubmit={handleVerify2Fa} className="space-y-4">
          <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block mb-0.5">{t.twoFactorModalTitle}</span>
              <span className="text-slate-400 text-[11px]">{t.twoFactorSub}</span>
            </div>
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          {!isBackupCodeMode ? (
            /* 6-Digit Segmented TOTP Input */
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider text-center">
                {t.twoFactorCodeLabel}
              </label>

              <div className="flex items-center justify-center gap-2" dir="ltr">
                {twoFactorCode.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (totpRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) =>
                      handleDigitChange(idx, e.target.value, twoFactorCode, setTwoFactorCode, totpRefs)
                    }
                    onKeyDown={(e) => handleKeyDown(idx, e.key as any, twoFactorCode, totpRefs)}
                    className="w-11 h-12 text-center text-lg font-mono font-bold rounded-xl border border-slate-600 bg-slate-900/90 text-indigo-400 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Backup Code Input Mode */
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                {t.backupCodeLabel}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-3.5 rtl:pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                </div>
                <input
                  type="text"
                  value={backupCodeInput}
                  onChange={(e) => setBackupCodeInput(e.target.value.toUpperCase())}
                  placeholder={t.backupCodePlaceholder}
                  className="w-full ltr:pl-10 rtl:pr-10 ltr:pr-3.5 rtl:pl-3.5 py-3 text-sm rounded-xl border border-slate-600 bg-slate-900/80 text-amber-300 font-mono font-bold placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            </div>
          )}

          {/* Toggle between Authenticator Code vs Backup Code */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setIsBackupCodeMode(!isBackupCodeMode);
                setErrorMsg(null);
              }}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
            >
              {isBackupCodeMode ? t.switchToTotpBtn : t.useBackupCodeBtn}
            </button>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setCurrentStep('lookup')}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              <span>{lang === 'ar' ? 'رجوع' : 'Back'}</span>
            </button>

            <button
              type="submit"
              disabled={
                isLoading ||
                (!isBackupCodeMode && twoFactorCode.join('').length !== 6) ||
                (isBackupCodeMode && !backupCodeInput.trim())
              }
              className="flex-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>{t.forgotPasswordVerifyBtn}</span>
            </button>
          </div>
        </form>
      )}

      {/* STEP 4: ENTER NEW PASSWORD */}
      {currentStep === 'new_password' && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-white block">
                {lang === 'ar' ? 'تم تأكيد الهوية بنجاح' : 'Identity Verified Successfully'}
              </span>
              <span className="text-slate-400 text-[11px]">
                {lang === 'ar'
                  ? `أدخل كلمة المرور الجديدة لحساب ${lookupData?.username}`
                  : `Enter new password for ${lookupData?.username}`}
              </span>
            </div>
          </div>

          {/* New Password Input */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {t.forgotPasswordNewPasswordLabel} <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-3.5 rtl:pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4 text-emerald-400" />
              </div>
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t.forgotPasswordNewPasswordPlaceholder}
                className="w-full ltr:pl-10 rtl:pr-10 ltr:pr-10 rtl:pl-10 py-3 text-sm rounded-xl border border-slate-600 bg-slate-900/80 text-white font-semibold placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 ltr:right-0 rtl:left-0 ltr:pr-3.5 rtl:pl-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password Input */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {t.forgotPasswordConfirmPasswordLabel} <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-3.5 rtl:pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4 text-emerald-400" />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.forgotPasswordConfirmPasswordPlaceholder}
                className="w-full ltr:pl-10 rtl:pr-10 ltr:pr-10 rtl:pl-10 py-3 text-sm rounded-xl border border-slate-600 bg-slate-900/80 text-white font-semibold placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 ltr:right-0 rtl:left-0 ltr:pr-3.5 rtl:pl-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onBackToLogin}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              <span>{t.forgotPasswordBackToLogin}</span>
            </button>

            <button
              type="submit"
              disabled={isLoading || !newPassword.trim() || !confirmPassword.trim()}
              className="flex-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>{t.forgotPasswordResetBtn}</span>
            </button>
          </div>
        </form>
      )}

      {/* STEP 5: SUCCESS NOTIFICATION */}
      {currentStep === 'success' && (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <h3 className="text-base font-bold text-white">{t.forgotPasswordSuccessTitle}</h3>
            <p className="text-xs text-emerald-200/90 mt-1 max-w-xs mx-auto">
              {t.forgotPasswordSuccessMsg}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onSuccess(newPassword)}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <KeyRound className="w-4 h-4" />
            <span>{t.forgotPasswordBackToLogin}</span>
          </button>
        </div>
      )}
    </div>
  );
};
