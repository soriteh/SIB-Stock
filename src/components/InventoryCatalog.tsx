import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Barcode, Boxes, LoaderCircle, MapPin, Package, Plus, RefreshCw, Search, Warehouse } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatTenantMoney, useTenantSettings } from '../contexts/TenantSettingsContext'

type Mode = 'Produits' | 'Entrepôts'
type ProductRow = { id:string; sku:string; name:string; unit_name:string; purchase_price:number; sale_price:number; minimum_stock:number; is_active:boolean }
type WarehouseRow = { id:string; code:string; name:string; address:string|null; is_active:boolean }

export default function InventoryCatalog({ mode }: { mode: Mode }) {
  const { currency_code } = useTenantSettings()
  const money = (value:number) => formatTenantMoney(value,currency_code)
  const [products,setProducts] = useState<ProductRow[]>([])
  const [warehouses,setWarehouses] = useState<WarehouseRow[]>([])
  const [query,setQuery] = useState('')
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [showForm,setShowForm] = useState(false)
  const [name,setName] = useState('')
  const [sku,setSku] = useState('')
  const [barcode,setBarcode] = useState('')
  const [unit,setUnit] = useState('unité')
  const [purchase,setPurchase] = useState('0')
  const [sale,setSale] = useState('0')
  const [minimum,setMinimum] = useState('0')
  const [code,setCode] = useState('')
  const [address,setAddress] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true); setError('')
    if (mode === 'Produits') {
      const {data,error:err}=await supabase.from('products').select('id,sku,name,unit_name,purchase_price,sale_price,minimum_stock,is_active').order('name')
      if(err) setError(err.message)
      setProducts((data ?? []) as ProductRow[])
    } else {
      const {data,error:err}=await supabase.from('warehouses').select('id,code,name,address,is_active').order('name')
      if(err) setError(err.message)
      setWarehouses((data ?? []) as WarehouseRow[])
    }
    setLoading(false)
  },[mode])

  useEffect(()=>{ void load() },[load])

  async function submit(event:FormEvent) {
    event.preventDefault()
    if(!supabase) return
    setBusy(true); setError(''); setNotice('')
    try {
      const {data:tenantId,error:tenantError}=await supabase.rpc('current_tenant_id')
      if(tenantError || !tenantId) throw tenantError ?? new Error('Aucun espace entreprise actif.')
      if(mode==='Produits') {
        const {data,error:err}=await supabase.from('products').insert({
          tenant_id:tenantId,sku:sku.trim(),name:name.trim(),unit_name:unit.trim()||'unité',
          purchase_price:Number(purchase),sale_price:Number(sale),minimum_stock:Number(minimum),
        }).select('id').single()
        if(err) throw err
        if(barcode.trim()) {
          const {error:barcodeError}=await supabase.from('product_barcodes').insert({tenant_id:tenantId,product_id:data.id,barcode:barcode.trim(),barcode_type:'INTERNAL'})
          if(barcodeError) throw new Error('Produit créé, mais code-barres non enregistré : '+barcodeError.message)
        }
        setNotice('Produit enregistré.')
        setName('');setSku('');setBarcode('');setPurchase('0');setSale('0');setMinimum('0')
      } else {
        const {error:err}=await supabase.from('warehouses').insert({tenant_id:tenantId,code:code.trim(),name:name.trim(),address:address.trim()||null})
        if(err) throw err
        setNotice('Entrepôt enregistré.')
        setName('');setCode('');setAddress('')
      }
      setShowForm(false)
      await load()
    } catch(err) { setError(err instanceof Error?err.message:'Enregistrement impossible.') }
    finally { setBusy(false) }
  }

  const rows = mode==='Produits' ? products.filter(p=>[p.name,p.sku].join(' ').toLowerCase().includes(query.toLowerCase())) : warehouses.filter(w=>[w.name,w.code,w.address??''].join(' ').toLowerCase().includes(query.toLowerCase()))

  return <div className="content catalog-page">
    <section className="welcome-row">
      <div><div className="eyebrow"><span className="live-dot"/> CATALOGUE & LOGISTIQUE</div><h1>{mode}</h1><p>{mode==='Produits'?'Gérez vos références, prix, unités et codes-barres.':'Organisez vos dépôts et points de stockage.'}</p></div>
      <button className="primary-button catalog-add" onClick={()=>{setShowForm(!showForm);setError('')}}><Plus size={15}/>{mode==='Produits'?'Nouveau produit':'Nouvel entrepôt'}</button>
    </section>
    <section className="catalog-toolbar"><div className="catalog-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={mode==='Produits'?'Rechercher par nom ou référence…':'Rechercher un entrepôt…'}/></div><button className="outline-button" onClick={()=>void load()}><RefreshCw size={13}/> Actualiser</button><span className="catalog-total">{rows.length} {mode.toLowerCase()}</span></section>
    {error&&<div className="catalog-error">{error}</div>}{notice&&<div className="catalog-notice">{notice}</div>}
    {showForm&&<form className="catalog-form" onSubmit={submit}>
      <div className="catalog-form-heading"><strong>{mode==='Produits'?'Fiche nouveau produit':'Fiche nouvel entrepôt'}</strong><button type="button" onClick={()=>setShowForm(false)}>Fermer</button></div>
      <div className="catalog-fields">
        {mode==='Produits'?<>
          <label>Nom du produit<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Ex. Ordinateur portable"/></label>
          <label>Référence SKU<input required value={sku} onChange={e=>setSku(e.target.value)} placeholder="Ex. PC-HP-001"/></label>
          <label>Code-barres<input value={barcode} onChange={e=>setBarcode(e.target.value)} placeholder="EAN / UPC / code interne"/></label>
          <label>Unité<input required value={unit} onChange={e=>setUnit(e.target.value)}/></label>
          <label>Prix d'achat ({currency_code})<input type="number" min="0" step="0.01" required value={purchase} onChange={e=>setPurchase(e.target.value)}/></label>
          <label>Prix de vente ({currency_code})<input type="number" min="0" step="0.01" required value={sale} onChange={e=>setSale(e.target.value)}/></label>
          <label>Seuil minimum<input type="number" min="0" step="0.01" required value={minimum} onChange={e=>setMinimum(e.target.value)}/></label>
        </>:<>
          <label>Nom de l'entrepôt<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Ex. Dépôt principal"/></label>
          <label>Code<input required value={code} onChange={e=>setCode(e.target.value)} placeholder="Ex. DEP-001"/></label>
          <label>Adresse<input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Ville, quartier, adresse"/></label>
        </>}
      </div>
      <div className="catalog-form-actions"><button type="button" className="outline-button" onClick={()=>setShowForm(false)}>Annuler</button><button className="primary-button" disabled={busy}>{busy?<LoaderCircle className="spin" size={14}/>:null} Enregistrer</button></div>
    </form>}
    <section className="panel catalog-panel"><div className="panel-heading"><div><h2>{mode==='Produits'?'Référentiel des produits':'Liste des entrepôts'}</h2><p>Données de votre entreprise · accès sécurisé</p></div><span className="catalog-count">{rows.length} enregistrement(s)</span></div>
      {loading?<div className="catalog-loading"><LoaderCircle className="spin"/> Chargement des données…</div>:mode==='Produits'?<div className="table-wrap"><table><thead><tr><th>RÉFÉRENCE</th><th>PRODUIT</th><th>UNITÉ</th><th>ACHAT ({currency_code})</th><th>VENTE ({currency_code})</th><th>SEUIL</th><th>STATUT</th></tr></thead><tbody>{(rows as ProductRow[]).map(p=><tr key={p.id}><td className="ref-cell">{p.sku}</td><td className="product-cell">{p.name}</td><td>{p.unit_name}</td><td>{money(Number(p.purchase_price))}</td><td>{money(Number(p.sale_price))}</td><td>{p.minimum_stock}</td><td><span className={p.is_active?'status-pill':'type-pill out'}>{p.is_active?'Actif':'Inactif'}</span></td></tr>)}</tbody></table>{rows.length===0&&<div className="empty-state"><Package size={22}/><p>Aucun produit enregistré. Créez votre première référence.</p></div>}</div>:<div className="warehouse-grid">{(rows as WarehouseRow[]).map(w=><article className="warehouse-card" key={w.id}><div className="warehouse-card-icon"><Warehouse size={20}/></div><div><strong>{w.name}</strong><small>{w.code}</small><p><MapPin size={12}/>{w.address||'Adresse non renseignée'}</p></div><span className={w.is_active?'status-pill':'type-pill out'}>{w.is_active?'Actif':'Inactif'}</span></article>)}{rows.length===0&&<div className="empty-state"><Boxes size={22}/><p>Aucun entrepôt enregistré. Créez votre premier entrepôt.</p></div>}</div>}
    </section>
    <p className="catalog-footnote"><Barcode size={14}/> Les stocks sont modifiés uniquement par des mouvements validés, jamais directement depuis la fiche produit.</p>
  </div>
}
