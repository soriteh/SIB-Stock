import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowRight, Building2, LoaderCircle, LogOut, Package } from 'lucide-react'
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
    <div className="auth-screen"><div className="auth-card"><Brand />
      <div className="auth-kicker">GESTION INTELLIGENTE DES STOCKS</div>
      <h1>{mode === 'login' ? 'Bienvenue sur SIB Stock' : 'Créer votre compte'}</h1>
      <p>{mode === 'login' ? 'Connectez-vous pour accéder à votre espace de gestion.' : 'Créez votre accès administrateur pour démarrer.'}</p>
      <form onSubmit={submitAuth} className="auth-form">
        {mode === 'signup' && <label>Nom complet<input required value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Votre nom et prénom"/></label>}
        <label>Adresse e-mail<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nom@entreprise.com"/></label>
        <label>Mot de passe<input type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="8 caractères minimum"/></label>
        {error && <div className="auth-error">{error}</div>}
        {notice && <div className="auth-notice">{notice}</div>}
        <button className="auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <>{mode === 'login' ? 'Se connecter' : 'Créer mon compte'} <ArrowRight size={17}/></>}</button>
      </form>
      <div className="auth-switch">{mode === 'login' ? 'Vous n’avez pas encore de compte ?' : 'Vous avez déjà un compte ?'} <button onClick={()=>{setMode(mode === 'login' ? 'signup' : 'login');setError('');setNotice('')}}>{mode === 'login' ? 'Créer un compte' : 'Se connecter'}</button></div>
      <small className="auth-security">Connexion sécurisée · Données isolées par entreprise</small>
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

  return <><div className="tenant-session"><span><Building2 size={15}/> {tenant.name}</span><button onClick={logout}><LogOut size={14}/> Déconnexion</button></div>{children}</>
}

function Brand() {
  return <div className="auth-brand"><div className="auth-brand-mark">S<span>I</span>B</div><div><strong>SIB Stock</strong><small>INVENTORY CLOUD</small></div><Package className="auth-brand-icon" size={24}/></div>
}
