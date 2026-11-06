import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, LoaderCircle, Plus, RefreshCw, Save, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Warehouse={id:string;code:string;name:string}
type Product={id:string;sku:string;name:string;unit_name:string}
type Count={id:string;reference:string;warehouse_id:string;status:'draft'|'completed'|'cancelled';created_at:string;completed_at:string|null;notes:string|null}
type Line={id:string;count_id:string;product_id:string;system_quantity:number;counted_quantity:number|null;difference:number|null}
export default function StockInventories(){
 const [warehouses,setWarehouses]=useState<Warehouse[]>([])
 const [products,setProducts]=useState<Product[]>([])
 const [counts,setCounts]=useState<Count[]>([])
 const [lines,setLines]=useState<Line[]>([])
 const [selected,setSelected]=useState('')
 const [warehouse,setWarehouse]=useState('')
 const [notes,setNotes]=useState('')
 const [query,setQuery]=useState('')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [savingLine,setSavingLine]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const load=useCallback(async()=>{
  if(!supabase)return
  setLoading(true);setError('')
  const [w,p,c]=await Promise.all([
   supabase.from('warehouses').select('id,code,name').eq('is_active',true).order('name'),
   supabase.from('products').select('id,sku,name,unit_name').eq('is_active',true).order('name'),
   supabase.from('stock_counts').select('id,reference,warehouse_id,status,created_at,completed_at,notes').order('created_at',{ascending:false}).limit(50)
  ])
  if(w.error||p.error||c.error)setError(w.error?.message||p.error?.message||c.error?.message||'Chargement impossible.')
  setWarehouses((w.data??[]) as Warehouse[]);setProducts((p.data??[]) as Product[]);setCounts((c.data??[]) as Count[])
  setLoading(false)
 },[])
 useEffect(()=>{void load()},[load])
 const active=counts.find(c=>c.id===selected)
 const loadLines=useCallback(async(id:string)=>{
  if(!supabase)return
  const {data,error:err}=await supabase.from('stock_count_lines').select('id,count_id,product_id,system_quantity,counted_quantity,difference').eq('count_id',id).order('product_id')
  if(err){setError(err.message);return}
  setLines((data??[]) as Line[])
 },[])
 useEffect(()=>{if(selected)void loadLines(selected);else setLines([])},[selected,loadLines])
 async function start(){
  if(!supabase||!warehouse)return
  setBusy(true);setError('');setNotice('')
  const {data,error:err}=await supabase.rpc('start_stock_count',{p_warehouse_id:warehouse,p_notes:notes.trim()||null})
  if(err)setError(err.message)
  else{setSelected(data as string);setNotes('');setNotice('Session d’inventaire créée. Saisissez les quantités physiques relevées.');await load()}
  setBusy(false)
 }
 async function saveLine(line:Line,value:string){
  if(!supabase)return
  const n=Number(value)
  if(value.trim()===''||!Number.isFinite(n)||n<0){setError('La quantité comptée doit être égale ou supérieure à zéro.');return}
  setError('');setSavingLine(true)
  const {error:err}=await supabase.rpc('set_stock_count_line',{p_count_id:line.count_id,p_product_id:line.product_id,p_counted_quantity:n})
  if(err){setError(err.message);setSavingLine(false);return}
  setLines(prev=>prev.map(x=>x.id===line.id?{...x,counted_quantity:n}:x));setSavingLine(false)
 }
 async function finalize(){
  if(!supabase||!selected)return
  if(lines.some(l=>l.counted_quantity===null)){setError('Tous les articles doivent être comptés avant la clôture.');return}
  if(!window.confirm('Confirmer la clôture ? Les écarts seront appliqués au stock et les mouvements seront enregistrés.'))return
  setBusy(true);setError('');setNotice('')
  const {error:err}=await supabase.rpc('finalize_stock_count',{p_count_id:selected})
  if(err)setError(err.message)
  else{setNotice('Inventaire clôturé. Les écarts ont été régularisés dans les mouvements de stock.');await load();await loadLines(selected)}
  setBusy(false)
 }
 const filtered=useMemo(()=>lines.filter(l=>{const p=products.find(x=>x.id===l.product_id);return [p?.name??'',p?.sku??''].join(' ').toLowerCase().includes(query.toLowerCase())}),[lines,products,query])
 const counted=lines.filter(l=>l.counted_quantity!==null).length
 const difference=lines.reduce((s,l)=>s+(l.counted_quantity===null?0:Number(l.counted_quantity)-Number(l.system_quantity)),0)
 return <div className="content catalog-page inventory-page">
  <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> CONTRÔLE PHYSIQUE DU STOCK</div><h1>Inventaires</h1><p>Comparez les quantités physiques au stock théorique et régularisez les écarts.</p></div><button className="outline-button" onClick={()=>void load()}><RefreshCw size={13}/> Actualiser</button></section>
  {error&&<div className="catalog-error">{error}</div>}{notice&&<div className="catalog-notice">{notice}</div>}
  <section className="panel catalog-form"><div className="catalog-form-heading"><strong><Plus size={15}/> Démarrer un inventaire</strong></div><div className="catalog-fields">
   <label>Entrepôt<select value={warehouse} onChange={e=>setWarehouse(e.target.value)}><option value="">Sélectionner un entrepôt</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
   <label className="inventory-note">Notes<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ex. Inventaire mensuel de novembre"/></label>
  </div><div className="catalog-form-actions"><button className="primary-button" type="button" onClick={()=>void start()} disabled={busy||!warehouse}>{busy?<LoaderCircle className="spin" size={14}/>:<Plus size={14}/>} Créer la session</button></div></section>
  <div className="inventory-layout">
   <section className="panel catalog-panel"><div className="panel-heading"><div><h2>Sessions d’inventaire</h2><p>Historique et sessions en cours</p></div><span className="catalog-count">{counts.length}</span></div>
    {loading?<div className="catalog-loading"><LoaderCircle className="spin"/> Chargement…</div>:<div className="inventory-count-list">{counts.map(c=><button key={c.id} className={selected===c.id?'inventory-count-item selected':'inventory-count-item'} onClick={()=>{setSelected(c.id);setNotice('');setError('')}}><strong>{c.reference}</strong><small>{warehouses.find(w=>w.id===c.warehouse_id)?.name??'Entrepôt'}</small><span className={c.status==='completed'?'status-pill':'partner-type-pill'}>{c.status==='completed'?'Clôturé':c.status==='draft'?'En cours':'Annulé'}</span><time>{new Date(c.created_at).toLocaleDateString('fr-FR')}</time></button>)}{counts.length===0&&<div className="empty-state">Aucune session d’inventaire.</div>}</div>}
   </section>
   <section className="panel catalog-panel inventory-detail"><div className="panel-heading"><div><h2>{active?active.reference:'Détail de l’inventaire'}</h2><p>{active?warehouses.find(w=>w.id===active.warehouse_id)?.name:'Sélectionnez une session pour afficher les articles.'}</p></div>{active&&<span className={active.status==='completed'?'status-pill':'partner-type-pill'}>{active.status==='completed'?'Clôturé':'Brouillon'}</span>}</div>
    {active&&<><div className="inventory-metrics"><div><strong>{lines.length}</strong><small>Articles à compter</small></div><div><strong>{counted}/{lines.length}</strong><small>Comptages saisis</small></div><div><strong>{difference.toLocaleString('fr-FR')}</strong><small>Écart net</small></div></div>
     <div className="catalog-toolbar"><div className="catalog-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un article…"/></div><span className="catalog-total">{filtered.length} article(s)</span></div>
     <div className="table-wrap"><table><thead><tr><th>RÉFÉRENCE</th><th>ARTICLE</th><th>STOCK SYSTÈME</th><th>QUANTITÉ COMPTÉE</th><th>ÉCART</th></tr></thead><tbody>{filtered.map(l=>{const p=products.find(x=>x.id===l.product_id);const diff=l.counted_quantity===null?null:Number(l.counted_quantity)-Number(l.system_quantity);return <tr key={l.id}><td className="ref-cell">{p?.sku??'—'}</td><td><strong>{p?.name??'Produit'}</strong><small className="stock-subcell">{p?.unit_name}</small></td><td>{Number(l.system_quantity).toLocaleString('fr-FR')}</td><td><input className="count-quantity" type="number" min="0" step="0.0001" disabled={active.status!=='draft'} value={l.counted_quantity??''} placeholder="À compter" onChange={e=>setLines(prev=>prev.map(x=>x.id===l.id?{...x,counted_quantity:e.target.value===''?null:Number(e.target.value)}:x))} onBlur={e=>{if(e.target.value!=='')void saveLine(l,e.target.value)}}/></td><td className={diff===null?'':diff>0?'qty-in':diff<0?'qty-out':''}>{diff===null?'—':diff>0?'+'+diff.toLocaleString('fr-FR'):diff.toLocaleString('fr-FR')}</td></tr>})}{filtered.length===0&&<tr><td colSpan={5} className="empty-state">Aucun article à afficher.</td></tr>}</tbody></table></div>
     {active.status==='draft'&&<div className="inventory-finalize"><span>{counted} comptage(s) enregistré(s) sur {lines.length}</span><button className="primary-button" disabled={busy||savingLine||counted!==lines.length||lines.length===0} onClick={()=>void finalize()}>{busy?<LoaderCircle className="spin" size={14}/>:<ClipboardCheck size={14}/>} Clôturer et régulariser</button></div>}
    </>}
   </section>
  </div>
  <p className="catalog-footnote"><Save size={14}/> Les quantités comptées sont enregistrées sur chaque article. La clôture applique les écarts par mouvements d’ajustement traçables.</p>
 </div>
}
