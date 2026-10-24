/**
 * Supabase Client Initialization and Realtime Connector
 * Connects to Supabase Cloud when credentials are configured in .env / Vercel.
 * Provides a seamless local storage backed adapter during initial sandbox testing.
 */

import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  rawUrl &&
    rawKey &&
    !rawUrl.includes('replace_me') &&
    !rawKey.includes('replace_me') &&
    rawUrl.startsWith('http'),
);

export const SUPABASE_URL = isSupabaseConfigured ? rawUrl : 'https://example.supabase.co';
export const SUPABASE_ANON_KEY = isSupabaseConfigured ? rawKey : 'example-anon-key';

// Real Supabase client instance
export const realSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Sandbox storage keys for unconfigured preview environments
const SBX_AUTH_KEY = 'campusfind.sbx.auth.user';
const SBX_ITEMS_KEY = 'campusfind.sbx.items';
const SBX_CLAIMS_KEY = 'campusfind.sbx.claims';
const SBX_REPORTS_KEY = 'campusfind.sbx.reports';

interface MockAuthUser {
  id: string;
  email: string;
  created_at?: string;
  user_metadata: {
    display_name?: string;
    role?: string;
  };
}

class SandboxAdapter {
  private authListeners: ((event: string, session: any) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', () => {
        this.notifyAuth();
      });
    }
  }

  getCurrentUser(): MockAuthUser | null {
    try {
      const raw = localStorage.getItem(SBX_AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  notifyAuth() {
    const user = this.getCurrentUser();
    const session = user ? { user, access_token: 'sbx-token' } : null;
    this.authListeners.forEach((fn) => fn(user ? 'SIGNED_IN' : 'SIGNED_OUT', session));
  }

  auth = {
    getUser: async () => {
      const user = this.getCurrentUser();
      return { data: { user }, error: null };
    },
    getSession: async () => {
      const user = this.getCurrentUser();
      return { data: { session: user ? { user, access_token: 'sbx-token' } : null }, error: null };
    },
    signUp: async ({ email, options }: { email: string; password?: string; options?: { data?: { display_name?: string; role?: string } } }) => {
      const user: MockAuthUser = {
        id: 'usr-' + Math.random().toString(36).slice(2, 10),
        email,
        created_at: new Date().toISOString(),
        user_metadata: {
          display_name: options?.data?.display_name || email.split('@')[0],
          role: options?.data?.role || 'student',
        },
      };
      localStorage.setItem(SBX_AUTH_KEY, JSON.stringify(user));
      this.notifyAuth();
      return { data: { user, session: { user, access_token: 'sbx-token' } }, error: null };
    },
    signInWithPassword: async ({ email }: { email: string; password?: string }) => {
      const user: MockAuthUser = {
        id: 'usr-' + Math.random().toString(36).slice(2, 10),
        email,
        created_at: new Date().toISOString(),
        user_metadata: {
          display_name: email.split('@')[0],
          role: 'student',
        },
      };
      localStorage.setItem(SBX_AUTH_KEY, JSON.stringify(user));
      this.notifyAuth();
      return { data: { user, session: { user, access_token: 'sbx-token' } }, error: null };
    },
    signOut: async () => {
      localStorage.removeItem(SBX_AUTH_KEY);
      this.notifyAuth();
      return { error: null };
    },
    resetPasswordForEmail: async (_email: string) => {
      return { error: null };
    },
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      this.authListeners.push(callback);
      const user = this.getCurrentUser();
      callback(user ? 'INITIAL_SESSION' : 'SIGNED_OUT', user ? { user, access_token: 'sbx-token' } : null);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              this.authListeners = this.authListeners.filter((fn) => fn !== callback);
            },
          },
        },
      };
    },
  };

  storage = {
    from: (_bucket: string) => ({
      upload: async (filePath: string, file: File | Blob) => {
        return new Promise<{ data: { path: string } | null; error: Error | null }>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result as string;
            try {
              sessionStorage.setItem(`sbx_img_${filePath}`, base64);
            } catch {
              /* ignore storage overflow */
            }
            resolve({ data: { path: filePath }, error: null });
          };
          reader.onerror = () => resolve({ data: null, error: new Error('Failed to read file') });
          reader.readAsDataURL(file);
        });
      },
      getPublicUrl: (filePath: string) => {
        const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`sbx_img_${filePath}`) : null;
        return {
          data: {
            publicUrl: stored || `https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80`,
          },
        };
      },
    }),
  };

  from(table: string) {
    const getStorageKey = () => {
      if (table === 'items') return SBX_ITEMS_KEY;
      if (table === 'claims') return SBX_CLAIMS_KEY;
      if (table === 'reports') return SBX_REPORTS_KEY;
      return `campusfind.sbx.${table}`;
    };

    const read = (): any[] => {
      try {
        const raw = localStorage.getItem(getStorageKey());
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    };

    const write = (data: any[]) => {
      try {
        localStorage.setItem(getStorageKey(), JSON.stringify(data));
      } catch {
        /* storage full */
      }
    };

    const createQuery = (currentRows: any[]) => {
      let filtered = [...currentRows];
      const queryObj: any = {
        order: (_col: string, _opts?: { ascending?: boolean }) => {
          return queryObj;
        },
        eq: (col: string, val: any) => {
          filtered = filtered.filter((r) => r[col] === val);
          return queryObj;
        },
        then: (resolve: (res: { data: any[]; error: null }) => void) => {
          resolve({ data: filtered, error: null });
        },
      };
      return queryObj;
    };

    return {
      select: (_cols = '*') => {
        return createQuery(read());
      },
      insert: (newRows: any | any[]) => {
        const itemsToInsert = Array.isArray(newRows) ? newRows : [newRows];
        const existing = read();
        const inserted = itemsToInsert.map((item) => ({
          ...item,
          id: item.id || 'id-' + Math.random().toString(36).slice(2, 10),
          created_at: item.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        write([...inserted, ...existing]);

        const resObj: any = {
          data: inserted,
          error: null,
          select: () => Promise.resolve({ data: inserted, error: null }),
          then: (resolve: (res: { data: any[]; error: null }) => void) => {
            resolve({ data: inserted, error: null });
          },
        };
        return resObj;
      },
      update: (updates: any) => ({
        eq: async (col: string, val: any) => {
          const rows = read();
          const updated = rows.map((r) => (r[col] === val ? { ...r, ...updates, updated_at: new Date().toISOString() } : r));
          write(updated);
          return { data: updated.filter((r) => r[col] === val), error: null };
        },
      }),
      delete: () => ({
        eq: async (col: string, val: any) => {
          const rows = read();
          const remaining = rows.filter((r) => r[col] !== val);
          write(remaining);
          return { data: null, error: null };
        },
      }),
    };
  }

  channel(_name: string) {
    return {
      on: (_event: any, _filter: any, _callback: (payload: any) => void) => {
        return {
          subscribe: () => ({
            unsubscribe: () => {},
          }),
        };
      },
    };
  }

  removeChannel(_channel: any) {}
}

// Export the active client: uses real Supabase if credentials exist, otherwise SandboxAdapter
export const supabase: any = isSupabaseConfigured ? realSupabase : new SandboxAdapter();
