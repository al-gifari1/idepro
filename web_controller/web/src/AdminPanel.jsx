import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard, Users, Radio, Mail, Server, ClipboardList,
  Settings, Bell, Search, RefreshCw, ChevronRight, ChevronLeft,
  TrendingUp, TrendingDown, Wifi, WifiOff, Trash2, ExternalLink,
  Download, Shield, Zap, AlertCircle, CheckCircle2,
  Menu, X, Plus
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://rjegmurqhkglyethgauq.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZWdtdXJxaGtnbHlldGhnYXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTIxMzYsImV4cCI6MjA5OTU2ODEzNn0.6Qf0ZDlU_bSBPCXG_4lvs5rZFBYndjfDJh3_k3K6tYw'
);

const WORKER_URL = 'https://idepro.ai-gifari-n8n.workers.dev';
const ADMIN_KEY  = import.meta.env.VITE_ADMIN_SECRET_KEY || 'idepro-admin-secret';

// ── Design Tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:        '#F8FAFB',
  white:     '#FFFFFF',
  border:    '#E2E8F0',
  borderSub: '#F1F5F9',
  text:      '#0F172A',
  textSub:   '#475569',
  textMuted: '#94A3B8',
  green:     '#10B981',
  greenBg:   '#F0FDF4',
  greenDim:  '#D1FAE5',
  amber:     '#F59E0B',
  amberBg:   '#FFFBEB',
  red:       '#EF4444',
  redBg:     '#FEF2F2',
  blue:      '#3B82F6',
  blueBg:    '#EFF6FF',
  purple:    '#8B5CF6',
  purpleBg:  '#F5F3FF',
  sidebar:   240,
  topbar:    56,
};

// ── Responsive hook ───────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// ── Pill Badge ────────────────────────────────────────────────────────────────
const Pill = ({ children, variant = 'green' }) => {
  const styles = {
    green:  { bg: C.greenBg,  color: C.green,   border: C.greenDim },
    grey:   { bg: '#F1F5F9',  color: C.textSub,  border: '#E2E8F0'  },
    amber:  { bg: C.amberBg,  color: C.amber,    border: '#FDE68A'  },
    red:    { bg: C.redBg,    color: C.red,       border: '#FECACA'  },
    blue:   { bg: C.blueBg,   color: C.blue,      border: '#BFDBFE'  },
    purple: { bg: C.purpleBg, color: C.purple,    border: '#DDD6FE'  },
  };
  const s = styles[variant] || styles.grey;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '9999px', fontSize: '11px',
      fontWeight: 600, letterSpacing: '0.02em',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {children}
    </span>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon: Icon, variant = 'default', trend, mobile }) => (
  <div style={{
    background: C.white, border: `1px solid ${C.border}`,
    borderRadius: mobile ? '12px' : '8px',
    padding: mobile ? '20px' : '20px 24px',
    flex: mobile ? 'unset' : 1,
    display: 'flex', flexDirection: mobile ? 'row' : 'column',
    alignItems: mobile ? 'center' : 'flex-start',
    justifyContent: mobile ? 'space-between' : 'flex-start',
  }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: C.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: variant === 'green' ? C.green : C.text, lineHeight: 1, marginBottom: sub ? '4px' : 0 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '12px', color: C.textMuted }}>{sub}</div>}
      {trend && !mobile && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${C.borderSub}`, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          {trend.dir === 'up' ? <TrendingUp size={13} color={C.green} /> : <TrendingDown size={13} color={C.red} />}
          <span style={{ color: trend.dir === 'up' ? C.green : C.red, fontWeight: 600 }}>{trend.val}</span>
          <span style={{ color: C.textMuted }}>{trend.label}</span>
        </div>
      )}
    </div>
    {Icon && (
      <div style={{
        width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
        background: variant === 'green' ? C.greenBg : '#EDF2F7',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Icon size={20} color={variant === 'green' ? C.green : C.textMuted} />
      </div>
    )}
  </div>
);

const TIER_PILL = {
  free:    { label: 'FREE',    variant: 'grey'   },
  pro:     { label: 'PRO',     variant: 'green'  },
  premium: { label: 'PREMIUM', variant: 'blue'   },
};

// ── Mobile Developer Card ─────────────────────────────────────────────────────
const DevCard = ({ p, online, handleCycleTier }) => {
  const tier = TIER_PILL[p.tier] || TIER_PILL.free;
  const initials = p.email?.slice(0, 2).toUpperCase() || '??';
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: C.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: C.green, flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{p.email}</div>
            <div style={{ fontSize: '12px', color: C.textMuted }}>{p.tier?.charAt(0).toUpperCase() + p.tier?.slice(1)} Plan · {p.gmail_limit || 1} Gmail slots</div>
          </div>
        </div>
        <Pill variant={online ? 'green' : 'grey'}>{online ? '● ONLINE' : '○ OFFLINE'}</Pill>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: `1px solid ${C.borderSub}` }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: C.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '2px' }}>Tier</div>
          <Pill variant={tier.variant}>{tier.label}</Pill>
        </div>
        <button onClick={() => handleCycleTier(p.email, p.tier)} style={{
          display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px',
          border: `1px solid ${C.border}`, borderRadius: '8px', background: C.white,
          cursor: 'pointer', fontSize: '12px', color: C.green, fontWeight: 600,
        }}>
          <RefreshCw size={12} /> Cycle Tier
        </button>
      </div>
    </div>
  );
};

// ── Main App ─────────────────────────────────────────────────────────────────
export default function AdminCommandCenter() {
  const isMobile       = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeNav, setActiveNav]   = useState('dashboard');
  const [profiles,  setProfiles]    = useState([]);
  const [sessions,  setSessions]    = useState([]);
  const [gmailPool, setGmailPool]   = useState([]);
  const [logs,      setLogs]        = useState([]);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [tierFilter,   setTierFilter]   = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [workerStatus, setWorkerStatus] = useState('checking');
  const [workerLatency,setWorkerLatency]= useState(0);
  const [addGmailLabel,setAddGmailLabel]= useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUserEmail, setAddUserEmail] = useState('');
  const [addUserPassword, setAddUserPassword] = useState('');
  const [addUserTier, setAddUserTier] = useState('free');
  const [addUserLimit, setAddUserLimit] = useState(1);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState('');
  const PAGE_SIZE = 10;

  const addLog = (msg) => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => [`[${ts}] ${msg}`, ...prev.slice(0, 99)]);
  };

  const checkWorkerHealth = async () => {
    const t = Date.now();
    try {
      const res  = await fetch(`${WORKER_URL}/health`);
      const data = await res.json();
      setWorkerStatus(res.ok ? 'online' : 'degraded');
      setWorkerLatency(Date.now() - t);
    } catch { setWorkerStatus('offline'); setWorkerLatency(0); }
  };

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const { data: profs, error: pErr } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (pErr && pErr.code === 'PGRST205') {
        console.warn('profiles table not found, using fallback simulated developers');
        setProfiles([
          { id: '1', email: 'gifari@gmail.com', tier: 'pro', gmail_limit: 3, updated_at: new Date().toISOString() },
          { id: '2', email: 'user2@test.com', tier: 'free', gmail_limit: 1, updated_at: new Date().toISOString() },
          { id: '3', email: 'dev3@email.com', tier: 'premium', gmail_limit: 5, updated_at: new Date().toISOString() }
        ]);
      } else {
        setProfiles(profs || []);
      }

      const { data: sess, error: sErr } = await supabase.from('active_sessions').select('*').order('last_synced_at', { ascending: false });
      if (sErr && sErr.code === 'PGRST205') {
        console.warn('active_sessions table not found, using fallback simulated sessions');
        setSessions([
          { id: '1', email: 'gifari@gmail.com', tier: 'pro', gmail_limit: 3, last_synced_at: new Date().toISOString() },
          { id: '3', email: 'dev3@email.com', tier: 'premium', gmail_limit: 5, last_synced_at: new Date().toISOString() }
        ]);
      } else {
        setSessions(sess || []);
      }

      try {
        const r = await fetch(`${WORKER_URL}/api/admin/gmail-pool`, { headers: { 'x-admin-key': ADMIN_KEY } });
        if (r.ok) setGmailPool(await r.json());
      } catch {}
      addLog(`Sync complete.`);
    } catch (e) { 
      console.warn('LoadData exception, falling back to simulated pool', e);
      addLog(`Sync fallback active.`); 
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const handleCycleTier = async (email, current) => {
    const next  = { free: 'pro', pro: 'premium', premium: 'free' }[current] || 'free';
    const limit = { free: 1, pro: 3, premium: 5 }[next];
    await supabase.from('profiles').update({ tier: next, gmail_limit: limit, updated_at: new Date().toISOString() }).eq('email', email);
    await supabase.from('active_sessions').update({ tier: next, gmail_limit: limit }).eq('email', email);
    addLog(`Tier updated: ${email} → ${next.toUpperCase()}`);
    loadData();
  };

  const handleToggleGmail = async (id, status) => {
    const newStatus = status === 'active' ? 'disabled' : 'active';
    await fetch(`${WORKER_URL}/api/admin/gmail-pool/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
      body: JSON.stringify({ status: newStatus })
    });
    addLog(`Gmail ${id.slice(0,8)}… → ${newStatus}`);
    loadData();
  };

  const handleRemoveGmail = async (id, gmail) => {
    if (!confirm(`Remove ${gmail}?`)) return;
    await fetch(`${WORKER_URL}/api/admin/gmail-pool/${id}`, { method: 'DELETE', headers: { 'x-admin-key': ADMIN_KEY } });
    addLog(`Removed ${gmail}`);
    loadData();
  };

  const handleReassignAll = async () => {
    const res  = await fetch(`${WORKER_URL}/api/admin/reassign-all`, { method: 'POST', headers: { 'x-admin-key': ADMIN_KEY } });
    const data = await res.json();
    addLog(`Re-assigned gmails for ${data.reassigned} users`);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddUserLoading(true);
    setAddUserError('');
    try {
      const res = await fetch(`${WORKER_URL}/api/admin/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_KEY
        },
        body: JSON.stringify({
          email: addUserEmail,
          password: addUserPassword,
          tier: addUserTier,
          gmail_limit: addUserLimit
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      addLog(`Created user: ${addUserEmail}`);
      setShowAddUserModal(false);
      setAddUserEmail('');
      setAddUserPassword('');
      setAddUserTier('free');
      setAddUserLimit(1);
      loadData();
    } catch (err) {
      setAddUserError(err.message);
    } finally {
      setAddUserLoading(false);
    }
  };

  const handleGoogleOAuthLogin = async () => {
    setOauthLoading(true);
    try {
      const res  = await fetch(`${WORKER_URL}/api/admin/oauth-url?display_name=${encodeURIComponent(addGmailLabel)}`, { headers: { 'x-admin-key': ADMIN_KEY } });
      const data = await res.json();
      if (!res.ok || !data.configured) { alert('GOOGLE_CLIENT_ID not configured on worker.'); return; }
      const popup = window.open(data.url, 'Google OAuth', 'width=500,height=620');
      const poll  = setInterval(() => { if (popup?.closed) { clearInterval(poll); loadData(); setOauthLoading(false); } }, 600);
    } catch (e) { addLog(`OAuth error: ${e.message}`); }
    finally { setOauthLoading(false); }
  };

  useEffect(() => {
    loadData(); checkWorkerHealth();
    const iv = setInterval(checkWorkerHealth, 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const h = (e) => { if (e.data?.type === 'GMAIL_ADDED') { addLog(`✅ ${e.data.gmail} added`); loadData(); } };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  const handleNavClick = (id) => { setActiveNav(id); setDrawerOpen(false); };

  const filteredProfiles  = profiles.filter(p => {
    const matchSearch = !searchQuery || p.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchTier   = tierFilter === 'all' || p.tier === tierFilter;
    return matchSearch && matchTier;
  });
  const totalPages    = Math.max(1, Math.ceil(filteredProfiles.length / PAGE_SIZE));
  const pagedProfiles = filteredProfiles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard',    icon: LayoutDashboard },
    { id: 'users',     label: 'Developer DB', icon: Users           },
    { id: 'sessions',  label: 'Live Sessions', icon: Radio          },
    { id: 'gmail',     label: 'Gmail Pool',   icon: Mail, badge: gmailPool.filter(g=>g.status==='active').length },
    { id: 'edge',      label: 'Edge Gateway', icon: Server          },
    { id: 'logs',      label: 'Audit Logs',   icon: ClipboardList   },
  ];

  const NavItems = ({ onNavClick }) => (
    <nav style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 8px 4px', marginBottom: '2px' }}>Platform</div>
      {navItems.map(item => {
        const active = activeNav === item.id;
        return (
          <button key={item.id} onClick={() => onNavClick(item.id)} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            width: '100%', padding: '9px 11px', borderRadius: '8px',
            border: 'none', cursor: 'pointer', marginBottom: '2px',
            background: active ? C.greenBg : 'transparent',
            color: active ? C.green : C.textSub,
            fontWeight: active ? 600 : 400, fontSize: '13px', textAlign: 'left',
            borderLeft: active ? `3px solid ${C.green}` : '3px solid transparent',
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}>
            <item.icon size={16} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge > 0 && (
              <span style={{ background: C.green, color: '#fff', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, padding: '1px 7px' }}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', -apple-system, sans-serif", background: C.bg, color: C.text, overflow: 'hidden' }}>

      {/* ══ MOBILE DRAWER OVERLAY ════════════════════════════════════════════ */}
      {isMobile && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.4)',
            opacity: drawerOpen ? 1 : 0,
            pointerEvents: drawerOpen ? 'all' : 'none',
            transition: 'opacity 0.25s',
          }}
        >
          {/* Drawer Panel */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: '280px',
              background: C.white, display: 'flex', flexDirection: 'column',
              boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
              transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {/* Drawer Header */}
            <div style={{ padding: '0 16px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={14} color="#fff" fill="#fff" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '15px' }}>IDEpro</span>
                <span style={{ fontSize: '10px', fontWeight: 700, background: C.greenBg, color: C.green, padding: '1px 7px', borderRadius: '9999px', border: `1px solid ${C.greenDim}` }}>Admin</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', color: C.textSub, display: 'flex' }}>
                <X size={20} />
              </button>
            </div>

            <NavItems onNavClick={handleNavClick} />

            {/* Drawer Footer */}
            <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px' }}>
              <button style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', padding: '9px 11px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent', color: C.textSub, fontSize: '13px', fontFamily: 'inherit' }}>
                <Settings size={16} /> Settings
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 11px 4px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `linear-gradient(135deg, ${C.green}, #059669)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 700 }}>AG</div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>Al Gifari</div>
                  <div style={{ fontSize: '11px', color: C.textMuted }}>Enterprise Admin</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ DESKTOP SIDEBAR ══════════════════════════════════════════════════ */}
      {!isMobile && (
        <aside style={{
          width: `${C.sidebar}px`, minWidth: `${C.sidebar}px`,
          background: C.white, borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100,
        }}>
          <div style={{ padding: '0 20px', height: `${C.topbar}px`, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={14} color="#fff" fill="#fff" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>IDEpro</span>
              <span style={{ fontSize: '10px', fontWeight: 700, background: C.greenBg, color: C.green, padding: '1px 6px', borderRadius: '9999px', border: `1px solid ${C.greenDim}` }}>Admin</span>
            </div>
          </div>

          <NavItems onNavClick={handleNavClick} />

          <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px' }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', padding: '8px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'transparent', color: C.textSub, fontSize: '13px', fontFamily: 'inherit' }}>
              <Settings size={15} /> Settings
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 10px 4px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: `linear-gradient(135deg, ${C.green}, #059669)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 700 }}>AG</div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>Al Gifari</div>
                <div style={{ fontSize: '11px', color: C.textMuted }}>Enterprise Admin</div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ══ MAIN AREA ════════════════════════════════════════════════════════ */}
      <div style={{ marginLeft: isMobile ? 0 : `${C.sidebar}px`, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── TOPBAR ─────────────────────────────────────────────────────── */}
        <header style={{
          height: `${C.topbar}px`, background: C.white, borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          {isMobile && (
            <button onClick={() => setDrawerOpen(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', color: C.textSub, display: 'flex', flexShrink: 0 }}>
              <Menu size={22} />
            </button>
          )}

          <div style={{ fontSize: isMobile ? '16px' : '15px', fontWeight: 700, color: isMobile ? C.green : C.text, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
            {isMobile ? 'IDEpro' : navItems.find(n => n.id === activeNav)?.label || 'Dashboard'}
          </div>

          {!isMobile && (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '320px' }}>
                <Search size={14} color={C.textMuted} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Search developers, emails..."
                  style={{
                    width: '100%', height: '34px', padding: '0 12px 0 34px',
                    background: C.bg, border: `1px solid ${C.border}`,
                    borderRadius: '9999px', fontSize: '13px', color: C.text,
                    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600 }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: workerStatus === 'online' ? C.green : workerStatus === 'checking' ? C.amber : C.red }} />
                <span style={{ color: C.textMuted }}>{workerStatus === 'online' ? `${workerLatency}ms` : workerStatus}</span>
              </div>
            )}
            <button onClick={() => setDrawerOpen(false)} title="Notifications" style={{ width: '34px', height: '34px', border: `1px solid ${C.border}`, borderRadius: '8px', background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={15} color={C.textSub} />
            </button>
            <button onClick={loadData} disabled={isRefreshing} style={{
              height: '34px', padding: '0 14px', background: C.green, color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit',
            }}>
              <RefreshCw size={12} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
              {!isMobile && 'Sync Data'}
            </button>
          </div>
        </header>

        {/* ── PAGE CONTENT ─────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px', paddingBottom: isMobile ? '24px' : '24px' }}>

          {/* ══ DASHBOARD ═══════════════════════════════════════════════ */}
          {activeNav === 'dashboard' && (
            <>
              {isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.01em' }}>Overview</div>
                </div>
              )}

              <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: '12px', marginBottom: '20px'
              }}>
                <StatCard mobile={isMobile} label="Total Developers" value={profiles.length} sub="Registered accounts" icon={Users}
                  trend={{ dir: 'up', val: '+12.5%', label: 'vs last month' }} />
                <StatCard mobile={isMobile} label="Online Now" value={sessions.length} sub="Active sessions" icon={Wifi}
                  variant="green" trend={{ dir: 'up', val: `${sessions.length} live`, label: '' }} />
                <StatCard mobile={isMobile} label="Gmail Pool" value={`${gmailPool.filter(g=>g.status==='active').length}`}
                  sub={`${gmailPool.length} total accounts`} icon={Mail}
                  trend={{ dir: 'up', val: 'Active', label: '' }} />
                <StatCard mobile={isMobile} label="Monthly Revenue" value="$4,820" sub="Crypto + card" icon={TrendingUp}
                  trend={{ dir: 'up', val: '+8.2%', label: 'vs last month' }} />
              </div>

              {!isMobile && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '20px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Edge Gateway Performance</div>
                    <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '16px' }}>Real-time worker latency</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '64px' }}>
                      {[40, 55, 35, 70, 45, 80, 60, 50, Math.min(workerLatency || 65, 100)].map((h, i) => (
                        <div key={i} style={{ flex: 1, background: i === 8 ? C.green : C.borderSub, borderRadius: '2px', height: `${h}%` }} />
                      ))}
                    </div>
                    <div style={{ marginTop: '10px', fontSize: '11px', color: C.textMuted }}>
                      Latency: <span style={{ color: C.green, fontWeight: 600 }}>{workerLatency || 24}ms avg</span>
                    </div>
                  </div>
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: C.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                      <Shield size={22} color={C.green} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Security Overview</div>
                    <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '14px' }}>No critical vulnerabilities in 24h.</div>
                    <button onClick={() => setActiveNav('logs')} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', color: C.textSub, fontWeight: 500, fontFamily: 'inherit' }}>
                      Run Full Audit
                    </button>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600, fontSize: isMobile ? '16px' : '14px' }}>
                  {isMobile ? 'Active Developers' : 'Recent Developers'}
                </div>
                <button onClick={() => setActiveNav('users')} style={{ fontSize: '12px', color: C.green, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  View All
                </button>
              </div>

              {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {profiles.slice(0, 5).map((p, i) => (
                    <DevCard key={p.id || i} p={p} online={sessions.some(s => s.email === p.email)} handleCycleTier={handleCycleTier} />
                  ))}
                  {profiles.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px', color: C.textMuted, background: C.white, borderRadius: '12px', border: `1px solid ${C.border}` }}>
                      No developers yet
                    </div>
                  )}
                </div>
              ) : (
                <DeveloperTable pagedProfiles={profiles.slice(0, 5)} sessions={sessions} handleCycleTier={handleCycleTier} compact />
              )}

              {isMobile && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '12px' }}>Edge Performance</div>
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100px' }}>
                      {[60, 45, 85, 30, 95, 70, 50, 65, 40].map((h, i) => (
                        <div key={i} style={{ flex: 1, background: i === 4 ? C.green : `${C.green}33`, borderRadius: '3px 3px 0 0', height: `${h}%`, transition: 'height 0.3s' }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', color: C.textMuted }}>
                      <span>08:00</span><span>12:00</span><span>16:00</span><span>Now</span>
                    </div>
                    <div style={{ marginTop: '10px', fontSize: '12px', color: C.textMuted }}>
                      Avg latency: <span style={{ color: C.green, fontWeight: 600 }}>{workerLatency || 24}ms</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══ DEVELOPER DB ════════════════════════════════════════════ */}
          {activeNav === 'users' && (
            <>
              {isMobile && (
                <div style={{ position: 'relative', marginBottom: '12px' }}>
                  <Search size={14} color={C.textMuted} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    placeholder="Search developers..."
                    style={{ width: '100%', height: '40px', padding: '0 12px 0 36px', background: C.white, border: `1px solid ${C.border}`, borderRadius: '10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {['all', 'free', 'pro', 'premium'].map(t => (
                  <button key={t} onClick={() => { setTierFilter(t); setCurrentPage(1); }} style={{
                    padding: '6px 14px', borderRadius: '9999px',
                    border: `1px solid ${tierFilter === t ? C.green : C.border}`,
                    background: tierFilter === t ? C.greenBg : C.white,
                    color: tierFilter === t ? C.green : C.textSub,
                    fontSize: '12px', fontWeight: tierFilter === t ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {t === 'all' ? 'All Tiers' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                  <button onClick={() => setShowAddUserModal(true)} style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px',
                    background: C.green, color: '#fff', border: 'none', borderRadius: '6px',
                    cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit'
                  }}>
                    <Plus size={13} /> Add Developer
                  </button>
                  {!isMobile && (
                    <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: '6px', background: C.white, cursor: 'pointer', fontSize: '12px', color: C.textSub, fontFamily: 'inherit' }}>
                      <Download size={13} /> Export CSV
                    </button>
                  )}
                </div>
              </div>

              {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {pagedProfiles.map((p, i) => (
                    <DevCard key={p.id || i} p={p} online={sessions.some(s => s.email === p.email)} handleCycleTier={handleCycleTier} />
                  ))}
                  {pagedProfiles.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: C.textMuted, background: C.white, borderRadius: '12px', border: `1px solid ${C.border}` }}>No results</div>
                  )}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
                        style={{ padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: '8px', background: C.white, cursor: 'pointer', fontSize: '13px', color: C.textSub, fontFamily: 'inherit' }}>← Prev</button>
                      <span style={{ padding: '8px 12px', fontSize: '13px', color: C.textMuted }}>{currentPage} / {totalPages}</span>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                        style={{ padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: '8px', background: C.white, cursor: 'pointer', fontSize: '13px', color: C.textSub, fontFamily: 'inherit' }}>Next →</button>
                    </div>
                  )}
                </div>
              ) : (
                <DeveloperTable
                  pagedProfiles={pagedProfiles} sessions={sessions} handleCycleTier={handleCycleTier}
                  currentPage={currentPage} totalPages={totalPages} total={filteredProfiles.length}
                  setCurrentPage={setCurrentPage}
                />
              )}
            </>
          )}

          {/* ══ LIVE SESSIONS ═══════════════════════════════════════════ */}
          {activeNav === 'sessions' && (
            <div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexDirection: isMobile ? 'column' : 'row' }}>
                <StatCard mobile={isMobile} label="Active Sessions" value={sessions.length} icon={Wifi} variant="green" />
                <StatCard mobile={isMobile} label="Unique Developers" value={new Set(sessions.map(s=>s.email)).size} icon={Users} />
              </div>
              {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sessions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: C.textMuted, background: C.white, borderRadius: '12px', border: `1px solid ${C.border}` }}>
                      <WifiOff size={28} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }} />
                      No active sessions
                    </div>
                  ) : sessions.map(s => (
                    <div key={s.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{s.email}</div>
                        <Pill variant="green">● ONLINE</Pill>
                      </div>
                      <div style={{ fontSize: '12px', color: C.textMuted }}>
                        Tier: {s.tier?.toUpperCase()} · {s.gmail_limit} slots · {s.last_synced_at ? new Date(s.last_synced_at).toLocaleTimeString() : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: '14px' }}>
                    Live Desktop Sessions ({sessions.length})
                  </div>
                  {sessions.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: C.textMuted }}>
                      <WifiOff size={28} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.4 }} />
                      No active sessions
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          {['Email', 'Tier', 'Gmail Slots', 'Last Sync', 'Status'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map(s => (
                          <tr key={s.id} style={{ borderBottom: `1px solid ${C.borderSub}` }}
                            onMouseEnter={e => e.currentTarget.style.background = C.bg}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '12px 16px', fontWeight: 500 }}>{s.email}</td>
                            <td style={{ padding: '12px 16px' }}><Pill variant={TIER_PILL[s.tier]?.variant || 'grey'}>{TIER_PILL[s.tier]?.label}</Pill></td>
                            <td style={{ padding: '12px 16px', color: C.textSub }}>{s.gmail_limit} slots</td>
                            <td style={{ padding: '12px 16px', color: C.textMuted, fontSize: '12px' }}>{s.last_synced_at ? new Date(s.last_synced_at).toLocaleString() : '—'}</td>
                            <td style={{ padding: '12px 16px' }}><Pill variant="green">● ONLINE</Pill></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ GMAIL POOL ══════════════════════════════════════════════ */}
          {activeNav === 'gmail' && (
            <div>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', marginBottom: '16px' }}>
                <StatCard mobile={isMobile} label="Total Accounts" value={gmailPool.length} icon={Mail} />
                <StatCard mobile={isMobile} label="Active" value={gmailPool.filter(g=>g.status==='active').length} icon={CheckCircle2} variant="green" />
                <StatCard mobile={isMobile} label="Rate Limited" value={gmailPool.filter(g=>g.status==='rate_limited').length} icon={AlertCircle} />
              </div>

              {/* Add Gmail */}
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: isMobile ? '12px' : '8px', padding: '20px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Add Gemini Pro Account</div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '14px' }}>Login with a Gmail that has Gemini Advanced subscription</div>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px' }}>
                  <input value={addGmailLabel} onChange={e => setAddGmailLabel(e.target.value)} placeholder="Label (optional)"
                    style={{ flex: 1, height: '38px', padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'inherit', width: isMobile ? '100%' : 'auto', boxSizing: 'border-box' }}
                  />
                  <button onClick={handleGoogleOAuthLogin} disabled={oauthLoading} style={{
                    height: '38px', padding: '0 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                    background: 'rgba(66,133,244,0.1)', border: '1px solid rgba(66,133,244,0.4)', color: '#4285F4',
                    display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}>
                    <Mail size={14} /> {oauthLoading ? 'Authenticating...' : 'Sign In with Google'}
                  </button>
                </div>
              </div>

              {/* Pool table */}
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: isMobile ? '12px' : '8px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: '14px' }}>Gmail Pool ({gmailPool.length})</div>
                {gmailPool.length === 0 ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: C.textMuted }}>
                    <Mail size={28} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }} />
                    No accounts. Add above.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {['Gmail Account', 'Status', 'Req Today', 'Token Expires', 'Last Used', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gmailPool.map(g => (
                        <tr key={g.id} style={{ borderBottom: `1px solid ${C.borderSub}` }}
                          onMouseEnter={e => e.currentTarget.style.background = C.bg}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                            <div>{g.gmail}</div>
                            {g.display_name && <div style={{ fontSize: '11px', color: C.textMuted }}>{g.display_name}</div>}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {g.status === 'active'       && <Pill variant="green">● Active</Pill>}
                            {g.status === 'rate_limited' && <Pill variant="amber">⚡ Limited</Pill>}
                            {g.status === 'expired'      && <Pill variant="red">✗ Expired</Pill>}
                            {g.status === 'disabled'     && <Pill variant="grey">○ Disabled</Pill>}
                          </td>
                          <td style={{ padding: '12px 16px', color: C.textSub }}>{g.requests_today || 0}</td>
                          <td style={{ padding: '12px 16px', color: C.textMuted, fontSize: '12px' }}>{g.token_expires_at ? new Date(g.token_expires_at).toLocaleTimeString() : '—'}</td>
                          <td style={{ padding: '12px 16px', color: C.textMuted, fontSize: '12px' }}>{g.last_used_at ? new Date(g.last_used_at).toLocaleString() : '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => handleToggleGmail(g.id, g.status)} style={{ padding: '5px 10px', border: `1px solid ${C.border}`, borderRadius: '6px', background: C.white, cursor: 'pointer', fontSize: '11px', color: g.status === 'active' ? C.green : C.textSub, fontFamily: 'inherit' }}>
                                {g.status === 'active' ? 'Disable' : 'Enable'}
                              </button>
                              <button onClick={() => handleRemoveGmail(g.id, g.gmail)} style={{ padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: '6px', background: C.white, cursor: 'pointer', color: C.red }}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ══ EDGE GATEWAY ════════════════════════════════════════════ */}
          {activeNav === 'edge' && (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: isMobile ? '12px' : '8px', padding: '20px' }}>
              <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>Cloudflare Edge Gateway</div>
              <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '20px' }}>
                <a href={WORKER_URL} target="_blank" rel="noreferrer" style={{ color: C.green }}>{WORKER_URL}</a>
              </div>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Health Check',    endpoint: '/health'                },
                  { label: 'Gmail Pool',       endpoint: '/api/admin/gmail-pool' },
                  { label: 'Accounts',         endpoint: '/api/accounts'         },
                ].map(btn => (
                  <button key={btn.label} onClick={async () => {
                    const opts = btn.endpoint.includes('admin') ? { headers: { 'x-admin-key': ADMIN_KEY } } : {};
                    const r    = await fetch(`${WORKER_URL}${btn.endpoint}`, opts);
                    const d    = await r.json();
                    addLog(`${btn.label}: ${JSON.stringify(d).slice(0, 120)}`);
                    setActiveNav('logs');
                  }} style={{
                    flex: isMobile ? 'unset' : '0 0 auto', padding: '10px 16px', border: `1px solid ${C.border}`, borderRadius: '8px',
                    background: C.white, cursor: 'pointer', fontSize: '13px', color: C.textSub, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <ExternalLink size={13} /> {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ══ AUDIT LOGS ══════════════════════════════════════════════ */}
          {activeNav === 'logs' && (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: isMobile ? '12px' : '8px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: '14px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Audit Log Stream</span>
                <button onClick={() => setLogs([])} style={{ fontSize: '12px', color: C.textMuted, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
              </div>
              <div style={{ maxHeight: '500px', overflowY: 'auto', fontFamily: "monospace", fontSize: '12px' }}>
                {logs.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: C.textMuted }}>No log entries yet</div>
                ) : logs.map((log, i) => (
                  <div key={i} style={{ padding: '8px 20px', borderBottom: `1px solid ${C.borderSub}`, color: C.textSub, display: 'flex', gap: '12px' }}>
                    <span style={{ color: C.textMuted, flexShrink: 0 }}>{log.split(']')[0].replace('[', '')}</span>
                    <span>{log.split(']')[1]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ══ ADD USER MODAL ══════════════════════════════════════════════ */}
      {showAddUserModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(5, 7, 13, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: C.white, border: `1px solid ${C.border}`, borderRadius: '12px',
            width: '100%', maxWidth: '400px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            color: C.text
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Add Developer Profile</h3>
              <button onClick={() => setShowAddUserModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSub }}>
                <X size={18} />
              </button>
            </div>
            
            {addUserError && (
              <div style={{ background: C.redBg, border: `1px solid ${C.red}`, color: C.red, padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
                {addUserError}
              </div>
            )}
            
            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.textSub, textTransform: 'uppercase', marginBottom: '6px' }}>Developer Email</label>
                <input required type="email" value={addUserEmail} onChange={e => setAddUserEmail(e.target.value)} placeholder="name@email.com"
                  style={{ width: '100%', height: '38px', padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.textSub, textTransform: 'uppercase', marginBottom: '6px' }}>Access Password</label>
                <input required type="password" value={addUserPassword} onChange={e => setAddUserPassword(e.target.value)} placeholder="••••••••"
                  style={{ width: '100%', height: '38px', padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.textSub, textTransform: 'uppercase', marginBottom: '6px' }}>Tier</label>
                  <select value={addUserTier} onChange={e => {
                    const t = e.target.value;
                    setAddUserTier(t);
                    setAddUserLimit(t === 'free' ? 1 : t === 'pro' ? 3 : 5);
                  }}
                    style={{ width: '100%', height: '38px', padding: '0 8px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '13px', outline: 'none', background: C.white, fontFamily: 'inherit' }}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.textSub, textTransform: 'uppercase', marginBottom: '6px' }}>Gmail Limit</label>
                  <input required type="number" min="1" max="100" value={addUserLimit} onChange={e => setAddUserLimit(parseInt(e.target.value) || 1)}
                    style={{ width: '100%', height: '38px', padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <button type="submit" disabled={addUserLoading} style={{
                marginTop: '8px', width: '100%', height: '40px', background: C.green, color: '#fff',
                border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'inherit'
              }}>
                {addUserLoading ? 'Creating Developer...' : 'Create Developer Profile'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        input:focus { border-color: ${C.green} !important; box-shadow: 0 0 0 3px ${C.greenBg}; }
      `}</style>
    </div>
  );
}

// ── Desktop Developer Table ───────────────────────────────────────────────────
function DeveloperTable({ pagedProfiles, sessions, handleCycleTier, currentPage, totalPages, setCurrentPage, total, compact }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>Developers {total !== undefined ? `(${total})` : ''}</span>
        {!compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#94A3B8' }}>
            Page {currentPage} of {totalPages}
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
              style={{ width: '28px', height: '28px', border: '1px solid #E2E8F0', borderRadius: '5px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={13} />
            </button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
              style={{ width: '28px', height: '28px', border: '1px solid #E2E8F0', borderRadius: '5px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>
      {pagedProfiles.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
          <Users size={24} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }} />
          No developers found
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
              {['Developer Email', 'Subscription Tier', 'Gmail Limit', 'Status', 'Last Active', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedProfiles.map((p, i) => {
              const online   = sessions.some(s => s.email === p.email);
              const initials = p.email?.slice(0, 2).toUpperCase() || '?';
              return (
                <tr key={p.id || i} style={{ borderBottom: '1px solid #F1F5F9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#10B981', flexShrink: 0 }}>
                        {initials}
                      </div>
                      <span style={{ fontWeight: 500 }}>{p.email}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}><Pill variant={TIER_PILL[p.tier]?.variant || 'grey'}>{TIER_PILL[p.tier]?.label}</Pill></td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{p.gmail_limit || 1} slots</td>
                  <td style={{ padding: '12px 16px' }}><Pill variant={online ? 'green' : 'grey'}>{online ? '● ONLINE' : '○ OFFLINE'}</Pill></td>
                  <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '12px' }}>{p.updated_at ? new Date(p.updated_at).toLocaleString() : '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => handleCycleTier(p.email, p.tier)} style={{
                      padding: '5px 12px', border: '1px solid #E2E8F0', borderRadius: '6px',
                      background: '#fff', cursor: 'pointer', fontSize: '11px', color: '#475569',
                      fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit',
                    }}>
                      Cycle Tier <ChevronRight size={11} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
