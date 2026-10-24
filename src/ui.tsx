import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Search,
  Plus,
  ShieldCheck,
  MapPin,
  CalendarDays,
  ArrowRight,
  HeartHandshake,
  PackageSearch,
  CheckCircle2,
  AlertTriangle,
  X,
  Menu,
  RotateCcw,
  BookOpen,
  KeyRound,
  Smartphone,
  Filter,
  User,
  LogOut,
  Upload,
  Flag,
  Database,
  Cloud,
  Loader2,
  Phone,
} from 'lucide-react';
import {
  categories,
  findMatches,
  getTodayDateString,
  searchItems,
  validItemInput,
  validClaimInput,
  validAuthInput,
  validReportInput,
  type Item,
  type ItemType,
  type Claim,
  type ClaimStatus,
  type UserProfile,
} from './domain';
import { isFirebaseConfigured } from './lib/firebase';
import { authService } from './services/authService';
import { itemService } from './services/itemService';
import { claimService } from './services/claimService';
import { reportService } from './services/reportService';

const icons: Record<string, typeof PackageSearch> = {
  Electronics: Smartphone,
  'ID & Cards': ShieldCheck,
  'Books & Notes': BookOpen,
  Keys: KeyRound,
  Bags: PackageSearch,
};

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [formType, setFormType] = useState<ItemType>('lost');
  const [selected, setSelected] = useState<Item | null>(null);
  const [notice, setNotice] = useState('');
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  // Auth Modal State
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');

  // Claim Modal State
  const [claimTarget, setClaimTarget] = useState<Item | null>(null);
  const [claimDetails, setClaimDetails] = useState('');
  const [claimPhone, setClaimPhone] = useState('');

  // Flag / Abuse Report Modal State
  const [flagTarget, setFlagTarget] = useState<Item | null>(null);
  const [flagReason, setFlagReason] = useState('Contains personal/sensitive info');
  const [flagDetails, setFlagDetails] = useState('');

  // Form image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 1. Initial Data and Auth Loading
  useEffect(() => {
    let isMounted = true;

    async function init() {
      setLoading(true);
      const currentUser = await authService.getSessionUser();
      if (isMounted) setUser(currentUser);

      const itemsRes = await itemService.fetchItems();
      if (isMounted) {
        setItems(itemsRes.items);
        setLoading(false);
      }

      if (currentUser) {
        const claimsRes = await claimService.fetchClaims(currentUser.id);
        if (isMounted) setClaims(claimsRes.claims);
      }
    }

    init();

    // Listen to real-time auth changes
    const unsubAuth = authService.onAuthStateChange(async (updatedUser) => {
      if (isMounted) {
        setUser(updatedUser);
        if (updatedUser) {
          const claimsRes = await claimService.fetchClaims(updatedUser.id);
          if (isMounted) setClaims(claimsRes.claims);
        } else {
          setClaims([]);
        }
      }
    });

    // Real-time cross-device synchronization for items
    const unsubItems = itemService.subscribeToItems((liveItems) => {
      if (isMounted) {
        setItems(liveItems);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubAuth();
      unsubItems();
    };
  }, []);

  // 2. Escape Key to Dismiss Modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (authOpen) setAuthOpen(false);
        else if (flagTarget) setFlagTarget(null);
        else if (claimTarget) setClaimTarget(null);
        else if (selected) setSelected(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [authOpen, flagTarget, claimTarget, selected]);

  // 3. Clear Notice Banner After 4 Seconds
  useEffect(() => {
    if (notice) {
      const t = window.setTimeout(() => setNotice(''), 4000);
      return () => clearTimeout(t);
    }
  }, [notice]);

  const results = useMemo(
    () => searchItems(items, q, type, category, status),
    [items, q, type, category, status],
  );

  const go = (p: string) => {
    setPage(p);
    setMenu(false);
    setSelected(null);
    try {
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      /* ignore smooth scroll in headless tests */
    }
  };

  // Image Selection Handler
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setNotice('Selected image is too large. Choose an image under 5MB.');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function removeSelectedImage() {
    setImageFile(null);
    setImagePreview(null);
  }

  // Auth Submission Handler
  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthError('');

    const errors = validAuthInput(
      authEmail,
      authMode === 'reset' ? undefined : authPassword,
      authMode === 'signup' ? authName : undefined,
    );

    if (Object.keys(errors).length > 0) {
      setAuthError(Object.values(errors)[0]);
      return;
    }

    setBusy(true);

    if (authMode === 'signup') {
      const { user: newUser, error } = await authService.signUp(authEmail, authPassword, authName);
      setBusy(false);
      if (error) {
        setAuthError(error);
      } else {
        setUser(newUser);
        setAuthOpen(false);
        setNotice(`Account created! Welcome, ${newUser?.displayName || authName}.`);
      }
    } else if (authMode === 'signin') {
      const { user: signedInUser, error } = await authService.signIn(authEmail, authPassword);
      setBusy(false);
      if (error) {
        setAuthError(error);
      } else {
        setUser(signedInUser);
        setAuthOpen(false);
        setNotice(`Signed in as ${signedInUser?.displayName || authEmail}.`);
      }
    } else if (authMode === 'reset') {
      const { error } = await authService.resetPassword(authEmail);
      setBusy(false);
      if (error) {
        setAuthError(error);
      } else {
        setAuthOpen(false);
        setNotice('Password reset link sent to your email.');
      }
    }
  }

  async function handleGoogleSignIn() {
    setBusy(true);
    setAuthError('');
    const { user: signedInUser, error } = await authService.signInWithGoogle();
    setBusy(false);
    if (error) {
      setAuthError(error);
    } else if (signedInUser) {
      setUser(signedInUser);
      setAuthOpen(false);
      setNotice(`Signed in with Google as ${signedInUser.displayName || signedInUser.email}!`);
    }
  }

  async function handleSignOut() {
    await authService.signOut();
    setUser(null);
    setClaims([]);
    setNotice('Signed out successfully.');
  }

  // Item Submission Handler
  async function submitItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user) {
      setAuthOpen(true);
      setAuthMode('signin');
      setNotice('Please sign in or create an account to post a report.');
      return;
    }

    const fd = new FormData(e.currentTarget);
    const draft: Partial<Item> = {
      title: String(fd.get('title') || ''),
      type: formType,
      category: String(fd.get('category') || ''),
      description: String(fd.get('description') || ''),
      color: String(fd.get('color') || ''),
      location: String(fd.get('location') || ''),
      date: String(fd.get('date') || ''),
      time: String(fd.get('time') || ''),
      handover: fd.get('handover') === 'on',
    };

    const nextErrors = validItemInput(draft);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setBusy(true);

    const { item: createdItem, error } = await itemService.createItem(
      draft,
      imageFile,
      user.id,
      user.displayName || user.email.split('@')[0],
    );

    setBusy(false);

    if (error || !createdItem) {
      setNotice(error || 'Failed to submit report. Please try again.');
      return;
    }

    setItems((prev) => [createdItem, ...prev]);
    setImageFile(null);
    setImagePreview(null);
    setNotice('Report published successfully and synchronized with cloud database.');
    go('browse');
    setQ(createdItem.title);
    setType('all');
  }

  // Claim Submission Handler
  async function submitClaim(e: FormEvent) {
    e.preventDefault();

    if (!user) {
      setAuthOpen(true);
      setAuthMode('signin');
      setNotice('Please sign in to submit an ownership claim.');
      return;
    }

    if (!claimTarget) return;

    const errorMsg = validClaimInput(claimDetails);
    if (errorMsg) {
      setNotice(errorMsg);
      return;
    }

    setBusy(true);

    const { claim: newClaim, error } = await claimService.createClaim(
      claimTarget.id,
      claimDetails,
      user.id,
      user.displayName,
      claimPhone,
    );

    setBusy(false);

    if (error || !newClaim) {
      setNotice(error || 'Failed to submit claim.');
      return;
    }

    setClaims((prev) => [newClaim, ...prev]);
    setClaimDetails('');
    setClaimPhone('');
    setClaimTarget(null);
    setNotice('Ownership claim submitted securely. Only the finder and reviewers can inspect verification details.');
    go('claims');
  }

  async function changeClaim(id: string, s: ClaimStatus) {
    const { error } = await claimService.updateClaimStatus(id, s);
    if (!error) {
      setClaims((prev) => prev.map((c) => (c.id === id ? { ...c, status: s } : c)));
      setNotice(`Claim status updated to ${s}.`);
    } else {
      setNotice(error);
    }
  }

  async function closeItem(id: string) {
    const { error } = await itemService.updateItemStatus(id, 'Recovered');
    if (!error) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'Recovered' } : i)));
      setNotice('Item marked recovered in the database.');
      setSelected(null);
    } else {
      setNotice(error);
    }
  }

  // Abuse Report Submission Handler
  async function submitFlagReport(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      setAuthOpen(true);
      setNotice('Please sign in to flag a report.');
      return;
    }
    if (!flagTarget) return;

    const validation = validReportInput(flagReason, flagDetails);
    if (Object.keys(validation).length) {
      setNotice(Object.values(validation)[0]);
      return;
    }

    setBusy(true);
    const { error } = await reportService.submitReport(flagTarget.id, flagReason, user.id, flagDetails);
    setBusy(false);

    if (error) {
      setNotice(error);
    } else {
      setNotice('Report flagged for administrative review. Thank you for keeping campus safe.');
      setFlagTarget(null);
      setFlagDetails('');
    }
  }

  // Development Seeding Handlers
  async function handleSeedDevData() {
    setBusy(true);
    const seedUserId = user?.id || 'demo-admin-seed';
    const seedUserName = user?.displayName || 'Campus Admin';
    const res = await itemService.seedDevData(seedUserId, seedUserName);
    setBusy(false);
    if (res.error) {
      setNotice(res.error);
    } else {
      const refreshed = await itemService.fetchItems();
      setItems(refreshed.items);
      setNotice(`Seeded ${res.inserted} test records clearly labeled [DEMO / TEST DATA].`);
    }
  }

  async function handleCleanupDevData() {
    setBusy(true);
    const res = await itemService.cleanupDevData();
    setBusy(false);
    if (res.error) {
      setNotice(res.error);
    } else {
      const refreshed = await itemService.fetchItems();
      setItems(refreshed.items);
      setNotice('Cleaned up all test records. Real user reports remain untouched.');
    }
  }

  const matchesFor = selected ? findMatches(selected, items) : [];

  return (
    <div className="app-shell">
      {/* Dev Tools & Cloud Status Banner (Visible in Development Mode) */}
      {!import.meta.env.PROD && (
        <div className="dev-banner">
          <div className="cloud-indicator">
            <span className={`cloud-dot ${isFirebaseConfigured ? '' : 'cloud-off'}`} />
            {isFirebaseConfigured ? (
              <span>Google Cloud Firestore Connected (Live Cross-Device Sync)</span>
            ) : (
              <span>Database Disconnected</span>
            )}
          </div>
          <div className="dev-banner-actions">
            <button className="dev-btn" onClick={handleSeedDevData} disabled={busy} title="Insert clearly labeled test records">
              <Database size={11} /> Seed Test Data
            </button>
            <button className="dev-btn danger" onClick={handleCleanupDevData} disabled={busy} title="Delete ONLY test records">
              <RotateCcw size={11} /> Clean Up Test Data
            </button>
          </div>
        </div>
      )}

      {/* Topbar Navigation */}
      <header className="topbar">
        <button className="brand" onClick={() => go('home')} aria-label="CampusFind home">
          <span className="brand-icon">
            <HeartHandshake size={22} />
          </span>
          <span>
            Campus<span className="brand-accent">Find</span>
            <small>LOST & FOUND, TOGETHER</small>
          </span>
        </button>

        <button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label="Toggle navigation">
          <Menu />
        </button>

        <nav className={menu ? 'nav open' : 'nav'}>
          <button onClick={() => go('browse')}>Explore items</button>
          <button onClick={() => go('how')}>How it works</button>
          <button onClick={() => go('claims')}>
            My claims <span className="nav-count">{claims.length}</span>
          </button>
          <button
            className="nav-cta"
            onClick={() => {
              setFormType('lost');
              go('report');
            }}
          >
            <Plus size={16} /> Report an item
          </button>

          {/* User Authentication Menu */}
          <div className="user-menu">
            {user ? (
              <div className="user-pill" title={`Signed in as ${user.email}`}>
                <User size={13} />
                <span>{user.displayName || user.email.split('@')[0]}</span>
                <button
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  style={{ background: 'none', border: 0, padding: 0, display: 'grid', color: '#687e6b' }}
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button
                className="auth-nav-btn"
                onClick={() => {
                  setAuthMode('signin');
                  setAuthOpen(true);
                }}
              >
                Sign In
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* Notification Toast */}
      {notice && (
        <div role="status" className="toast">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Home Page */}
      {page === 'home' && (
        <>
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="live-dot" /> YOUR CAMPUS, CONNECTED
              </div>
              <h1>
                Lost something?
                <br />
                <em>Let’s bring it back.</em>
              </h1>
              <p className="hero-text">
                A verified, cloud-synced campus community platform. Report misplaced belongings, check explainable matches,
                and recover items safely through staffed campus desks.
              </p>
              <div className="hero-actions">
                <button
                  className="button primary"
                  onClick={() => {
                    setFormType('lost');
                    go('report');
                  }}
                >
                  <Search size={17} /> I lost something
                </button>
                <button
                  className="button secondary"
                  onClick={() => {
                    setFormType('found');
                    go('report');
                  }}
                >
                  <Plus size={17} /> I found something
                </button>
              </div>
              <div className="trust-line">
                <ShieldCheck size={17} /> Authenticated Ownership <span>·</span> Cloud Synchronized
              </div>
            </div>

            <div className="hero-art">
              <div className="art-orbit orbit-one" />
              <div className="art-orbit orbit-two" />
              <div className="art-card card-back">
                <div className="mini-lines" />
                <div className="mini-lines short" />
                <div className="card-dot" />
              </div>
              <div className="art-card card-front">
                <div className="card-top">
                  <span className="tiny-logo">
                    <HeartHandshake size={16} />
                  </span>
                  <span>FOUND IT!</span>
                </div>
                <div className="key-illustration">
                  <KeyRound size={65} strokeWidth={1.35} />
                </div>
                <div className="art-card-bottom">
                  <b>Keys, reunited.</b>
                  <small>Every little thing matters.</small>
                </div>
              </div>
              <div className="floating-tag tag-found">
                <CheckCircle2 size={16} /> Verified Reports
              </div>
              <div className="floating-tag tag-safe">
                <ShieldCheck size={17} />
                <span>
                  <b>Safe handover</b>
                  <small>Meet on campus</small>
                </span>
              </div>
              <div className="art-spark spark-a">✳</div>
              <div className="art-spark spark-b">✦</div>
            </div>
          </section>

          <section className="search-strip">
            <div className="search-intro">
              <span className="search-icon">
                <Search size={20} />
              </span>
              <div>
                <b>Start your search</b>
                <small>It might be closer than you think.</small>
              </div>
            </div>
            <form
              className="quick-search"
              onSubmit={(e) => {
                e.preventDefault();
                go('browse');
              }}
            >
              <Search size={19} />
              <input
                aria-label="Search items"
                placeholder="Try ‘blue notebook’ or ‘library’..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button className="button primary" type="submit">
                Search <ArrowRight size={16} />
              </button>
            </form>
          </section>

          <section className="section-wrap">
            <div className="section-heading">
              <div>
                <span className="eyebrow">A COMMUNITY THAT CARES</span>
                <h2>
                  Small things. <em>Big relief.</em>
                </h2>
                <p>Browse real-time listings submitted by fellow students and campus staff.</p>
              </div>
              <button className="text-link" onClick={() => go('browse')}>
                View all items <ArrowRight size={16} />
              </button>
            </div>
            <div className="item-grid">
              {loading ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
                  <Loader2 className="animate-spin" size={28} style={{ margin: 'auto', color: '#688e4c' }} />
                  <p style={{ fontSize: '12px', color: '#7a887b', marginTop: '10px' }}>Loading campus reports...</p>
                </div>
              ) : (
                items
                  .filter((i) => !['Closed', 'Recovered'].includes(i.status))
                  .slice(0, 3)
                  .map((item) => (
                    <ItemCard key={item.id} item={item} onOpen={() => setSelected(item)} />
                  ))
              )}
            </div>
          </section>

          <section className="steps-band">
            <div className="steps-title">
              <span className="eyebrow">IT’S SIMPLE</span>
              <h2>
                Three steps to
                <br />
                <em>reunited.</em>
              </h2>
            </div>
            <div className="step">
              <span className="step-num">01</span>
              <div className="step-icon">
                <Search />
              </div>
              <h3>Search or report</h3>
              <p>Look through reports or add a few helpful details about your item.</p>
            </div>
            <div className="step">
              <span className="step-num">02</span>
              <div className="step-icon">
                <HeartHandshake />
              </div>
              <h3>Spot a possible match</h3>
              <p>Compare details with transparent, explainable heuristic scores.</p>
            </div>
            <div className="step">
              <span className="step-num">03</span>
              <div className="step-icon">
                <CheckCircle2 />
              </div>
              <h3>Meet & reunite</h3>
              <p>Verify ownership privately and arrange a safe campus handover.</p>
            </div>
          </section>
        </>
      )}

      {/* Browse Page */}
      {page === 'browse' && (
        <main className="page-wrap">
          <PageIntro
            eyebrow="THE CAMPUS BOARD"
            title="Find your missing piece."
            subtitle="Search reports, narrow the list, and check possible matches."
          />

          <div className="filters-panel">
            <div className="big-search">
              <Search />
              <input
                placeholder="Search title, color, description or place"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search reports"
              />
            </div>
            <div className="filter-row">
              <label>
                <span>
                  <Filter size={14} /> Report type
                </span>
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="all">Lost & found</option>
                  <option value="lost">Lost items</option>
                  <option value="found">Found items</option>
                </select>
              </label>
              <label>
                <span>Category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="all">All statuses</option>
                  {['Open', 'Possible Match', 'Claim Pending', 'Recovered', 'Closed'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <button
                className="clear-btn"
                onClick={() => {
                  setQ('');
                  setType('all');
                  setCategory('all');
                  setStatus('all');
                }}
              >
                <RotateCcw size={14} /> Clear filters
              </button>
            </div>
          </div>

          <div className="results-heading">
            <span>
              <b>{results.length}</b> {results.length === 1 ? 'report' : 'reports'} found
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="button primary compact" onClick={() => go('report')}>
                <Plus size={16} /> Add a report
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <Loader2 className="animate-spin" size={32} style={{ margin: 'auto', color: '#688e4c' }} />
              <p style={{ fontSize: '13px', color: '#7a887b', marginTop: '12px' }}>Loading reports...</p>
            </div>
          ) : results.length ? (
            <div className="item-grid">
              {results.map((item) => (
                <ItemCard key={item.id} item={item} onOpen={() => setSelected(item)} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <PackageSearch size={38} />
              <h3>No reports found just yet</h3>
              <p>Try a different search or clear your filters.</p>
              <button
                className="button secondary"
                onClick={() => {
                  setQ('');
                  setType('all');
                  setCategory('all');
                  setStatus('all');
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </main>
      )}

      {/* Report Form Page */}
      {page === 'report' && (
        <main className="page-wrap narrow">
          <button className="back-link" onClick={() => go('browse')}>
            ← Back to reports
          </button>
          <PageIntro
            eyebrow="HELP YOUR COMMUNITY"
            title={formType === 'lost' ? 'Report a lost item.' : 'Report a found item.'}
            subtitle="Share useful visible features. Never include full ID numbers or financial details publicly."
          />

          {!user && (
            <div className="privacy-note" style={{ background: '#fcf6ec', borderColor: '#f4dec1', color: '#97641c' }}>
              <ShieldCheck size={18} />
              <p>
                <b>Authentication Required:</b> You must be signed in to create listings so ownership and updates can be
                verified securely.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setAuthOpen(true);
                  }}
                  style={{ background: 'none', border: 0, color: '#476f33', fontWeight: 700, textDecoration: 'underline' }}
                >
                  Sign in or create an account
                </button>
              </p>
            </div>
          )}

          <div className="type-switch">
            <button className={formType === 'lost' ? 'selected' : ''} onClick={() => setFormType('lost')}>
              <Search size={17} /> I lost something
            </button>
            <button className={formType === 'found' ? 'selected' : ''} onClick={() => setFormType('found')}>
              <Plus size={17} /> I found something
            </button>
          </div>

          <form className="report-form" onSubmit={submitItem} noValidate>
            <div className="form-grid">
              <Field label="Item title" error={formErrors.title}>
                <input
                  name="title"
                  placeholder={formType === 'lost' ? 'e.g. Black wireless earphones' : 'e.g. Blue notebook'}
                  maxLength={100}
                  required
                />
              </Field>
              <Field label="Category" error={formErrors.category}>
                <select name="category" defaultValue="" required>
                  <option value="" disabled>
                    Select category
                  </option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Description" wide error={formErrors.description}>
                <textarea
                  name="description"
                  rows={4}
                  placeholder="Describe visible features. Do not post full ID numbers or sensitive information."
                  maxLength={2000}
                  required
                />
              </Field>
              <Field label="Color / visible details">
                <input name="color" placeholder="e.g. Navy blue, silver trim" maxLength={100} />
              </Field>
              <Field label={formType === 'lost' ? 'Last seen near' : 'Found near'} error={formErrors.location}>
                <input
                  name="location"
                  placeholder="e.g. Engineering block, library"
                  maxLength={150}
                  required
                />
              </Field>
              <Field label={formType === 'lost' ? 'Date lost' : 'Date found'} error={formErrors.date}>
                <input
                  name="date"
                  type="date"
                  max={getTodayDateString()}
                  defaultValue={getTodayDateString()}
                  required
                />
              </Field>
              <Field label="Approximate time (optional)">
                <input name="time" type="time" />
              </Field>

              {/* Real Image Upload */}
              <div className="field wide">
                <span>Upload Item Image (Optional, max 5MB)</span>
                {imagePreview ? (
                  <div className="image-preview-card">
                    <img src={imagePreview} alt="Item preview" />
                    <button type="button" className="image-remove-btn" onClick={removeSelectedImage} aria-label="Remove image">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="file-upload-box">
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} />
                    <div className="file-upload-inner">
                      <Upload size={22} />
                      <b>Click or drag an image here</b>
                      <small>PNG, JPG or WebP up to 5MB</small>
                    </div>
                  </div>
                )}
              </div>

              {formType === 'found' && (
                <label className="check-field">
                  <input name="handover" type="checkbox" />{' '}
                  <span>Already handed over to campus security / an authorized office</span>
                </label>
              )}
            </div>

            <div className="privacy-note">
              <ShieldCheck size={18} />
              <p>
                <b>Security & Privacy:</b> All listings are stored in the cloud database. Do not upload photos of government
                identity cards, credit cards, or personal documents.
              </p>
            </div>

            <button className="button primary submit-button" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="animate-spin" size={17} /> Saving to cloud...
                </>
              ) : (
                <>
                  Submit report <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        </main>
      )}

      {/* Claims Page */}
      {page === 'claims' && (
        <main className="page-wrap">
          <PageIntro
            eyebrow="RECOVERY DESK"
            title="Your claims."
            subtitle="Review ownership claims you have submitted. Verification details remain strictly private."
          />
          {claims.length ? (
            <div className="claims-list">
              {claims.map((c) => {
                const relatedItem = items.find((i) => i.id === c.itemId);
                return (
                  <article className="claim-card" key={c.id}>
                    <div>
                      <span className="status-pill">{c.status}</span>
                      <h3>{relatedItem?.title || 'Listing'}</h3>
                      <p>{c.details}</p>
                      {c.contactPhone && <small style={{ display: 'block', margin: '4px 0' }}>Contact phone: {c.contactPhone}</small>}
                      <small>Claim created {new Date(c.createdAt).toLocaleDateString()}</small>
                    </div>
                    <label>
                      Claim status
                      <select value={c.status} onChange={(e) => changeClaim(c.id, e.target.value as ClaimStatus)}>
                        {(['Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'] as ClaimStatus[]).map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <HeartHandshake size={38} />
              <h3>No claims yet</h3>
              <p>Open a found-item report on the board to submit an ownership verification claim.</p>
              <button
                className="button primary"
                onClick={() => {
                  setType('found');
                  go('browse');
                }}
              >
                Browse found items <ArrowRight size={16} />
              </button>
            </div>
          )}
        </main>
      )}

      {/* How it Works Page */}
      {page === 'how' && (
        <main className="page-wrap">
          <PageIntro
            eyebrow="SAFETY FIRST"
            title="A safer way to reunite."
            subtitle="CampusFind is designed to make reporting easy while keeping ownership checks private."
          />
          <div className="safety-grid">
            <article>
              <ShieldCheck />
              <h3>Keep proof private</h3>
              <p>
                Don't publish full ID numbers, serial numbers, or sensitive documents. Ask claimants to describe hidden
                identifying features privately.
              </p>
            </article>
            <article>
              <MapPin />
              <h3>Choose a safe handover</h3>
              <p>
                For valuables or uncertain claims, use a staffed campus security office or authorized front desk on campus.
              </p>
            </article>
            <article>
              <AlertTriangle />
              <h3>Verified authenticity</h3>
              <p>
                Listings and claims require student authentication and Row-Level Security, protecting private claims from public
                exposure.
              </p>
            </article>
          </div>
          <div className="how-cta">
            <div>
              <h2>Lost something on campus?</h2>
              <p>Start with a report. A few helpful details can make a difference.</p>
            </div>
            <button className="button primary" onClick={() => go('report')}>
              Create a report <ArrowRight size={16} />
            </button>
          </div>
        </main>
      )}

      <Footer go={go} />

      {/* Item Details Modal */}
      {selected && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close details">
              <X />
            </button>

            <span className={'type-pill ' + selected.type}>
              {selected.type === 'lost' ? 'LOST ITEM' : 'FOUND ITEM'}
            </span>
            <span className="status-pill">{selected.status}</span>
            {selected.isDemo && <span className="demo-tag">DEMO DATA</span>}

            <h2 id="detail-title">{selected.title}</h2>

            {/* Display Real Uploaded Image if Present */}
            {selected.imageUrl || selected.image ? (
              <img src={selected.imageUrl || selected.image} alt={selected.title} className="detail-img-cover" />
            ) : null}

            <p className="detail-description">{selected.description}</p>

            <div className="detail-facts">
              <span>
                <PackageSearch size={16} />
                {selected.category}
              </span>
              {selected.color && (
                <span>
                  <span className="color-dot" />
                  {selected.color}
                </span>
              )}
              <span>
                <MapPin size={16} />
                {selected.location}
              </span>
              <span>
                <CalendarDays size={16} />
                {selected.date}
              </span>
            </div>

            {selected.handover && (
              <p className="handover-note">
                <ShieldCheck size={16} /> Item was handed to campus security / authorized front desk.
              </p>
            )}

            {/* Explainable Possible Matches */}
            <div className="match-box">
              <h3>
                <HeartHandshake size={18} /> Possible matches
              </h3>
              {matchesFor.length ? (
                matchesFor.map((m) => (
                  <button className="match-row" key={m.item.id} onClick={() => setSelected(m.item)}>
                    <span>
                      <b>{m.item.title}</b>
                      <small>
                        {m.item.location} · {m.item.date}
                      </small>
                      <small>Why: {m.reasons.join(', ') || 'Some details overlap'}</small>
                    </span>
                    <span className="match-score">
                      {m.score}%<small>heuristic</small>
                    </span>
                  </button>
                ))
              ) : (
                <p className="muted">No strong potential matches in the current reports yet.</p>
              )}
              <p className="match-disclaimer">Scores are simple heuristic comparisons, not proof of ownership.</p>
            </div>

            <div className="modal-actions">
              {selected.type === 'found' && selected.status !== 'Recovered' && (
                <button
                  className="button primary"
                  onClick={() => {
                    if (!user) {
                      setAuthOpen(true);
                      setNotice('Please sign in to submit an ownership claim.');
                    } else {
                      setClaimTarget(selected);
                      setSelected(null);
                    }
                  }}
                >
                  Submit ownership claim
                </button>
              )}

              {user && (user.id === selected.ownerId || selected.owner === 'You (this browser)' || selected.owner === user.displayName) && selected.status !== 'Recovered' && (
                <button className="button secondary" onClick={() => closeItem(selected.id)}>
                  Mark recovered
                </button>
              )}

              <button
                className="button ghost"
                onClick={() => {
                  setFlagTarget(selected);
                  setSelected(null);
                }}
              >
                <Flag size={14} /> Flag report
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Claim Submission Modal */}
      {claimTarget && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setClaimTarget(null);
          }}
        >
          <section className="detail-modal claim-modal" role="dialog" aria-modal="true" aria-labelledby="claim-title">
            <button className="modal-close" onClick={() => setClaimTarget(null)} aria-label="Close claim">
              <X />
            </button>
            <span className="eyebrow">OWNERSHIP CHECK</span>
            <h2 id="claim-title">Claim “{claimTarget.title}”</h2>
            <div className="privacy-note">
              <ShieldCheck size={18} />
              <p>
                Describe a distinctive feature only the true owner would know. These verification details are visible only
                to the finder and designated campus reviewers.
              </p>
            </div>
            <form onSubmit={submitClaim}>
              <label className="field">
                <span>Contact phone / preferred reaching method (optional)</span>
                <input
                  value={claimPhone}
                  onChange={(e) => setClaimPhone(e.target.value)}
                  placeholder="e.g. +1 555-0199 or WhatsApp"
                  maxLength={50}
                />
              </label>
              <label className="field">
                <span>Private identifying details</span>
                <textarea
                  value={claimDetails}
                  onChange={(e) => setClaimDetails(e.target.value)}
                  rows={4}
                  placeholder="What unique marking, wallpaper, sticker, or contents verify this belongs to you?"
                  required
                  minLength={12}
                  maxLength={1500}
                />
              </label>
              <button className="button primary submit-button" type="submit" disabled={busy}>
                {busy ? 'Submitting claim...' : 'Submit verification claim'} <ArrowRight size={16} />
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Flag / Abuse Report Modal */}
      {flagTarget && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setFlagTarget(null);
          }}
        >
          <section className="detail-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="flag-title">
            <button className="modal-close" onClick={() => setFlagTarget(null)} aria-label="Close flag dialog">
              <X />
            </button>
            <span className="eyebrow" style={{ color: '#b95043' }}>
              COMMUNITY SAFEGUARD
            </span>
            <h2 id="flag-title">Report listing</h2>
            <p style={{ fontSize: '12px', color: '#6d7c71', margin: '8px 0 16px' }}>
              Reporting “{flagTarget.title}” for administrative or moderation review.
            </p>
            <form onSubmit={submitFlagReport}>
              <label className="field" style={{ marginBottom: '14px' }}>
                <span>Reason</span>
                <select value={flagReason} onChange={(e) => setFlagReason(e.target.value)}>
                  <option value="Contains personal/sensitive info">Contains personal or sensitive info</option>
                  <option value="Spam or commercial listing">Spam or commercial advertisement</option>
                  <option value="Fraudulent or suspicious claim">Fraudulent or suspicious claim</option>
                  <option value="Inappropriate or abusive language">Inappropriate or abusive language</option>
                  <option value="Item already returned/resolved">Item already returned / resolved</option>
                </select>
              </label>
              <label className="field" style={{ marginBottom: '20px' }}>
                <span>Additional details (optional)</span>
                <textarea
                  value={flagDetails}
                  onChange={(e) => setFlagDetails(e.target.value)}
                  rows={3}
                  placeholder="Provide any additional context for campus administrators."
                  maxLength={500}
                />
              </label>
              <button className="button primary submit-button" type="submit" disabled={busy}>
                {busy ? 'Submitting...' : 'Submit Report for Moderation'}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Real Authentication Modal */}
      {authOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAuthOpen(false);
          }}
        >
          <section className="detail-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Close login dialog">
              <X />
            </button>

            <div className="auth-tabs">
              <button
                className={`auth-tab ${authMode === 'signin' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError('');
                }}
              >
                Sign In
              </button>
              <button
                className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError('');
                }}
              >
                Create Account
              </button>
              <button
                className={`auth-tab ${authMode === 'reset' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('reset');
                  setAuthError('');
                }}
              >
                Reset
              </button>
            </div>

            <h2 id="auth-title">
              {authMode === 'signin' && 'Welcome back'}
              {authMode === 'signup' && 'Join CampusFind'}
              {authMode === 'reset' && 'Reset your password'}
            </h2>

            {authError && <div className="auth-error">{authError}</div>}

            <button
              type="button"
              className="google-auth-btn"
              onClick={handleGoogleSignIn}
              disabled={busy}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="auth-divider">or continue with email</div>

            <form onSubmit={handleAuthSubmit}>
              {authMode === 'signup' && (
                <label className="field" style={{ marginBottom: '14px' }}>
                  <span>Your Name</span>
                  <input
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    required
                  />
                </label>
              )}

              <label className="field" style={{ marginBottom: '14px' }}>
                <span>Campus / Personal Email</span>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@university.edu"
                  required
                />
              </label>

              {authMode !== 'reset' && (
                <label className="field" style={{ marginBottom: '20px' }}>
                  <span>Password</span>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                  />
                </label>
              )}

              <button className="button primary submit-button" type="submit" disabled={busy}>
                {busy ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : authMode === 'signin' ? (
                  'Sign In'
                ) : authMode === 'signup' ? (
                  'Create Account'
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <div className="auth-switch">
                {authMode === 'signin' ? (
                  <>
                    Don't have an account?{' '}
                    <button type="button" onClick={() => setAuthMode('signup')}>
                      Create one
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button type="button" onClick={() => setAuthMode('signin')}>
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  wide,
  error,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  error?: string;
}) {
  return (
    <label className={'field' + (wide ? ' wide' : '')}>
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

function ItemCard({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const Icon = icons[item.category] || PackageSearch;
  const hasImage = Boolean(item.imageUrl || item.image);

  return (
    <article className="item-card">
      <div className={'item-visual ' + item.type}>
        {hasImage ? (
          <img src={item.imageUrl || item.image} alt={item.title} className="item-img-cover" />
        ) : (
          <>
            <div className="visual-top">
              <span className={'type-pill ' + item.type}>{item.type === 'lost' ? 'LOST' : 'FOUND'}</span>
              <span className="visual-date">{item.date}</span>
            </div>
            <div className="visual-icon">
              <Icon size={40} strokeWidth={1.4} />
            </div>
            <span className="visual-category">{item.category}</span>
          </>
        )}
      </div>
      <div className="item-card-body">
        <div className="item-card-title">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {item.title}
            {item.isDemo && <span className="demo-tag">DEMO</span>}
          </h3>
          <span className="status-dot" title={item.status} />
        </div>
        <p>{item.description}</p>
        <div className="item-meta">
          <span>
            <MapPin size={14} />
            {item.location}
          </span>
          <span>
            <CalendarDays size={14} />
            {item.date}
          </span>
        </div>
        <button className="card-link" onClick={onOpen}>
          View details <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}

function PageIntro({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="page-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function Footer({ go }: { go: (p: string) => void }) {
  return (
    <footer className="footer">
      <div className="footer-main">
        <button className="brand footer-brand" onClick={() => go('home')}>
          <span className="brand-icon">
            <HeartHandshake size={22} />
          </span>
          <span>
            Campus<span className="brand-accent">Find</span>
            <small>LOST & FOUND, TOGETHER</small>
          </span>
        </button>
        <p>
          Good things find their way back.
          <br />
          One campus, a little more connected.
        </p>
        <div className="footer-links">
          <button onClick={() => go('how')}>About & safety</button>
          <button onClick={() => go('browse')}>Browse reports</button>
          <button onClick={() => go('report')}>Report an item</button>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 CampusFind · Cloud-Synced Platform</span>
        <span className="demo-label">
          <span /> {isFirebaseConfigured ? 'CONNECTED TO GOOGLE CLOUD FIRESTORE' : 'DATABASE DISCONNECTED'}
        </span>
      </div>
    </footer>
  );
}
