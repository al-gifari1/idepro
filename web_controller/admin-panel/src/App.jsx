import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Terminal, 
  RefreshCw, 
  Server, 
  Users, 
  Radio, 
  Activity, 
  Zap, 
  Globe, 
  Lock, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertOctagon, 
  Edit3, 
  Check, 
  X, 
  TrendingUp, 
  Database,
  Sliders,
  Send,
  Cpu,
  Bot,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  ToggleLeft,
  ToggleRight,
  KeyRound
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';

// ── Cyberpunk Design Tokens ─────────────────────
const T = {
  bg: '#05070d',
  card: 'rgba(12, 16, 28, 0.75)',
  cardBorder: '1px solid rgba(0, 220, 255, 0.2)',
  glowCyan: '0 0 20px rgba(0, 220, 255, 0.25)',
  glowGreen: '0 0 20px rgba(16, 185, 129, 0.25)',
  cyan: '#00dcff',
  cyanDim: 'rgba(0, 220, 255, 0.08)',
  green: '#10b981',
  greenDim: 'rgba(16, 185, 129, 0.08)',
  red: '#ff4455',
  redDim: 'rgba(255, 68, 85, 0.1)',
  purple: '#a78bfa',
  purpleDim: 'rgba(167, 139, 250, 0.1)',
  muted: '#717a96',
  inputBg: '#080a12',
  mono: 'monospace, system-ui, sans-serif'
};

const TIERS = {
  free: { label: 'FREE', color: '#888888', limit: 1 },
  pro: { label: 'PRO', color: T.green, limit: 3 },
  premium: { label: 'PREMIUM', color: T.cyan, limit: 10 }
};

const WORKER_URL = 'https://idepro-edge-gateway.ai-gifari-n8n.workers.dev';

export default function AdminCommandCenter() {
  const [profiles, setProfiles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [gmailPool, setGmailPool] = useState([]);
  const [logs, setLogs] = useState([
    '[SYSTEM] COMMAND CENTER v3 INITIALIZED.',
    '[EDGE] CLOUDFLARE GATEWAY ONLINE.',
    '[SUPABASE] POSTGRES RLS ACTIVE.',
    '[POOL] GMAIL OAUTH SESSION POOL READY.'
  ]);

  const [workerHealth, setWorkerHealth] = useState({ status: 'checking', latency: 0, active_gmails: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('users'); // users | sessions | gmail-pool | edge | logs
  const [editingUser, setEditingUser] = useState(null);
  const [customLimit, setCustomLimit] = useState('1');

  // Gmail OAuth Pool state
  const [addGmailLabel, setAddGmailLabel] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);

  const ADMIN_KEY = import.meta.env.VITE_ADMIN_SECRET_KEY || 'idepro-admin-secret';

  const addLog = (msg) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${ts}] ${msg}`, ...prev.slice(0, 99)]);
  };

  // ── Ping Cloudflare Edge Worker for Live Latency ─
  const checkWorkerHealth = async () => {
    const start = Date.now();
    try {
      const res = await fetch(`${WORKER_URL}/health`);
      const latency = Date.now() - start;
      if (res.ok) {
        const data = await res.json();
        setWorkerHealth({ status: 'online', latency, active_gmails: data.active_gmails || 0 });
      } else {
        setWorkerHealth({ status: 'degraded', latency, active_gmails: 0 });
      }
    } catch {
      setWorkerHealth({ status: 'offline', latency: 0, active_gmails: 0 });
    }
  };

  // ── Fetch Supabase Data ───────────────────────
  const loadData = async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch profiles
      const { data: profs, error: profErr } = await supabase
        .from('profiles').select('*').order('created_at', { ascending: false });
      if (profErr) throw profErr;
      setProfiles(profs || []);

      // 2. Fetch active desktop sessions
      const { data: sess, error: sessErr } = await supabase
        .from('active_sessions').select('*').order('last_synced_at', { ascending: false });
      if (sessErr) throw sessErr;
      setSessions(sess || []);

      // 3. Fetch Gmail Pool from Edge Worker
      try {
        const gmailRes = await fetch(`${WORKER_URL}/api/admin/gmail-pool`, {
          headers: { 'x-admin-key': ADMIN_KEY }
        });
        if (gmailRes.ok) {
          const gmailData = await gmailRes.json();
          setGmailPool(gmailData);
          addLog(`GMAIL POOL: Loaded ${gmailData.length} accounts (${gmailData.filter(g => g.status === 'active').length} active).`);
        }
      } catch { /* Worker not deployed yet */ }

      addLog(`DATA SYNC: ${profs?.length || 0} developers | ${sess?.length || 0} live sessions.`);
    } catch (e) {
      addLog(`ERR DATA SYNC: ${e.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── Open Google OAuth popup to add Gmail account ─
  const handleGoogleOAuthLogin = async () => {
    setOauthLoading(true);
    try {
      // Get OAuth URL from Edge Worker
      const res = await fetch(
        `${WORKER_URL}/api/admin/oauth-url?display_name=${encodeURIComponent(addGmailLabel)}`,
        { headers: { 'x-admin-key': ADMIN_KEY } }
      );
      const data = await res.json();

      if (!res.ok || !data.configured) {
        addLog(`ERR OAUTH: ${data.error || 'GOOGLE_CLIENT_ID not configured on Edge Worker'}`);
        alert(`⚠️ GOOGLE_CLIENT_ID not set!\n\nRun this command to set it:\nnpx wrangler secret put GOOGLE_CLIENT_ID\nnpx wrangler secret put GOOGLE_CLIENT_SECRET`);
        return;
      }

      // Open Google OAuth in popup window
      const popup = window.open(
        data.url,
        'Google OAuth - IDEpro',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for success message from popup
      const handleMessage = (event) => {
        if (event.data?.type === 'GMAIL_ADDED') {
          addLog(`GMAIL POOL: ✅ ${event.data.gmail} added via Google OAuth`);
          setAddGmailLabel('');
          loadData();
          window.removeEventListener('message', handleMessage);
        }
      };
      window.addEventListener('message', handleMessage);

      // Fallback: poll if popup was closed
      const pollClose = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollClose);
          window.removeEventListener('message', handleMessage);
          loadData(); // Refresh anyway in case it succeeded
          setOauthLoading(false);
        }
      }, 500);

    } catch (e) {
      addLog(`ERR OAUTH: ${e.message}`);
    } finally {
      setOauthLoading(false);
    }
  };

  // ── Toggle Gmail Pool Account Status ─────────────
  const handleToggleGmail = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      await fetch(`${WORKER_URL}/api/admin/gmail-pool/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
        body: JSON.stringify({ status: newStatus })
      });
      addLog(`GMAIL POOL: ${id.slice(0,8)}... → ${newStatus.toUpperCase()}`);
      loadData();
    } catch (e) { addLog(`ERR TOGGLE: ${e.message}`); }
  };

  // ── Remove Gmail from Pool ────────────────────────
  const handleRemoveGmail = async (id, gmail) => {
    if (!confirm(`Remove ${gmail} from Gmail Pool?\nAll user assignments will be re-distributed.`)) return;
    try {
      await fetch(`${WORKER_URL}/api/admin/gmail-pool/${id}`, {
        method: 'DELETE', headers: { 'x-admin-key': ADMIN_KEY }
      });
      addLog(`GMAIL POOL: Removed ${gmail}`);
      loadData();
    } catch (e) { addLog(`ERR REMOVE: ${e.message}`); }
  };

  // ── Re-assign all users' gmails ───────────────────
  const handleReassignAll = async () => {
    try {
      const res = await fetch(`${WORKER_URL}/api/admin/reassign-all`, {
        method: 'POST', headers: { 'x-admin-key': ADMIN_KEY }
      });
      const data = await res.json();
      addLog(`GMAIL POOL: Re-assigned gmails for ${data.reassigned} users.`);
    } catch (e) { addLog(`ERR REASSIGN: ${e.message}`); }
  };

  useEffect(() => {
    loadData();
    checkWorkerHealth();
    const interval = setInterval(checkWorkerHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // Listen for OAuth popup message
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'GMAIL_ADDED') {
        addLog(`GMAIL POOL: ✅ ${e.data.gmail} successfully added!`);
        loadData();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ── Cycle Tier via Supabase / Edge API ─────────
  const handleCycleTier = async (email, currentTier) => {
    const nextTiers = { free: 'pro', pro: 'premium', premium: 'free' };
    const newTier = nextTiers[currentTier || 'free'];
    const newLimit = TIERS[newTier].limit;

    try {
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ tier: newTier, gmail_limit: newLimit, updated_at: new Date().toISOString() })
        .eq('email', email);

      if (pErr) throw pErr;

      await supabase
        .from('active_sessions')
        .update({ tier: newTier, gmail_limit: newLimit, last_synced_at: new Date().toISOString() })
        .eq('email', email);

      addLog(`ADMIN: Updated ${email} -> ${newTier.toUpperCase()}`);
      loadData();
    } catch (e) {
      addLog(`ERR TIER UPDATE: ${e.message}`);
    }
  };

  // ── Revoke Session / Kill Switch ──────────────
  const handleRevokeSession = async (email) => {
    try {
      const { error } = await supabase
        .from('active_sessions')
        .delete()
        .eq('email', email);

      if (error) throw error;
      addLog(`KILL SWITCH: Revoked active session for ${email}`);
      loadData();
    } catch (e) {
      addLog(`ERR REVOKE: ${e.message}`);
    }
  };

  // ── Filtered Profiles ──────────────────────────
  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch = p.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === 'all' || p.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  return (
    <div style={{ backgroundColor: T.bg, minHeight: '100vh', color: '#fff', fontFamily: T.mono, padding: '24px' }}>
      
      {/* ── TOP HEADER ───────────────────────────── */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 24px', background: T.card, border: T.cardBorder,
        boxShadow: T.glowCyan, marginBottom: '24px', flexWrap: 'wrap', gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: T.cyanDim, border: `1px solid ${T.cyan}`, padding: '10px', display: 'flex' }}>
            <Shield size={26} color={T.cyan} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 900, margin: 0, color: T.cyan, letterSpacing: '2px' }}>
              IDEpro // COMMAND_CENTER v2.5
            </h1>
            <p style={{ margin: 0, fontSize: '11px', color: T.muted }}>
              GLOBAL EDGE & SUPABASE CLOUD MANAGEMENT NODE
            </p>
          </div>
        </div>

        {/* STATUS INDICATORS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '11px' }}>
          {/* Edge Worker Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.5)', padding: '6px 12px', border: `1px solid ${T.cyan}44` }}>
            <Globe size={14} color={T.cyan} />
            <span>EDGE WORKER:</span>
            <span style={{ color: workerHealth.status === 'online' ? T.green : T.red, fontWeight: 700 }}>
              {workerHealth.status.toUpperCase()} ({workerHealth.latency}ms)
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadData} disabled={isRefreshing}
            style={{
              background: T.cyanDim, border: `1px solid ${T.cyan}`, color: T.cyan,
              padding: '7px 16px', cursor: 'pointer', fontFamily: T.mono, fontSize: '11px',
              display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700
            }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'SYNCING...' : 'FORCE REFRESH'}
          </button>
        </div>
      </header>

      {/* ── METRICS DASHBOARD ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'REGISTERED DEVELOPERS', val: profiles.length, icon: Users, color: T.cyan },
          { label: 'ACTIVE IDE SESSIONS', val: sessions.length, icon: Radio, color: T.green },
          { label: 'FREE TIER USERS', val: profiles.filter(p => p.tier === 'free').length, icon: Shield, color: T.muted },
          { label: 'PRO / PREMIUM TIER', val: profiles.filter(p => p.tier !== 'free').length, icon: Zap, color: T.purple },
        ].map((stat) => (
          <div key={stat.label} style={{ background: T.card, border: `1px solid ${stat.color}33`, padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: stat.color }}>{stat.val}</div>
              <div style={{ fontSize: '10px', color: T.muted, marginTop: '4px', letterSpacing: '1px' }}>{stat.label}</div>
            </div>
            <stat.icon size={28} color={stat.color} style={{ opacity: 0.6 }} />
          </div>
        ))}
      </div>

      {/* ── TAB NAVIGATION ──────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'users', label: 'DEVELOPER DB', icon: Users },
          { id: 'sessions', label: 'LIVE SESSIONS', icon: Server },
          { id: 'gmail-pool', label: 'GMAIL POOL', icon: Bot, badge: gmailPool.filter(g => g.status === 'active').length },
          { id: 'edge', label: 'EDGE GATEWAY', icon: Cpu },
          { id: 'logs', label: 'AUDIT LOGS', icon: Terminal },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? T.cyanDim : 'transparent',
              border: `1px solid ${activeTab === tab.id ? T.cyan : 'rgba(255,255,255,0.1)'}`,
              color: activeTab === tab.id ? T.cyan : T.muted,
              padding: '10px 16px', cursor: 'pointer', fontFamily: T.mono, fontSize: '11px',
              display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 700, transition: 'all 0.2s'
            }}
          >
            <tab.icon size={14} /> {tab.label}
            {tab.badge !== undefined && (
              <span style={{ background: T.green, color: '#000', borderRadius: '10px', fontSize: '10px', padding: '1px 6px', fontWeight: 900, marginLeft: '2px' }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ─────────────────────────── */}
      {activeTab === 'users' && (
        <div style={{ background: T.card, border: T.cardBorder, padding: '20px' }}>
          {/* SEARCH & FILTER BAR */}
          <div style={{ display: 'flex', gap: '14px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, position: 'relative', minWidth: '260px' }}>
              <Search size={14} color={T.cyan} style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter profiles by email..."
                style={{ width: '100%', padding: '10px 12px 10px 36px', background: T.inputBg, border: '1px solid #222', color: '#fff', fontSize: '12px', outline: 'none', fontFamily: T.mono, boxSizing: 'border-box' }}
              />
            </div>
            <select
              value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}
              style={{ background: T.inputBg, border: '1px solid #222', color: T.cyan, padding: '10px 16px', fontSize: '12px', outline: 'none', fontFamily: T.mono }}
            >
              <option value="all">ALL TIERS</option>
              <option value="free">FREE ONLY</option>
              <option value="pro">PRO ONLY</option>
              <option value="premium">PREMIUM ONLY</option>
            </select>
          </div>

          {/* PROFILES TABLE */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.cyan}33`, color: T.cyan }}>
                  <th style={{ padding: '12px' }}>DEVELOPER EMAIL</th>
                  <th style={{ padding: '12px' }}>SUBSCRIPTION TIER</th>
                  <th style={{ padding: '12px' }}>GMAIL LIMIT</th>
                  <th style={{ padding: '12px' }}>ONLINE STATUS</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: T.muted }}>NO DEVELOPERS MATCH QUERY</td>
                  </tr>
                ) : (
                  filteredProfiles.map((p) => {
                    const tier = TIERS[p.tier] || TIERS.free;
                    const session = sessions.find((s) => s.email === p.email);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #141724' }}>
                        <td style={{ padding: '12px', fontWeight: 700 }}>{p.email}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ background: `${tier.color}15`, color: tier.color, border: `1px solid ${tier.color}44`, padding: '3px 8px', fontSize: '10px', fontWeight: 700 }}>
                            {tier.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: T.muted }}>{p.gmail_limit} slots</td>
                        <td style={{ padding: '12px' }}>
                          {session ? (
                            <span style={{ color: T.green, fontWeight: 700 }}>● ONLINE</span>
                          ) : (
                            <span style={{ color: T.muted }}>○ OFFLINE</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleCycleTier(p.email, p.tier)}
                            style={{ background: 'transparent', border: `1px solid ${T.cyan}`, color: T.cyan, padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontFamily: T.mono }}
                          >
                            CYCLE TIER ➔
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── LIVE SESSIONS & KILL SWITCH ─────────── */}
      {activeTab === 'sessions' && (
        <div style={{ background: T.card, border: T.cardBorder, padding: '20px' }}>
          <h2 style={{ fontSize: '15px', color: T.green, marginTop: 0, marginBottom: '16px' }}>
            ACTIVE DESKTOP SESSIONS ({sessions.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {sessions.length === 0 ? (
              <p style={{ color: T.muted }}>NO LIVE SESSIONS CONNECTED</p>
            ) : (
              sessions.map((s) => (
                <div key={s.id} style={{ background: '#070912', border: `1px solid ${T.green}44`, padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{s.email}</div>
                    <span style={{ background: T.greenDim, color: T.green, padding: '2px 6px', fontSize: '9px', fontWeight: 700 }}>ACTIVE</span>
                  </div>
                  <div style={{ fontSize: '10px', color: T.muted, marginTop: '8px' }}>
                    Tier: {s.tier.toUpperCase()} | Gmail Slots: {s.gmail_limit}
                  </div>
                  <div style={{ fontSize: '9px', color: '#555', marginTop: '4px', wordBreak: 'break-all' }}>
                    Token: {s.access_token.substring(0, 24)}...
                  </div>
                  <button
                    onClick={() => handleRevokeSession(s.email)}
                    style={{ marginTop: '12px', width: '100%', background: T.redDim, border: `1px solid ${T.red}`, color: T.red, padding: '6px', cursor: 'pointer', fontSize: '10px', fontFamily: T.mono, fontWeight: 700 }}
                  >
                    KILL SESSION (REVOKE ACCESS)
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── GMAIL OAUTH POOL ──────────────────────── */}
      {activeTab === 'gmail-pool' && (() => {
        const statusColor = { active: T.green, rate_limited: '#f59e0b', expired: T.red, disabled: T.muted };
        const statusLabel = { active: '● ACTIVE', rate_limited: '⚡ RATE LIMITED', expired: '✗ EXPIRED', disabled: '○ DISABLED' };
        return (
          <div style={{ background: T.card, border: T.cardBorder, padding: '20px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '15px', color: T.cyan, margin: 0 }}>GMAIL OAUTH SESSION POOL</h2>
                <p style={{ fontSize: '10px', color: T.muted, margin: '4px 0 0' }}>
                  Admin logs into Gemini Pro Gmail accounts → OAuth tokens saved → Users get assigned 1-5 accounts based on tier
                </p>
              </div>
              <button onClick={handleReassignAll}
                style={{ background: 'transparent', border: `1px solid ${T.purple}`, color: T.purple, padding: '7px 14px', cursor: 'pointer', fontFamily: T.mono, fontSize: '10px', fontWeight: 700 }}>
                ↺ REASSIGN ALL USERS
              </button>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'TOTAL ACCOUNTS', val: gmailPool.length, color: T.cyan },
                { label: 'ACTIVE', val: gmailPool.filter(g => g.status === 'active').length, color: T.green },
                { label: 'RATE LIMITED', val: gmailPool.filter(g => g.status === 'rate_limited').length, color: '#f59e0b' },
                { label: 'REQUESTS TODAY', val: gmailPool.reduce((a, g) => a + (g.requests_today || 0), 0), color: T.purple },
              ].map(s => (
                <div key={s.label} style={{ background: '#070912', border: `1px solid ${s.color}33`, padding: '12px' }}>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: '9px', color: T.muted, marginTop: '3px', letterSpacing: '1px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* ── ADD GMAIL VIA GOOGLE LOGIN ── */}
            <div style={{ background: '#070912', border: `1px solid ${T.cyan}33`, padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ color: T.cyan, fontSize: '12px', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={13} /> ADD GEMINI PRO GMAIL ACCOUNT
              </h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ fontSize: '10px', color: T.muted, display: 'block', marginBottom: '4px' }}>LABEL / NICKNAME (OPTIONAL)</label>
                  <input
                    value={addGmailLabel}
                    onChange={e => setAddGmailLabel(e.target.value)}
                    placeholder="e.g. Gifari's Gemini Pro"
                    style={{ width: '100%', padding: '9px 12px', background: T.inputBg, border: '1px solid #222', color: '#fff', fontSize: '12px', outline: 'none', fontFamily: T.mono, boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  onClick={handleGoogleOAuthLogin}
                  disabled={oauthLoading}
                  style={{
                    background: oauthLoading ? 'rgba(0,0,0,0.3)' : 'rgba(66,133,244,0.15)',
                    border: '1px solid rgba(66,133,244,0.6)',
                    color: '#4285f4',
                    padding: '9px 20px', cursor: oauthLoading ? 'not-allowed' : 'pointer',
                    fontFamily: T.mono, fontSize: '12px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {oauthLoading ? 'OPENING LOGIN...' : 'LOGIN WITH GOOGLE'}
                </button>
              </div>
              <p style={{ fontSize: '10px', color: T.muted, margin: '10px 0 0' }}>
                ⚠️ Login with a Gmail account that has <strong style={{color: '#fff'}}>Gemini Advanced / Google One AI Premium</strong> subscription.
                The OAuth session will be encrypted and saved automatically.
              </p>
            </div>

            {/* Gmail Pool Table */}
            {gmailPool.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: T.muted, fontSize: '12px' }}>
                <Bot size={32} color={T.muted} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
                NO GMAIL ACCOUNTS IN POOL — ADD GEMINI PRO ACCOUNTS ABOVE
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.cyan}22`, color: T.cyan, fontSize: '10px', letterSpacing: '1px' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>GMAIL ACCOUNT</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>STATUS</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>REQ TODAY</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>TOKEN EXPIRES</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>LAST USED</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gmailPool.map(g => (
                      <tr key={g.id} style={{ borderBottom: '1px solid #0d1020' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 700 }}>{g.gmail}</div>
                          {g.display_name && <div style={{ fontSize: '9px', color: T.muted }}>{g.display_name}</div>}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ color: statusColor[g.status] || T.muted, fontWeight: 700, fontSize: '10px' }}>
                            {statusLabel[g.status] || g.status.toUpperCase()}
                          </span>
                          {g.rate_limit_until && g.status === 'rate_limited' && (
                            <div style={{ fontSize: '9px', color: T.muted }}>Reset: {new Date(g.rate_limit_until).toLocaleString()}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: T.cyan }}>{g.requests_today || 0}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '9px', color: T.muted }}>
                          {g.token_expires_at ? new Date(g.token_expires_at).toLocaleTimeString() : '—'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '9px', color: T.muted }}>
                          {g.last_used_at ? new Date(g.last_used_at).toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleToggleGmail(g.id, g.status)}
                              title={g.status === 'active' ? 'Disable' : 'Enable'}
                              style={{ background: 'transparent', border: `1px solid ${g.status === 'active' ? T.green : T.muted}44`, color: g.status === 'active' ? T.green : T.muted, padding: '5px 8px', cursor: 'pointer' }}
                            >
                              {g.status === 'active' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                            </button>
                            <button
                              onClick={() => handleRemoveGmail(g.id, g.gmail)}
                              title="Remove"
                              style={{ background: 'transparent', border: `1px solid ${T.red}44`, color: T.red, padding: '5px 8px', cursor: 'pointer' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── EDGE WORKER GATEWAY ─────────────────── */}
      {activeTab === 'edge' && (
        <div style={{ background: T.card, border: T.cardBorder, padding: '20px' }}>
          <h2 style={{ fontSize: '15px', color: T.cyan, marginTop: 0, marginBottom: '12px' }}>
            CLOUDFLARE EDGE WORKER INSPECTOR
          </h2>
          <div style={{ background: '#030408', border: '1px solid #222', padding: '14px', fontSize: '11px', color: T.cyan }}>
            <strong>TARGET WORKER:</strong> <a href={WORKER_URL} target="_blank" rel="noreferrer" style={{ color: T.cyan }}>{WORKER_URL}</a>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
            <button
              onClick={async () => {
                const r = await fetch(`${WORKER_URL}/api/accounts`);
                const json = await r.json();
                addLog(`EDGE TEST /api/accounts: ${json.length} sessions returned`);
              }}
              style={{ background: T.cyanDim, border: `1px solid ${T.cyan}`, color: T.cyan, padding: '8px 16px', cursor: 'pointer', fontFamily: T.mono, fontSize: '11px' }}
            >
              TEST GET /api/accounts
            </button>
          </div>
        </div>
      )}

      {/* ── AUDIT LOGS ──────────────────────────── */}
      {activeTab === 'logs' && (
        <div style={{ background: T.card, border: T.cardBorder, padding: '20px' }}>
          <h2 style={{ fontSize: '15px', color: T.green, marginTop: 0, marginBottom: '12px' }}>
            COMMAND AUDIT STREAM
          </h2>
          <div style={{ background: '#000', border: '1px solid #1a1a1a', padding: '14px', maxHeight: '360px', overflowY: 'auto', fontSize: '11px', color: T.green }}>
            {logs.map((log, idx) => (
              <div key={idx} style={{ marginBottom: '4px' }}>{log}</div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
