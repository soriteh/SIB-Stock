import { useEffect, useMemo, useRef, useState } from 'react'
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
  Search, Settings, ShoppingCart, Truck, Users, Warehouse, UserRound,
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

const movements = [
  { code: 'MVT-2026-0148', product: 'Ordinateur portable HP 15', warehouse: 'Dépôt principal', type: 'Entrée', qty: '+12', date: 'Aujourd’hui, 10:42', status: 'Validé' },
  { code: 'MVT-2026-0147', product: 'Cartouche HP 305 noire', warehouse: 'Magasin Kipé', type: 'Sortie', qty: '-4', date: 'Aujourd’hui, 09:18', status: 'Validé' },
  { code: 'MVT-2026-0146', product: 'Câble réseau RJ45', warehouse: 'Dépôt principal', type: 'Entrée', qty: '+50', date: 'Hier, 16:35', status: 'Validé' },
  { code: 'MVT-2026-0145', product: 'Souris sans fil Logitech', warehouse: 'Magasin Kipé', type: 'Sortie', qty: '-8', date: 'Hier, 14:12', status: 'Validé' },
]

const stats = [
  { label: 'Références produits', value: '1 284', note: '+8,2 % ce mois', icon: Package, tone: 'blue' },
  { label: 'Valeur du stock', value: '284,6 M', suffix: 'GNF', note: 'Coût de valorisation', icon: Boxes, tone: 'violet' },
  { label: 'Entrées du mois', value: '426', note: '+12,4 % vs mois dernier', icon: ArrowDownLeft, tone: 'green' },
  { label: 'Sorties du mois', value: '318', note: 'Toutes opérations confondues', icon: ArrowUpRight, tone: 'orange' },
]

function Dashboard() {
  const [active, setActive] = useState('Vue d’ensemble')
  const [query, setQuery] = useState('')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [profileEmail, setProfileEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const company = useTenantSettings()
  const [currentTime, setCurrentTime] = useState(() => new Date())
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
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      if (mounted) setDisplayName(profile?.full_name?.trim() || String(user.user_metadata?.full_name ?? '').trim() || user.email?.split('@')[0] || 'Utilisateur')
    }
    void loadAccount()
    const clock = window.setInterval(() => setCurrentTime(new Date()), 60000)
    return () => { mounted = false; window.clearInterval(clock) }
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
  const filtered = useMemo(() => movements.filter((m) => [m.code, m.product, m.warehouse].join(' ').toLowerCase().includes(query.toLowerCase())), [query])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className={company.logo_url ? "brand-mark has-custom-logo" : "brand-mark"}>{company.logo_url ? <img src={company.logo_url} alt={"Logo "+company.name}/> : <>S<span>I</span>B</>}</div>
          <div><strong>{company.name || "SIB Stock"}</strong><small>INVENTORY CLOUD</small></div>
        </div>
        <div className="sidebar-scroll">
          <div className="workspace">
            <div className="workspace-icon"><Building2 size={17} /></div>
            <div className="workspace-copy"><strong>{company.name || "Mon entreprise"}</strong><small>{company.email || company.phone || "Espace de travail"}</small></div>
            <ChevronDown size={15} />
          </div>
          <div className="nav-label">ESPACE DE TRAVAIL</div>
          <nav className="navigation">
            {navigation.map(({ label, icon: Icon }) => (
              <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => setActive(label)}>
                <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
                {label === 'Mouvements' && <i className="nav-count">4</i>}
              </button>
            ))}
          </nav>
          <div className="sidebar-settings">
            <div className="nav-label">CONFIGURATION</div>
            <button className={active === 'Paramètres' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('Paramètres')}><Settings size={18}/><span>Paramètres</span></button>
            <button className={active === 'Centre d’aide' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('Centre d’aide')}><CircleHelp size={18}/><span>Centre d’aide</span></button>
          </div>
          <div className="plan-card"><div className="plan-top"><span>OFFRE BUSINESS</span><span className="plan-dot"/></div><strong>Votre espace évolue</strong><p>Gérez vos stocks et vos équipes depuis un seul endroit.</p><button onClick={() => setActive('Abonnement')}>Gérer l’abonnement <ArrowUpRight size={14}/></button></div>
        </div>
        <div className="sidebar-bottom">
          <div className="profile-menu-anchor" ref={profileMenuAnchorRef}>
            {profileMenuOpen && createPortal(<div ref={profileDropdownRef} className="profile-dropdown" role="menu" aria-label="Menu du compte">
              <div className="profile-dropdown-heading"><div className="profile-dropdown-avatar"><UserRound size={17}/></div><div><strong>Compte utilisateur</strong><small>{profileEmail || "Compte connecté"}</small></div></div>
              <div className="profile-dropdown-divider"/>
              <button role="menuitem" onClick={() => openProfileSection("Mon profil")}><UserRound size={16}/><span>Mon profil</span></button>
              <button role="menuitem" onClick={() => openProfileSection("Paramètres")}><Settings size={16}/><span>Paramètres</span></button>
              <button role="menuitem" onClick={() => openProfileSection("Centre d’aide")}><CircleHelp size={16}/><span>Centre d’aide</span></button>
              <div className="profile-dropdown-divider"/>
              <button role="menuitem" className="profile-dropdown-logout" onClick={signOut}><LogOut size={16}/><span>Déconnexion</span></button>
            </div>, document.body)}
            <button className="profile profile-trigger" aria-expanded={profileMenuOpen} aria-haspopup="menu" onClick={() => setProfileMenuOpen(v => !v)}><div className="avatar"><UserRound size={17}/></div><div><strong>Mon compte</strong><small>{profileEmail || "Compte utilisateur"}</small></div><ChevronDown size={15} className={profileMenuOpen ? "profile-chevron open" : "profile-chevron"}/></button>
          </div>
          <button className="sidebar-logout" onClick={signOut}><LogOut size={16}/><span>Se déconnecter</span></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Application</span><b>/</b><strong>{active}</strong></div>
          <div className="top-actions">
            <div className="search-box"><Search size={16}/><input placeholder="Rechercher un produit, une référence..." value={query} onChange={(e) => setQuery(e.target.value)}/><kbd>⌘ K</kbd></div>
            <button className="icon-button" aria-label="Notifications"><Bell size={18}/><i/></button>
            <button className="top-avatar top-avatar-button" aria-label="Ouvrir mon profil" onClick={() => setActive('Mon profil')}><UserRound size={17}/></button>
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

          <section className="stats-grid">
            {stats.map(({ label, value, suffix, note, icon: Icon, tone }) => (
              <article className="stat-card" key={label}>
                <div className="stat-head"><span>{label}</span><div className={'stat-icon '+tone}><Icon size={18}/></div></div>
                <div className="stat-value">{value}<small>{suffix}</small></div><div className="stat-note">{note}</div>
              </article>
            ))}
          </section>

          <section className="middle-grid">
            <article className="panel stock-panel">
              <div className="panel-heading"><div><h2>État du stock</h2><p>Répartition de vos références produits</p></div><button className="text-button">Voir le rapport <ArrowUpRight size={15}/></button></div>
              <div className="stock-summary"><div className="donut"><div><strong>1 284</strong><small>Produits</small></div></div><div className="legend">
                <div><i className="legend-dot available"/><span>Disponible</span><strong>1 096</strong></div>
                <div><i className="legend-dot low"/><span>Stock faible</span><strong>142</strong></div>
                <div><i className="legend-dot empty"/><span>En rupture</span><strong>46</strong></div>
              </div></div>
            </article>
            <article className="panel alert-panel">
              <div className="panel-heading"><div><h2>Alertes de stock</h2><p>Produits nécessitant votre attention</p></div><span className="alert-badge">3 alertes</span></div>
              <div className="alert-row"><div className="alert-symbol red"><Package size={17}/></div><div><strong>Cartouche HP 305 noire</strong><small>Réf. CART-305 · Seuil minimum : 10</small></div><b className="quantity danger">3 unités</b></div>
              <div className="alert-row"><div className="alert-symbol amber"><Package size={17}/></div><div><strong>Souris sans fil Logitech</strong><small>Réf. LOG-M185 · Seuil minimum : 15</small></div><b className="quantity warning">8 unités</b></div>
              <div className="alert-row"><div className="alert-symbol red"><Package size={17}/></div><div><strong>Disque SSD 500 Go</strong><small>Réf. SSD-500 · Seuil minimum : 5</small></div><b className="quantity danger">0 unité</b></div>
            </article>
          </section>

          <section className="panel movement-panel">
            <div className="panel-heading movement-heading"><div><h2>Derniers mouvements</h2><p>Suivi des entrées et sorties de marchandises</p></div><div className="heading-actions"><button className="outline-button">Exporter</button><button className="primary-button">+ Nouveau mouvement</button></div></div>
            <div className="table-wrap"><table><thead><tr><th>RÉFÉRENCE</th><th>PRODUIT</th><th>ENTREPÔT</th><th>TYPE</th><th>QUANTITÉ</th><th>DATE</th><th>STATUT</th></tr></thead><tbody>
              {filtered.map((m) => <tr key={m.code}><td className="ref-cell">{m.code}</td><td className="product-cell">{m.product}</td><td>{m.warehouse}</td><td><span className={m.type === 'Entrée' ? 'type-pill in' : 'type-pill out'}>{m.type}</span></td><td className={m.type === 'Entrée' ? 'qty-in' : 'qty-out'}>{m.qty}</td><td className="date-cell">{m.date}</td><td><span className="status-pill">{m.status}</span></td></tr>)}
              {filtered.length === 0 && <tr><td colSpan={7} className="empty-state">Aucun mouvement ne correspond à votre recherche.</td></tr>}
            </tbody></table></div>
            <div className="table-footer"><span>Affichage de {filtered.length} mouvements récents</span><button className="text-button">Consulter l’historique <ArrowUpRight size={15}/></button></div>
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
