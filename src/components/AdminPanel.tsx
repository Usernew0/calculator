import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import {
  getAllUsersFromFirestore,
  saveUserProfileToFirestore,
  deleteUserFromFirestore,
  subscribeToUsers,
  subscribeToCalculations,
  syncAllDataWithFirestore,
  deduplicateUsers,
} from '../lib/firebase';
import {
  checkSupabaseHealth,
  SupabaseHealthReport,
  SUPABASE_REQUIRED_DDL_SQL,
} from '../lib/supabase';
import { Language, translations } from '../data/translations';
import {
  ShieldCheck,
  Users,
  UserPlus,
  Search,
  Filter,
  RefreshCw,
  Edit,
  Trash2,
  Lock,
  UserX,
  UserCheck,
  Building,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  ShieldAlert,
  Loader2,
  Database,
  X,
  Plus,
  Calculator,
  Ship,
  Globe,
  Sun,
  Moon,
  LogOut,
  Radio,
  Zap,
  Clock,
  Save,
  Copy,
  Check,
  Activity,
  Server,
  Table,
  FileCode,
} from 'lucide-react';

interface AdminPanelProps {
  lang: Language;
  setLang?: (lang: Language) => void;
  isDarkMode?: boolean;
  setIsDarkMode?: (val: boolean) => void;
  currentUser: UserProfile;
  onLogout?: () => void;
  onSwitchToTraderView?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  lang,
  setLang,
  isDarkMode,
  setIsDarkMode,
  currentUser,
  onLogout,
  onSwitchToTraderView,
}) => {
  const t = translations[lang];

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Form State for Create / Edit
  const [formData, setFormData] = useState<{
    userId: string;
    username: string;
    password: string;
    role: 'admin' | 'user';
    status: 'active' | 'suspended';
    name: string;
    email: string;
    company: string;
  }>({
    userId: '',
    username: '',
    password: '',
    role: 'user',
    status: 'active',
    name: '',
    email: '',
    company: '',
  });

  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Inactivity Timeout Settings
  const [inactivityMinutes, setInactivityMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('cargo_inactivity_timeout_minutes');
      return saved ? parseInt(saved, 10) || 15 : 15;
    } catch {
      return 15;
    }
  });

  const handleSaveInactivityTimeout = () => {
    const val = Math.max(1, Math.min(120, inactivityMinutes));
    setInactivityMinutes(val);
    localStorage.setItem('cargo_inactivity_timeout_minutes', String(val));
    window.dispatchEvent(new CustomEvent('cargo_timeout_updated', { detail: val }));
    showNotification(
      'success',
      lang === 'ar'
        ? `تم حفظ مهلة عدم النشاط للجلسات بنجاح (${val} دقيقة)`
        : `Session inactivity timeout successfully set to ${val} minutes`
    );
  };

  // Sync state tracking
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(true);
  const [syncedCalculationsCount, setSyncedCalculationsCount] = useState<number>(0);

  // Supabase Health & Auto-Check state
  const [supabaseHealth, setSupabaseHealth] = useState<SupabaseHealthReport | null>(null);
  const [isCheckingSupabase, setIsCheckingSupabase] = useState<boolean>(false);
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  const runSupabaseAutoCheck = async () => {
    setIsCheckingSupabase(true);
    try {
      const report = await checkSupabaseHealth();
      setSupabaseHealth(report);
      return report;
    } catch (err) {
      console.warn("Auto-check Supabase exception:", err);
    } finally {
      setIsCheckingSupabase(false);
    }
    return null;
  };

  // Load all users from Firestore or Local Storage fallback
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const dbUsers = await getAllUsersFromFirestore();
      
      // Also check local current user profile if not in list
      let userList = deduplicateUsers([...dbUsers]);
      if (
        currentUser &&
        !userList.some(
          (u) =>
            u.userId?.toLowerCase() === currentUser.userId?.toLowerCase() ||
            u.username?.toLowerCase() === currentUser.username?.toLowerCase()
        )
      ) {
        userList.push(currentUser);
      }

      setUsers(deduplicateUsers(userList));
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Failed to load users for admin panel:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Real-Time subscription on component mount
  useEffect(() => {
    fetchUsers();
    runSupabaseAutoCheck();

    // Subscribe to real-time users collection updates
    const unsubscribeUsers = subscribeToUsers(
      (updatedUsers) => {
        let userList = deduplicateUsers([...updatedUsers]);
        if (
          currentUser &&
          !userList.some(
            (u) =>
              u.userId?.toLowerCase() === currentUser.userId?.toLowerCase() ||
              u.username?.toLowerCase() === currentUser.username?.toLowerCase()
          )
        ) {
          userList.push(currentUser);
        }
        setUsers(deduplicateUsers(userList));
        setIsRealtimeConnected(true);
        setLastSyncedAt(new Date());
        setIsLoading(false);
      },
      (error) => {
        console.info('Realtime user subscription notice:', error);
      }
    );

    // Subscribe to real-time calculations collection updates for admin live counter
    const unsubscribeCalculations = subscribeToCalculations(
      (calcs) => {
        if (Array.isArray(calcs)) {
          setSyncedCalculationsCount(calcs.length);
        }
      }
    );

    return () => {
      unsubscribeUsers();
      if (unsubscribeCalculations) unsubscribeCalculations();
    };
  }, []);

  // Manual Bidirectional Real-Time Push & Pull Sync across Firestore & Supabase
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const [result, sbReport] = await Promise.all([
        syncAllDataWithFirestore(),
        runSupabaseAutoCheck(),
      ]);
      let userList = [...result.users];
      if (
        currentUser &&
        !userList.some((u) => u.username?.toLowerCase() === currentUser.username?.toLowerCase())
      ) {
        userList.push(currentUser);
      }
      setUsers(userList);
      setSyncedCalculationsCount(result.calculations.length);
      setLastSyncedAt(result.syncedAt);
      setIsRealtimeConnected(true);

      const sbUsersCount = sbReport?.usersCount ?? 0;
      const sbCalcsCount = sbReport?.calculationsCount ?? 0;

      showNotification(
        'success',
        lang === 'ar'
          ? `تمت مزامنة البيانات وتحديثها فورياً مع Firestore و Supabase (${result.users.length} حساب، ${result.calculations.length} عملية حسابية | Supabase: ${sbUsersCount} حسابات، ${sbCalcsCount} عمليات)`
          : `Dual sync complete! (${result.users.length} users & ${result.calculations.length} calculations synced. Supabase verified: ${sbUsersCount} users, ${sbCalcsCount} calcs)`
      );
    } catch (err: any) {
      showNotification(
        'error',
        lang === 'ar'
          ? 'تعذر إكمال المزامنة الكلية. يرجى التحقق من الاتصال.'
          : 'Sync error: Unable to push/pull latest database records.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const togglePasswordVisibility = (usernameKey: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [usernameKey]: !prev[usernameKey],
    }));
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormData({
      userId: 'USR-' + Math.floor(100000 + Math.random() * 900000),
      username: '',
      password: '',
      role: 'user',
      status: 'active',
      name: '',
      email: '',
      company: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      userId: user.userId || 'USR-' + Math.floor(100000 + Math.random() * 900000),
      username: user.username || '',
      password: user.password || '',
      role: user.role || 'user',
      status: user.status || 'active',
      name: user.name || '',
      email: user.email || '',
      company: user.company || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password.trim()) {
      showNotification('error', lang === 'ar' ? 'يرجى ملء اسم المستخدم وكلمة المرور' : 'Username and Password are required');
      return;
    }

    setIsSaving(true);
    const updatedProfile: UserProfile = {
      userId: formData.userId || 'USR-' + Math.floor(100000 + Math.random() * 900000),
      username: formData.username.trim().toLowerCase(),
      password: formData.password.trim(),
      role: formData.role,
      status: formData.status,
      name: formData.name.trim() || formData.username.trim(),
      email: formData.email.trim(),
      company: formData.company.trim(),
      createdAt: editingUser?.createdAt || new Date().toISOString(),
      lastLoginAt: editingUser?.lastLoginAt || new Date().toISOString(),
    };

    try {
      const oldUsername = editingUser?.username?.trim().toLowerCase();
      await saveUserProfileToFirestore(updatedProfile, oldUsername);
      showNotification('success', lang === 'ar' ? 'تم حفظ بيانات المستخدم بنجاح في قاعدة البيانات' : 'User account updated in Firestore database successfully');
      setIsModalOpen(false);
      await fetchUsers();
    } catch (err) {
      showNotification('error', lang === 'ar' ? 'حدث خطأ أثناء حفظ البيانات' : 'Failed to save user account to database');
    } finally {
      setIsSaving(false);
    }
  };

  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState<boolean>(false);

  const handleDeleteUser = (user: UserProfile) => {
    setUserToDelete(user);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      await deleteUserFromFirestore(userToDelete.username);
      showNotification(
        'success',
        lang === 'ar'
          ? `تم حذف حساب المستخدم "${userToDelete.username}" بنجاح من قاعدة البيانات`
          : `User account "${userToDelete.username}" deleted from Firestore successfully`
      );
      setUserToDelete(null);
      await fetchUsers();
    } catch (err) {
      showNotification('error', lang === 'ar' ? 'حدث خطأ أثناء حذف الحساب' : 'Failed to delete user account');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
    const updated: UserProfile = { ...user, status: newStatus };
    try {
      await saveUserProfileToFirestore(updated);
      showNotification(
        'success',
        lang === 'ar'
          ? `تم تغيير حالة الحساب إلى (${newStatus === 'active' ? 'نشط' : 'معطل'})`
          : `Account status updated to ${newStatus}`
      );
      await fetchUsers();
    } catch (err) {
      showNotification('error', 'Error updating user status');
    }
  };

  const handleToggleRole = async (user: UserProfile) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const updated: UserProfile = { ...user, role: newRole };
    try {
      await saveUserProfileToFirestore(updated);
      showNotification(
        'success',
        lang === 'ar'
          ? `تم تغيير صلاحية الحساب إلى (${newRole === 'admin' ? 'مدير نظام' : 'مستخدم عادي'})`
          : `User role updated to ${newRole}`
      );
      await fetchUsers();
    } catch (err) {
      showNotification('error', 'Error updating user role');
    }
  };

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.username?.toLowerCase().includes(q) ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.company?.toLowerCase().includes(q) ||
      u.userId?.toLowerCase().includes(q);

    const matchesRole = roleFilter === 'all' || (u.role || 'user') === roleFilter;
    const matchesStatus = statusFilter === 'all' || (u.status || 'active') === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => (u.status || 'active') === 'active').length;
  const suspendedUsers = users.filter((u) => u.status === 'suspended').length;
  const adminUsers = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Standalone Admin Portal Header */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand & Admin Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base text-white tracking-tight">Elegant</span>
              </div>
              <p className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                  Admin Portal
              </p>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Logged in admin badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 font-semibold">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>{currentUser.name || currentUser.username}</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono font-bold px-1.5 py-0.2 rounded border border-emerald-500/30">
                {currentUser.role}
              </span>
            </div>

            {/* Language Switcher */}
            {setLang && (
              <button
                onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Toggle Language"
              >
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'en' ? 'العربية' : 'EN'}</span>
              </button>
            )}

            {/* Dark Mode Toggle */}
            {setIsDarkMode && (
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Toggle Dark Mode"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
              </button>
            )}

            {/* Switch to Trader App Button */}
            {onSwitchToTraderView && (
              <button
                onClick={onSwitchToTraderView}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Switch to Trader Website & Calculator"
              >
                <Calculator className="w-4 h-4" />
                <span className="hidden sm:inline">{lang === 'ar' ? 'موقع الحاسبة والتجارة' : 'Trader Website'}</span>
              </button>
            )}

            {/* Logout Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-rose-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="Logout from Admin System"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">{lang === 'ar' ? 'خروج' : 'Logout'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Admin Portal Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Banner Header */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-800/90 to-amber-950/40 p-6 rounded-2xl border border-slate-700/80 shadow-xl text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                <span>{lang === 'ar' ? 'لوحة تحكم مدير النظام - إدارة الحسابات' : 'Admin Control Panel - Account Management'}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  user.profile Schema
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                {lang === 'ar'
                  ? 'التحكم الكامل بحسابات المستخدمين، تعديل كلمات المرور، منح الصلاحيات، وإدارة قاعدة بيانات Firestore.'
                  : 'Full management of user accounts, password resets, role permissions, and Firestore user database records.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
            {/* Real-time sync action button */}
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer border border-emerald-300/40"
              title="Push and pull latest data to/from Firestore in real-time"
            >
              <RefreshCw className={`w-4 h-4 text-slate-950 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing
                  ? lang === 'ar'
                    ? 'جاري المزامنة...'
                    : 'Syncing Real-Time...'
                  : lang === 'ar'
                  ? 'مزامنة البيانات الآن'
                  : 'Sync Data Real-Time'}
              </span>
            </button>

            <button
              onClick={fetchUsers}
              disabled={isLoading}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Refresh local database records"
            >
              <Database className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
              <span>{lang === 'ar' ? 'تحديث القائمة' : 'Refresh'}</span>
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-amber-900/40 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إضافة حساب جديد' : 'Add New Account'}</span>
            </button>
          </div>
        </div>

        {/* Dual Database Sync & Auto-Check Status Panel */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-700/80">
            <div className="flex items-center gap-2.5">
              <Server className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>{lang === 'ar' ? 'حالة المزامنة وفحص قواعد البيانات (Firestore & Supabase)' : 'Database Sync & Diagnostics (Firestore & Supabase)'}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  {lang === 'ar'
                    ? 'يتم حفظ المصادقة وحالة الحسابات في Firestore، ويتم حفظ كافة البيانات والعمليات في Supabase'
                    : 'Firestore manages Auth & Account Status, Supabase stores complete application data'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={runSupabaseAutoCheck}
                disabled={isCheckingSupabase}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Run diagnostic auto-check on Supabase connection and tables"
              >
                <Activity className={`w-3.5 h-3.5 ${isCheckingSupabase ? 'animate-spin text-indigo-400' : 'text-indigo-400'}`} />
                <span>
                  {isCheckingSupabase
                    ? lang === 'ar' ? 'جاري الفحص...' : 'Checking...'
                    : lang === 'ar' ? 'فحص تلقائي لـ Supabase' : 'Auto-Check Supabase'}
                </span>
              </button>

              <button
                onClick={() => setShowSqlModal(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="View SQL DDL schema script for Supabase tables"
              >
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'ar' ? 'سكربت إنشاء الجداول (SQL)' : 'SQL DDL Setup'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Database 1: Firebase Firestore (Auth & Status) */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-xs text-slate-200">Firebase Firestore</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Auth & Account Status
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{isRealtimeConnected ? 'Online' : 'Connecting'}</span>
                </div>
              </div>
              <div className="text-xs text-slate-400 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>{lang === 'ar' ? 'المزامنة الحية:' : 'Real-Time Sync:'}</span>
                  <span className="text-emerald-400 font-bold">Active (Firestore Listener)</span>
                </div>
                <div className="flex justify-between">
                  <span>{lang === 'ar' ? 'مجموعة الحسابات :' : 'users collection:'}</span>
                  <span className="text-slate-200 font-bold">{users.length} {lang === 'ar' ? 'حسابات' : 'records'}</span>
                </div>
              </div>
            </div>

            {/* Database 2: Supabase PostgreSQL (Full Application Data) */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-xs text-slate-200">Supabase PostgreSQL</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Full Data Storage
                  </span>
                </div>
                {supabaseHealth ? (
                  supabaseHealth.usersTableOk && supabaseHealth.calculationsTableOk ? (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'سليم ومتصل' : 'Healthy & Ready'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'يحتاج تهيئة جداول' : 'Tables Action Needed'}</span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px] font-bold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Checking...</span>
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-400 space-y-1 font-mono">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <Table className="w-3 h-3 text-slate-500" />
                    <span>users table:</span>
                  </span>
                  {supabaseHealth?.usersTableOk ? (
                    <span className="text-emerald-400 font-bold">
                      ✓ OK ({supabaseHealth.usersCount} {lang === 'ar' ? 'سجل' : 'rows'})
                    </span>
                  ) : (
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {supabaseHealth?.usersError || 'Missing Table'}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <Table className="w-3 h-3 text-slate-500" />
                    <span>calculations table:</span>
                  </span>
                  {supabaseHealth?.calculationsTableOk ? (
                    <span className="text-emerald-400 font-bold">
                      ✓ OK ({supabaseHealth.calculationsCount} {lang === 'ar' ? 'سجل' : 'rows'})
                    </span>
                  ) : (
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {supabaseHealth?.calculationsError || 'Missing Table'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Warning Banner if Supabase tables missing */}
          {supabaseHealth && (!supabaseHealth.usersTableOk || !supabaseHealth.calculationsTableOk) && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {lang === 'ar'
                    ? 'تنبيه: يبدو أن بعض الجداول لم تُنشأ بعد في حساب Supabase الخاص بك. يمكنك نسخ وتنسيق سكربت SQL وتشغيله في Supabase SQL Editor بخطوة واحدة.'
                    : 'Notice: Some tables have not been created in your Supabase project yet. Click to view & copy the SQL setup script to execute in Supabase SQL Editor.'}
                </span>
              </div>
              <button
                onClick={() => setShowSqlModal(true)}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shrink-0 transition-colors text-[11px] cursor-pointer"
              >
                {lang === 'ar' ? 'فتح سكربت SQL' : 'View SQL Script'}
              </button>
            </div>
          )}
        </div>

        {/* Real-Time Live Sync Status Strip */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 shadow-inner">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span>
                {isRealtimeConnected
                  ? lang === 'ar'
                    ? 'المزامنة الفورية نشطة'
                    : 'Firestore Real-Time Listener Active'
                  : lang === 'ar'
                  ? 'جاري الاتصال بـ Firestore...'
                  : 'Connecting to Firestore...'}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-slate-400 font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {lang === 'ar'
                  ? 'التغييرات تتزامن آلياً عبر جميع الأجهزة والحسابات'
                  : 'Changes sync automatically across all clients'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
            {lastSyncedAt && (
              <span>
                {lang === 'ar' ? 'آخر مزامنة:' : 'Last Synced:'}{' '}
                <strong className="text-slate-200">{lastSyncedAt.toLocaleTimeString()}</strong>
              </span>
            )}
            {syncedCalculationsCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
                {syncedCalculationsCount} {lang === 'ar' ? 'عملية محفوطة' : 'calcs synced'}
              </span>
            )}
          </div>
        </div>

      {/* Notifications Toast */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-bold border flex items-center gap-2.5 shadow-md ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
              : 'bg-rose-950/80 border-rose-700 text-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Analytics Counter Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-800">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{totalUsers}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              {lang === 'ar' ? 'إجمالي الحسابات' : 'Total Accounts'}
            </div>
          </div>
        </div>

        {/* Card 2: Active */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{activeUsers}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              {lang === 'ar' ? 'حسابات نشطة' : 'Active Accounts'}
            </div>
          </div>
        </div>

        {/* Card 3: Admins */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{adminUsers}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              {lang === 'ar' ? 'مدراء النظام' : 'System Admins'}
            </div>
          </div>
        </div>

        {/* Card 4: Suspended */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{suspendedUsers}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              {lang === 'ar' ? 'حسابات معطلة' : 'Suspended Users'}
            </div>
          </div>
        </div>
      </div>

      {/* Session Inactivity Timeout Settings Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-800/90 via-slate-800 to-amber-950/30 border border-slate-700/90 shadow-xl text-white space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{t.inactivityTimeoutLabel || (lang === 'ar' ? 'إعداد مهلة عدم النشاط للجلسات' : 'Session Inactivity Timeout Settings')}</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-extrabold uppercase border border-amber-500/30">
                  {inactivityMinutes} {t.inactivityTimeoutUnit || (lang === 'ar' ? 'دقيقة' : 'Mins')}
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {t.inactivityTimeoutSub || (lang === 'ar' ? 'يتم تسجيل خروج المستخدم تلقائياً عند عدم تفاعله مع الصفحة لمدة الدقائق المحددة.' : 'Automatically log out users when no mouse/keyboard/touch activity is detected for the specified minutes.')}
              </p>
            </div>
          </div>

          {/* Preset Buttons & Custom Input Form */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-700">
              {[5, 15, 30, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setInactivityMinutes(mins)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    inactivityMinutes === mins
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {mins} {lang === 'ar' ? 'د' : 'm'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-28">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={inactivityMinutes}
                  onChange={(e) => setInactivityMinutes(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-600 bg-slate-900 text-white text-center focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                />
                <span className="absolute ltr:right-2 rtl:left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                  {t.inactivityTimeoutUnit || (lang === 'ar' ? 'دقيقة' : 'min')}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSaveInactivityTimeout}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-amber-950/40 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t.saveTimeoutBtn || (lang === 'ar' ? 'حفظ المهلة' : 'Save Timeout')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'ar' ? 'البحث باسم المستخدم، البريد، أو المعرف...' : 'Search username, name, email, or ID...'}
            className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold shrink-0">
            <Filter className="w-3.5 h-3.5 text-emerald-500" />
            <span>{lang === 'ar' ? 'التصفية:' : 'Filters:'}</span>
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden"
          >
            <option value="all">{lang === 'ar' ? 'كل الصلاحيات' : 'All Roles'}</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden"
          >
            <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
            <option value="active">{lang === 'ar' ? 'نشط (Active)' : 'Active'}</option>
            <option value="suspended">{lang === 'ar' ? 'معطل (Suspended)' : 'Suspended'}</option>
          </select>
        </div>
      </div>

      {/* Users Table Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3.5 text-start">{lang === 'ar' ? 'اسم المستخدم / المعرف' : 'Username / ID'}</th>
                <th className="p-3.5 text-start">{lang === 'ar' ? 'كلمة المرور' : 'Password'}</th>
                <th className="p-3.5 text-start">{lang === 'ar' ? 'الصلاحية' : 'Role'}</th>
                <th className="p-3.5 text-start">{lang === 'ar' ? 'حالة الحساب' : 'Status'}</th>
                <th className="p-3.5 text-start">{lang === 'ar' ? 'الاسم والشركة' : 'Name & Company'}</th>
                <th className="p-3.5 text-start">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</th>
                <th className="p-3.5 text-end">{lang === 'ar' ? 'الإجراءات والتحكم' : 'Actions & Control'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
                    <span>{lang === 'ar' ? 'جاري تحميل الحسابات من قاعدة البيانات...' : 'Loading accounts from Firestore database...'}</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                    <ShieldAlert className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {lang === 'ar' ? 'لم يتم العثور على حسابات طابقة للبحث' : 'No user accounts match your filters'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isPassVisible = visiblePasswords[user.username] || false;
                  const isCurrentLoggedIn = currentUser?.username?.toLowerCase() === user.username?.toLowerCase();

                  return (
                    <tr
                      key={user.username || user.userId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      {/* Username + ID */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{user.username}</span>
                              {isCurrentLoggedIn && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-emerald-500 text-white rounded-md font-bold">
                                  {lang === 'ar' ? 'حسابك الحالي' : 'You'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">{user.userId}</div>
                          </div>
                        </div>
                      </td>

                      {/* Password */}
                      <td className="p-3.5">
                        <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-800 dark:text-slate-200">
                          <KeyRound className="w-3 h-3 text-slate-400" />
                          <span>{isPassVisible ? user.password || '••••••' : '••••••••'}</span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(user.username)}
                            className="text-slate-400 hover:text-emerald-500 ltr:ml-1 rtl:mr-1 cursor-pointer"
                            title="Toggle password view"
                          >
                            {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Role Badge & Toggle */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleRole(user)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold cursor-pointer border flex items-center gap-1 transition-all ${
                            user.role === 'admin'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20'
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>{user.role === 'admin' ? 'ADMIN' : 'USER'}</span>
                        </button>
                      </td>

                      {/* Status Badge & Toggle */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold cursor-pointer border flex items-center gap-1 transition-all ${
                            (user.status || 'active') === 'active'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                          }`}
                        >
                          {(user.status || 'active') === 'active' ? (
                            <>
                              <UserCheck className="w-3 h-3" />
                              <span>ACTIVE</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-3 h-3" />
                              <span>SUSPENDED</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Name & Company */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{user.name || '-'}</div>
                        {user.company && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            <span>{user.company}</span>
                          </div>
                        )}
                      </td>

                      {/* Email */}
                      <td className="p-3.5 text-slate-600 dark:text-slate-300">
                        {user.email ? (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{user.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No email</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(user)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                            title={lang === 'ar' ? 'تعديل الحساب' : 'Edit User Account'}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            disabled={isCurrentLoggedIn}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isCurrentLoggedIn ? 'Cannot delete current logged in account' : 'Delete user account'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <ShieldCheck className="w-5 h-5 text-emerald-200" />
                </div>
                <h3 className="text-base font-extrabold">
                  {editingUser
                    ? lang === 'ar'
                      ? 'تعديل بيانات الحساب'
                      : 'Edit User Account'
                    : lang === 'ar'
                    ? 'إضافة حساب جديد إلى قاعدة البيانات'
                    : 'Create New User Account'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {/* Username Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  {t.usernameLabel} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g. ebrahim_trader"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60"
                />
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  {t.passwordLabel} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Set account password"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              {/* Grid: Role & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    {lang === 'ar' ? 'الصلاحية (Role)' : 'Role'}
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold focus:outline-hidden"
                  >
                    <option value="user">USER (Regular Trader)</option>
                    <option value="admin">ADMIN (System Control)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    {lang === 'ar' ? 'حالة الحساب' : 'Account Status'}
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold focus:outline-hidden"
                  >
                    <option value="active">ACTIVE (نشط)</option>
                    <option value="suspended">SUSPENDED (معطل)</option>
                  </select>
                </div>
              </div>

              {/* Full Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  {t.userNameLabel}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ebrahim Ayman"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:outline-hidden"
                />
              </div>

              {/* Grid: Email & Company */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    {t.userEmailLabel}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="trader@company.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    {t.companyLabel}
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Logistics Inc"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{lang === 'ar' ? 'حفظ الحساب في قاعدة البيانات' : 'Save Account to Database'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-rose-500/30 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 border-b border-rose-900/40 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-100">
                    {lang === 'ar' ? 'تأكيد حذف حساب المستخدم' : 'Confirm Delete Account'}
                  </h3>
                  <p className="text-[11px] text-rose-300/80 font-medium">
                    {lang === 'ar' ? 'إجراء غير قابل للتراجع من قاعدة البيانات' : 'Irreversible Firestore Operation'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">{lang === 'ar' ? 'اسم المستخدم:' : 'Username:'}</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                    {userToDelete.username}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">{lang === 'ar' ? 'معرف الحساب:' : 'User ID:'}</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300 font-bold">
                    {userToDelete.userId}
                  </span>
                </div>
                {userToDelete.name && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-bold">{lang === 'ar' ? 'الاسم:' : 'Name:'}</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">
                      {userToDelete.name}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">{lang === 'ar' ? 'الصلاحية:' : 'Role:'}</span>
                  <span className="font-bold uppercase text-amber-500">
                    {userToDelete.role}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  {lang === 'ar'
                    ? `هل أنت متأكد من حذف حساب المستخدم "${userToDelete.username}"؟ سيتم مسح بيانات الحساب تماماً من قاعدة البيانات ولن تتمكن من استعادتها.`
                    : `Are you sure you want to permanently delete user account "${userToDelete.username}" from Firestore? This action cannot be undone.`}
                </span>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  disabled={isDeletingUser}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={confirmDeleteUser}
                  disabled={isDeletingUser}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/50 disabled:opacity-50"
                >
                  {isDeletingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>{lang === 'ar' ? 'تأكيد الحذف النهائى' : 'Confirm Delete'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supabase SQL DDL Schema Setup Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100">
                    {lang === 'ar' ? 'سكربت إنشاء جداول Supabase (SQL DDL Setup)' : 'Supabase SQL DDL Schema Setup Script'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {lang === 'ar' ? 'قم بنسخ هذا السكربت وتشغيله في Supabase SQL Editor' : 'Copy and run this script in Supabase SQL Editor to initialize tables'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-xs font-semibold flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  {lang === 'ar'
                    ? 'هذا السكربت ينشئ جدول `users` لبيانات المستخدمين وجدول `calculations` للعمليات الحسابية وعروض الأسعار مع تفعيل سياسات الوصول RLS.'
                    : 'This script creates the `users` table for account data, the `calculations` table for quotes/freight logs, and configures permissive RLS policies.'}
                </span>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-xs overflow-x-auto max-h-72 leading-relaxed">
                  {SUPABASE_REQUIRED_DDL_SQL}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(SUPABASE_REQUIRED_DDL_SQL);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2500);
                  }}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5 text-slate-950" />}
                  <span>{copiedSql ? (lang === 'ar' ? 'تم النسخ!' : 'Copied!') : (lang === 'ar' ? 'نسخ السكربت' : 'Copy SQL')}</span>
                </button>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-2">
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-amber-400 hover:underline font-bold flex items-center gap-1"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'الانتقال إلى لوحة تحكم Supabase SQL Editor' : 'Open Supabase Dashboard'}</span>
                </a>

                <button
                  type="button"
                  onClick={() => setShowSqlModal(false)}
                  className="px-5 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
};
