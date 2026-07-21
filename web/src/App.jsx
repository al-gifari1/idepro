import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Terminal, 
  RefreshCw, 
  Server, 
  LogOut, 
  ExternalLink, 
  CheckCircle, 
  Mail, 
  Lock, 
  Users, 
  Award, 
  Radio, 
  Edit2, 
  Check, 
  X,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';

// ── Theme ─────────────────────────────────────
const T = {
  bg:         '#07080d',
  card:       '#0e1017',
  text:       '#ffffff',
  muted:      '#888888',
  border:     '1px solid rgba(0,220,255,0.18)',
  cyan:       '#00dcff',
  cyanDim:    'rgba(0,220,255,0.1)',
  green:      '#10b981',
  greenDim:   'rgba(16,185,129,0.1)',
  red:        '#ff4455',
  purple:     '#a78bfa',
  inputBg:    '#030406',
  mono:       'monospace, system-ui, sans-serif',
};

// ── Tier config ────────────────────────────────
const TIERS = {
  free:    { label: 'FREE',    color: '#888',    gmailLimit: 1  },
  pro:     { label: 'PRO',     color: T.green,   gmailLimit: 3  },
  premium: { label: 'PREMIUM', color: T.cyan,    gmailLimit: 10 },
};
const TIER_ORDER = ['free', 'pro', 'premium'];

function nextTier(current) {
  const idx = TIER_ORDER.indexOf(current || 'free');
  return TIER_ORDER[(idx + 1) % TIER_ORDER.length];
}

// ── Initials avatar ────────────────────────────
function Avatar({ email, size = 36 }) {
  const initials = email ? email[0].toUpperCase() : '?';
  let hash = 0;
  for (let i = 0; i < (email || '').length; i++) hash = (hash * 31 + email.charCodeAt(i)) & 0xffffffff;
  const hue = Math.abs(hash) % 360;
  return (
    <div style={{
      width: size, height: size,
      background: `hsl(${hue},60%,22%)`,
      border: `1px solid hsl(${hue},60%,40%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: `hsl(${hue},80%,75%)`,
      fontFamily: T.mono, flexShrink: 0,
      userSelect: 'none',
    }}>
      {initials}
    </div>
  );
}

// ── Gmail slot bar ─────────────────────────────
function GmailSlotBar({ used, total }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  const color = pct >= 100 ? T.red : pct >= 66 ? '#f59e0b' : T.green;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.muted, marginBottom: 3, fontFamily: T.mono }}>
        <span>GMAIL SLOTS</span>
        <span style={{ color }}>{used}/{total}</span>
      </div>
      <div style={{ height: 3, background: '#1a1c26', width: '100%' }}>
        <div style={{ height: '100%', width: `${Math.min(pct,100)}%`, background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// MAIN APP - SUPABASE POWERED
// ══════════════════════════════════════════════
export default function App() {
  const isAdminRoute = window.location.pathname === '/admin';
  const configured = isSupabaseConfigured();

  const [accounts,    setAccounts]    = useState([]);
  const [dbUsers,     setDbUsers]     = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [session,     setSession]     = useState(null);

  const [logs,           setLogs]           = useState(['[SYS] SUPABASE AUTH ENGINE INITIALIZING...', '[SYS] EDGE FUNCTION SYNC READY.']);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [authError,      setAuthError]      = useState('');
  const [authSuccess,    setAuthSuccess]    = useState('');
  const [loading,        setLoading]        = useState(false);

  const addLog = msg => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-80), `[${ts}] ${msg}`]);
  };

  // ── Sync active session to database & Edge Function ──
  const syncActiveSession = async (userEmail, accessToken, refreshToken, userTier = 'free', gmailLimit = 1) => {
    try {
      if (configured) {
        // Upsert into active_sessions table via Supabase client
        const { error } = await supabase
          .from('active_sessions')
          .upsert({
            email: userEmail,
            access_token: accessToken,
            refresh_token: refreshToken || '',
            tier: userTier,
            gmail_limit: gmailLimit,
            last_synced_at: new Date().toISOString()
          }, { onConflict: 'email' });

        if (error) addLog(`WARN: SESSION DB SYNC — ${error.message}`);
        else addLog(`SYNC: Session updated in Supabase for ${userEmail}`);
      }
    } catch (e) {
      addLog(`ERR: SESSION SYNC FAILED — ${e.message}`);
    }
  };

  // ── Fetch active sessions & profiles ──────────────
  const fetchAccounts = async () => {
    if (!configured) return;
    try {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .order('last_synced_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (e) {
      addLog(`ERR: SESSIONS FETCH — ${e.message}`);
    }
  };

  const fetchDbUsers = async () => {
    if (!configured) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDbUsers(data || []);
    } catch (e) {
      addLog(`ERR: USER LIST FETCH — ${e.message}`);
    }
  };

  // ── Admin Tier Cycle ──────────────────────────────
  const handleCycleTier = async (userEmail, currentTier) => {
    const newTier = nextTier(currentTier);
    const newLimit = TIERS[newTier].gmailLimit;

    try {
      if (configured) {
        // Update profile
        await supabase
          .from('profiles')
          .update({ tier: newTier, gmail_limit: newLimit, updated_at: new Date().toISOString() })
          .eq('email', userEmail);

        // Update active session if present
        await supabase
          .from('active_sessions')
          .update({ tier: newTier, gmail_limit: newLimit, last_synced_at: new Date().toISOString() })
          .eq('email', userEmail);
      }

      addLog(`ADMIN: ${userEmail} → ${newTier.toUpperCase()} (Gmail Limit: ${newLimit})`);
      fetchDbUsers();
      fetchAccounts();
    } catch (e) {
      addLog(`ERR: TIER UPDATE — ${e.message}`);
    }
  };

  // ── Initialize Supabase Auth state listener ───────
  useEffect(() => {
    if (!configured) return;

    // Fetch initial auth session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        // Fetch user profile from Supabase
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        const userData = {
          email: session.user.email,
          tier: profile?.tier || 'free',
          gmailLimit: profile?.gmail_limit || 1,
          token: {
            accessToken: session.access_token,
            refreshToken: session.refresh_token
          }
        };
        setCurrentUser(userData);
        syncActiveSession(session.user.email, session.access_token, session.refresh_token, userData.tier, userData.gmailLimit);
      }
    });

    // Listen to Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (event === 'SIGNED_IN' && session?.user) {
        addLog(`SUPABASE AUTH: User signed in (${session.user.email})`);
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        const userData = {
          email: session.user.email,
          tier: profile?.tier || 'free',
          gmailLimit: profile?.gmail_limit || 1,
          token: {
            accessToken: session.access_token,
            refreshToken: session.refresh_token
          }
        };
        setCurrentUser(userData);
        syncActiveSession(session.user.email, session.access_token, session.refresh_token, userData.tier, userData.gmailLimit);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        addLog('SUPABASE AUTH: User signed out.');
      }
    });

    fetchAccounts();
    if (isAdminRoute) fetchDbUsers();

    return () => subscription.unsubscribe();
  }, [configured, isAdminRoute]);

  // ── Auth Handlers ─────────────────────────────────
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError(''); setAuthSuccess(''); setLoading(true);

    if (!email || !password) {
      setAuthError('Email and password required.');
      setLoading(false);
      return;
    }

    try {
      if (!configured) {
        // Mock fallback mode when Supabase credentials aren't set up yet
        const mockToken = `supabase-mock-${Math.random().toString(36).substring(2, 12)}`;
        const mockUser = {
          email,
          tier: 'free',
          gmailLimit: 1,
          token: { accessToken: mockToken, refreshToken: 'refresh-mock' }
        };
        setCurrentUser(mockUser);
        setAuthSuccess('Local Session Created (Supabase credentials pending setup).');
        addLog(`MOCK LOGIN: ${email}`);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthSuccess('Supabase Authentication Successful.');
      }

      // Check for deep-link redirect
      const params = new URLSearchParams(window.location.search);
      if (params.get('source') === 'app' || params.get('redirect_to')) {
        setTimeout(() => {
          const userObj = currentUser || { email, tier: 'free', gmailLimit: 1, token: { accessToken: 'token' } };
          window.location.href = `idepro://auth/callback?token=${userObj.token?.accessToken || 'token'}&email=${email}&tier=${userObj.tier}&gmailLimit=${userObj.gmailLimit}`;
        }, 1000);
      }
    } catch (e) {
      setAuthError(e.message);
      addLog(`LOGIN FAILED: ${email} — ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setAuthError(''); setAuthSuccess(''); setLoading(true);

    if (!email || !password) {
      setAuthError('Email and password required.');
      setLoading(false);
      return;
    }

    try {
      if (!configured) {
        setAuthSuccess('Account registered (Mock Mode). You can now log in.');
        setIsRegisterMode(false);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAuthSuccess('Registration successful! Check your email to confirm your account.');
        setIsRegisterMode(false);
        addLog(`SIGNUP SUCCESS: ${email}`);
      }
    } catch (e) {
      setAuthError(e.message);
      addLog(`SIGNUP FAILED: ${email} — ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (configured) await supabase.auth.signOut();
    setCurrentUser(null);
    addLog('SESSION TERMINATED.');
  };

  const reSyncToIDE = (user) => {
    if (!user) return;
    const token = user.token?.accessToken || 'token';
    const deepLink = `idepro://auth/callback?token=${token}&email=${user.email}&tier=${user.tier}&gmailLimit=${user.gmailLimit || 1}`;
    addLog(`AUTO-SYNC: Launching IDE Deep Link for ${user.email}`);
    window.location.href = deepLink;
  };

  // ══════════════════════════════════════════
  // ADMIN VIEW
  // ══════════════════════════════════════════
  if (isAdminRoute) {
    return (
      <div style={{ padding: '20px', maxWidth: 1400, margin: '0 auto' }}>
        <header className="glass-panel neon-border-cyan" style={{ padding: '15px 30px', marginBottom: 25, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <Shield size={36} color={T.cyan} />
            <div>
              <h1 style={{ fontFamily: 'Orbitron', fontWeight: 900, fontSize: 22, margin: 0, color: T.cyan, letterSpacing: 2 }}>
                IDEpro // SUPABASE CONTROL PANEL
              </h1>
              <p style={{ margin: 0, fontSize: 10, color: T.muted }}>CLOUD AUTH & REALTIME SESSION MANAGEMENT</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 15, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Radio size={13} color={T.green} />
              <span style={{ color: T.green }}>SUPABASE CONNECTED</span>
            </div>
            <button
              onClick={() => { fetchAccounts(); fetchDbUsers(); }}
              style={{ background: T.cyanDim, color: T.cyan, border: `1px solid ${T.cyan}`, padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: T.mono }}
            >
              <RefreshCw size={12} /> REFRESH DATA
            </button>
          </div>
        </header>

        {/* STATS BAR */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 15, marginBottom: 25 }}>
          {[
            { label: 'REGISTERED PROFILES', val: dbUsers.length, color: T.cyan  },
            { label: 'ACTIVE SESSIONS', val: accounts.length, color: T.green },
            { label: 'FREE TIER', val: dbUsers.filter(u => u.tier === 'free').length, color: T.muted },
            { label: 'PRO TIER', val: dbUsers.filter(u => u.tier === 'pro').length, color: T.green },
            { label: 'PREMIUM TIER', val: dbUsers.filter(u => u.tier === 'premium').length, color: T.cyan },
          ].map(s => (
            <div key={s.label} className="glass-panel" style={{ padding: '14px 18px', textAlign: 'center', border: `1px solid ${s.color}22` }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: s.color, fontFamily: T.mono }}>{s.val}</div>
              <div style={{ fontSize: 9, color: T.muted, marginTop: 3, letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* MAIN GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 25 }}>
          {/* USER PROFILES */}
          <section className="glass-panel neon-border-cyan" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${T.cyan}22`, paddingBottom: 10 }}>
              <Users size={17} color={T.cyan} />
              <h2 style={{ fontFamily: 'Orbitron', fontSize: 15, margin: 0, color: T.cyan }}>SUPABASE PROFILES</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
              {dbUsers.length === 0 ? (
                <p style={{ color: T.muted, fontSize: 12, textAlign: 'center', padding: 20 }}>NO PROFILES FOUND IN DATABASE</p>
              ) : dbUsers.map((user, idx) => {
                const tier = TIERS[user.tier] ?? TIERS.free;
                const session = accounts.find(a => a.email === user.email);
                return (
                  <div key={idx} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #1e1e2a', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <Avatar email={user.email} size={32} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: T.mono, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                          <div style={{ fontSize: 9, color: tier.color, marginTop: 2, fontFamily: T.mono, fontWeight: 700 }}>
                            {tier.label} {session && <span style={{ color: T.green, marginLeft: 6 }}>◉ ONLINE</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCycleTier(user.email, user.tier)}
                        style={{ fontSize: 9, background: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}55`, padding: '3px 8px', fontFamily: T.mono, cursor: 'pointer' }}
                      >
                        → {TIERS[nextTier(user.tier)].label}
                      </button>
                    </div>
                    <GmailSlotBar used={session?.active_gmail_count || 0} total={user.gmail_limit || 1} />
                  </div>
                );
              })}
            </div>
          </section>

          {/* ACTIVE SESSIONS */}
          <section className="glass-panel neon-border" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${T.green}22`, paddingBottom: 10 }}>
              <Server size={17} color={T.green} />
              <h2 style={{ fontFamily: 'Orbitron', fontSize: 15, margin: 0, color: T.green }}>ACTIVE DEEP-LINK SESSIONS</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
              {accounts.length === 0 ? (
                <p style={{ color: T.muted, fontSize: 12, textAlign: 'center', padding: 20 }}>NO LIVE SESSIONS</p>
              ) : accounts.map((acc, idx) => {
                const tier = TIERS[acc.tier] ?? TIERS.free;
                return (
                  <div key={idx} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #1e1e2a', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar email={acc.email} size={30} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>{acc.email}</div>
                          <div style={{ fontSize: 9, color: tier.color, fontFamily: T.mono, fontWeight: 700 }}>{tier.label}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 9, background: `${T.green}18`, color: T.green, border: `1px solid ${T.green}55`, padding: '2px 7px', fontFamily: T.mono }}>SYNCED</span>
                    </div>
                    <GmailSlotBar used={acc.active_gmail_count || 0} total={acc.gmail_limit || 1} />
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* LOGS */}
        <section className="glass-panel neon-border" style={{ marginTop: 25, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${T.green}22`, paddingBottom: 10, marginBottom: 14 }}>
            <Terminal size={17} color={T.green} />
            <h2 style={{ fontFamily: 'Orbitron', fontSize: 15, margin: 0, color: T.green }}>SYSTEM LOGS</h2>
          </div>
          <div style={{ background: '#000', border: '1px solid #1a1a1a', padding: 14, maxHeight: 160, overflowY: 'auto', fontFamily: T.mono, fontSize: 11, color: T.green }}>
            {logs.map((log, i) => <div key={i} style={{ marginBottom: 3 }}>{log}</div>)}
          </div>
        </section>
      </div>
    );
  }

  // ══════════════════════════════════════════
  // USER / LOGIN VIEW
  // ══════════════════════════════════════════
  return (
    <div style={{
      backgroundColor: T.bg, minHeight: '100vh', fontFamily: T.mono,
      color: T.text, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center', padding: 20, boxSizing: 'border-box',
    }}>

      {/* CONFIG WARNING BANNER IF SUPABASE KEYS ARE MISSING */}
      {!configured && (
        <div style={{
          width: '100%', maxWidth: 400, background: '#1c160c', border: '1px solid #f59e0b',
          padding: '10px 14px', marginBottom: 15, fontSize: 10, color: '#f59e0b',
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <AlertTriangle size={18} flexShrink={0} />
          <div>
            <strong>SUPABASE ENV PENDING:</strong> Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>web/.env</code> file for real Supabase connection. Running in local fallback mode.
          </div>
        </div>
      )}

      <div className="glass-panel" style={{
        width: '100%', maxWidth: 400, backgroundColor: '#0c0d14',
        border: `1px solid ${T.cyan}`, boxShadow: `0 0 24px ${T.cyanDim}`,
        padding: '36px 30px', boxSizing: 'border-box',
      }}>

        {/* BRAND HEADER */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, backgroundColor: T.cyanDim,
            border: `1px solid ${T.cyan}33`, marginBottom: 14,
          }}>
            <Shield size={20} color={T.cyan} />
          </div>
          <h1 className="neon-glow-text-cyan" style={{ fontSize: 19, fontWeight: 600, letterSpacing: 1, margin: '0 0 6px', color: T.cyan }}>
            IDEpro // SUPABASE AUTH
          </h1>
          <p style={{ fontSize: 11, color: T.muted, margin: 0, lineHeight: 1.5 }}>
            {isRegisterMode ? 'CREATE NEW SUPABASE DEVELOPER ACCOUNT' : 'AUTHENTICATE CENTRAL ACCESS PORTAL'}
          </p>
        </div>

        {/* FEEDBACK */}
        {authError && (
          <div style={{ fontSize: 11, color: T.red, background: `${T.red}0d`, border: `1px solid ${T.red}`, padding: '9px 12px', marginBottom: 16, fontFamily: T.mono }}>
            [ERROR] {authError.toUpperCase()}
          </div>
        )}
        {authSuccess && (
          <div style={{ fontSize: 11, color: T.green, background: T.greenDim, border: `1px solid ${T.green}`, padding: '9px 12px', marginBottom: 16, fontFamily: T.mono }}>
            [OK] {authSuccess.toUpperCase()}
          </div>
        )}

        {/* AUTH STATE */}
        {!currentUser ? (
          <form onSubmit={isRegisterMode ? handleRegisterSubmit : handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* EMAIL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.cyan, letterSpacing: 1 }}>SUPABASE EMAIL</label>
              <div style={{ position: 'relative' }}>
                <Mail style={{ position: 'absolute', left: 12, top: 12, width: 14, height: 14, color: T.cyan }} />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="developer@idepro.pro"
                  style={{ width: '100%', padding: '11px 12px 11px 36px', border: '1px solid #3c3c3c', background: T.inputBg, fontSize: 13, outline: 'none', color: '#fff', fontFamily: T.mono, boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = T.cyan}
                  onBlur={e  => e.target.style.borderColor = '#3c3c3c'}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.cyan, letterSpacing: 1 }}>SECURITY PASSPHRASE</label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: 12, top: 12, width: 14, height: 14, color: T.cyan }} />
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '11px 12px 11px 36px', border: '1px solid #3c3c3c', background: T.inputBg, fontSize: 13, outline: 'none', color: '#fff', fontFamily: T.mono, boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = T.cyan}
                  onBlur={e  => e.target.style.borderColor = '#3c3c3c'}
                />
              </div>
            </div>

            <button
              type="submit" disabled={loading} className="cyber-button"
              style={{ width: '100%', padding: 11, border: `1px solid ${T.cyan}`, background: T.cyanDim, color: T.cyan, fontSize: 13, fontWeight: 700, letterSpacing: 1, cursor: 'pointer', fontFamily: T.mono, marginTop: 6 }}
              onMouseEnter={e => { e.currentTarget.style.background = T.cyan; e.currentTarget.style.color = '#000'; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.cyanDim; e.currentTarget.style.color = T.cyan; }}
            >
              {loading ? 'PROCESSING...' : isRegisterMode ? 'REGISTER_SUPABASE_USER' : 'CONNECT_SUPABASE_SESSION'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11 }}>
              <span style={{ color: T.muted }}>{isRegisterMode ? 'ALREADY INSTANTIATED? ' : 'NEW DEVELOPER ACCOUNT? '}</span>
              <button
                type="button"
                onClick={() => { setIsRegisterMode(!isRegisterMode); setAuthError(''); setAuthSuccess(''); }}
                style={{ background: 'none', border: 'none', color: T.cyan, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: T.mono, textDecoration: 'underline' }}
              >
                {isRegisterMode ? 'LOGIN' : 'REGISTER_WORKSPACE'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            {/* SYNCED BADGE */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.greenDim, border: `1px solid ${T.green}`, padding: '10px 14px', marginBottom: 18 }}>
              <CheckCircle size={14} color={T.green} />
              <div style={{ fontSize: 11, color: T.green, fontWeight: 700, fontFamily: T.mono }}>
                SUPABASE AUTHENTICATED
              </div>
            </div>

            {/* PROFILE CARD */}
            <div style={{ border: `1px solid ${T.cyan}22`, background: '#050609', padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar email={currentUser.email} size={38} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, fontFamily: T.mono, color: '#fff' }}>{currentUser.email}</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, marginTop: 2, fontWeight: 700, fontFamily: T.mono }}>
                      <Award size={9} color={TIERS[currentUser.tier]?.color ?? T.muted} />
                      <span style={{ color: TIERS[currentUser.tier]?.color ?? T.muted }}>
                        {TIERS[currentUser.tier]?.label ?? 'FREE'}_MEMBER
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, padding: 3 }}
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </div>

              <GmailSlotBar
                used={accounts.find(a => a.email === currentUser.email)?.active_gmail_count ?? 0}
                total={currentUser.gmailLimit ?? TIERS[currentUser.tier]?.gmailLimit ?? 1}
              />
            </div>

            {/* LAUNCH IDE */}
            <button
              onClick={() => reSyncToIDE(currentUser)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, padding: '11px 14px', border: `1px solid ${T.cyan}`,
                background: T.cyanDim, color: T.cyan, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: T.mono, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.cyan; e.currentTarget.style.color = '#000'; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.cyanDim; e.currentTarget.style.color = T.cyan; }}
            >
              SEND_TO_IDE <ExternalLink size={12} />
            </button>
          </div>
        )}

        {/* ADMIN LINK */}
        <div style={{ marginTop: 22, borderTop: '1px solid #1e1e2a', paddingTop: 14, textAlign: 'center', fontSize: 11, fontFamily: T.mono }}>
          <span style={{ color: T.muted }}>SYS_ADMIN CONFIG? </span>
          <a href="/admin" style={{ color: T.cyan, textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            PANEL_CONTROL <ArrowRight size={10} />
          </a>
        </div>
      </div>
    </div>
  );
}
