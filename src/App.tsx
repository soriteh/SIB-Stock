import { useMemo, useState } from 'react'
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
import {
  Activity, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Bell, Boxes, Building2, Landmark, ShieldCheck,
  ChevronDown, CircleHelp, LayoutDashboard, Package,
  Search, Settings, ShoppingCart, Truck, Users, Warehouse,
} from 'lucide-react'
import { isSupabaseConfigured } from './lib/supabase'

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
  const filtered = useMemo(() => movements.filter((m) => [m.code, m.product, m.warehouse].join(' ').toLowerCase().includes(query.toLowerCase())), [query])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S<span>I</span>B</div>
          <div><strong>SIB Stock</strong><small>INVENTORY CLOUD</small></div>
        </div>
        <div className="workspace">
          <div className="workspace-icon"><Building2 size={17} /></div>
          <div className="workspace-copy"><strong>Mon entreprise</strong><small>Espace de travail</small></div>
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
        <div className="sidebar-bottom">
          <div className="nav-label">CONFIGURATION</div>
          <button className={active === 'Paramètres' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('Paramètres')}><Settings size={18}/><span>Paramètres</span></button>
          <button className={active === 'Centre d’aide' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('Centre d’aide')}><CircleHelp size={18}/><span>Centre d’aide</span></button>
          <div className="plan-card"><div className="plan-top"><span>OFFRE BUSINESS</span><span className="plan-dot"/></div><strong>Votre espace évolue</strong><p>Gérez vos stocks et vos équipes depuis un seul endroit.</p><button onClick={() => setActive('Abonnement')}>Gérer l’abonnement <ArrowUpRight size={14}/></button></div>
          <div className="profile"><div className="avatar">SC</div><div><strong>Administrateur</strong><small>admin@entreprise.com</small></div><ChevronDown size={15}/></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Application</span><b>/</b><strong>{active}</strong></div>
          <div className="top-actions">
            <div className="search-box"><Search size={16}/><input placeholder="Rechercher un produit, une référence..." value={query} onChange={(e) => setQuery(e.target.value)}/><kbd>⌘ K</kbd></div>
            <button className="icon-button" aria-label="Notifications"><Bell size={18}/><i/></button>
            <div className="top-avatar">SC</div>
          </div>
        </header>

        {active === 'Produits' || active === 'Entrepôts' ? <InventoryCatalog mode={active as 'Produits' | 'Entrepôts'} /> : active === 'Mouvements' ? <StockMovements /> : active === 'Clients' ? <Clients /> : active === 'Fournisseurs' ? <BusinessPartners /> : active === 'Transferts' ? <StockTransfers /> : active === 'Inventaires' ? <StockInventories /> : active === 'Achats' ? <CommercialDocuments mode="purchase" /> : active === 'Ventes' ? <CommercialDocuments mode="sale" /> : active === 'Caisse & finances' ? <Finance /> : active === 'Rapports' ? <Reports /> : active === 'Alertes' ? <StockAlerts /> : active === 'Administration' ? <Administration /> : active === 'Paramètres' ? <SettingsPage /> : active === 'Centre d’aide' ? <HelpCenter /> : <div className="content">
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="live-dot"/> ESPACE DE GESTION</div><h1>Bonjour, bienvenue 👋</h1><p>Voici ce qui se passe dans votre gestion de stock aujourd’hui.</p></div>
            <div className="date-chip">Jeudi 5 novembre 2026 <ChevronDown size={15}/></div>
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
          <footer className="footer"><span>© 2026 SIB Stock · Gestion intelligente des stocks</span><span><i className="footer-dot"/> Plateforme prête pour configuration</span></footer>
        </div>}
      </main>
    </div>
  )
}


export default function App() {
  return <AuthGate><Dashboard /></AuthGate>
}
