import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeftRight, LoaderCircle, RefreshCw, Search, Warehouse } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Product={id:string;sku:string;name:string;unit_name:string}
type WarehouseRow={id:string;code:string;name:string}
type Transfer={id:string;reference:string;product_id:string;source_warehouse_id:string;destination_warehouse_id:string;quantity:number;notes:string|null;created_at:string}
export default function StockTransfers(){
 const [products,setProducts]=useState<Product[]>([])
 const [warehouses,setWarehouses]=useState<WarehouseRow[]>([])
 const [rows,setRows]=useState<Transfer[]>([])
 const [product,setProduct]=useState('');const [source,setSource]=useState('');const [destination,setDestination]=useState('')
 const [quantity,setQuantity]=useState('1');const [notes,setNotes]=useState('')
 const [query,setQuery]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false)
 const [error,setError]=useState('');const [notice,setNotice]=useState('')
 const load=useCallback(async()=>{
  if(!supabase)return
  setLoading(true);setError('')
  const [p,w,t]=await Promise.all([
   supabase.from('products').select('id,sku,name,unit_name').eq('is_active',true).order('name'),
   supabase.from('warehouses').select('id,code,name').eq('is_active',true).order('name'),
   supabase.from('stock_transfers').select('id,reference,product_id,source_warehouse_id,destination_warehouse_id,quantity,notes,created_at').order('created_at',{ascending:false}).limit(100)
  ])
  if(p.error||w.error||t.error)setError(p.error?.message||w.error?.message||t.error?.message||'Chargement impossible.')
  setProducts((p.data??[]) as Product[]);setWarehouses((w.data??[]) as WarehouseRow[]);setRows((t.data??[]) as unknown as Transfer[])
  setLoading(false)
 },[])
 useEffect(()=>{void load()},[load])
 const filtered=useMemo(()=>rows.filter(r=>[r.reference,products.find(p=>p.id===r.product_id)?.name??'',products.find(p=>p.id===r.product_id)?.sku??'',warehouses.find(w=>w.id===r.source_warehouse_id)?.name??'',warehouses.find(w=>w.id===r.destination_warehouse_id)?.name??''].join(' ').toLowerCase().includes(query.toLowerCase())),[rows,query,products,warehouses])
 async function submit(e:FormEvent){
  e.preventDefault();if(!supabase)return
  if(!product||!source||!destination){setError('Sélectionnez le produit et les deux entrepôts.');return}
  if(source===destination){setError('Les entrepôts source et destination doivent être différents.');return}
  if(Number(quantity)<=0){setError('La quantité doit être supérieure à zéro.');return}
  setBusy(true);setError('');setNotice('')
  try{
   const {data,error:err}=await supabase.rpc('execute_stock_transfer',{p_product_id:product,p_source_warehouse_id:source,p_destination_warehouse_id:destination,p_quantity:Number(quantity),p_notes:notes.trim()||null,p_idempotency_key:crypto.randomUUID()})
   if(err)throw err
   setNotice('Transfert validé. Les deux stocks ont été mis à jour.')
   setQuantity('1');setNotes('')
   await load()
  }catch(e){setError(e instanceof Error?e.message:'Le transfert a échoué.')}
  finally{setBusy(false)}
 }
 return <div className="content catalog-page transfer-page">
  <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> LOGISTIQUE MULTI-ENTREPÔTS</div><h1>Transferts de stock</h1><p>Déplacez les articles entre dépôts avec une mise à jour atomique des deux stocks.</p></div><button className="outline-button" onClick={()=>void load()}><RefreshCw size={13}/> Actualiser</button></section>
  {error&&<div className="catalog-error">{error}</div>}{notice&&<div className="catalog-notice">{notice}</div>}
  <form className="catalog-form" onSubmit={submit}>
   <div className="catalog-form-heading"><strong><ArrowLeftRight size={15}/> Nouveau transfert</strong><span className="transfer-hint">Le stock source ne peut pas devenir négatif</span></div>
   <div className="catalog-fields">
    <label>Produit<select required value={product} onChange={e=>setProduct(e.target.value)}><option value="">Sélectionner un produit</option>{products.map(p=><option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}</select></label>
    <label>Entrepôt de départ<select required value={source} onChange={e=>setSource(e.target.value)}><option value="">Sélectionner le départ</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
    <label>Entrepôt de destination<select required value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Sélectionner la destination</option>{warehouses.filter(w=>w.id!==source).map(w=><option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
    <label>Quantité à transférer<input required type="number" min="0.0001" step="0.0001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
    <label className="transfer-notes">Motif / observations<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Motif du transfert (facultatif)"/></label>
   </div>
   <div className="catalog-form-actions"><button className="primary-button" disabled={busy||!products.length||warehouses.length<2}>{busy?<LoaderCircle className="spin" size={14}/>:<ArrowLeftRight size={14}/>} Valider le transfert</button></div>
  </form>
  <section className="panel catalog-panel"><div className="panel-heading"><div><h2>Historique des transferts</h2><p>Les entrées et sorties correspondantes sont conservées dans l’historique des mouvements.</p></div><span className="catalog-count">{filtered.length} transfert(s)</span></div>
   <div className="catalog-toolbar"><div className="catalog-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Référence, produit ou entrepôt…"/></div></div>
   {loading?<div className="catalog-loading"><LoaderCircle className="spin"/> Chargement…</div>:<div className="table-wrap"><table><thead><tr><th>RÉFÉRENCE</th><th>PRODUIT</th><th>DÉPART</th><th>DESTINATION</th><th>QUANTITÉ</th><th>DATE</th><th>STATUT</th></tr></thead><tbody>
    {filtered.map(r=><tr key={r.id}><td className="ref-cell">{r.reference}</td><td><strong>{r.products?.name??'—'}</strong><small className="stock-subcell">{r.products?.sku}</small></td><td>{warehouses.find(w=>w.id===r.source_warehouse_id)?.name??'—'}</td><td>{warehouses.find(w=>w.id===r.destination_warehouse_id)?.name??'—'}</td><td><strong>{Number(r.quantity).toLocaleString('fr-FR')}</strong></td><td>{new Date(r.created_at).toLocaleString('fr-FR')}</td><td><span className="status-pill">Terminé</span></td></tr>)}
    {filtered.length===0&&<tr><td colSpan={7} className="empty-state">Aucun transfert enregistré.</td></tr>}
   </tbody></table></div>}
  </section>
  <p className="catalog-footnote"><Warehouse size={14}/> Chaque transfert crée deux mouvements liés et est exécuté dans une seule transaction PostgreSQL.</p>
 </div>
}
