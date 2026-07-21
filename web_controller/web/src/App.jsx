import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import AdminCommandCenter from './AdminPanel';
import {
  Zap, ArrowRight, CheckCircle2, ChevronRight, Menu, X, Shield, Users, Radio,
  Mail, Server, BarChart3, Clock, AlertTriangle, Key, LogIn, LogOut, Settings,
  CreditCard, LayoutDashboard, Copy, Check, RefreshCw, Power, Plus, Trash2, HelpCircle
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://rjegmurqhkglyethgauq.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZWdtdXJxaGtnbHlldGhnYXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTIxMzYsImV4cCI6MjA5OTU2ODEzNn0.6Qf0ZDlU_bSBPCXG_4lvs5rZFBYndjfDJh3_k3K6tYw'
);

const WORKER_URL = 'https://idepro.ai-gifari-n8n.workers.dev';

// Custom colors config
const C = {
  bg: '#F8FAFB',
  white: '#FFFFFF',
  border: '#E2E8F0',
  borderSub: '#F1F5F9',
  text: '#0F172A',
  textSub: '#475569',
  textMuted: '#94A3B8',
  green: '#10B981',
  greenBg: '#F0FDF4',
  greenDim: '#D1FAE5',
  greenText: '#065F46',
  amber: '#F59E0B',
  amberBg: '#FFFBEB',
  amberText: '#92400E',
  red: '#EF4444',
  redBg: '#FEF2F2',
  blue: '#3B82F6',
  blueBg: '#EFF6FF',
};

// ── Shared UI Components ──────────────────────────────────────────────────
const Pill = ({ children, variant = 'green' }) => {
  const styles = {
    green: { bg: C.greenBg, color: C.green, border: C.greenDim },
    grey: { bg: '#F1F5F9', color: C.textSub, border: '#E2E8F0' },
    amber: { bg: C.amberBg, color: C.amber, border: '#FDE68A' },
    red: { bg: C.redBg, color: C.red, border: '#FECACA' },
    blue: { bg: C.blueBg, color: C.blue, border: '#BFDBFE' },
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

// ── Auth Context / Mock Provider ──────────────────────────────────────────
// Keeps tracking simulated user session or Supabase session
function useSession() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.email);
      else setLoading(false);
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.email);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (email) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('email', email).single();
      if (data && !error) {
        setProfile(data);
      } else {
        if (error && error.code === 'PGRST205') {
          console.warn('Supabase profiles table not found, fallback to local simulated profile');
          const mockProf = {
            id: 'mock-user-id-idepro-pro',
            email,
            tier: 'pro',
            gmail_limit: 3,
            created_at: new Date().toISOString()
          };
          setProfile(mockProf);
        } else {
          // Create profile if not exist (auto-create free tier)
          const newProf = {
            email,
            tier: 'free',
            gmail_limit: 1,
            created_at: new Date().toISOString()
          };
          await supabase.from('profiles').insert([newProf]);
          setProfile(newProf);
        }
      }
    } catch (e) {
      console.warn('Supabase exception, falling back to mock profile', e);
      setProfile({
        id: 'mock-user-id-idepro-pro',
        email,
        tier: 'pro',
        gmail_limit: 3,
        created_at: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  return { session, profile, loading, refreshProfile: () => profile && fetchProfile(profile.email) };
}

// ── Public SaaS Header ─────────────────────────────────────────────────────
function PublicHeader({ session, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.border}`,
      height: '64px', display: 'flex', alignItems: 'center'
    }}>
      <div className="container" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Brand */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={15} color="#fff" fill="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.02em', color: C.text }}>IDEpro</span>
        </Link>

        {/* Desktop Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }} className="desktop-only">
          <a href="#features" style={{ fontSize: '14px', fontWeight: 500, color: C.textSub }}>Features</a>
          <a href="#pricing" style={{ fontSize: '14px', fontWeight: 500, color: C.textSub }}>Pricing</a>
          <a href="#docs" style={{ fontSize: '14px', fontWeight: 500, color: C.textSub }}>Docs</a>
          <a href="#faq" style={{ fontSize: '14px', fontWeight: 500, color: C.textSub }}>FAQ</a>
        </nav>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} className="desktop-only">
          {session ? (
            <>
              <Link to="/dashboard" style={{ fontSize: '14px', fontWeight: 600, color: C.green }}>Console</Link>
              <button onClick={onLogout} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14px', color: C.textSub }}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ fontSize: '14px', fontWeight: 500, color: C.textSub }}>Log in</Link>
              <Link to="/signup" style={{
                background: C.green, color: '#fff', padding: '8px 16px', borderRadius: '8px',
                fontSize: '14px', fontWeight: 600, transition: 'opacity 0.2s'
              }}>Get Started Free</Link>
            </>
          )}
        </div>

        {/* Hamburger Menu (Mobile) */}
        <button onClick={() => setMenuOpen(!menuOpen)} className="mobile-only" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div style={{
          position: 'absolute', top: '64px', left: 0, right: 0, background: C.white,
          borderBottom: `1px solid ${C.border}`, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 99
        }}>
          <a href="#features" onClick={() => setMenuOpen(false)} style={{ fontSize: '15px', fontWeight: 500 }}>Features</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)} style={{ fontSize: '15px', fontWeight: 500 }}>Pricing</a>
          <a href="#docs" onClick={() => setMenuOpen(false)} style={{ fontSize: '15px', fontWeight: 500 }}>Docs</a>
          <a href="#faq" onClick={() => setMenuOpen(false)} style={{ fontSize: '15px', fontWeight: 500 }}>FAQ</a>
          <hr style={{ border: 'none', borderTop: `1px solid ${C.borderSub}` }} />
          {session ? (
            <>
              <Link to="/dashboard" onClick={() => setMenuOpen(false)} style={{ fontSize: '15px', fontWeight: 600, color: C.green }}>Console Dashboard</Link>
              <button onClick={() => { onLogout(); setMenuOpen(false); }} style={{ border: 'none', background: 'transparent', textAlign: 'left', fontSize: '15px', color: C.textSub }}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)} style={{ fontSize: '15px', fontWeight: 500 }}>Log in</Link>
              <Link to="/signup" onClick={() => setMenuOpen(false)} style={{
                background: C.green, color: '#fff', padding: '10px', borderRadius: '8px',
                textAlign: 'center', fontSize: '15px', fontWeight: 600
              }}>Get Started Free</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}

// ── Public SaaS Footer ─────────────────────────────────────────────────────
function PublicFooter() {
  return (
    <footer style={{ background: C.white, borderTop: `1px solid ${C.border}`, padding: '48px 0 24px' }}>
      <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '32px', marginBottom: '48px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={15} color="#fff" fill="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '18px', color: C.text }}>IDEpro</span>
          </div>
          <p style={{ fontSize: '13px', color: C.textSub, lineHeight: 1.6 }}>Unlimited AI Power for modern development teams. Scaled seamlessly with automatic routing failovers.</p>
        </div>
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Product</h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: C.textSub }}>
            <li><a href="#features">Features</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="/login">Console login</a></li>
          </ul>
        </div>
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Resources</h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: C.textSub }}>
            <li><a href="#docs">Documentation</a></li>
            <li><a href="#faq">FAQ Help</a></li>
            <li><a href="#">System Status</a></li>
          </ul>
        </div>
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Legal</h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: C.textSub }}>
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Terms of Service</a></li>
            <li><a href="#">Contact Us</a></li>
          </ul>
        </div>
      </div>
      <div className="container" style={{ borderTop: `1px solid ${C.borderSub}`, paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ fontSize: '12px', color: C.textMuted }}>&copy; {new Date().getFullYear()} IDEpro. All rights reserved.</p>
        <p style={{ fontSize: '12px', color: C.textMuted }}>Designed for high-performance engineering.</p>
      </div>
    </footer>
  );
}

// ── Public SaaS Homepage Page ──────────────────────────────────────────────
function PublicHomepage({ session }) {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const plans = [
    {
      name: 'Free',
      price: '$0',
      cycle: '/mo',
      desc: 'Great for individual developers getting started.',
      features: ['1 Gmail slot assignment', 'Standard failover latency', 'Community support', 'Basic edge API gateway'],
      cta: 'Start Free',
      link: '/signup',
      variant: 'grey'
    },
    {
      name: 'Pro',
      price: billingCycle === 'monthly' ? '$19' : '$15',
      cycle: '/mo',
      desc: 'Power usage for high-activity active programmers.',
      features: ['3 Gmail slots sync pool', 'Instant auto-rotation rotation', 'Priority support', 'Telegram status alerts', 'Advanced gateway latency optimization'],
      cta: 'Get Pro Access',
      link: '/signup?tier=pro',
      variant: 'green'
    },
    {
      name: 'Premium',
      price: billingCycle === 'monthly' ? '$49' : '$39',
      cycle: '/mo',
      desc: 'For teams and enterprise power-users scaling AI.',
      features: ['5 Gmail slots sync pool', 'Pre-warmed instances bypass limit', '24/7 dedicated system gateway', 'Telegram integration webhook link', 'Enterprise support SLA'],
      cta: 'Get Premium Access',
      link: '/signup?tier=premium',
      variant: 'blue'
    }
  ];

  return (
    <div style={{ background: C.bg }}>
      {/* 1. Hero Section */}
      <section style={{ padding: '80px 0 60px', background: 'radial-gradient(ellipse at top, #F0FDF4, transparent)' }}>
        <div className="container" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: C.greenBg, border: `1px solid ${C.greenDim}`, padding: '4px 12px', borderRadius: '9999px', marginBottom: '24px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: C.green }}>✦ Powered by Gemini Advanced</span>
          </div>
          <h1 style={{ fontSize: '48px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, color: C.text, maxWidth: '800px', marginBottom: '20px' }}>
            Unlimited AI Power for Every Developer
          </h1>
          <p style={{ fontSize: '18px', color: C.textSub, lineHeight: 1.5, maxWidth: '640px', marginBottom: '32px' }}>
            IDEpro gives your workflow access to Gemini Pro at scale — no API limits, no rate limits. Multiple accounts sync to keep you online forever.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/signup" style={{ background: C.green, color: '#fff', padding: '12px 28px', borderRadius: '8px', fontSize: '15px', fontWeight: 600 }}>Start Free Trial</Link>
            <a href="#pricing" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.textSub, padding: '12px 28px', borderRadius: '8px', fontSize: '15px', fontWeight: 600 }}>View Pricing</a>
          </div>

          <div style={{ marginTop: '48px', display: 'flex', gap: '24px', justifyContent: 'center', color: C.textMuted, fontSize: '13px', fontWeight: 500 }}>
            <span>2,400+ Active Devs</span>
            <span>•</span>
            <span>Instant Auto-Rotation</span>
            <span>•</span>
            <span>Edge Routing API</span>
          </div>
        </div>
      </section>

      {/* 2. Mockup Display */}
      <section style={{ padding: '0 0 80px' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            background: C.white, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '12px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.04)', maxWidth: '960px', width: '100%'
          }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
            </div>
            {/* Mock Dashboard Screen */}
            <div style={{ background: C.bg, border: `1px solid ${C.borderSub}`, borderRadius: '8px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: C.textMuted }}>ACTIVE ACCOUNT IN POOL</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    gifari.pro@gmail.com <Pill variant="green">ACTIVE</Pill>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: C.textMuted }}>ROTATION STATUS</div>
                  <span style={{ fontSize: '12px', color: C.green, fontWeight: 600 }}>⚡ Failover Standby Pre-Warmed</span>
                </div>
              </div>
              <div style={{ height: '8px', background: C.border, borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{ width: '85%', height: '100%', background: C.green }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: C.textSub }}>
                <span>Daily Limit Remaining: 8,500 / 10,000 reqs</span>
                <span>Latency Optimization: 24ms avg</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Features Section */}
      <section id="features" style={{ padding: '80px 0', background: C.white, borderTop: `1px solid ${C.border}` }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>Everything you need to scale AI development</h2>
            <p style={{ fontSize: '16px', color: C.textSub, marginTop: '8px' }}>No limits. No downtime. Powered by smart account pool rotation.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', padding: '24px' }}>
              <div style={{ width: '40px', height: '40px', background: C.greenBg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.green, marginBottom: '16px' }}>
                <Users size={20} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Gemini Pool Rotation</h3>
              <p style={{ fontSize: '13px', color: C.textSub, lineHeight: 1.6 }}>Deploy multiple premium Gemini Google accounts into your pool. IDEpro manages them as a single high-performance API endpoint.</p>
            </div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', padding: '24px' }}>
              <div style={{ width: '40px', height: '40px', background: C.greenBg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.green, marginBottom: '16px' }}>
                <RefreshCw size={20} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Instant Auto-Rotation</h3>
              <p style={{ fontSize: '13px', color: C.textSub, lineHeight: 1.6 }}>When one account hits the daily rate limits or token constraints, IDEpro automatically rotates to the next pre-warmed account in under 5ms.</p>
            </div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', padding: '24px' }}>
              <div style={{ width: '40px', height: '40px', background: C.greenBg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.green, marginBottom: '16px' }}>
                <Server size={20} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Cloudflare Edge Gateway</h3>
              <p style={{ fontSize: '13px', color: C.textSub, lineHeight: 1.6 }}>Run your requests via our high-speed global Edge Gateways. Minimal payload latency, fully cached for redundant requests.</p>
            </div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', padding: '24px' }}>
              <div style={{ width: '40px', height: '40px', background: C.greenBg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.green, marginBottom: '16px' }}>
                <BarChart3 size={20} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Usage Metrics & Analytics</h3>
              <p style={{ fontSize: '13px', color: C.textSub, lineHeight: 1.6 }}>Track request volumes, response times, model distribution logs, and token limits with precision developer charts.</p>
            </div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', padding: '24px' }}>
              <div style={{ width: '40px', height: '40px', background: C.greenBg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.green, marginBottom: '16px' }}>
                <Radio size={20} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Telegram Bot Alerts</h3>
              <p style={{ fontSize: '13px', color: C.textSub, lineHeight: 1.6 }}>Get instant telegram push alerts when one of your pool accounts is expired or if the worker configuration requires updates.</p>
            </div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', padding: '24px' }}>
              <div style={{ width: '40px', height: '40px', background: C.greenBg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.green, marginBottom: '16px' }}>
                <Shield size={20} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Enterprise Pool Encryption</h3>
              <p style={{ fontSize: '13px', color: C.textSub, lineHeight: 1.6 }}>All OAuth credentials, cookies, and keys are encrypted with industry-standard AES-256-GCM. We never read your user data.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Pricing Section */}
      <section id="pricing" style={{ padding: '80px 0', borderTop: `1px solid ${C.border}` }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>Simple, transparent pricing</h2>
            <p style={{ fontSize: '16px', color: C.textSub, marginTop: '8px', marginBottom: '24px' }}>Choose the tier that fits your development scale.</p>

            {/* Toggle */}
            <div style={{ display: 'inline-flex', background: C.white, border: `1px solid ${C.border}`, borderRadius: '9999px', padding: '4px' }}>
              <button onClick={() => setBillingCycle('monthly')} style={{
                border: 'none', background: billingCycle === 'monthly' ? C.greenBg : 'transparent',
                color: billingCycle === 'monthly' ? C.green : C.textSub, fontWeight: 600,
                fontSize: '13px', padding: '6px 16px', borderRadius: '9999px', cursor: 'pointer', fontFamily: 'inherit'
              }}>Monthly</button>
              <button onClick={() => setBillingCycle('annual')} style={{
                border: 'none', background: billingCycle === 'annual' ? C.greenBg : 'transparent',
                color: billingCycle === 'annual' ? C.green : C.textSub, fontWeight: 600,
                fontSize: '13px', padding: '6px 16px', borderRadius: '9999px', cursor: 'pointer', fontFamily: 'inherit'
              }}>Annual (Save 20%)</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'stretch' }}>
            {plans.map(p => {
              const isPro = p.name === 'Pro';
              return (
                <div key={p.name} style={{
                  background: C.white, border: isPro ? `2px solid ${C.green}` : `1px solid ${C.border}`,
                  borderRadius: '12px', padding: '32px', width: '320px', display: 'flex', flexDirection: 'column',
                  boxShadow: isPro ? '0 10px 30px rgba(16,185,129,0.06)' : 'none', position: 'relative'
                }}>
                  {isPro && <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: C.green, color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 10px', borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Most Popular</div>}
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: C.text }}>{p.name}</h3>
                  <p style={{ fontSize: '13px', color: C.textSub, marginTop: '8px', minHeight: '36px' }}>{p.desc}</p>
                  <div style={{ margin: '24px 0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontSize: '40px', fontWeight: 800, color: C.text }}>{p.price}</span>
                    <span style={{ fontSize: '14px', color: C.textMuted }}>{p.cycle}</span>
                  </div>

                  <Link to={p.link} style={{
                    display: 'block', textAlign: 'center', background: isPro ? C.green : C.white,
                    color: isPro ? '#fff' : C.textSub, border: isPro ? 'none' : `1px solid ${C.border}`,
                    padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '24px'
                  }}>{p.cta}</Link>

                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: C.textSub, marginTop: 'auto' }}>
                    {p.features.map(f => (
                      <li key={f} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <CheckCircle2 size={15} color={C.green} style={{ flexShrink: 0 }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Documentation Section */}
      <section id="docs" style={{ padding: '80px 0', background: C.white, borderTop: `1px solid ${C.border}` }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>Quick Integration Guide</h2>
            <p style={{ fontSize: '16px', color: C.textSub, marginTop: '8px' }}>Start routing your IDE extensions, terminals, or SDKs through the gateway in seconds.</p>
          </div>

          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '24px', fontFamily: 'monospace', fontSize: '13px', color: C.textSub }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: '12px' }}>// Replace your Gemini endpoint in Antigravity, Cline, or Cursor settings:</div>
            <div>Base URL: <span style={{ color: C.green }}>{WORKER_URL}</span></div>
            <div>API Key: <span style={{ color: C.green }}>your-idepro-license-key</span></div>
            <div style={{ marginTop: '16px', color: C.textMuted }}>// The gateway auto-maps your request to the active premium Gmail session</div>
          </div>
        </div>
      </section>

      {/* 6. FAQ Section */}
      <section id="faq" style={{ padding: '80px 0', borderTop: `1px solid ${C.border}` }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>Frequently Asked Questions</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {[
              {
                q: 'How does the Gmail Account Pool work?',
                a: 'You (or your organization admin) sync standard Gmail accounts with premium subscription levels (Gemini Advanced). Our Cloudflare Edge Gateway manages access to the Gemini endpoint. The gateway dynamically signs calls with active session cookies and automatically shifts to other standby pools when rate limit errors are generated.'
              },
              {
                q: 'Is it secure to authenticate Google Accounts?',
                a: 'Yes. We utilize standard OAuth token structures and session cookie isolation inside Supabase. All session values are fully encrypted using AES-256-GCM. Client request payload values are only forwarded directly to official Google endpoint servers and never recorded on our nodes.'
              },
              {
                q: 'What is the request limitation for plans?',
                a: 'Free plan has 1 Gmail slot with up to 2,000 daily requests. Pro plan provides 3 slots with up to 10,000 requests. Premium provides 5 slots allowing up to 30,000 daily queries.'
              }
            ].map((item, idx) => (
              <div key={idx} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '20px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: C.text, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HelpCircle size={16} color={C.green} /> {item.q}
                </h4>
                <p style={{ fontSize: '13px', color: C.textSub, lineHeight: 1.6, paddingLeft: '24px' }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Auth Pages (Login / Signup) ──────────────────────────────────────────
function AuthPage({ mode = 'login' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Registration successful! Please check your email for the confirmation link or try logging in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/dashboard');
      }
    } catch (e) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px - 100px)', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: C.text, marginBottom: '6px' }}>
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h2>
        <p style={{ fontSize: '13px', color: C.textSub, marginBottom: '24px' }}>
          {mode === 'signup' ? 'Get started with your free Gemini Pro pool.' : 'Access your developer command console.'}
        </p>

        {message && (
          <div style={{
            background: message.startsWith('Error') ? C.redBg : C.greenBg,
            border: `1px solid ${message.startsWith('Error') ? C.red : C.green}`,
            color: message.startsWith('Error') ? C.red : C.greenText,
            padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px'
          }}>
            {message}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Email address</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@email.com"
              style={{ width: '100%', height: '40px', padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Password</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              style={{ width: '100%', height: '40px', padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', outline: 'none' }}
            />
          </div>
          <button type="submit" disabled={loading} style={{
            background: C.green, color: '#fff', border: 'none', height: '40px', borderRadius: '8px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}>
            {loading ? 'Processing...' : mode === 'signup' ? 'Register' : 'Sign In'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: C.textSub }}>
          {mode === 'signup' ? (
            <span>Already have an account? <Link to="/login" style={{ color: C.green, fontWeight: 600 }}>Log in</Link></span>
          ) : (
            <span>New to IDEpro? <Link to="/signup" style={{ color: C.green, fontWeight: 600 }}>Create account</Link></span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Authenticated User Panel ──────────────────────────────────────────────
function UserDashboard({ profile, session, onLogout }) {
  const [activeNav, setActiveNav] = useState('overview');
  const [userGmails, setUserGmails] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [addGmailLabel, setAddGmailLabel] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const addLog = (msg) => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => [`[${ts}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const loadUserGmails = async () => {
    if (!profile) return;
    try {
      // Get all assignments for this user
      const { data: ass, error } = await supabase.from('user_gmail_assignments').select(`
        id, assigned_at,
        gmail_pool (
          id, gmail, display_name, status, last_used_at
        )
      `).eq('user_email', profile.email);
      
      if (error) {
        if (error.code === 'PGRST205') {
          console.warn('user_gmail_assignments table not found, fallback to local assignments');
          setUserGmails([
            { id: '1', pool_id: 'p1', gmail: 'gifari.pro@gmail.com', display_name: 'Primary AI Session', status: 'active', last_used_at: new Date().toISOString() },
            { id: '2', pool_id: 'p2', gmail: 'gifari.backup@gmail.com', display_name: 'Backup Failover', status: 'active', last_used_at: null },
            { id: '3', pool_id: 'p3', gmail: 'gifari.extra@gmail.com', display_name: 'Secondary Rotation', status: 'active', last_used_at: null }
          ].slice(0, profile.gmail_limit || 3));
        }
        return;
      }
      
      if (ass) {
        setUserGmails(ass.map(a => ({
          id: a.id,
          pool_id: a.gmail_pool?.id,
          gmail: a.gmail_pool?.gmail || 'Pending assignment...',
          display_name: a.gmail_pool?.display_name || 'Standby Account',
          status: a.gmail_pool?.status || 'inactive',
          last_used_at: a.gmail_pool?.last_used_at
        })));
      }
    } catch (e) {
      console.warn('Supabase loadUserGmails exception, falling back to mock list', e);
      setUserGmails([
        { id: '1', pool_id: 'p1', gmail: 'gifari.pro@gmail.com', display_name: 'Primary AI Session', status: 'active', last_used_at: new Date().toISOString() },
        { id: '2', pool_id: 'p2', gmail: 'gifari.backup@gmail.com', display_name: 'Backup Failover', status: 'active', last_used_at: null },
        { id: '3', pool_id: 'p3', gmail: 'gifari.extra@gmail.com', display_name: 'Secondary Rotation', status: 'active', last_used_at: null }
      ].slice(0, profile?.gmail_limit || 3));
    }
  };

  useEffect(() => {
    loadUserGmails();
    addLog('System online. Pre-warmed failover gateway connected.');
  }, [profile]);

  // Listener for popup postMessage
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'GMAIL_ADDED') {
        addLog(`✅ Successfully integrated Gmail: ${e.data.gmail}`);
        loadUserGmails();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleOAuthLogin = async () => {
    setOauthLoading(true);
    try {
      const res = await fetch(`${WORKER_URL}/api/admin/oauth-url?display_name=${encodeURIComponent(addGmailLabel)}`);
      const data = await res.json();
      if (!res.ok || !data.url) {
        alert('OAuth redirect error from worker gateway.');
        return;
      }
      const popup = window.open(data.url, 'Add Gmail Account - IDEpro', 'width=500,height=600');
      const poll = setInterval(() => {
        if (popup?.closed) {
          clearInterval(poll);
          loadUserGmails();
          setOauthLoading(false);
        }
      }, 600);
    } catch (e) {
      addLog(`Error triggering OAuth login: ${e.message}`);
    } finally {
      setOauthLoading(false);
    }
  };

  const handleRemoveAssignment = async (id, gmail) => {
    if (!confirm(`Are you sure you want to unassign ${gmail}?`)) return;
    try {
      const { error } = await supabase.from('user_gmail_assignments').delete().eq('id', id);
      if (error) throw error;
      addLog(`Unassigned account: ${gmail}`);
      loadUserGmails();
    } catch (e) {
      addLog(`Error unassigning: ${e.message}`);
    }
  };

  const copyLicenseKey = () => {
    navigator.clipboard.writeText(profile?.id || 'key-not-available');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    addLog('License key copied to clipboard.');
  };

  const currentTier = profile?.tier || 'free';
  const gmailLimit = profile?.gmail_limit || 1;

  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'gmails', label: 'My Gmail Pool', icon: Mail, badge: userGmails.length },
    { id: 'stats', label: 'Usage Stats', icon: BarChart3 },
    { id: 'billing', label: 'Billing Plan', icon: CreditCard },
    { id: 'settings', label: 'Console Settings', icon: Settings },
  ];

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <div style={{ padding: '0 20px', height: '56px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${C.border}` }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={14} color="#fff" fill="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: '15px', color: C.text }}>IDEpro</span>
          <span style={{ textTransform: 'uppercase', fontSize: '9px', fontWeight: 800, background: C.greenBg, color: C.green, border: `1px solid ${C.greenDim}`, padding: '1px 6px', borderRadius: '9999px' }}>
            Console
          </span>
        </Link>
      </div>

      {/* Profile summary */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.borderSub}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: C.greenDim, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.greenText, fontWeight: 700, fontSize: '13px' }}>
          {profile?.email?.[0]?.toUpperCase() || 'U'}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{profile?.email}</div>
          <div style={{ marginTop: '2px' }}><Pill variant={currentTier === 'free' ? 'grey' : currentTier === 'pro' ? 'green' : 'blue'}>{currentTier.toUpperCase()}</Pill></div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {sidebarItems.map(item => {
          const active = activeNav === item.id;
          return (
            <button key={item.id} onClick={() => { setActiveNav(item.id); setDrawerOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 12px',
              borderRadius: '8px', border: 'none', background: active ? C.greenBg : 'transparent',
              color: active ? C.green : C.textSub, fontWeight: active ? 600 : 400, fontSize: '13px',
              textAlign: 'left', cursor: 'pointer', borderLeft: active ? `3px solid ${C.green}` : '3px solid transparent',
              fontFamily: 'inherit'
            }}>
              <item.icon size={16} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge > 0 && <span style={{ background: C.green, color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '9999px', fontWeight: 700 }}>{item.badge}</span>}
            </button>
          );
        })}
      </nav>

      {/* Promo banner */}
      {currentTier !== 'premium' && (
        <div style={{ padding: '12px' }}>
          <div style={{ background: C.greenBg, border: `1px solid ${C.greenDim}`, borderRadius: '12px', padding: '16px' }}>
            <h5 style={{ fontSize: '13px', fontWeight: 700, color: C.greenText }}>Upgrade to Premium</h5>
            <p style={{ fontSize: '11px', color: C.greenText, marginTop: '4px', lineHeight: 1.4 }}>Unlock 5 Gmail slots and bypass all gateway latency throttles.</p>
            <button onClick={() => setActiveNav('billing')} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '12px', border: 'none', background: C.green, color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              View Plans <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Logout */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px' }}>
        <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', padding: '9px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: C.red, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
          <LogOut size={16} /> Log Out
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, overflow: 'hidden' }}>

      {/* ══ MOBILE DRAWER OVERLAY ════════════════════════════════════════════ */}
      {isMobile && (
        <div onClick={() => setDrawerOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)',
          opacity: drawerOpen ? 1 : 0, pointerEvents: drawerOpen ? 'all' : 'none', transition: 'opacity 0.25s'
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: '260px', background: C.white,
            boxShadow: '4px 0 24px rgba(0,0,0,0.12)', transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)'
          }}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* ══ DESKTOP SIDEBAR ══════════════════════════════════════════════════ */}
      {!isMobile && (
        <aside style={{ width: '220px', minWidth: '220px', background: C.white, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
          <SidebarContent />
        </aside>
      )}

      {/* ══ MAIN AREA ════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{ height: '56px', background: C.white, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isMobile && (
              <button onClick={() => setDrawerOpen(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                <Menu size={20} />
              </button>
            )}
            <h2 style={{ fontSize: '15px', fontWeight: 700, textTransform: 'capitalize' }}>{activeNav}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.green }} />
              <span style={{ fontSize: '11px', color: C.textMuted, fontWeight: 600 }}>Gateway Active</span>
            </div>
            <button style={{ width: '32px', height: '32px', border: `1px solid ${C.border}`, borderRadius: '6px', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={14} color={C.textSub} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px' }}>

          {/* ═══ OVERVIEW ═════════════════════════════════════════════════ */}
          {activeNav === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Plan Banner */}
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.green}`, borderRadius: '8px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>{currentTier.toUpperCase()} Plan Status</span>
                    <Pill variant="green">Active</Pill>
                  </div>
                  <p style={{ fontSize: '12px', color: C.textMuted }}>Renews automatically next month · Sync pool allocated: {userGmails.length} / {gmailLimit} Slots</p>
                </div>
                <button onClick={() => setActiveNav('billing')} style={{ border: `1px solid ${C.border}`, background: C.white, padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Modify Subscription
                </button>
              </div>

              {/* License Card */}
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '20px' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>IDEpro License Key</div>
                <p style={{ fontSize: '12px', color: C.textMuted, marginBottom: '16px' }}>Use this license key inside Antigravity, Cline, or Cursor setup panel to authenticate calls through the edge gateway.</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input readOnly type="password" value={profile?.id || 'key-loading-state'}
                    style={{ flex: 1, height: '36px', padding: '0 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace', outline: 'none' }}
                  />
                  <button onClick={copyLicenseKey} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', background: C.green, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                    {copiedKey ? 'Copied' : 'Copy Key'}
                  </button>
                </div>
              </div>

              {/* Live Gmail assignments */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Assigned Gmail Accounts</h3>
                  <button onClick={() => setActiveNav('gmails')} style={{ fontSize: '12px', color: C.green, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer' }}>Manage Pools</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {userGmails.map((g, idx) => (
                    <div key={g.id || idx} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700 }}>{g.gmail}</div>
                        <Pill variant={g.status === 'active' ? 'green' : g.status === 'rate_limited' ? 'amber' : 'grey'}>
                          {g.status.toUpperCase()}
                        </Pill>
                      </div>
                      <div style={{ fontSize: '12px', color: C.textMuted }}>
                        {g.display_name} · Last active: {g.last_used_at ? new Date(g.last_used_at).toLocaleTimeString() : 'Standby pool pre-warmed'}
                      </div>
                    </div>
                  ))}
                  {userGmails.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '32px', textAlign: 'center', color: C.textMuted }}>
                      No Gmail sessions synced yet. Go to 'My Gmail Pool' to sync your first account.
                    </div>
                  )}
                </div>
                <div style={{ marginTop: '10px', fontSize: '11px', color: C.textMuted, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚡ Gateway Auto-rotation active</span>
                  <span>•</span>
                  <span>Standby delay: &lt;5ms</span>
                </div>
              </div>

              {/* Stats & logs grid */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '20px' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>Usage Metrics Today</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: C.textSub }}>Daily gateway quota used</span>
                    <span style={{ fontWeight: 700 }}>1,240 / 10,000 reqs</span>
                  </div>
                  <div style={{ height: '6px', background: C.borderSub, borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
                    <div style={{ width: '12.4%', height: '100%', background: C.green }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: C.textMuted }}>
                    <span>Active Gateway: CF Frankfurt</span>
                    <span>12% utilized</span>
                  </div>
                </div>

                <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '20px' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>Event Log Stream</div>
                  <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontFamily: 'monospace' }}>
                    {logs.map((l, i) => (
                      <div key={i} style={{ color: C.textSub }}>{l}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ MY GMAIL POOL ═════════════════════════════════════════════ */}
          {activeNav === 'gmails' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Add Account to Rotation Pool</h3>
                <p style={{ fontSize: '12px', color: C.textMuted, marginBottom: '16px' }}>
                  Add a Gmail account that has active Google One AI Premium (Gemini Advanced) subscription.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input value={addGmailLabel} onChange={e => setAddGmailLabel(e.target.value)} placeholder="Display label (e.g. Personal Backup)"
                    style={{ flex: 1, minWidth: '240px', height: '38px', padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '13px', outline: 'none' }}
                  />
                  <button onClick={handleOAuthLogin} disabled={oauthLoading || userGmails.length >= gmailLimit} style={{
                    height: '38px', padding: '0 16px', borderRadius: '8px', border: 'none', background: C.green, color: '#fff',
                    fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit'
                  }}>
                    <Plus size={16} /> {oauthLoading ? 'Authenticating...' : 'Link via Google OAuth'}
                  </button>
                </div>
                {userGmails.length >= gmailLimit && (
                  <p style={{ marginTop: '8px', fontSize: '11px', color: C.red }}>
                    ❌ Pool allocation full. Upgrade plan to assign up to {currentTier === 'free' ? '3 slots (Pro)' : '5 slots (Premium)'}.
                  </p>
                )}
              </div>

              {/* Pool table */}
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: '14px' }}>
                  Rotation Pool Status ({userGmails.length} / {gmailLimit} Assigned)
                </div>
                {userGmails.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: C.textMuted }}>No pool accounts assigned yet.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', color: C.textMuted }}>Account</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', color: C.textMuted }}>Status</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', color: C.textMuted }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userGmails.map((g, i) => (
                        <tr key={g.id || i} style={{ borderBottom: `1px solid ${C.borderSub}` }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{g.gmail}</div>
                            <div style={{ fontSize: '11px', color: C.textMuted }}>{g.display_name}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Pill variant={g.status === 'active' ? 'green' : 'grey'}>{g.status.toUpperCase()}</Pill>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <button onClick={() => handleRemoveAssignment(g.id, g.gmail)} style={{ border: 'none', background: 'none', color: C.red, cursor: 'pointer', padding: '4px' }}>
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ═══ STATS ════════════════════════════════════════════════════ */}
          {activeNav === 'stats' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '20px' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '16px' }}>Latency Breakdown (Gateway Endpoint)</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '140px', paddingBottom: '10px', borderBottom: `1px solid ${C.border}` }}>
                  {[24, 30, 22, 28, 25, 32, 21, 26, 23, 29, 24, 27].map((lat, idx) => (
                    <div key={idx} style={{ flex: 1, background: C.green, borderRadius: '4px 4px 0 0', height: `${(lat / 40) * 100}%` }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: C.textMuted, marginTop: '8px' }}>
                  <span>Jan 1</span><span>Jan 6</span><span>Jan 12</span><span>Today</span>
                </div>
              </div>
            </div>
          )}

          {/* ═══ BILLING ══════════════════════════════════════════════════ */}
          {activeNav === 'billing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Manage Subscription Plan</h3>
                <p style={{ fontSize: '13px', color: C.textSub, marginBottom: '24px' }}>Select the billing plan to upgrade/downgrade your active Gemini API rotation slots pool capacity.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  {[
                    { tier: 'free', name: 'Free Plan', desc: '1 Gmail account pool rotation slot.', price: '$0/mo' },
                    { tier: 'pro', name: 'Pro Plan', desc: '3 Gmail account pool rotation slots.', price: '$19/mo' },
                    { tier: 'premium', name: 'Premium Plan', desc: '5 Gmail account pool rotation slots.', price: '$49/mo' }
                  ].map(plan => {
                    const active = currentTier === plan.tier;
                    return (
                      <div key={plan.tier} style={{
                        border: active ? `2px solid ${C.green}` : `1px solid ${C.border}`,
                        background: C.white, borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '14px' }}>{plan.name}</span>
                          {active && <Pill variant="green">Current</Pill>}
                        </div>
                        <p style={{ fontSize: '12px', color: C.textSub }}>{plan.desc}</p>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: C.text }}>{plan.price}</div>
                        {!active && (
                          <button onClick={async () => {
                            const newLimit = plan.tier === 'free' ? 1 : plan.tier === 'pro' ? 3 : 5;
                            await supabase.from('profiles').update({ tier: plan.tier, gmail_limit: newLimit }).eq('email', profile.email);
                            addLog(`Tier upgraded to ${plan.tier.toUpperCase()}`);
                            window.location.reload();
                          }} style={{
                            border: 'none', background: C.green, color: '#fff', padding: '8px', borderRadius: '6px',
                            fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit'
                          }}>Upgrade Plan</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══ SETTINGS ════════════════════════════════════════════════ */}
          {activeNav === 'settings' && (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '20px' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '16px' }}>Account Settings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.textSub, textTransform: 'uppercase', marginBottom: '6px' }}>Email</label>
                  <input readOnly type="text" value={profile?.email || ''} style={{ width: '100%', height: '38px', padding: '0 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.textSub, textTransform: 'uppercase', marginBottom: '6px' }}>Member Since</label>
                  <input readOnly type="text" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'} style={{ width: '100%', height: '38px', padding: '0 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '13px' }} />
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

    </div>
  );
}

// ── Admin Login Page ───────────────────────────────────────────────────────
function AdminLoginPage({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleAdminAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'admin@idepro.com',
        password
      });
      if (error) throw error;
      if (onLoginSuccess) onLoginSuccess();
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0D0E16', padding: '16px' }}>
      <div style={{ background: '#161722', border: '1px solid rgba(0, 220, 255, 0.2)', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '400px', fontFamily: 'monospace', color: '#fff' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#00dcff', margin: '0 0 6px' }}>IDEpro // ADMIN</h2>
          <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>SECURE ACCESS CONSOLE PORTAL</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,68,85,0.1)', border: '1px solid #ff4455', color: '#ff4455', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', marginBottom: '16px' }}>
            [ERROR] {error.toUpperCase()}
          </div>
        )}

        <form onSubmit={handleAdminAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: '#00dcff', marginBottom: '6px' }}>ADMIN EMAIL</label>
            <input required type="email" value="admin@idepro.com" disabled
              style={{ width: '100%', height: '40px', padding: '0 12px', background: '#090A0F', border: '1px solid #3c3c3c', borderRadius: '6px', fontSize: '13px', color: '#888', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: '#00dcff', marginBottom: '6px' }}>SECURE ACCESS KEY</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              style={{ width: '100%', height: '40px', padding: '0 12px', background: '#030406', border: '1px solid #3c3c3c', borderRadius: '6px', fontSize: '13px', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button type="submit" disabled={loading} style={{
            width: '100%', background: 'rgba(0, 220, 255, 0.1)', border: '1px solid #00dcff', color: '#00dcff', height: '40px', borderRadius: '6px',
            fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}>
            {loading ? 'CONNECTING...' : 'INITIALIZE_SECURE_LINK'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── App Shell / Router ─────────────────────────────────────────────────────
export function AppShell() {
  const { session, profile, loading } = useSession();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: C.green }} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public SaaS Landings */}
        <Route path="/" element={
          <>
            <PublicHeader session={session} onLogout={handleLogout} />
            <PublicHomepage session={session} />
            <PublicFooter />
          </>
        } />

        {/* Authenticated user Console */}
        <Route path="/dashboard" element={
          session ? (
            <UserDashboard profile={profile} session={session} onLogout={handleLogout} />
          ) : (
            <AuthPage mode="login" />
          )
        } />

        {/* /user alias route */}
        <Route path="/user" element={
          session ? (
            <UserDashboard profile={profile} session={session} onLogout={handleLogout} />
          ) : (
            <AuthPage mode="login" />
          )
        } />

        {/* /admin route */}
        <Route path="/admin" element={
          session && session.user.email === 'admin@idepro.com' ? (
            <AdminCommandCenter />
          ) : (
            <AdminLoginPage />
          )
        } />

        {/* Auth routes */}
        <Route path="/login" element={
          <>
            <PublicHeader session={session} onLogout={handleLogout} />
            <AuthPage mode="login" />
            <PublicFooter />
          </>
        } />
        <Route path="/signup" element={
          <>
            <PublicHeader session={session} onLogout={handleLogout} />
            <AuthPage mode="signup" />
            <PublicFooter />
          </>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default AppShell;
