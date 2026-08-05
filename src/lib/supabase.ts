import { createClient } from '@supabase/supabase-js';
import { CalculationResult, UserProfile } from '../types';

const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};

const SUPABASE_URL =
  env.VITE_SUPABASE_URL || 'https://vpopmufbiennknognoth.supabase.co';
const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwb3BtdWZiaWVubmtub2dub3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MzI1OTQsImV4cCI6MjEwMTUwODU5NH0.7suCLGIj75KRqDyVm7PCPFMS5GFvVeWBcUoDh6ofZns';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const USERS_TABLE = 'users';
const CALCULATIONS_TABLE = 'calculations';

function handleSupabaseError(context: string, error: any) {
  if (!error) return;
  const msg = error.message || '';
  if (
    error.code === 'PGRST301' ||
    error.code === '42P01' ||
    msg.toLowerCase().includes('schema cache') ||
    msg.toLowerCase().includes('does not exist')
  ) {
    console.info(
      `[Supabase Setup Info] Table required for "${context}" is not created yet in Supabase. Open Admin Panel to view/copy the SQL DDL setup script.`
    );
  } else {
    console.warn(`Supabase ${context} warning:`, msg);
  }
}

/**
 * Save user profile to Supabase
 */
export async function saveUserProfileToSupabase(profile: UserProfile): Promise<boolean> {
  try {
    const docKey = (profile.username || profile.userId).toLowerCase().trim();
    const payload = {
      id: docKey,
      user_id: profile.userId || docKey,
      username: profile.username || docKey,
      full_name: profile.name || profile.username || '',
      email: profile.email || '',
      company_name: profile.company || '',
      role: profile.role || 'user',
      status: profile.status || 'active',
      password: profile.password || '',
      profile_data: profile,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from(USERS_TABLE)
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      handleSupabaseError('save user profile', error);
      return false;
    }
    console.info('User profile saved to Supabase successfully:', docKey);
    return true;
  } catch (err) {
    handleSupabaseError('save user profile exception', err);
    return false;
  }
}

/**
 * Get user profile from Supabase by username or userId
 */
export async function getUserProfileFromSupabase(username: string): Promise<UserProfile | null> {
  try {
    const key = username.toLowerCase().trim();
    const { data, error } = await supabase
      .from(USERS_TABLE)
      .select('*')
      .or(`id.eq.${key},username.eq.${key},user_id.eq.${key}`)
      .maybeSingle();

    if (error) {
      handleSupabaseError('fetch user profile', error);
      return null;
    }

    if (data) {
      if (data.profile_data) {
        return data.profile_data as UserProfile;
      }
      return {
        userId: data.user_id || data.id,
        username: data.username || data.id,
        name: data.full_name || '',
        email: data.email || '',
        company: data.company_name || '',
        role: data.role || 'user',
        status: data.status || 'active',
        password: data.password || '',
        createdAt: data.created_at || new Date().toISOString(),
        lastLoginAt: data.updated_at || new Date().toISOString(),
      };
    }
  } catch (err) {
    handleSupabaseError('fetch user profile exception', err);
  }
  return null;
}

/**
 * Fetch all users from Supabase
 */
export async function getAllUsersFromSupabase(): Promise<UserProfile[]> {
  try {
    const { data, error } = await supabase
      .from(USERS_TABLE)
      .select('*');

    if (error) {
      handleSupabaseError('fetch all users', error);
      return [];
    }

    if (data && Array.isArray(data)) {
      return data.map((item) => {
        if (item.profile_data) return item.profile_data as UserProfile;
        return {
          userId: item.user_id || item.id,
          username: item.username || item.id,
          name: item.full_name || '',
          email: item.email || '',
          company: item.company_name || '',
          role: item.role || 'user',
          status: item.status || 'active',
          password: item.password || '',
          createdAt: item.created_at || new Date().toISOString(),
          lastLoginAt: item.updated_at || new Date().toISOString(),
        };
      });
    }
  } catch (err) {
    handleSupabaseError('fetch all users exception', err);
  }
  return [];
}

/**
 * Delete user from Supabase
 */
export async function deleteUserFromSupabase(key: string): Promise<boolean> {
  try {
    const docKey = key.toLowerCase().trim();
    const { error } = await supabase
      .from(USERS_TABLE)
      .delete()
      .or(`id.eq.${docKey},username.eq.${docKey},user_id.eq.${docKey}`);

    if (error) {
      handleSupabaseError('delete user', error);
      return false;
    }
    return true;
  } catch (err) {
    handleSupabaseError('delete user exception', err);
    return false;
  }
}

/**
 * Save calculation record to Supabase
 */
export async function saveCalculationToSupabase(calc: CalculationResult): Promise<boolean> {
  try {
    const payload = {
      id: calc.id,
      user_id: calc.userId || 'guest',
      title: calc.input?.title || 'Calculation Record',
      target_currency: calc.input?.targetCurrency || 'USD',
      total_landed_cost: calc.totalLandedCostTarget || 0,
      total_revenue: calc.totalRevenueTarget || 0,
      net_profit: calc.totalProfitTarget || 0,
      calculation_data: calc,
      created_at: calc.createdAt || new Date().toISOString(),
    };

    const { error } = await supabase
      .from(CALCULATIONS_TABLE)
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      handleSupabaseError('save calculation', error);
      return false;
    }
    console.info('Calculation saved to Supabase successfully:', calc.id);
    return true;
  } catch (err) {
    handleSupabaseError('save calculation exception', err);
    return false;
  }
}

/**
 * Get calculations from Supabase for a specific user or all
 */
export async function getCalculationsFromSupabase(filterUserId?: string | null): Promise<CalculationResult[]> {
  try {
    let query = supabase.from(CALCULATIONS_TABLE).select('*');
    if (filterUserId) {
      query = query.eq('user_id', filterUserId);
    }

    const { data, error } = await query;
    if (error) {
      handleSupabaseError('fetch calculations', error);
      return [];
    }

    if (data && Array.isArray(data)) {
      const results: CalculationResult[] = data.map((item) => {
        if (item.calculation_data) {
          return item.calculation_data as CalculationResult;
        }
        return item as unknown as CalculationResult;
      });
      results.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      return results;
    }
  } catch (err) {
    handleSupabaseError('fetch calculations exception', err);
  }
  return [];
}

/**
 * Delete calculation from Supabase
 */
export async function deleteCalculationFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(CALCULATIONS_TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      handleSupabaseError('delete calculation', error);
      return false;
    }
    return true;
  } catch (err) {
    handleSupabaseError('delete calculation exception', err);
    return false;
  }
}

/**
 * Clear all calculations from Supabase for a specific user or all
 */
export async function clearAllCalculationsFromSupabase(filterUserId?: string | null): Promise<boolean> {
  try {
    let query = supabase.from(CALCULATIONS_TABLE).delete();
    if (filterUserId) {
      query = query.eq('user_id', filterUserId);
    } else {
      query = query.neq('id', '');
    }

    const { error } = await query;
    if (error) {
      handleSupabaseError('clear calculations', error);
      return false;
    }
    return true;
  } catch (err) {
    handleSupabaseError('clear calculations exception', err);
    return false;
  }
}

/**
 * Subscribe to real-time changes in calculations table
 */
export function subscribeToCalculationsSupabase(
  onUpdate: (data: CalculationResult[]) => void,
  filterUserId?: string | null
) {
  // Fetch initial data
  getCalculationsFromSupabase(filterUserId).then((initialData) => {
    onUpdate(initialData);
  });

  const channelId = `calculations_sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  // Subscribe to changes
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: CALCULATIONS_TABLE },
      () => {
        getCalculationsFromSupabase(filterUserId).then((freshData) => {
          onUpdate(freshData);
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to real-time changes in users table
 */
export function subscribeToUsersSupabase(onUpdate: (data: UserProfile[]) => void) {
  // Fetch initial data
  getAllUsersFromSupabase().then((initialUsers) => {
    onUpdate(initialUsers);
  });

  const channelId = `users_sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: USERS_TABLE },
      () => {
        getAllUsersFromSupabase().then((freshUsers) => {
          onUpdate(freshUsers);
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export interface SupabaseHealthReport {
  isConnected: boolean;
  usersTableOk: boolean;
  calculationsTableOk: boolean;
  usersCount: number;
  calculationsCount: number;
  usersError?: string;
  calculationsError?: string;
  generalError?: string;
  checkedAt: string;
  recommendedSqlDDL: string;
}

export const SUPABASE_REQUIRED_DDL_SQL = `-- Supabase & PostgreSQL Table Schema Setup for CargoProfit Application
-- Auto-Updated: Includes support for Product Cargo Images, Unit/Total Prices & Freight History

-- 1. Create users table (Stores full user account data & metadata)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT,
  full_name TEXT,
  email TEXT,
  company_name TEXT,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  password TEXT,
  profile_data JSONB, -- Contains full UserProfile object
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create calculations table (Stores all calculations, quotes, products & uploaded invoice/cargo images)
CREATE TABLE IF NOT EXISTS public.calculations (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT,
  target_currency TEXT,
  total_landed_cost NUMERIC,
  total_revenue NUMERIC,
  net_profit NUMERIC,
  calculation_data JSONB, -- Stores complete calculation, product image (invoiceImage), SKU, and freight specs
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Optimization Indexes (Enables instant searching by Product SKU, Title, Trade Direction & Cargo Image presence)
CREATE INDEX IF NOT EXISTS idx_calculations_user_id ON public.calculations (user_id);
CREATE INDEX IF NOT EXISTS idx_calculations_created_at ON public.calculations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calculations_product_sku ON public.calculations ((calculation_data->'input'->>'skuSupplier'));
CREATE INDEX IF NOT EXISTS idx_calculations_trade_direction ON public.calculations ((calculation_data->'input'->>'tradeDirection'));
CREATE INDEX IF NOT EXISTS idx_calculations_has_image ON public.calculations (((calculation_data->'input'->>'invoiceImage') IS NOT NULL));

-- 4. Enable Row Level Security (RLS) and permissive policies for public client app
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read write users" ON public.users;
CREATE POLICY "Allow anon read write users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read write calculations" ON public.calculations;
CREATE POLICY "Allow anon read write calculations" ON public.calculations FOR ALL USING (true) WITH CHECK (true);
`;

/**
 * Diagnostic auto-check for Supabase connection and tables status
 */
export async function checkSupabaseHealth(): Promise<SupabaseHealthReport> {
  const report: SupabaseHealthReport = {
    isConnected: false,
    usersTableOk: false,
    calculationsTableOk: false,
    usersCount: 0,
    calculationsCount: 0,
    checkedAt: new Date().toISOString(),
    recommendedSqlDDL: SUPABASE_REQUIRED_DDL_SQL,
  };

  try {
    // Check users table
    const { count: usersCount, error: usersErr } = await supabase
      .from(USERS_TABLE)
      .select('id', { count: 'exact', head: true });

    if (usersErr) {
      report.usersError = usersErr.message;
      if (usersErr.code === '42P01' || usersErr.message.toLowerCase().includes('does not exist')) {
        report.usersError = `Table "${USERS_TABLE}" missing in Supabase. Please run SQL setup script.`;
      }
    } else {
      report.usersTableOk = true;
      report.usersCount = usersCount ?? 0;
    }

    // Check calculations table
    const { count: calcsCount, error: calcsErr } = await supabase
      .from(CALCULATIONS_TABLE)
      .select('id', { count: 'exact', head: true });

    if (calcsErr) {
      report.calculationsError = calcsErr.message;
      if (calcsErr.code === '42P01' || calcsErr.message.toLowerCase().includes('does not exist')) {
        report.calculationsError = `Table "${CALCULATIONS_TABLE}" missing in Supabase. Please run SQL setup script.`;
      }
    } else {
      report.calculationsTableOk = true;
      report.calculationsCount = calcsCount ?? 0;
    }

    report.isConnected = report.usersTableOk || report.calculationsTableOk || !report.usersError?.includes('FetchError');
  } catch (err: any) {
    report.generalError = err?.message || 'Failed to connect to Supabase backend';
  }

  return report;
}


