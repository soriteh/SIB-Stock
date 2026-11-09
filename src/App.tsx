import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AuthGate from './components/AuthGate'
import InventoryCatalog from './components/InventoryCatalog'
import StockMovements from './components/StockMovements'
import BusinessPartners from './components/BusinessPartners'
import Clients from './components/Clients'
import StockTransfers from './components/StockTransfers'
import StockInventories from './components/StockInventories'
import CommercialDocuments from './components/CommercialDocuments'
import Finance from './components/Finance'
import Reports from './components/Reports'
import StockAlerts from './components/StockAlerts'
import Administration from './components/Administration'
import SettingsPage from './components/SettingsPage'
import HelpCenter from './components/HelpCenter'
import SubscriptionPage from './components/SubscriptionPage'
import ProfilePage from './components/ProfilePage'
import {
  Activity, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Bell, Boxes, Building2, Landmark, ShieldCheck,
  ChevronDown, CircleHelp, CreditCard, LayoutDashboard, Package, LogOut,
  Search, Settings, ShoppingCart, Truck, Users, Warehouse, UserRound, Sun, Moon,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { TenantSettingsProvider, useTenantSettings } from './contexts/TenantSettingsContext'

const navigation = [
  { label: 'Vue d’ensemble', icon: LayoutDashboard },
  { label: 'Produits', icon: Package },
  { label: 'Entrepôts', icon: Warehouse },
  { label: 'Mouvements', icon: Activity },
  { label: 'Transferts', icon: ArrowLeftRight },
  { label: 'Achats', icon: Truck },
  { label: 'Ventes', icon: ShoppingCart },
  { label: 'Inventaires', icon: Boxes },
  { label: 'Caisse & finances', icon: Landmark },
  { label: 'Rapports', icon: Activity },
  { label: 'Alertes', icon: Bell },
  { label: 'Administration', icon: ShieldCheck },
  { label: 'Abonnement', icon: CreditCard },
  { label: 'Clients', icon: Users },
  { label: 'Fournisseurs', icon: Truck },
]


function Dashboard() {
  const [active, setActive] = useState('Vue d’ensemble')
  const [query, setQuery] = useState('')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [topProfileOpen, setTopProfileOpen] = useState(false)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')
  const [darkTheme, setDarkTheme] = useState(() => { try { return localStorage.getItem('sib-stock-theme') === 'dark' } catch { return false } })
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [profileEmail, setProfileEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [dashboardStats, setDashboardStats] = useState({products:0,stockValue:0,purchases:0,sales:0,lowStock:0})
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')
  const company = useTenantSettings()
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const formattedClock = new Intl.DateTimeFormat('fr-FR', {hour:'2-digit',minute:'2-digit',timeZone: company.timezone || 'Africa/Conakry'}).format(currentTime)
  const profileMenuAnchorRef = useRef<HTMLDivElement>(null)
  const profileDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true
    async function loadAccount() {
      if (!supabase) return
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!mounted || !user) return
      setProfileEmail(user.email ?? '')
      const { data: profile } = await supabase.from('profiles').select('full_name,avatar_path').eq('id', user.id).maybeSingle()
      if (mounted) setDisplayName(profile?.full_name?.trim() || String(user.user_metadata?.full_name ?? '').trim() || user.email?.split('@')[0] || 'Utilisateur')
      if (profile?.avatar_path) { const { data: signed } = await supabase.storage.from('profile-avatars').createSignedUrl(profile.avatar_path, 3600); if (mounted) setProfileAvatarUrl(signed?.signedUrl ?? '') }
    }
    void loadAccount()
    const clock = window.setInterval(() => setCurrentTime(new Date()), 60000)
    return () => { mounted = false; window.clearInterval(clock) }
  }, [])

  useEffect(() => {
    if (active !== 'Vue d’ensemble') return
    let cancelled = false
    async function loadDashboardStats() {
      if (!supabase) { setDashboardLoading(false); return }
      setDashboardLoading(true)
      setDashboardError('')
      const [products, levels, docs] = await Promise.all([
        supabase.from('products').select('id', {count:'exact',head:true}),
        supabase.from('stock_levels').select('quantity,products(purchase_price,minimum_stock)'),
        supabase.from('inventory_documents').select('document_type,total_amount,status').eq('status','posted')
      ])
      if (cancelled) return
      const err = products.error || levels.error || docs.error
      if (err) setDashboardError(err.message)
      const rows = (levels.data ?? []) as Array<{quantity:number;products:{purchase_price:number;minimum_stock:number}|null}>
      const posted = docs.data ?? []
      setDashboardStats({
        products: products.count ?? 0,
        stockValue: rows.reduce((sum,row)=>sum+Number(row.quantity||0)*Number(row.products?.purchase_price||0),0),
        purchases: posted.filter(row=>row.document_type==='purchase').reduce((sum,row)=>sum+Number(row.total_amount||0),0),
        sales: posted.filter(row=>row.document_type==='sale').reduce((sum,row)=>sum+Number(row.total_amount||0),0),
        lowStock: rows.filter(row=>Number(row.quantity||0)<=Number(row.products?.minimum_stock||0)).length
      })
      setDashboardLoading(false)
    }
    void loadDashboardStats()
    return ()=>{cancelled=true}
  }, [active])

  useEffect(() => {
    document.documentElement.dataset.theme = darkTheme ? 'dark' : 'light'
    try { localStorage.setItem('sib-stock-theme', darkTheme ? 'dark' : 'light') } catch {}
  }, [darkTheme])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
      if (event.key === 'Escape') {
        setNotificationsOpen(false)
        setTopProfileOpen(false)
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  const hour = Number(new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', hourCycle: 'h23', timeZone: company.timezone || 'Africa/Conakry' }).format(currentTime))
  const greeting = hour >= 5 && hour < 12 ? 'Bonjour' : hour >= 12 && hour < 18 ? 'Bon après-midi' : hour >= 18 && hour < 22 ? 'Bonsoir' : 'Bonne nuit'
  const formattedDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: company.timezone || 'Africa/Conakry' }).format(currentTime)
  const welcomeDate = formattedDate.charAt(0).toLocaleUpperCase('fr-FR') + formattedDate.slice(1)

  useEffect(() => {
    if (!profileMenuOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (profileMenuAnchorRef.current?.contains(target) || profileDropdownRef.current?.contains(target)) return
      setProfileMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [profileMenuOpen])

  useEffect(() => {
    if (!profileMenuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [profileMenuOpen])

  async function signOut() { if (!supabase) return; const { error } = await supabase.auth.signOut(); if (error) window.alert(error.message); else setProfileMenuOpen(false) }
  function openProfileSection(section: string) { setActive(section); setProfileMenuOpen(false) }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className={company.id ? (company.logo_url ? "brand-mark has-custom-logo" : "brand-mark") : "brand-mark brand-mark-loading"}>{company.id ? (company.logo_url ? <img src={company.logo_url} alt={"Logo "+company.name} /> : <>S<span>I</span>B</>) : null}</div>
          <div><strong>{company.name || "SIB Stock"}</strong></div>
        </div>
        <div className="sidebar-scroll">
          <div className="workspace">
            <div className="workspace-icon"><Building2 size={17} /></div>
            <div className="workspace-copy"><strong>{company.name || "Entreprise non configurée"}</strong><small>{company.email || company.phone || "Coordonnées non renseignées"}</small></div>
            <ChevronDown size={15} />
          </div>
          <div className="nav-label">ESPACE DE TRAVAIL</div>
          <nav className="navigation">
            {navigation.map(({ label, icon: Icon }) => (
              <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => setActive(label)}>
                <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-settings">
            <div className="nav-label">CONFIGURATION</div>
            <button className={active === 'Paramètres' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('Paramètres')}><Settings size={18}/><span>Paramètres</span></button>
            <button className={active === 'Centre d’aide' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('Centre d’aide')}><CircleHelp size={18}/><span>Centre d’aide</span></button>
          </div>

        </div>
        <div className="sidebar-bottom">
          <div className="profile-menu-anchor" ref={profileMenuAnchorRef}>
            {profileMenuOpen && createPortal(<div ref={profileDropdownRef} className="profile-dropdown" role="menu" aria-label="Menu du compte">
              <div className="profile-dropdown-heading"><div className="profile-dropdown-avatar"><UserRound size={17}/></div><div><strong>{displayName || 'Profil utilisateur'}</strong><small>{profileEmail || 'Adresse e-mail non renseignée'}</small></div></div>
              <div className="profile-dropdown-divider"/>
              <button role="menuitem" onClick={() => openProfileSection("Mon profil")}><UserRound size={16}/><span>Mon profil</span></button>
              <button role="menuitem" onClick={() => openProfileSection("Paramètres")}><Settings size={16}/><span>Paramètres</span></button>
              <button role="menuitem" onClick={() => openProfileSection("Centre d’aide")}><CircleHelp size={16}/><span>Centre d’aide</span></button>
              <div className="profile-dropdown-divider"/>
              <button role="menuitem" className="profile-dropdown-logout" onClick={signOut}><LogOut size={16}/><span>Déconnexion</span></button>
            </div>, document.body)}
            <button className="profile profile-trigger" aria-expanded={profileMenuOpen} aria-haspopup="menu" onClick={() => setProfileMenuOpen(v => !v)}><div className="avatar"><UserRound size={17}/></div><div><strong>{displayName || 'Mon compte'}</strong><small>{profileEmail || 'Adresse e-mail non renseignée'}</small></div><ChevronDown size={15} className={profileMenuOpen ? "profile-chevron open" : "profile-chevron"}/></button>
          </div>
          <button className="sidebar-logout" onClick={signOut}><LogOut size={16}/><span>Se déconnecter</span></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <h1 className="topbar-title">{active}</h1>
          <div className="top-actions">
            <div className="topbar-datetime"><strong>{formattedClock}</strong><span>{welcomeDate}</span></div>
            <label className="search-box" aria-label="Rechercher dans les mouvements récents"><Search size={19}/><input ref={searchInputRef} placeholder="Rechercher un produit, une référence..." value={query} onChange={(e) => setQuery(e.target.value)}/><kbd>⌘ K</kbd>{query&&<button type="button" className="search-clear" aria-label="Effacer la recherche" onClick={()=>setQuery('')}>×</button>}</label>
            <button type="button" className="theme-toggle" aria-label={darkTheme ? "Activer le thème clair" : "Activer le thème sombre"} title={darkTheme ? "Thème clair" : "Thème sombre"} onClick={()=>setDarkTheme(v=>!v)}>{darkTheme?<Sun size={17}/>:<Moon size={17}/>}</button>
            <div className="top-notification-wrap">
              <button className={notificationsOpen?"icon-button notification-button is-open":"icon-button notification-button"} aria-label="Notifications" aria-expanded={notificationsOpen} onClick={()=>setNotificationsOpen(v=>!v)}><Bell size={19}/></button>
              {notificationsOpen&&<div className="top-notification-panel"><div className="top-notification-heading"><strong>Notifications</strong><button type="button" onClick={()=>setNotificationsOpen(false)} aria-label="Fermer">×</button></div><div className="top-notification-empty"><strong>Aucune notification réelle</strong><p>Les notifications apparaîtront ici lorsqu’une alerte sera générée.</p></div></div>}
            </div>
            <div className="top-profile-wrap">
              <button className="top-avatar top-avatar-button" aria-label="Ouvrir le menu du profil" aria-haspopup="menu" aria-expanded={topProfileOpen} title={displayName||"Mon profil"} onClick={() => setTopProfileOpen(v=>!v)}>{profileAvatarUrl?<img src={profileAvatarUrl} alt="Photo de profil"/>:<UserRound size={18}/>}</button>
              {topProfileOpen&&<div className="top-profile-menu" role="menu" aria-label="Menu du profil"><div className="top-profile-identity">{profileAvatarUrl?<img src={profileAvatarUrl} alt=""/>:<span className="top-profile-initial">{(displayName||profileEmail||'U').slice(0,1).toUpperCase()}</span>}<div><strong>{displayName||'Utilisateur'}</strong><small>{profileEmail||'Compte utilisateur'}</small></div></div><div className="top-profile-divider"/><button role="menuitem" onClick={()=>{setActive('Mon profil');setTopProfileOpen(false)}}><UserRound size={15}/> Mon profil</button><button role="menuitem" onClick={()=>{setActive('Paramètres');setTopProfileOpen(false)}}><Settings size={15}/> Paramètres</button><button role="menuitem" onClick={()=>{setActive('Centre d’aide');setTopProfileOpen(false)}}><CircleHelp size={15}/> Centre d’aide</button><div className="top-profile-divider"/><button role="menuitem" className="top-profile-logout" onClick={()=>{setTopProfileOpen(false);void signOut()}}><LogOut size={15}/> Déconnexion</button></div>}
            </div>
          </div>
        </header>

        {active === 'Produits' || active === 'Entrepôts' ? <InventoryCatalog mode={active as 'Produits' | 'Entrepôts'} /> : active === 'Mouvements' ? <StockMovements /> : active === 'Clients' ? <Clients /> : active === 'Fournisseurs' ? <BusinessPartners /> : active === 'Transferts' ? <StockTransfers /> : active === 'Inventaires' ? <StockInventories /> : active === 'Achats' ? <CommercialDocuments mode="purchase" /> : active === 'Ventes' ? <CommercialDocuments mode="sale" /> : active === 'Caisse & finances' ? <Finance /> : active === 'Rapports' ? <Reports /> : active === 'Alertes' ? <StockAlerts /> : active === 'Administration' ? <Administration /> : active === 'Paramètres' ? <SettingsPage /> : active === 'Centre d’aide' ? <HelpCenter /> : active === 'Abonnement' ? <SubscriptionPage /> : active === 'Mon profil' ? <ProfilePage /> : <div className="content">
          <section className="welcome-hero">
            <span className="welcome-orb welcome-orb-one" aria-hidden="true" />
            <span className="welcome-orb welcome-orb-two" aria-hidden="true" />
            <span className="welcome-particle welcome-particle-one" aria-hidden="true" />
            <span className="welcome-particle welcome-particle-two" aria-hidden="true" />
            <span className="welcome-particle welcome-particle-three" aria-hidden="true" />
            <div className="welcome-hero-content">
              <div className="welcome-eyebrow"><span className="welcome-live-dot" /> {company.name.toUpperCase()} <span className="welcome-eyebrow-divider">/</span> ESPACE DE GESTION</div>
              <h1>{greeting}{displayName ? ', ' : ''}{displayName || 'et bienvenue'} <span className="welcome-wave" aria-label="salutations">👋</span></h1>
              <p>Nous vous souhaitons une excellente journée de travail.</p>
              <div className="welcome-date"><span className="welcome-date-mark" />{welcomeDate}</div>
            </div>
            <div className="welcome-hero-accent" aria-hidden="true">{company.logo_url ? <img src={company.logo_url} alt="" /> : null}</div>
          </section>

          <section className="quick-actions" aria-label="Actions rapides">
            {[
              { label: 'Nouveau produit', icon: Package, target: 'Produits', tone: 'quick-blue' },
              { label: 'Entrée de stock', icon: ArrowDownLeft, target: 'Mouvements', tone: 'quick-violet' },
              { label: 'Sortie de stock', icon: ArrowUpRight, target: 'Mouvements', tone: 'quick-orange' },
              { label: 'Transfert', icon: ArrowLeftRight, target: 'Transferts', tone: 'quick-teal' },
              { label: 'Inventaire', icon: Boxes, target: 'Inventaires', tone: 'quick-green' },
              { label: 'Achats', icon: Truck, target: 'Achats', tone: 'quick-cyan' },
              { label: 'Ventes', icon: ShoppingCart, target: 'Ventes', tone: 'quick-slate' },
              { label: 'Clients', icon: Users, target: 'Clients', tone: 'quick-navy' },
            ].map(({ label, icon: Icon, target, tone }) => (
              <button key={label} className={`quick-action ${tone}`} onClick={() => setActive(target)}>
                <Icon size={20} strokeWidth={1.9} />
                <span>{label}</span>
              </button>
            ))}
          </section>

          {!isSupabaseConfigured && <div className="setup-notice"><div><strong>Configuration Supabase requise</strong><p>Le socle visuel est initialisé. Ajoutez vos variables d’environnement pour connecter les données réelles.</p></div><code>VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY</code></div>}

          <section className="dashboard-live-section">
            <div className="dashboard-section-heading"><div><span className="eyebrow">INDICATEURS EN TEMPS RÉEL</span><h2>Activité de votre stock</h2><p>Données issues des enregistrements de votre espace.</p></div><button className="outline-button" onClick={()=>setActive('Rapports')}>Voir les rapports <ArrowUpRight size={14}/></button></div>
            {dashboardError&&<div className="catalog-error">Impossible de charger certains indicateurs : {dashboardError}</div>}
            <div className="dashboard-live-grid">
              <article className="dashboard-live-card"><span>Produits enregistrés</span><strong>{dashboardLoading?'—':dashboardStats.products.toLocaleString('fr-FR')}</strong><small>Catalogue produits</small></article>
              <article className="dashboard-live-card"><span>Valeur du stock</span><strong>{dashboardLoading?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(dashboardStats.stockValue)} <small>{company.currency_code||'GNF'}</small></strong><small>Au coût d’achat renseigné</small></article>
              <article className="dashboard-live-card"><span>Achats validés</span><strong>{dashboardLoading?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(dashboardStats.purchases)} <small>{company.currency_code||'GNF'}</small></strong><small>Total des achats comptabilisés</small></article>
              <article className="dashboard-live-card"><span>Ventes validées</span><strong>{dashboardLoading?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(dashboardStats.sales)} <small>{company.currency_code||'GNF'}</small></strong><small>Total des ventes comptabilisées</small></article>
              <article className="dashboard-live-card"><span>Références à réapprovisionner</span><strong>{dashboardLoading?'—':dashboardStats.lowStock.toLocaleString('fr-FR')}</strong><small>Seuil minimum atteint ou dépassé</small></article>
            </div>
            {!dashboardLoading&&!dashboardError&&dashboardStats.products===0&&<div className="dashboard-empty-note"><Boxes size={18}/> Aucun produit n’est encore enregistré. Les indicateurs se rempliront avec vos données réelles.</div>}
          </section>
          <footer className="footer"><span>© {currentTime.getFullYear()} {company.legal_name || company.name} · Gestion intelligente des stocks</span><span><i className="footer-dot"/> Plateforme prête pour configuration</span></footer>
        </div>}
      </main>
    </div>
  )
}


export default function App() {
  return <AuthGate><TenantSettingsProvider><Dashboard /></TenantSettingsProvider></AuthGate>
}
