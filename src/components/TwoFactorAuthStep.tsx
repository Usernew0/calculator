import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { verify2FaApi } from '../lib/api';
import { generateQrCodeDataUrl, formatTotpSecret, getTotpRemainingSeconds } from '../lib/totp';
import { translations, Language } from '../data/translations';
import {
  ShieldCheck,
  KeyRound,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  QrCode,
  HelpCircle,
  Clock,
  Key,
  Smartphone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface TwoFactorAuthStepProps {
  lang: Language;
  username: string;
  twoFactorToken?: string;
  isFirstSetup?: boolean;
  initialSecret?: string;
  initialUri?: string;
  passwordFallback?: string;
  onVerifySuccess: (result: { token: string; user: UserProfile; backupCodeUsed?: boolean }) => void;
  onBack: () => void;
}

export const TwoFactorAuthStep: React.FC<TwoFactorAuthStepProps> = ({
  lang,
  username,
  twoFactorToken,
  isFirstSetup = false,
  initialSecret,
  initialUri,
  passwordFallback,
  onVerifySuccess,
  onBack,
}) => {
  const t = translations[lang];

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [backupCode, setBackupCode] = useState('');
  const [isBackupMode, setIsBackupMode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [remainingSeconds, setRemainingSeconds] = useState(getTotpRemainingSeconds());
  const [showQrDetails, setShowQrDetails] = useState(isFirstSetup);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Generate QR code if initialUri exists
  useEffect(() => {
    if (initialUri) {
      generateQrCodeDataUrl(initialUri).then((url) => {
        if (url) setQrDataUrl(url);
      });
    }
  }, [initialUri]);

  // Live 30-second TOTP Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds(getTotpRemainingSeconds());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-focus on first digit on mount
  useEffect(() => {
    if (!isBackupMode && inputRefs.current[0]) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    }
  }, [isBackupMode]);

  const handleDigitChange = (index: number, value: string) => {
    // Handle paste of 6 digits
    if (value.length > 1) {
      const cleanPaste = value.replace(/\D/g, '').slice(0, 6);
      if (cleanPaste.length > 0) {
        const newDigits = [...digits];
        for (let i = 0; i < 6; i++) {
          newDigits[i] = cleanPaste[i] || '';
        }
        setDigits(newDigits);
        setErrorMsg(null);

        const lastFilled = Math.min(cleanPaste.length - 1, 5);
        inputRefs.current[lastFilled]?.focus();

        if (cleanPaste.length === 6) {
          submitVerification(newDigits.join(''));
        }
        return;
      }
    }

    const singleChar = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = singleChar;
    setDigits(newDigits);
    setErrorMsg(null);

    // Auto-advance to next input
    if (singleChar && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 6 digits entered
    if (singleChar && index === 5 && newDigits.every((d) => d !== '')) {
      submitVerification(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = [...digits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setDigits(newDigits);
      setErrorMsg(null);

      const focusIdx = Math.min(pasted.length, 5);
      inputRefs.current[focusIdx]?.focus();

      if (pasted.length === 6) {
        submitVerification(newDigits.join(''));
      }
    }
  };

  const submitVerification = async (codeToVerify?: string) => {
    const code = codeToVerify || (isBackupMode ? backupCode.trim() : digits.join(''));
    if (!code) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى إدخال رمز الأمان المكون من 6 أرقام أو رمز الاسترداد'
          : 'Please enter the 6-digit verification code or recovery key'
      );
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const res = await verify2FaApi({
        twoFactorToken,
        code,
        username,
        password: passwordFallback,
      });

      setSuccessMsg(
        lang === 'ar'
          ? 'تم التحقق من رمز المصادقة بنجاح! جاري تسجيل الدخول...'
          : 'Security code verified successfully! Signing you in...'
      );

      setTimeout(() => {
        onVerifySuccess(res);
      }, 500);
    } catch (err: any) {
      setIsVerifying(false);
      setErrorMsg(
        err?.message ||
          (lang === 'ar'
            ? 'رمز التحقق غير صحيح أو انتهت صلاحيته. يرجى مراجعة تطبيق المصادقة وإعادة المحاولة.'
            : 'Invalid or expired verification code. Please check your authenticator app and try again.')
      );
    }
  };

  const handleCopySecret = () => {
    if (initialSecret) {
      navigator.clipboard.writeText(initialSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  // Progress percentage for 30s TOTP countdown
  const progressPercent = (remainingSeconds / 30) * 100;

  return (
    <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* 2FA Step Header */}
      <div className="text-center space-y-1.5 pb-1 border-b border-slate-700/60">
        <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 mb-1 shadow-inner">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black tracking-tight text-white">{t.twoFactorTitle}</h3>
        <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
          {t.twoFactorSub}
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs font-bold text-emerald-400 mt-1">
          <Smartphone className="w-3.5 h-3.5" />
          <span>{username}</span>
        </div>
      </div>

      {/* Mode 1: 6-Digit TOTP PIN Boxes */}
      {!isBackupMode ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-bold text-slate-300">{t.twoFactorCodeLabel}</span>
            {/* Live Countdown Badge */}
            <div className="flex items-center gap-1.5 font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/60">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              <span>
                {remainingSeconds} {t.twoFactorSeconds}
              </span>
            </div>
          </div>

          {/* 6 Digit Input Group */}
          <div className="flex items-center justify-center gap-2 sm:gap-3" dir="ltr">
            {digits.map((digit, idx) => (
              <React.Fragment key={idx}>
                {idx === 3 && (
                  <span className="text-slate-600 font-bold text-lg select-none">-</span>
                )}
                <input
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={digit}
                  disabled={isVerifying}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  className={`w-11 h-13 sm:w-13 sm:h-15 text-center text-2xl font-black rounded-xl border bg-slate-900/90 text-emerald-400 shadow-inner transition-all focus:outline-hidden focus:ring-2 ${
                    digit
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                      : 'border-slate-700 hover:border-slate-600 focus:border-emerald-400 focus:ring-emerald-500/40'
                  }`}
                />
              </React.Fragment>
            ))}
          </div>

          {/* Live Progress Bar Indicator */}
          <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden border border-slate-700/60">
            <div
              className={`h-full transition-all duration-1000 ${
                remainingSeconds <= 5
                  ? 'bg-rose-500'
                  : remainingSeconds <= 10
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : (
        /* Mode 2: Backup Recovery Code Input */
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            {t.twoFactorUseBackupCode}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-3.5 rtl:pr-3.5 flex items-center pointer-events-none text-slate-400">
              <Key className="w-4 h-4 text-emerald-400" />
            </div>
            <input
              type="text"
              autoFocus
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
              placeholder={t.twoFactorBackupPlaceholder}
              className="w-full ltr:pl-10 rtl:pr-10 py-3 text-base font-mono font-bold tracking-widest uppercase rounded-xl border border-slate-700 bg-slate-900 text-emerald-300 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>
      )}

      {/* First Setup / QR Code Helper Expander */}
      {(initialSecret || initialUri) && (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-700/70 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowQrDetails(!showQrDetails)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-emerald-400" />
              {t.twoFactorSetupTitle}
            </span>
            {showQrDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showQrDetails && (
            <div className="p-4 pt-1 space-y-3 border-t border-slate-800 text-xs">
              <p className="text-slate-400 leading-relaxed">{t.twoFactorSetupSub}</p>

              {qrDataUrl && (
                <div className="flex justify-center p-2 bg-white rounded-xl shadow-md w-fit mx-auto">
                  <img
                    src={qrDataUrl}
                    alt="2FA QR Code"
                    className="w-40 h-40 object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {initialSecret && (
                <div className="space-y-1">
                  <span className="text-slate-400 font-semibold">{t.twoFactorSecretKeyLabel}</span>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-emerald-300 text-xs">
                    <span className="tracking-wider select-all">{formatTotpSecret(initialSecret)}</span>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="ltr:ml-2 rtl:mr-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedSecret ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">{t.twoFactorCopied}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t.twoFactorCopySecret}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error & Success Messages */}
      {errorMsg && (
        <div className="p-3 text-xs font-semibold text-rose-300 bg-rose-950/60 rounded-xl border border-rose-800 animate-in fade-in">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3 text-xs font-bold text-emerald-300 bg-emerald-950/70 rounded-xl border border-emerald-700 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2.5 pt-1">
        {/* Verify Submit Button */}
        <button
          type="button"
          disabled={isVerifying}
          onClick={() => submitVerification()}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-extrabold text-sm shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isVerifying ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t.twoFactorVerifyingBtn}</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              <span>{t.twoFactorVerifyBtn}</span>
              {lang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </>
          )}
        </button>

        {/* Toggle Backup Code Mode */}
        <div className="flex items-center justify-between text-xs pt-1">
          <button
            type="button"
            onClick={() => {
              setIsBackupMode(!isBackupMode);
              setErrorMsg(null);
            }}
            className="text-slate-400 hover:text-emerald-400 transition-colors font-semibold underline underline-offset-4 cursor-pointer"
          >
            {isBackupMode ? t.twoFactorUseTotpCode : t.twoFactorUseBackupCode}
          </button>

          {/* Back to Credentials */}
          <button
            type="button"
            onClick={onBack}
            className="text-slate-400 hover:text-slate-200 transition-colors font-medium flex items-center gap-1 cursor-pointer"
          >
            {lang === 'ar' ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
            <span>{t.twoFactorBackToLogin}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
