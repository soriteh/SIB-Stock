import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Activity, ArrowDownLeft, ArrowUpRight, LoaderCircle, Plus, RefreshCw, Search, Warehouse } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Product = { id: string; sku: string; name: string; unit_name: string; purchase_price: number; is_active: boolean }
type WarehouseRow = { id: string; code: string; name: string; is_active: boolean }
type Movement = { id: string; movement_type: string; quantity_delta: number; quantity_after: number; unit_cost: number | null; notes: string | null; created_at: string; products: { name: string; sku: string } | null; warehouses: { name: string } | null }
type StockRow = { quantity: number; reserved_quantity: number; products: { name: string; sku: string; unit_name: string; minimum_stock: number } | null; warehouses: { name: string } | null }
const movementLabels: Record<string, string> = { opening: 'Stock initial', receipt: 'Entrée / réception', sale: 'Sortie', transfer_in: 'Transfert entrant', transfer_out: 'Transfert sortant', adjustment_in: 'Ajustement positif', adjustment_out: 'Ajustement négatif', customer_return: 'Retour client', supplier_return: 'Retour fournisseur', reversal: 'Contrepassation' }
const money = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value) + ' GNF'
const quantity = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 }).format(value)

export default function StockMovements() {
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [productId, setProductId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [type, setType] = useState<'receipt' | 'sale' | 'adjustment_in' | 'adjustment_out'>('receipt')
  const [amount, setAmount] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError('')
    const [productResult, warehouseResult, movementResult, stockResult] = await Promise.all([
      supabase.from('products').select('id,sku,name,unit_name,purchase_price,is_active').eq('is_active', true).order('name'),
      supabase.from('warehouses').select('id,code,name,is_active').eq('is_active', true).order('name'),
      supabase.from('stock_movements').select('id,movement_type,quantity_delta,quantity_after,unit_cost,notes,created_at,products(name,sku),warehouses(name)').order('created_at', { ascending: false }).limit(100),
      supabase.from('stock_levels').select('quantity,reserved_quantity,products(name,sku,unit_name,minimum_stock),warehouses(name)').order('updated_at', { ascending: false }).limit(500),
    ])
    const firstError = productResult.error || warehouseResult.error || movementResult.error || stockResult.error
    if (firstError) setError(firstError.message)
    setProducts((productResult.data ?? []) as Product[])
    setWarehouses((warehouseResult.data ?? []) as WarehouseRow[])
    setMovements((movementResult.data ?? []) as unknown as Movement[])
    setStock((stockResult.data ?? []) as unknown as StockRow[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])
  const filteredMovements = useMemo(() => movements.filter(item => [item.products?.name, item.products?.sku, item.warehouses?.name, movementLabels[item.movement_type], item.notes].join(' ').toLowerCase().includes(query.toLowerCase())), [movements, query])
  const lowStock = stock.filter(item => item.products && Number(item.quantity) <= Number(item.products.minimum_stock))
  const totalUnits = stock.reduce((sum, item) => sum + Number(item.quantity), 0)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const parsedAmount = Number(amount)
    const parsedCost = unitCost.trim() ? Number(unitCost) : null
    if (!productId || !warehouseId || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0))) {
      setError('Vérifiez le produit, l’entrepôt, la quantité et le coût unitaire.')
      return
    }
    setBusy(true); setError(''); setNotice('')
    const delta = type === 'sale' || type === 'adjustment_out' ? -parsedAmount : parsedAmount
    try {
      const { error: rpcError } = await supabase.rpc('apply_stock_movement', {
        p_product_id: productId, p_warehouse_id: warehouseId, p_quantity_delta: delta,
        p_movement_type: type, p_unit_cost: parsedCost, p_notes: notes.trim() || null,
        p_idempotency_key: globalThis.crypto?.randomUUID?.() ?? `stock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      })
      if (rpcError) throw rpcError
      setNotice('Mouvement enregistré. Le stock a été recalculé automatiquement.')
      setAmount('1'); setUnitCost(''); setNotes(''); setShowForm(false)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible d’enregistrer le mouvement.'
      if (message.includes('Insufficient available stock')) setError('Stock insuffisant : la quantité demandée dépasse le stock disponible.')
      else if (message.toLowerCase().includes('permission')) setError('Votre rôle ne vous autorise pas à modifier le stock.')
      else setError(message)
    } finally { setBusy(false) }
  }

  return <div className="content catalog-page stock-page">
    <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> CONTRÔLE DES OPÉRATIONS</div><h1>Mouvements de stock</h1><p>Enregistrez les entrées, sorties et ajustements avec un historique sécurisé.</p></div><button className="primary-button catalog-add" onClick={() => { setShowForm(!showForm); setError('') }}><Plus size={15}/> Nouveau mouvement</button></section>
    {error && <div className="catalog-error">{error}</div>}{notice && <div className="catalog-notice">{notice}</div>}
    <section className="stats-grid stock-kpis">
      <article className="stat-card"><div className="stat-head"><span>Références suivies</span><div className="stat-icon blue"><Activity size={18}/></div></div><div className="stat-value">{stock.length}</div><div className="stat-note">Produits et entrepôts avec solde</div></article>
      <article className="stat-card"><div className="stat-head"><span>Unités en stock</span><div className="stat-icon green"><Warehouse size={18}/></div></div><div className="stat-value">{quantity(totalUnits)}</div><div className="stat-note">Somme des quantités physiques</div></article>
      <article className="stat-card"><div className="stat-head"><span>Alertes de seuil</span><div className="stat-icon orange"><ArrowDownLeft size={18}/></div></div><div className="stat-value">{lowStock.length}</div><div className="stat-note">Niveaux inférieurs au seuil minimum</div></article>
      <article className="stat-card"><div className="stat-head"><span>Mouvements récents</span><div className="stat-icon violet"><ArrowUpRight size={18}/></div></div><div className="stat-value">{movements.length}</div><div className="stat-note">Historique des 100 dernières opérations</div></article>
    </section>
    {showForm && <form className="catalog-form" onSubmit={submit}>
      <div className="catalog-form-heading"><strong>Nouvelle opération de stock</strong><button type="button" onClick={() => setShowForm(false)}>Fermer</button></div>
      <div className="catalog-fields">
        <label>Type d’opération<select value={type} onChange={e => setType(e.target.value as typeof type)}><option value="receipt">Entrée / réception</option><option value="sale">Sortie</option><option value="adjustment_in">Ajustement positif</option><option value="adjustment_out">Ajustement négatif</option></select></label>
        <label>Produit<select required value={productId} onChange={e => setProductId(e.target.value)}><option value="">Choisir un produit</option>{products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}</select></label>
        <label>Entrepôt<select required value={warehouseId} onChange={e => setWarehouseId(e.target.value)}><option value="">Choisir un entrepôt</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
        <label>Quantité<input required type="number" min="0.0001" step="0.0001" value={amount} onChange={e => setAmount(e.target.value)}/></label>
        <label>Coût unitaire (GNF)<input type="number" min="0" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="Facultatif"/></label>
        <label>Motif / référence<input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Bon, facture, commentaire…"/></label>
      </div>
      {products.length === 0 && <p className="catalog-footnote">Créez d’abord un produit actif pour enregistrer un mouvement.</p>}
      {warehouses.length === 0 && <p className="catalog-footnote">Créez d’abord un entrepôt actif pour enregistrer un mouvement.</p>}
      <div className="catalog-form-actions"><button type="button" className="outline-button" onClick={() => setShowForm(false)}>Annuler</button><button className="primary-button" disabled={busy || products.length === 0 || warehouses.length === 0}>{busy ? <LoaderCircle className="spin" size={14}/> : null} Valider le mouvement</button></div>
    </form>}
    <section className="panel catalog-panel"><div className="panel-heading"><div><h2>État actuel du stock</h2><p>Quantités réelles par produit et par entrepôt</p></div><button className="outline-button" onClick={() => void load()}><RefreshCw size={13}/> Actualiser</button></div>
      {loading ? <div className="catalog-loading"><LoaderCircle className="spin"/> Chargement…</div> : <div className="table-wrap"><table><thead><tr><th>RÉFÉRENCE</th><th>PRODUIT</th><th>ENTREPÔT</th><th>QUANTITÉ</th><th>RÉSERVÉ</th><th>DISPONIBLE</th><th>SEUIL</th></tr></thead><tbody>
        {stock.map((item, index) => <tr key={index}><td className="ref-cell">{item.products?.sku ?? '—'}</td><td className="product-cell">{item.products?.name ?? 'Produit'}</td><td>{item.warehouses?.name ?? 'Entrepôt'}</td><td>{quantity(Number(item.quantity))}</td><td>{quantity(Number(item.reserved_quantity))}</td><td className={Number(item.quantity) - Number(item.reserved_quantity) <= 0 ? 'qty-out' : 'qty-in'}>{quantity(Number(item.quantity) - Number(item.reserved_quantity))}</td><td>{quantity(Number(item.products?.minimum_stock ?? 0))}</td></tr>)}
        {stock.length === 0 && <tr><td colSpan={7} className="empty-state">Aucun stock initial. Enregistrez une entrée pour commencer.</td></tr>}
      </tbody></table></div>}
    </section>
    <section className="panel catalog-panel"><div className="panel-heading"><div><h2>Historique des mouvements</h2><p>100 dernières opérations validées · historique non modifiable</p></div><span className="catalog-count">{filteredMovements.length} mouvement(s)</span></div>
      <div className="catalog-toolbar"><div className="catalog-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un produit, dépôt ou motif…"/></div></div>
      {loading ? <div className="catalog-loading"><LoaderCircle className="spin"/> Chargement…</div> : <div className="table-wrap"><table><thead><tr><th>DATE</th><th>PRODUIT</th><th>ENTREPÔT</th><th>OPÉRATION</th><th>QUANTITÉ</th><th>SOLDE APRÈS</th><th>COÛT UNITAIRE</th><th>MOTIF</th></tr></thead><tbody>
        {filteredMovements.map(item => <tr key={item.id}><td className="date-cell">{new Date(item.created_at).toLocaleString('fr-FR')}</td><td className="product-cell">{item.products?.name ?? '—'}<small className="stock-subcell">{item.products?.sku ?? ''}</small></td><td>{item.warehouses?.name ?? '—'}</td><td>{movementLabels[item.movement_type] ?? item.movement_type}</td><td className={Number(item.quantity_delta) > 0 ? 'qty-in' : 'qty-out'}>{Number(item.quantity_delta) > 0 ? '+' : ''}{quantity(Number(item.quantity_delta))}</td><td>{quantity(Number(item.quantity_after))}</td><td>{item.unit_cost == null ? '—' : money(Number(item.unit_cost))}</td><td>{item.notes || '—'}</td></tr>)}
        {filteredMovements.length === 0 && <tr><td colSpan={8} className="empty-state">Aucun mouvement trouvé.</td></tr>}
      </tbody></table></div>}
    </section>
    <p className="catalog-footnote">Les quantités sont recalculées côté base de données dans une transaction. Les mouvements validés ne peuvent pas être modifiés ni supprimés.</p>
  </div>
}