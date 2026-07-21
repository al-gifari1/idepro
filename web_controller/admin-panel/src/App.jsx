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
  const [aiSessions, setAiSessions] = useState([]);
  const [logs, setLogs] = useState([
    '[SYSTEM] COMMAND CENTER INITIALIZED.',
    '[EDGE] CLOUDFLARE GATEWAY ONLINE.',
    '[SUPABASE] POSTGRES RLS ACTIVE.'
  ]);

  const [workerHealth, setWorkerHealth] = useState({ status: 'checking', latency: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('users'); // users | sessions | edge | ai-pool | logs
  const [editingUser, setEditingUser] = useState(null);
  const [customLimit, setCustomLimit] = useState('1');

  // AI Session Pool state
  const [showAddSession, setShowAddSession] = useState(false);
  const [newSession, setNewSession] = useState({ gmail: '', display_name: '', auth_method: 'apikey', credential: '', notes: '' });
  const [showCredential, setShowCredential] = useState(false);
  const [addingSession, setAddingSession] = useState(false);

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
        setWorkerHealth({ status: 'online', latency });
      } else {
        setWorkerHealth({ status: 'degraded', latency });
      }
    } catch {
      setWorkerHealth({ status: 'offline', latency: 0 });
    }
  };

  // ── Fetch Supabase Data ───────────────────────
  const loadData = async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch profiles
      const { data: profs, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profErr) throw profErr;
      setProfiles(profs || []);

      // 2. Fetch active sessions from Edge Worker API or Supabase
      const { data: sess, error: sessErr } = await supabase
        .from('active_sessions')
        .select('*')
        .order('last_synced_at', { ascending: false });

      if (sessErr) throw sessErr;
      setSessions(sess || []);

      // 3. Fetch AI session pool from Edge Worker
      try {
        const aiRes = await fetch(`${WORKER_URL}/api/admin/sessions`, {
          headers: { 'x-admin-key': ADMIN_KEY }
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          setAiSessions(aiData);
          addLog(`AI POOL: Loaded ${aiData.length} Google AI sessions.`);
        }
      } catch { /* Edge Worker may not be deployed yet */ }

      addLog(`DATA SYNC: Loaded ${profs?.length || 0} profiles & ${sess?.length || 0} active sessions.`);
    } catch (e) {
      addLog(`ERR DATA SYNC: ${e.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── Add new AI session to pool ──────────────────
  const handleAddAiSession = async () => {
    if (!newSession.gmail || !newSession.credential) {
      addLog('ERR: Gmail and credential are required.');
      return;
    }
    setAddingSession(true);
    try {
      const res = await fetch(`${WORKER_URL}/api/admin/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
        body: JSON.stringify(newSession)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add session');
      addLog(`AI POOL: Added session for ${newSession.gmail}`);
      setNewSession({ gmail: '', display_name: '', auth_method: 'apikey', credential: '', notes: '' });
      setShowAddSession(false);
      loadData();
    } catch (e) {
      addLog(`ERR ADD SESSION: ${e.message}`);
    } finally {
      setAddingSession(false);
    }
  };

  // ── Toggle AI session status ────────────────────
  const handleToggleAiSession = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      await fetch(`${WORKER_URL}/api/admin/sessions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
        body: JSON.stringify({ status: newStatus })
      });
      addLog(`AI POOL: Session ${id.slice(0,8)}... -> ${newStatus.toUpperCase()}`);
      loadData();
    } catch (e) {
      addLog(`ERR TOGGLE: ${e.message}`);
    }
  };

  // ── Remove AI session ───────────────────────────
  const handleRemoveAiSession = async (id, gmail) => {
    if (!confirm(`Remove AI session for ${gmail}?`)) return;
    try {
      await fetch(`${WORKER_URL}/api/admin/sessions/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': ADMIN_KEY }
      });
      addLog(`AI POOL: Removed session for ${gmail}`);
      loadData();
    } catch (e) {
      addLog(`ERR REMOVE: ${e.message}`);
    }
  };

  useEffect(() => {
    loadData();
    checkWorkerHealth();
    const interval = setInterval(checkWorkerHealth, 15000);
    return () => clearInterval(interval);
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
          { id: 'ai-pool', label: 'AI SESSION POOL', icon: Bot, badge: aiSessions.filter(s => s.status === 'active').length },
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
              display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 700, transition: 'all 0.2s',
              position: 'relative'
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

      {/* ── AI SESSION POOL ──────────────────────── */}
      {activeTab === 'ai-pool' && (() => {
        const statusColor = { active: T.green, rate_limited: '#f59e0b', expired: T.red, disabled: T.muted };
        const statusLabel = { active: '● ACTIVE', rate_limited: '⚡ RATE LIMITED', expired: '✗ EXPIRED', disabled: '○ DISABLED' };
        return (
          <div style={{ background: T.card, border: T.cardBorder, padding: '20px' }}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '15px', color: T.cyan, margin: 0 }}>GOOGLE AI SESSION POOL</h2>
                <p style={{ fontSize: '10px', color: T.muted, margin: '4px 0 0' }}>
                  Pooled Google AI Studio API keys — shared across all IDEpro users
                </p>
              </div>
              <button
                onClick={() => setShowAddSession(v => !v)}
                style={{ background: T.cyanDim, border: `1px solid ${T.cyan}`, color: T.cyan, padding: '8px 16px', cursor: 'pointer', fontFamily: T.mono, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 700 }}
              >
                <Plus size={13} /> ADD SESSION
              </button>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'TOTAL SESSIONS', val: aiSessions.length, color: T.cyan },
                { label: 'ACTIVE', val: aiSessions.filter(s => s.status === 'active').length, color: T.green },
                { label: 'RATE LIMITED', val: aiSessions.filter(s => s.status === 'rate_limited').length, color: '#f59e0b' },
                { label: 'REQUESTS TODAY', val: aiSessions.reduce((acc, s) => acc + (s.requests_today || 0), 0), color: T.purple },
              ].map(stat => (
                <div key={stat.label} style={{ background: '#070912', border: `1px solid ${stat.color}33`, padding: '12px' }}>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: stat.color }}>{stat.val}</div>
                  <div style={{ fontSize: '9px', color: T.muted, marginTop: '3px', letterSpacing: '1px' }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Add Session Modal */}
            {showAddSession && (
              <div style={{ background: '#070912', border: `1px solid ${T.cyan}44`, padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ color: T.cyan, fontSize: '13px', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <KeyRound size={14} /> ADD NEW GOOGLE AI SESSION
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '10px', color: T.muted, display: 'block', marginBottom: '4px' }}>GMAIL / ACCOUNT EMAIL *</label>
                    <input
                      value={newSession.gmail}
                      onChange={e => setNewSession(v => ({ ...v, gmail: e.target.value }))}
                      placeholder="example@gmail.com"
                      style={{ width: '100%', padding: '9px 12px', background: T.inputBg, border: '1px solid #222', color: '#fff', fontSize: '12px', outline: 'none', fontFamily: T.mono, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: T.muted, display: 'block', marginBottom: '4px' }}>DISPLAY LABEL</label>
                    <input
                      value={newSession.display_name}
                      onChange={e => setNewSession(v => ({ ...v, display_name: e.target.value }))}
                      placeholder="e.g. Primary AI Account"
                      style={{ width: '100%', padding: '9px 12px', background: T.inputBg, border: '1px solid #222', color: '#fff', fontSize: '12px', outline: 'none', fontFamily: T.mono, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '10px', color: T.muted, display: 'block', marginBottom: '4px' }}>AUTH METHOD</label>
                  <select
                    value={newSession.auth_method}
                    onChange={e => setNewSession(v => ({ ...v, auth_method: e.target.value }))}
                    style={{ background: T.inputBg, border: '1px solid #222', color: T.cyan, padding: '9px 16px', fontSize: '12px', outline: 'none', fontFamily: T.mono }}
                  >
                    <option value="apikey">Google AI Studio API Key (Recommended)</option>
                    <option value="cookie">Session Cookie JSON</option>
                  </select>
                </div>
                <div style={{ marginBottom: '12px', position: 'relative' }}>
                  <label style={{ fontSize: '10px', color: T.muted, display: 'block', marginBottom: '4px' }}>
                    {newSession.auth_method === 'apikey' ? 'GOOGLE AI STUDIO API KEY *' : 'SESSION COOKIE JSON *'}
                  </label>
                  <input
                    type={showCredential ? 'text' : 'password'}
                    value={newSession.credential}
                    onChange={e => setNewSession(v => ({ ...v, credential: e.target.value }))}
                    placeholder={newSession.auth_method === 'apikey' ? 'AIzaSy...' : '{"__Secure-1PSID": "..."}'}
                    style={{ width: '100%', padding: '9px 40px 9px 12px', background: T.inputBg, border: '1px solid #222', color: '#fff', fontSize: '12px', outline: 'none', fontFamily: T.mono, boxSizing: 'border-box' }}
                  />
                  <button onClick={() => setShowCredential(v => !v)} style={{ position: 'absolute', right: '10px', top: '26px', background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 0 }}>
                    {showCredential ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '10px', color: T.muted, display: 'block', marginBottom: '4px' }}>NOTES (OPTIONAL)</label>
                  <input
                    value={newSession.notes}
                    onChange={e => setNewSession(v => ({ ...v, notes: e.target.value }))}
                    placeholder="e.g. Gifari's main account"
                    style={{ width: '100%', padding: '9px 12px', background: T.inputBg, border: '1px solid #222', color: '#fff', fontSize: '12px', outline: 'none', fontFamily: T.mono, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleAddAiSession}
                    disabled={addingSession}
                    style={{ background: T.cyanDim, border: `1px solid ${T.cyan}`, color: T.cyan, padding: '9px 20px', cursor: 'pointer', fontFamily: T.mono, fontSize: '11px', fontWeight: 700 }}
                  >
                    {addingSession ? 'ENCRYPTING & SAVING...' : 'SAVE SESSION →'}
                  </button>
                  <button
                    onClick={() => setShowAddSession(false)}
                    style={{ background: 'transparent', border: '1px solid #333', color: T.muted, padding: '9px 20px', cursor: 'pointer', fontFamily: T.mono, fontSize: '11px' }}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}

            {/* Sessions Table */}
            {aiSessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: T.muted, fontSize: '12px' }}>
                <Bot size={32} color={T.muted} style={{ opacity: 0.4, display: 'block', margin: '0 auto 12px' }} />
                NO AI SESSIONS IN POOL — ADD YOUR FIRST GOOGLE AI ACCOUNT
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.cyan}22`, color: T.cyan, fontSize: '10px' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>ACCOUNT</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>AUTH</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>STATUS</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>REQ TODAY</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>TOTAL REQ</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>LAST USED</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiSessions.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #0d1020' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 700 }}>{s.gmail}</div>
                          {s.display_name && <div style={{ fontSize: '9px', color: T.muted }}>{s.display_name}</div>}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ background: T.purpleDim, color: T.purple, border: `1px solid ${T.purple}44`, padding: '2px 7px', fontSize: '9px', fontWeight: 700 }}>
                            {s.auth_method === 'apikey' ? 'API KEY' : 'COOKIE'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ color: statusColor[s.status] || T.muted, fontWeight: 700, fontSize: '10px' }}>
                            {statusLabel[s.status] || s.status}
                          </span>
                          {s.rate_limit_until && s.status === 'rate_limited' && (
                            <div style={{ fontSize: '9px', color: T.muted }}>Reset: {new Date(s.rate_limit_until).toLocaleTimeString()}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: T.cyan }}>{s.requests_today || 0}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: T.muted }}>{s.requests_total || 0}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '9px', color: T.muted }}>
                          {s.last_used_at ? new Date(s.last_used_at).toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleToggleAiSession(s.id, s.status)}
                              title={s.status === 'active' ? 'Disable' : 'Enable'}
                              style={{ background: 'transparent', border: `1px solid ${s.status === 'active' ? T.green : T.muted}44`, color: s.status === 'active' ? T.green : T.muted, padding: '5px 8px', cursor: 'pointer' }}
                            >
                              {s.status === 'active' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                            </button>
                            <button
                              onClick={() => handleRemoveAiSession(s.id, s.gmail)}
                              title="Remove Session"
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
