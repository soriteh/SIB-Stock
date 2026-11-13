import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowRight, Building2, LoaderCircle, LogOut, Eye, EyeOff, ShieldCheck, Boxes, TrendingUp, ChevronDown } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type TenantSummary = { id: string; name: string; slug: string; status: string }

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [tenant, setTenant] = useState<TenantSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [slug, setSlug] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let mounted = true
    supabase.auth.getSession().then(({ data, error: authError }) => {
      if (!mounted) return
      if (authError) setError(authError.message)
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  // Déconnexion automatique après 30 minutes sans interaction utilisateur.
  const lastActivityRef = useRef(0)
  useEffect(() => {
    const client = supabase
    const userId = session?.user?.id
    if (!client || !userId) return

    const inactivityLimit = 30 * 60 * 1000
    const activityStorageKey = `sib-stock:last-activity:${userId}`
    let timeoutId: number | undefined
    let watchdogId: number | undefined
    let disposed = false
    let expired = false

    const readLastActivity = () => {
      try {
        const stored = Number(localStorage.getItem(activityStorageKey))
        if (Number.isFinite(stored) && stored > 0) return stored
      } catch {}
      return lastActivityRef.current
    }

    const writeLastActivity = (timestamp: number) => {
      lastActivityRef.current = timestamp
      try { localStorage.setItem(activityStorageKey, String(timestamp)) } catch {}
    }

    const expireSession = async () => {
      if (disposed || expired) return
      expired = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      if (watchdogId !== undefined) window.clearInterval(watchdogId)
      setNotice('Votre session a été fermée après 30 minutes d’inactivité. Veuillez vous reconnecter.')
      const { error: signOutError } = await client.auth.signOut({ scope: 'local' })
      if (signOutError && !disposed) {
        setError('La déconnexion automatique a échoué. Vérifiez votre connexion puis déconnectez-vous manuellement.')
      }
    }

    const checkInactivity = () => {
      if (disposed || expired) return
      const lastActivity = readLastActivity()
      // Une session sans horodatage valide démarre à l'instant de l'activation.
      if (!lastActivity) {
        writeLastActivity(Date.now())
        scheduleCheck()
        return
      }
      const remaining = inactivityLimit - (Date.now() - lastActivity)
      if (remaining <= 0) {
        void expireSession()
        return
      }
      scheduleCheck(remaining)
    }

    const scheduleCheck = (delay = inactivityLimit) => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(checkInactivity, Math.max(250, Math.min(delay + 50, 5000)))
    }

    const handleActivity = () => {
      if (disposed || expired) return
      const now = Date.now()
      const lastActivity = readLastActivity()
      // Une action après expiration ne doit jamais prolonger la session.
      if (lastActivity && now - lastActivity >= inactivityLimit) {
        void expireSession()
        return
      }
      writeLastActivity(now)
      scheduleCheck()
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== activityStorageKey) return
      const timestamp = Number(event.newValue)
      if (Number.isFinite(timestamp) && timestamp > 0) {
        lastActivityRef.current = timestamp
        checkInactivity()
      }
    }

    // Le watchdog vérifie aussi les onglets suspendus ou laissés en arrière-plan.
    const handleResume = () => checkInactivity()
    if (!lastActivityRef.current) {
      const stored = readLastActivity()
      if (stored) lastActivityRef.current = stored
    }
    if (!readLastActivity()) writeLastActivity(Date.now())
    checkInactivity()
    watchdogId = window.setInterval(checkInactivity, 5000)

    const activityEvents: (keyof WindowEventMap)[] = [
      'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart', 'click', 'input'
    ]
    activityEvents.forEach(eventName => window.addEventListener(eventName, handleActivity, { passive: true }))
    window.addEventListener('focus', handleResume)
    window.addEventListener('pageshow', handleResume)
    window.addEventListener('storage', handleStorage)
    document.addEventListener('visibilitychange', handleResume)

    return () => {
      disposed = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      if (watchdogId !== undefined) window.clearInterval(watchdogId)
      activityEvents.forEach(eventName => window.removeEventListener(eventName, handleActivity))
      window.removeEventListener('focus', handleResume)
      window.removeEventListener('pageshow', handleResume)
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('visibilitychange', handleResume)
    }
  }, [session?.user?.id])
  useEffect(() => {
    const client = supabase
    const userId = session?.user?.id
    if (!client || !userId) return

    const inactivityLimit = 30 * 60 * 1000
    const activityStorageKey = `sib-stock:last-activity:${userId}`
    let timeoutId: number | undefined
    let disposed = false
    let expired = false

    const readLastActivity = () => {
      try {
        const stored = Number(localStorage.getItem(activityStorageKey))
        if (Number.isFinite(stored) && stored > 0) return stored
      } catch {}
      return lastActivityRef.current || Date.now()
    }

    const writeLastActivity = (timestamp: number) => {
      lastActivityRef.current = timestamp
      try { localStorage.setItem(activityStorageKey, String(timestamp)) } catch {}
    }

    const expireSession = async () => {
      if (disposed || expired) return
      expired = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      setNotice('Votre session a été fermée après 30 minutes d’inactivité. Veuillez vous reconnecter.')
      const { error: signOutError } = await client.auth.signOut({ scope: 'local' })
      if (signOutError && !disposed) setError('La déconnexion automatique a échoué. Vérifiez votre connexion puis déconnectez-vous manuellement.')
    }

    const checkInactivity = () => {
      if (disposed || expired) return
      const elapsed = Date.now() - readLastActivity()
      const remaining = inactivityLimit - elapsed
      if (remaining <= 0) {
        void expireSession()
        return
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(checkInactivity, remaining + 25)
    }

    const handleActivity = () => {
      if (disposed || expired) return
      const now = Date.now()
      // Vérifier l'expiration AVANT de réinitialiser le compteur : les navigateurs
      // peuvent suspendre les timers lorsque l'onglet reste en arrière-plan.
      if (now - readLastActivity() >= inactivityLimit) {
        void expireSession()
        return
      }
      writeLastActivity(now)
      checkInactivity()
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== activityStorageKey || !event.newValue) return
      const timestamp = Number(event.newValue)
      if (!Number.isFinite(timestamp) || timestamp <= 0) return
      lastActivityRef.current = timestamp
      checkInactivity()
    }

    // Ne pas remettre le compteur à zéro au rechargement de la page :
    // le délai d'inactivité continue entre les actualisations et les onglets.
    if (!lastActivityRef.current) lastActivityRef.current = readLastActivity()
    checkInactivity()

    const activityEvents: (keyof WindowEventMap)[] = [
      'pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'click', 'input'
    ]
    activityEvents.forEach(eventName => window.addEventListener(eventName, handleActivity, { passive: true }))
    window.addEventListener('focus', handleActivity)
    window.addEventListener('storage', handleStorage)
    document.addEventListener('visibilitychange', checkInactivity)

    return () => {
      disposed = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      activityEvents.forEach(eventName => window.removeEventListener(eventName, handleActivity))
      window.removeEventListener('focus', handleActivity)
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('visibilitychange', checkInactivity)
    }
  }, [session?.user?.id])
  useEffect(() => {
    let mounted = true
    async function loadTenant() {
      if (!supabase || !session?.user) { setTenant(null); return }
      setLoading(true)
      const { data: profile, error: profileError } = await supabase
        .from('profiles').select('active_tenant_id').eq('id', session.user.id).maybeSingle()
      if (!mounted) return
      if (profileError) setError('Impossible de charger votre profil : ' + profileError.message)
      if (profile?.active_tenant_id) {
        const { data, error: tenantError } = await supabase
          .from('tenants').select('id,name,slug,status').eq('id', profile.active_tenant_id).maybeSingle()
        if (!mounted) return
        if (tenantError) setError('Impossible de charger votre entreprise : ' + tenantError.message)
        setTenant(data as TenantSummary | null)
      } else setTenant(null)
      setLoading(false)
    }
    void loadTenant()
    return () => { mounted = false }
  }, [session])

  async function submitAuth(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setError(''); setNotice('')
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { full_name: fullName.trim() } },
        })
        if (authError) throw authError
        if (!data.session) setNotice('Compte créé. Consultez votre boîte e-mail pour confirmer votre adresse, puis connectez-vous.')
        else {
          try { localStorage.setItem(`sib-stock:last-activity:${data.session.user.id}`, String(Date.now())) } catch {}
          setNotice('Compte créé. Vous pouvez maintenant configurer votre entreprise.')
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) throw authError
        if (data.user) {
          try { localStorage.setItem(`sib-stock:last-activity:${data.user.id}`, String(Date.now())) } catch {}
        }
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Une erreur est survenue.') }
    finally { setBusy(false) }
  }

  async function createCompany(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !session) return
    setBusy(true); setError(''); setNotice('')
    try {
      const normalizedSlug = slug.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const { error: rpcError } = await supabase.rpc('create_tenant', {
        p_name: company.trim(), p_slug: normalizedSlug, p_country_code: 'GN', p_currency_code: 'GNF',
      })
      if (rpcError) throw rpcError
      const { data: profile, error: profileError } = await supabase
        .from('profiles').select('active_tenant_id').eq('id', session.user.id).single()
      if (profileError) throw profileError
      const { data, error: tenantError } = await supabase
        .from('tenants').select('id,name,slug,status').eq('id', profile.active_tenant_id).single()
      if (tenantError) throw tenantError
      setTenant(data as TenantSummary)
    } catch (err) { setError(err instanceof Error ? err.message : 'La création de l’entreprise a échoué.') }
    finally { setBusy(false) }
  }

  async function logout() {
    if (!supabase) return
    setError('')
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) setError(signOutError.message)
  }

  if (!isSupabaseConfigured || !supabase) return (
    <div className="auth-screen"><div className="auth-card"><Brand /><h1>Connexion à Supabase requise</h1>
      <p>Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans le fichier .env.local, puis redémarrez l’application.</p>
      <code>VITE_SUPABASE_URL=https://votre-projet.supabase.co</code>
      <code>VITE_SUPABASE_ANON_KEY=votre-cle-publique</code>
    </div></div>
  )

  if (loading) return <div className="auth-screen"><div className="auth-loading"><LoaderCircle className="spin" size={28}/><span>Chargement de votre espace sécurisé…</span></div></div>

  if (!session) return (
    <div className="auth-screen auth-screen-premium">
      <div className="auth-layout">
        <section className="auth-visual" aria-label="Présentation de SIB Stock">
          <svg className="auth-circuit-board" viewBox="0 0 900 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs><linearGradient id="circuitGlow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#55b7ff"/><stop offset=".62" stopColor="#1687e8"/><stop offset="1" stopColor="#ff8a32"/></linearGradient></defs>
            <g className="circuit-traces">
              <path d="M0 112H118V164H205V225H285 M900 80H790V142H720V210H650V260H590 M900 390H820V345H748V300H690 M0 510H105V455H175V405H255V360H330 M150 760V680H225V620H300V565H365 M720 760V690H665V635H610V580H550"/>
              <path d="M0 255H72V300H145V345H220 M900 560H820V510H755V455H680V410H625 M390 0V75H445V130H510V180 M525 760V710H480V665H435V620"/>
              <path d="M0 650H85V605H145V560H205 M900 220H845V260H795V300H745 M310 0V55H355V95H400"/>
            </g>
            <g className="circuit-pulses">
              <path d="M0 112H118V164H205V225H285 M900 390H820V345H748V300H690 M0 510H105V455H175V405H255V360H330 M720 760V690H665V635H610V580H550"/>
            </g>
            <g className="circuit-nodes">
              <circle cx="118" cy="112" r="4"/><circle cx="205" cy="164" r="4"/><circle cx="285" cy="225" r="4"/>
              <circle cx="790" cy="142" r="4"/><circle cx="720" cy="210" r="4"/><circle cx="590" cy="260" r="4"/>
              <circle cx="105" cy="455" r="4"/><circle cx="255" cy="360" r="4"/><circle cx="665" cy="635" r="4"/>
              <circle cx="610" cy="580" r="4"/><circle cx="445" cy="130" r="4"/><circle cx="510" cy="180" r="4"/>
            </g>
          </svg>
          <div className="auth-visual-orb auth-visual-orb-blue" />
          <div className="auth-visual-orb auth-visual-orb-orange" />
          <div className="auth-visual-content">
            <Brand />
            <div className="auth-visual-copy">
              <span className="auth-visual-eyebrow"><span className="auth-live-dot" /> PLATEFORME DE GESTION INTELLIGENTE</span>
              <h1>Pilotez votre stock.<br/><span>Maîtrisez votre activité.</span></h1>
              <p>Centralisez vos produits, vos mouvements, vos achats et vos ventes dans un espace de gestion clair et sécurisé.</p>
              <div className="auth-feature-list">
                <div><span><Boxes size={17}/></span><div><strong>Stock maîtrisé</strong><small>Suivi des produits et des mouvements en temps réel</small></div></div>
                <div><span><TrendingUp size={17}/></span><div><strong>Décisions éclairées</strong><small>Indicateurs et rapports pour suivre votre activité</small></div></div>
                <div><span><ShieldCheck size={17}/></span><div><strong>Espace sécurisé</strong><small>Données séparées par entreprise</small></div></div>
              </div>
            </div>
            <div className="auth-visual-footer"><span> SIB STOCK </span><span>GESTION · PERFORMANCE · CONTRÔLE</span></div>
          </div>
        </section>
        <section className="auth-panel">
          <div className="auth-card auth-card-premium">
            <div className="auth-mobile-brand"><Brand /></div>
            <div className="auth-kicker">{mode === 'login' ? 'ACCÈS À VOTRE ESPACE' : 'NOUVEL UTILISATEUR'}</div>
            {notice && <div className="auth-notice" role="status">{notice}</div>}
            <h2>{mode === 'login' ? 'Ravi de vous revoir' : 'Créer votre compte'}</h2>
            <p className="auth-intro">{mode === 'login' ? 'Connectez-vous pour retrouver votre espace de travail.' : 'Créez votre accès administrateur pour démarrer.'}</p>
            <form onSubmit={submitAuth} className="auth-form auth-form-premium">
              {mode === 'signup' && <label>Nom complet<input required autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Votre nom et prénom"/></label>}
              <label>Adresse e-mail<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nom@entreprise.com"/></label>
              <label>Mot de passe
                <span className="auth-password-field">
                  <input type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="8 caractères minimum"/>
                  <button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={()=>setShowPassword(v=>!v)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
                </span>
              </label>
              {error && <div className="auth-error" role="alert">{error}</div>}
              <button className="auth-submit auth-submit-premium" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17}/> Connexion en cours…</> : <>{mode === 'login' ? 'Se connecter' : 'Créer mon compte'} <ArrowRight size={17}/></>}</button>
            </form>
            <div className="auth-switch">{mode === 'login' ? 'Vous n’avez pas encore de compte ?' : 'Vous avez déjà un compte ?'} <button type="button" onClick={()=>{setMode(mode === 'login' ? 'signup' : 'login');setError('');setNotice('');setShowPassword(false)}}>{mode === 'login' ? 'Créer un compte' : 'Se connecter'}</button></div>
            <div className="auth-security auth-security-premium"><ShieldCheck size={14}/><span>Connexion sécurisée · Données isolées par entreprise</span></div>
          </div>
        </section>
      </div>
    </div>
  )

  if (tenant?.status === 'suspended') return (
    <div className="auth-screen"><div className="auth-card">
      <Brand /><div className="auth-kicker">ACCÈS TEMPORAIREMENT SUSPENDU</div>
      <h1>Espace entreprise suspendu</h1>
      <p>L’accès à l’espace <strong>{tenant.name}</strong> est temporairement suspendu par l’administration SIB. Les données de votre entreprise restent conservées. Contactez l’assistance SIB pour régulariser la situation.</p>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="auth-submit" onClick={logout}><LogOut size={15}/> Se déconnecter</button>
    </div></div>
  )

  if (!tenant) return (
    <div className="auth-screen"><div className="auth-card"><Brand />
      <div className="auth-kicker">CONFIGURATION INITIALE</div><h1>Configurez votre entreprise</h1>
      <p>Votre compte est prêt. Renseignez les informations de votre entreprise pour créer votre espace de travail privé.</p>
      <form onSubmit={createCompany} className="auth-form">
        <label>Nom de l’entreprise<input required minLength={2} value={company} onChange={e=>{setCompany(e.target.value);setSlug(e.target.value)}} placeholder="Ex. Soritech Innov Business"/></label>
        <label>Identifiant de l’espace<input required pattern="[a-zA-Z0-9][a-zA-Z0-9-]{1,62}" value={slug.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]/g, '-')} onChange={e=>setSlug(e.target.value)} placeholder="mon-entreprise"/><small>Minuscules, chiffres et tirets uniquement.</small></label>
        {error && <div className="auth-error">{error}</div>}
        <button className="auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <>Créer mon espace <ArrowRight size={17}/></>}</button>
      </form>
      <button className="auth-logout" onClick={logout}><LogOut size={15}/> Se déconnecter</button>
    </div></div>
  )

  return <><div className="tenant-session"><div className="tenant-session-company" aria-label={`Entreprise active : ${tenant.name}`}><Building2 size={18}/><strong>{tenant.name}</strong><ChevronDown size={15}/></div><button onClick={logout}><LogOut size={14}/> Déconnexion</button></div>{children}</>
}

function Brand() {
  return <div className="auth-brand"><div className="auth-brand-mark">S<span>I</span>B</div><div><strong>SIB Stock</strong></div></div>
}
