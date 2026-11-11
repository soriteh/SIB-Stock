import {useCallback,useEffect,useMemo,useState} from 'react'
import {LoaderCircle,RefreshCw,ShieldCheck,Users,Search,Filter} from 'lucide-react'
import {supabase} from '../lib/supabase'

type Member={id:string;user_id:string;role:string;status:string;created_at:string;full_name?:string|null;phone?:string|null}
const roles=['admin','manager','warehouse_manager','storekeeper','buyer','sales','cashier','accountant','viewer']
const roleLabel=(s:string)=>({owner:'Propriétaire',admin:'Administrateur',manager:'Gestionnaire',warehouse_manager:'Responsable stock',storekeeper:'Magasinier',buyer:'Acheteur',sales:'Commercial',cashier:'Caissier',accountant:'Comptable',viewer:'Lecture seule'}[s]??s)
const statusLabel=(s:string)=>({active:'Actif',invited:'Invité',suspended:'Suspendu'}[s]??s)

export default function Administration(){
 const [members,setMembers]=useState<Member[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState('')
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [query,setQuery]=useState('')
 const [roleFilter,setRoleFilter]=useState('all')
 const [statusFilter,setStatusFilter]=useState('all')
 const load=useCallback(async()=>{
  if(!supabase){setLoading(false);setError('Service de données indisponible.');return}
  setLoading(true);setError('')
  const {data,error:e}=await supabase.from('tenant_members').select('id,user_id,role,status,created_at').order('created_at',{ascending:false})
  if(e){setError(e.message);setMembers([]);setLoading(false);return}
  const rows=(data??[]) as Member[]
  const ids=rows.map(x=>x.user_id)
  const profiles:Record<string,{full_name:string|null;phone:string|null}>={}
  if(ids.length){
   const {data:p,error:profileError}=await supabase.from('profiles').select('id,full_name,phone').in('id',ids)
   if(profileError){setError('Membres chargés, mais les profils ne sont pas accessibles : '+profileError.message)}
   for(const item of p??[])profiles[item.id]={full_name:item.full_name,phone:item.phone}
  }
  setMembers(rows.map(x=>({...x,...profiles[x.user_id]})))
  setLoading(false)
 },[])
 useEffect(()=>{void load()},[load])
 const filtered=useMemo(()=>members.filter(m=>{
  const term=query.trim().toLocaleLowerCase('fr')
  const matchesText=!term||[m.full_name,m.phone,m.user_id,m.role].some(v=>String(v??'').toLocaleLowerCase('fr').includes(term))
  return matchesText&&(roleFilter==='all'||m.role===roleFilter)&&(statusFilter==='all'||m.status===statusFilter)
 }),[members,query,roleFilter,statusFilter])
 async function update(m:Member,field:'role'|'status',value:string){
  if(!supabase)return
  if(field==='status'&&value==='suspended'&&!window.confirm('Suspendre cet utilisateur ? Il perdra l’accès à cet espace.'))return
  if(field==='status'&&m.status==='suspended'&&value==='active'&&!window.confirm('Réactiver l’accès de cet utilisateur ?'))return
  setBusy(m.id);setError('');setNotice('')
  const {error:e}=await supabase.from('tenant_members').update({[field]:value}).eq('id',m.id)
  if(e)setError('Modification refusée : '+e.message)
  else{setNotice(field==='role'?'Rôle de l’utilisateur mis à jour.':'Statut de l’utilisateur mis à jour.');await load()}
  setBusy('')
 }
 return <div className="content catalog-page admin-page">
  <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> GESTION DES ACCÈS</div><h1>Gestion des utilisateurs</h1><p>Consultez les membres, attribuez les rôles et contrôlez les accès de votre entreprise.</p></div><button className="outline-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={13}/> Actualiser</button></section>
  {error&&<div className="catalog-error" role="alert">{error}</div>}{notice&&<div className="catalog-notice" role="status">{notice}</div>}
  <section className="stats-grid admin-stats">
   <article className="stat-card"><div className="stat-head"><span>Utilisateurs</span><Users size={17}/></div><div className="stat-value">{members.length}</div><div className="stat-note">Espace de l’entreprise active</div></article>
   <article className="stat-card"><div className="stat-head"><span>Actifs</span></div><div className="stat-value">{members.filter(m=>m.status==='active').length}</div><div className="stat-note">Accès autorisés</div></article>
   <article className="stat-card"><div className="stat-head"><span>En attente</span></div><div className="stat-value">{members.filter(m=>m.status==='invited').length}</div><div className="stat-note">Comptes invités</div></article>
   <article className="stat-card"><div className="stat-head"><span>Suspendus</span><ShieldCheck size={17}/></div><div className="stat-value">{members.filter(m=>m.status==='suspended').length}</div><div className="stat-note">Accès désactivés</div></article>
  </section>
  <section className="panel catalog-panel">
   <div className="panel-heading"><div><h2>Utilisateurs et permissions</h2><p>Les droits sont appliqués par les politiques de sécurité de la base de données.</p></div><span className="catalog-count">{filtered.length} résultat(s)</span></div>
   <div className="admin-toolbar"><label className="catalog-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un nom, téléphone ou identifiant…"/></label><label className="admin-filter"><Filter size={14}/><select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="all">Tous les rôles</option>{['owner',...roles].map(r=><option key={r} value={r}>{roleLabel(r)}</option>)}</select></label><label className="admin-filter"><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Tous les statuts</option><option value="active">Actifs</option><option value="invited">En attente</option><option value="suspended">Suspendus</option></select></label></div>
   {loading?<div className="catalog-loading"><LoaderCircle className="spin"/> Chargement des utilisateurs…</div>:<div className="table-wrap"><table><thead><tr><th>UTILISATEUR</th><th>IDENTIFIANT</th><th>RÔLE</th><th>STATUT</th><th>DATE D’AJOUT</th></tr></thead><tbody>
    {filtered.map(m=><tr key={m.id}><td><strong>{m.full_name||'Utilisateur sans nom'}</strong>{m.phone&&<small className="admin-phone">{m.phone}</small>}</td><td className="admin-id" title={m.user_id}>{m.user_id.slice(0,8)}…</td><td>{m.role==='owner'?<span className="status-pill">Propriétaire</span>:<select aria-label={'Rôle de '+(m.full_name||m.user_id)} className="admin-select" disabled={busy===m.id} value={m.role} onChange={e=>void update(m,'role',e.target.value)}>{roles.map(r=><option key={r} value={r}>{roleLabel(r)}</option>)}</select>}</td><td>{m.role==='owner'?<span className="status-pill">Actif</span>:<select aria-label={'Statut de '+(m.full_name||m.user_id)} className="admin-select" disabled={busy===m.id} value={m.status} onChange={e=>void update(m,'status',e.target.value)}><option value="active">Actif</option><option value="invited">Invité</option><option value="suspended">Suspendu</option></select>}{busy===m.id&&<LoaderCircle className="spin admin-saving" size={13}/>}</td><td>{new Date(m.created_at).toLocaleDateString('fr-FR')}</td></tr>)}
    {!filtered.length&&<tr><td colSpan={5} className="empty-state">{members.length?'Aucun utilisateur ne correspond aux filtres.':'Aucun utilisateur visible ou droits insuffisants pour administrer cet espace.'}</td></tr>}
   </tbody></table></div>}
  </section>
  <div className="admin-note"><ShieldCheck size={16}/><p>Le propriétaire principal est protégé contre toute modification de rôle ou suspension. L’invitation de nouveaux comptes doit passer par une fonction serveur Supabase utilisant la clé de service, jamais exposée dans le navigateur. Les modifications restent soumises aux règles RLS.</p></div>
 </div>
}
