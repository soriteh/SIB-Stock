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
import PlatformAdmin from './components/PlatformAdmin'
import Establishments from './components/Establishments'
import ProfilePage from './components/ProfilePage'
import DashboardOverview from './components/DashboardOverview'
import {
  Activity, ArrowLeftRight, Bell, Boxes, Building2, Landmark, Lock,
  ChevronDown, CircleHelp, CreditCard, LayoutDashboard, Package, LogOut,
  Search, Settings, ShoppingCart, Truck, Users, Warehouse, UserRound, Menu, PanelLeftClose, Sun, Moon, Monitor, ShieldCheck,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import { TenantSettingsProvider, useTenantSettings } from './contexts/TenantSettingsContext'
import { PlanAccessProvider, usePlanAccess, type PlanTier } from './contexts/PlanAccessContext'
import { EstablishmentProvider } from './contexts/EstablishmentContext'

const navigation = [
  { label: 'Vue d’ensemble', icon: LayoutDashboard },
  { label: 'Produits', icon: Package },
  { label: 'Entrepôts', icon: Warehouse },
  { label: 'Établissements', icon: Building2 },
  { label: 'Mouvements', icon: Activity },
  { label: 'Transferts', icon: ArrowLeftRight, requiredTier: 'business' as PlanTier },
  { label: 'Achats', icon: Truck, requiredTier: 'business' as PlanTier },
  { label: 'Ventes', icon: ShoppingCart, requiredTier: 'business' as PlanTier },
  { label: 'Inventaires', icon: Boxes },
  { label: 'Caisse & finances', icon: Landmark, requiredTier: 'business' as PlanTier },
  { label: 'Rapports', icon: Activity },
  { label: 'Alertes', icon: Bell },
  { label: 'Utilisateurs', icon: Users, requiredTier: 'business' as PlanTier },
  { label: 'Abonnement', icon: CreditCard },
  { label: 'Clients', icon: Users },
  { label: 'Fournisseurs', icon: Truck },
]


function Dashboard() {
  const [active, setActive] = useState('Vue d’ensemble')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [topProfileOpen, setTopProfileOpen] = useState(false)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [themeMode, setThemeMode] = useState<'auto' | 'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('sib-stock-theme')
      if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved
    } catch {}
    return 'auto'
  })
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  )
  const theme = themeMode === 'auto' ? systemTheme : themeMode
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [profileEmail, setProfileEmail] = useState('')
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const company = useTenantSettings()
  const { tier, loading: planLoading, canAccess } = usePlanAccess()
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const profileMenuAnchorRef = useRef<HTMLDivElement>(null)
  const profileDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (planLoading) return
    const protectedPages: Record<string, PlanTier> = { 'Transferts': 'business', 'Achats': 'business', 'Ventes': 'business', 'Caisse & finances': 'business', 'Utilisateurs': 'business' }
    const required = protectedPages[active]
    if (required && !canAccess(required)) setActive('Abonnement')
  }, [active, planLoading, tier, canAccess])

  useEffect(() => {
    let mounted = true
    async function loadPlatformRole() {
      if (!supabase) return
      const { data, error } = await supabase.rpc('is_platform_admin')
      if (mounted && !error) setIsPlatformAdmin(data === true)
    }
    void loadPlatformRole()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    async function loadAccount() {
      if (!supabase) return
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!mounted || !user) return
      setProfileEmail(user.email ?? '')
      let welcomeAlreadySeen = user.user_metadata?.sib_stock_welcome_seen === true
      if (!welcomeAlreadySeen) {
        try { welcomeAlreadySeen = localStorage.getItem('sib-stock-welcome-' + user.id) === 'seen' } catch {}
      }
      const { data: profile } = await supabase.from('profiles').select('full_name,avatar_path').eq('id', user.id).maybeSingle()
      if (mounted) {
        setDisplayName(profile?.full_name?.trim() || String(user.user_metadata?.full_name ?? '').trim() || user.email?.split('@')[0] || 'Utilisateur')
        if (!welcomeAlreadySeen) {
          setWelcomeOpen(true)
          try { localStorage.setItem('sib-stock-welcome-' + user.id, 'seen') } catch {}
          void supabase.auth.updateUser({ data: { sib_stock_welcome_seen: true } })
        }
      }
      if (profile?.avatar_path) {
        const { data: signed } = await supabase.storage.from('profile-avatars').createSignedUrl(profile.avatar_path, 3600)
        if (mounted) setProfileAvatarUrl(signed?.signedUrl ?? '')
      }
    }
    void loadAccount()
    const clock = window.setInterval(() => setCurrentTime(new Date()), 30000)
    return () => { mounted = false; window.clearInterval(clock) }
  }, [])


  useEffect(() => {
    const iconHref = company.logo_url || '/favicon.svg'
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.appendChild(icon) }
    icon.href = iconHref
    icon.type = company.logo_url ? (company.logo_url.toLowerCase().includes('.svg') ? 'image/svg+xml' : 'image/png') : 'image/svg+xml'
    let shortcut = document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]')
    if (!shortcut) { shortcut = document.createElement('link'); shortcut.rel = 'shortcut icon'; document.head.appendChild(shortcut) }
    shortcut.href = iconHref
  }, [company.logo_url])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => setSystemTheme(media.matches ? 'dark' : 'light')
    updateSystemTheme()
    media.addEventListener('change', updateSystemTheme)
    return () => media.removeEventListener('change', updateSystemTheme)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try { localStorage.setItem('sib-stock-theme', themeMode) } catch {}
  }, [theme, themeMode])

  useEffect(() => {
    if (!welcomeOpen) return
    const timeout = window.setTimeout(() => setWelcomeOpen(false), 4200)
    return () => window.clearTimeout(timeout)
  }, [welcomeOpen])

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

  const formattedDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Conakry' }).format(currentTime)
  const welcomeDate = formattedDate.charAt(0).toLocaleUpperCase('fr-FR') + formattedDate.slice(1)
  const formattedClock = new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Conakry'}).format(currentTime)

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
    <div className={`app-shell${sidebarCollapsed ? " sidebar-is-collapsed" : ""}${mobileSidebarOpen ? " mobile-sidebar-open" : ""}`}>
      {mobileSidebarOpen && <button type="button" className="sidebar-backdrop" aria-label="Fermer le menu" onClick={() => setMobileSidebarOpen(false)} />}
      <aside className="sidebar">
        <div className="brand">
          <div className={company.id ? (company.logo_url ? "brand-mark has-custom-logo" : "brand-mark") : "brand-mark brand-mark-loading"}>{company.id ? (company.logo_url ? <img src={company.logo_url} alt={"Logo "+company.name} /> : <>S<span>I</span>B</>) : null}</div>
          <div><strong>{company.name || "SIB Stock"}</strong></div>
        </div>
        <div className="sidebar-scroll">
          <div className="nav-label">ESPACE DE TRAVAIL</div>
          <nav className="navigation">
            {[...navigation, ...(isPlatformAdmin ? [{ label: 'Administration SaaS', icon: ShieldCheck }] : [])].map(({ label, icon: Icon, requiredTier }) => {
              const locked = Boolean(requiredTier && !planLoading && !canAccess(requiredTier))
              return <button key={label} title={locked ? 'Disponible à partir de l’offre Business' : label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => { setActive(locked ? 'Abonnement' : label); setMobileSidebarOpen(false) }}>
                <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{locked && <Lock size={13} className="nav-lock-icon" />}
              </button>
            })}
          </nav>
          <div className="sidebar-settings">
            <div className="nav-label">CONFIGURATION</div>
            <button className={active === 'Paramètres' ? 'nav-item active' : 'nav-item'} onClick={() => { setActive('Paramètres'); setMobileSidebarOpen(false) }}><Settings size={18}/><span>Paramètres</span></button>
            <button className={active === 'Centre d’aide' ? 'nav-item active' : 'nav-item'} onClick={() => { setActive('Centre d’aide'); setMobileSidebarOpen(false) }}><CircleHelp size={18}/><span>Centre d’aide</span></button>
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

      {welcomeOpen && <div className="first-welcome-toast" role="status" aria-live="polite"><span className="first-welcome-toast-mark">S<span>I</span>B</span><div><strong>Bienvenue, {displayName || "Utilisateur"} !</strong><small>Votre espace SIB Stock est prêt.</small></div><span className="first-welcome-toast-progress" /></div>}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-heading"><button type="button" className="sidebar-toggle" aria-label="Ouvrir ou replier le menu" aria-expanded={mobileSidebarOpen || !sidebarCollapsed} onClick={() => { if (window.matchMedia("(max-width: 760px)").matches) setMobileSidebarOpen(v => !v); else setSidebarCollapsed(v => !v) }}>{sidebarCollapsed ? <Menu size={19}/> : <PanelLeftClose size={19}/>}</button><h1 className="topbar-title">{active}</h1></div>
          <div className="top-actions">
            <div className="topbar-datetime"><strong>{formattedClock}</strong><span>{welcomeDate}</span></div>
            <label className="search-box" aria-label="Rechercher dans les mouvements récents"><Search size={19}/><input ref={searchInputRef} placeholder="Rechercher un produit, une référence..." value={query} onChange={(e) => setQuery(e.target.value)}/><kbd>⌘ K</kbd>{query&&<button type="button" className="search-clear" aria-label="Effacer la recherche" onClick={()=>setQuery('')}>×</button>}</label>

            <button type="button" className="theme-toggle" aria-label={themeMode === 'auto' ? 'Thème automatique actif' : themeMode === 'dark' ? 'Passer au thème clair' : 'Passer au thème automatique'} title={themeMode === 'auto' ? `Thème automatique (système : ${systemTheme === 'dark' ? 'sombre' : 'clair'}) — cliquer pour changer` : themeMode === 'dark' ? 'Thème sombre — cliquer pour passer au thème clair' : 'Thème clair — cliquer pour passer au thème automatique'} onClick={() => setThemeMode(current => current === 'auto' ? 'dark' : current === 'dark' ? 'light' : 'auto')}><span className="theme-toggle-icon">{themeMode === 'auto' ? <Monitor size={18}/> : theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</span></button>
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

        {active === 'Établissements' ? <Establishments /> : active === 'Produits' || active === 'Entrepôts' ? <InventoryCatalog mode={active as 'Produits' | 'Entrepôts'} /> : active === 'Mouvements' ? <StockMovements /> : active === 'Clients' ? <Clients /> : active === 'Fournisseurs' ? <BusinessPartners /> : active === 'Transferts' ? <StockTransfers /> : active === 'Inventaires' ? <StockInventories /> : active === 'Achats' ? <CommercialDocuments mode="purchase" /> : active === 'Ventes' ? <CommercialDocuments mode="sale" /> : active === 'Caisse & finances' ? <Finance /> : active === 'Rapports' ? <Reports /> : active === 'Alertes' ? <StockAlerts /> : active === 'Utilisateurs' ? <Administration /> : active === 'Paramètres' ? <SettingsPage /> : active === 'Centre d’aide' ? <HelpCenter /> : active === 'Abonnement' ? <SubscriptionPage /> : active === 'Mon profil' ? <ProfilePage /> : active === 'Administration SaaS' && isPlatformAdmin ? <PlatformAdmin /> : <DashboardOverview onNavigate={setActive} displayName={displayName} currentTime={currentTime} />}
      </main>
    </div>
  )
}


export default function App() {
  return <AuthGate><TenantSettingsProvider><PlanAccessProvider><EstablishmentProvider><Dashboard /></EstablishmentProvider></PlanAccessProvider></TenantSettingsProvider></AuthGate>
}
