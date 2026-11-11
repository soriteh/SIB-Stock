import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowRight, Building2, LoaderCircle, LogOut, Eye, EyeOff, ShieldCheck, Boxes, TrendingUp } from 'lucide-react'
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

  // Déconnexion automatique après 30 minutes sans activité utilisateur.
  const lastActivityRef = useRef(0)
  useEffect(() => {
    const client = supabase
    if (!client || !session?.user) return
    let timeoutId: number
    let disposed = false
    const inactivityLimit = 30 * 60 * 1000
    const resetInactivityTimer = () => {
      if (disposed) return
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(async () => {
        if (disposed) return
        setNotice('Votre session a été fermée après 30 minutes d’inactivité. Veuillez vous reconnecter.')
        await client.auth.signOut()
      }, inactivityLimit)
    }
    const handleActivity = () => {
      const now = Date.now()
      if (now - lastActivityRef.current < 1000) return
      lastActivityRef.current = now
      resetInactivityTimer()
    }
    const activityEvents: (keyof WindowEventMap)[] = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart']
    resetInactivityTimer()
    activityEvents.forEach(eventName => window.addEventListener(eventName, handleActivity, { passive: true }))
    return () => {
      disposed = true
      window.clearTimeout(timeoutId)
      activityEvents.forEach(eventName => window.removeEventListener(eventName, handleActivity))
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
        else setNotice('Compte créé. Vous pouvez maintenant configurer votre entreprise.')
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) throw authError
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

  return <><div className="tenant-session"><span><Building2 size={15}/> {tenant.name}</span><button onClick={logout}><LogOut size={14}/> Déconnexion</button></div>{children}</>
}

function Brand() {
  return <div className="auth-brand"><div className="auth-brand-mark">S<span>I</span>B</div><div><strong>SIB Stock</strong></div></div>
}
