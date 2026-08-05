import React, { useState } from 'react';
import { UserProfile } from '../types';
import { saveUserProfileToFirestore, getUserProfileFromFirestore } from '../lib/firebase';
import { translations, Language } from '../data/translations';
import {
  Ship,
  Lock,
  User,
  CheckCircle2,
  Database,
  Loader2,
  ShieldCheck,
  Globe,
  Sun,
  Moon,
  ArrowRight,
  ArrowLeft,
  Calculator,
  TrendingUp,
  Camera,
  FileText,
  KeyRound,
  IdCard,
  Eye,
  EyeOff,
} from 'lucide-react';

interface LoginScreenProps {
  lang: Language;
  setLang: (lang: Language) => void;
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  lang,
  setLang,
  isDarkMode,
  setIsDarkMode,
  onLoginSuccess,
}) => {
  const t = translations[lang];

  const [username, setUsername] = useState(() => {
    return localStorage.getItem('cargo_remember_username') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    return localStorage.getItem('cargo_remember_me') !== 'false';
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى إدخال اسم المستخدم وكلمة المرور'
          : 'Please enter both Username and Password'
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Check if user profile exists in Firestore database / seed records
      const existingUser = await getUserProfileFromFirestore(cleanUsername);

      if (!existingUser) {
        setErrorMsg(
          lang === 'ar'
            ? 'حساب المستخدم غير مسجل لدينا. يرجى التواصل مع مسؤول النظام لإضافة حسابك.'
            : 'User account is not signed in for us. Please contact the administrator.'
        );
        setIsSubmitting(false);
        return;
      }

      if (existingUser.status === 'suspended') {
        setErrorMsg(
          lang === 'ar'
            ? 'هذا الحساب معطل من قبل مدير النظام'
            : 'This account has been suspended by the system administrator.'
        );
        setIsSubmitting(false);
        return;
      }

      // Validate password for existing user
      if (existingUser.password && existingUser.password !== cleanPassword) {
        setErrorMsg(t.invalidPasswordMsg);
        setIsSubmitting(false);
        return;
      }

      const profileSchema: UserProfile = {
        ...existingUser,
        lastLoginAt: new Date().toISOString(),
      };

      // Update user last login timestamp in Firestore database
      await saveUserProfileToFirestore(profileSchema);

      // Persist in localStorage according to rememberMe preference
      if (rememberMe) {
        localStorage.setItem('cargo_remember_username', cleanUsername);
        localStorage.setItem('cargo_remember_me', 'true');
        localStorage.setItem('cargo_user_profile', JSON.stringify(profileSchema));
      } else {
        localStorage.removeItem('cargo_remember_username');
        localStorage.setItem('cargo_remember_me', 'false');
        sessionStorage.setItem('cargo_session_active', 'true');
        localStorage.setItem('cargo_user_profile', JSON.stringify(profileSchema));
      }

      setSuccessMsg(t.loginSuccessMsg);
      setTimeout(() => {
        onLoginSuccess(profileSchema);
        setIsSubmitting(false);
      }, 800);
    } catch (err: any) {
      console.error('Error during authentication:', err);
      setErrorMsg(
        lang === 'ar'
          ? 'حدث خطأ يرجى المحاولة مرة أخرى.'
          : 'connection error. Please try again.'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Top Header Bar */}
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl shadow-md text-white">
            <Ship className="w-6 h-6" />
          </div>
          <div>
            <span className="text-lg font-black tracking-wider text-white">
              CargoProfit <span className="text-emerald-400">FX</span>
            </span>
            <span className="hidden sm:inline-block ltr:ml-2 rtl:mr-2 text-xs text-slate-400 font-medium border-l rtl:border-r border-slate-700 ltr:pl-2 rtl:pr-2">
              {lang === 'ar' ? 'نظام حاسبة الشحن والتجارة الدولية' : 'Landed Cost & FX Platform'}
            </span>
          </div>
        </div>

        {/* Top Controls: Language & Theme */}
        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <button
            type="button"
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 transition-all cursor-pointer"
            title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Login Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center items-center gap-8 my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full">
          {/* Left / Top Hero Info */}
          <div className="lg:col-span-6 space-y-6 text-center lg:ltr:text-left lg:rtl:text-right">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              {lang === 'ar' ? (
                <>
                  تسجيل الدخول إلى <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">منصة الشحن والتكلفة</span>
                </>
              ) : (
                <>
                  Login to <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">CargoProfit Platform</span>
                </>
              )}
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {lang === 'ar'
                ? 'أدخل اسم المستخدم وكلمة المرور لتسجيل الدخول مباشرة إلى حسابك الخاص بالمنصة.'
                : 'Sign in with your registered Username and Password to access your private account.'}
            </p>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                  <Calculator className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-200 font-semibold text-start">
                  {lang === 'ar' ? 'حاسبة النولون والجمارك' : 'Freight & Customs Cost'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400 shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-200 font-semibold text-start">
                  {lang === 'ar' ? 'ماسح الفواتير بالذكاء الاصطناعي' : 'AI Invoice OCR Scanner'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-200 font-semibold text-start">
                  {lang === 'ar' ? 'أسعار الصرف المباشرة' : 'Live FX Currency Rates'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-200 font-semibold text-start">
                  {lang === 'ar' ? 'تقارير PDF بالعربية والإنجليزية' : 'PDF Reports (AR & EN)'}
                </div>
              </div>
            </div>
          </div>

          {/* Right / Bottom Login Card */}
          <div className="lg:col-span-6 w-full">
            <div className="bg-slate-800/90 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden backdrop-blur-md">
              {/* Card Banner Header */}
              <div className="p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
                    <KeyRound className="w-6 h-6 text-emerald-200" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold leading-tight">{t.loginModalTitle}</h2>
                    <p className="text-xs text-emerald-100/90 mt-0.5">{t.loginModalSub}</p>
                  </div>
                </div>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Username Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    {t.usernameLabel} <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-3.5 rtl:pr-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4 text-emerald-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t.usernamePlaceholder}
                      className="w-full ltr:pl-10 rtl:pr-10 ltr:pr-3.5 rtl:pl-3.5 py-3 text-sm rounded-xl border border-slate-600 bg-slate-900/80 text-white font-semibold placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      {t.passwordLabel} <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer"
                    >
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 ltr:pl-3.5 rtl:pr-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4 text-emerald-400" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.passwordPlaceholder}
                      className="w-full ltr:pl-10 rtl:pr-10 ltr:pr-10 rtl:pl-10 py-3 text-sm rounded-xl border border-slate-600 bg-slate-900/80 text-white font-semibold placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 ltr:right-0 rtl:left-0 ltr:pr-3.5 rtl:pl-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Option */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-300 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded-md bg-slate-900 border-slate-600 text-emerald-500 focus:ring-emerald-500/50 focus:ring-offset-slate-800 cursor-pointer accent-emerald-500"
                    />
                    <span className="group-hover:text-white transition-colors">
                      {t.rememberMeLabel || (lang === 'ar' ? 'تذكر بيانات الدخول' : 'Remember me on this device')}
                    </span>
                  </label>
                </div>


                {/* Error & Success Messages */}
                {errorMsg && (
                  <div className="p-3 text-xs font-semibold text-rose-300 bg-rose-950/50 rounded-xl border border-rose-800">
                    {errorMsg}
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 text-xs font-bold text-emerald-300 bg-emerald-950/60 rounded-xl border border-emerald-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Login Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-extrabold text-sm shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>{t.loginSubmitBtn}</span>
                      {lang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    </>
                  )}
                </button>
              </form>

              {/* Footer info inside card */}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-800 text-center text-xs text-slate-500">
        © 2026 CargoProfit FX. {lang === 'ar' ? 'جميع الحقوق محفوظة - حاسبة الشحن والتكلفة الإجمالية' : 'All Rights Reserved. Landed Cost & Customs Intelligence.'}
      </footer>
    </div>
  );
};
