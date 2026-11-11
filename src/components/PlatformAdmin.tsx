import { useCallback, useEffect, useState } from 'react'
import { Activity, Building2, CalendarClock, Check, Clock3, LoaderCircle, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Tenant = { id:string; name:string; slug:string; status:string; country_code:string; currency_code:string; created_at:string; subscription_status:string|null; plan_name:string|null; period_end:string|null; trial_ends_at:string|null }
type RequestRow = { id:string; tenant_id:string; tenant_name:string; plan_name:string|null; requested_plan_id:string; payment_method:string; payment_reference:string|null; note:string|null; status:string; created_at:string }
type Overview = { stats:{tenants:number;active_tenants:number;subscriptions:number;pending_requests:number}; tenants:Tenant[]; requests:RequestRow[]; plans:{id:string;name:string;code:string;price_amount:number|null;currency_code:string;billing_interval:string;is_active:boolean}[] }

const date=(v:string|null)=>v?new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'}).format(new Date(v)):'—'
const money=(v:number|null,c:string)=>v===null?'Sur devis':new Intl.NumberFormat('fr-FR',{style:'currency',currency:c||'GNF',maximumFractionDigits:0}).format(v)

export default function PlatformAdmin(){
 const [data,setData]=useState<Overview|null>(null)
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState('')
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const load=useCallback(async()=>{
  if(!supabase){setError('Connexion Supabase indisponible.');setLoading(false);return}
  setLoading(true);setError('')
  const {data:result,error:e}=await supabase.rpc('get_platform_admin_overview')
  if(e){setError(e.message);setData(null)}else setData(result as Overview)
  setLoading(false)
 },[])
 useEffect(()=>{void load()},[load])
 async function review(id:string,decision:'approved'|'rejected'){
  if(!supabase)return
  const label=decision==='approved'?'activer l’abonnement':'rejeter la demande'
  if(!window.confirm('Confirmer : '+label+' ?'))return
  setBusy(id);setError('');setNotice('')
  const {error:e}=await supabase.rpc('review_platform_subscription_request',{p_request_id:id,p_decision:decision,p_review_note:null})
  if(e)setError(e.message)
  else{setNotice(decision==='approved'?'Abonnement activé et demande approuvée.':'Demande rejetée.');await load()}
  setBusy('')
 }
 if(loading&&!data)return <div className="content"><div className="panel catalog-loading"><LoaderCircle className="spin"/> Chargement de la console SaaS…</div></div>
 return <div className="content catalog-page platform-admin-page">
  <section className="welcome-row"><div><div className="eyebrow"><ShieldCheck size={14}/> CONSOLE DE PILOTAGE GLOBAL</div><h1>Administration SaaS</h1><p>Supervision des entreprises clientes, des abonnements et des demandes de souscription.</p></div><button className="outline-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Actualiser</button></section>
  {error&&<div className="catalog-error" role="alert">{error}</div>}{notice&&<div className="catalog-notice" role="status">{notice}</div>}
  {data&&<>
   <section className="stats-grid admin-stats">
    <article className="stat-card"><div className="stat-head"><span>Entreprises</span><Building2 size={17}/></div><div className="stat-value">{data.stats.tenants}</div><div className="stat-note">Comptes clients enregistrés</div></article>
    <article className="stat-card"><div className="stat-head"><span>Entreprises actives</span><Activity size={17}/></div><div className="stat-value">{data.stats.active_tenants}</div><div className="stat-note">Espaces actifs</div></article>
    <article className="stat-card"><div className="stat-head"><span>Abonnements</span><CalendarClock size={17}/></div><div className="stat-value">{data.stats.subscriptions}</div><div className="stat-note">Contrats enregistrés</div></article>
    <article className="stat-card"><div className="stat-head"><span>Demandes en attente</span><Clock3 size={17}/></div><div className="stat-value">{data.stats.pending_requests}</div><div className="stat-note">À examiner</div></article>
   </section>
   <section className="panel catalog-panel">
    <div className="panel-heading"><div><h2>Demandes de souscription</h2><p>Une approbation active l’offre et démarre sa période de facturation.</p></div><span className="catalog-count">{data.requests.length} en attente</span></div>
    {data.requests.length===0?<div className="subscription-empty">Aucune demande en attente.</div>:<div className="table-wrap"><table><thead><tr><th>ENTREPRISE</th><th>OFFRE</th><th>PAIEMENT</th><th>RÉFÉRENCE</th><th>DATE</th><th>ACTIONS</th></tr></thead><tbody>{data.requests.map(r=><tr key={r.id}><td><strong>{r.tenant_name}</strong>{r.note&&<small className="admin-phone">{r.note}</small>}</td><td>{r.plan_name||'Offre supprimée'}</td><td>{r.payment_method.replaceAll('_',' ')}</td><td>{r.payment_reference||'—'}</td><td>{date(r.created_at)}</td><td><div className="platform-admin-actions"><button className="primary-button" disabled={!!busy} onClick={()=>void review(r.id,'approved')} title="Approuver"><Check size={14}/> Valider</button><button className="outline-button" disabled={!!busy} onClick={()=>void review(r.id,'rejected')} title="Rejeter"><X size={14}/> Rejeter</button>{busy===r.id&&<LoaderCircle className="spin" size={15}/>}</div></td></tr>)}</tbody></table></div>}
   </section>
   <section className="panel catalog-panel">
    <div className="panel-heading"><div><h2>Entreprises clientes</h2><p>Vue consolidée des espaces et de leur abonnement.</p></div><span className="catalog-count">{data.tenants.length} entreprise(s)</span></div>
    <div className="table-wrap"><table><thead><tr><th>ENTREPRISE</th><th>PAYS / DEVISE</th><th>STATUT</th><th>OFFRE</th><th>VALIDITÉ</th><th>CRÉATION</th></tr></thead><tbody>{data.tenants.map(t=><tr key={t.id}><td><strong>{t.name}</strong><small className="admin-phone">{t.slug}</small></td><td>{t.country_code||'—'} / {t.currency_code||'—'}</td><td><span className="status-pill">{t.subscription_status||t.status}</span></td><td>{t.plan_name||'Aucune offre'}</td><td>{date(t.period_end||t.trial_ends_at)}</td><td>{date(t.created_at)}</td></tr>)}{!data.tenants.length&&<tr><td colSpan={6} className="empty-state">Aucune entreprise enregistrée.</td></tr>}</tbody></table></div>
   </section>
   <section className="panel catalog-panel"><div className="panel-heading"><div><h2>Offres configurées</h2><p>Catalogue d’abonnements actuellement enregistré.</p></div></div><div className="table-wrap"><table><thead><tr><th>OFFRE</th><th>CODE</th><th>TARIF</th><th>FACTURATION</th><th>ÉTAT</th></tr></thead><tbody>{data.plans.map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.code}</td><td>{money(p.price_amount,p.currency_code)}</td><td>{p.billing_interval==='yearly'?'Annuelle':p.billing_interval==='monthly'?'Mensuelle':p.billing_interval}</td><td><span className="status-pill">{p.is_active?'Active':'Inactive'}</span></td></tr>)}</tbody></table></div></section>
   <p className="admin-note"><ShieldCheck size={16}/><span>Console réservée au Super Administrateur. Les validations sont contrôlées par Supabase et consignées dans le journal d’audit.</span></p>
  </>}
 </div>
}
