import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Building2, Download, Eye, LoaderCircle, Mail, MapPin, Phone, Plus, RefreshCw, Search, UserRound, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Client = {
  id: string; partner_type: 'customer'|'both'; partner_code: string|null; name: string
  contact_person: string|null; phone: string|null; email: string|null; address: string|null
  tax_number: string|null; notes: string|null; is_active: boolean
}
type ClientForm = { partner_code:string; name:string; contact_person:string; phone:string; email:string; address:string; tax_number:string; notes:string; partner_type:'customer'|'both' }
const emptyForm:ClientForm = {partner_code:'',name:'',contact_person:'',phone:'',email:'',address:'',tax_number:'',notes:'',partner_type:'customer'}

export default function Clients() {
  const [clients,setClients] = useState<Client[]>([])
  const [query,setQuery] = useState('')
  const [status,setStatus] = useState<'all'|'active'|'inactive'>('all')
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [formOpen,setFormOpen] = useState(false)
  const [editing,setEditing] = useState<string|null>(null)
  const [selected,setSelected] = useState<Client|null>(null)
  const [form,setForm] = useState<ClientForm>(emptyForm)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')

  const load = useCallback(async () => {
    if (!supabase) { setError('Supabase n’est pas configuré.'); setLoading(false); return }
    setLoading(true); setError('')
    const {data,error:loadError} = await supabase.from('business_partners')
      .select('id,partner_type,partner_code,name,contact_person,phone,email,address,tax_number,notes,is_active')
      .in('partner_type',['customer','both']).order('name')
    if (loadError) setError(loadError.message)
    setClients((data??[]) as Client[])
    setLoading(false)
  },[])
  useEffect(()=>{void load()},[load])

  const visible = useMemo(()=>clients.filter(c=>{
    const matchesStatus = status==='all' || (status==='active' ? c.is_active : !c.is_active)
    const text = [c.name,c.partner_code??'',c.contact_person??'',c.phone??'',c.email??'',c.address??''].join(' ').toLocaleLowerCase()
    return matchesStatus && text.includes(query.toLocaleLowerCase().trim())
  }),[clients,query,status])

  const total = clients.length
  const active = clients.filter(c=>c.is_active).length
  const inactive = total-active

  function openNew() { setEditing(null);setForm(emptyForm);setFormOpen(true);setSelected(null);setError('');setNotice('') }
  function openEdit(c:Client) {
    setEditing(c.id);setForm({partner_code:c.partner_code??'',name:c.name,contact_person:c.contact_person??'',phone:c.phone??'',email:c.email??'',address:c.address??'',tax_number:c.tax_number??'',notes:c.notes??'',partner_type:c.partner_type})
    setFormOpen(true);setSelected(null);setError('');setNotice('')
  }
  async function submit(e:FormEvent) {
    e.preventDefault(); if(!supabase) return
    setSaving(true);setError('');setNotice('')
    try {
      const {data:tenantId,error:tenantError}=await supabase.rpc('current_tenant_id')
      if(tenantError || !tenantId) throw tenantError ?? new Error('Aucun espace entreprise actif.')
      const payload = { ...form, tenant_id:tenantId, name:form.name.trim(), partner_code:form.partner_code.trim()||null, contact_person:form.contact_person.trim()||null, phone:form.phone.trim()||null, email:form.email.trim()||null, address:form.address.trim()||null, tax_number:form.tax_number.trim()||null, notes:form.notes.trim()||null }
      const result = editing
        ? await supabase.from('business_partners').update(payload).eq('id',editing)
        : await supabase.from('business_partners').insert(payload)
      if(result.error) throw result.error
      setNotice(editing?'Client mis à jour avec succès.':'Client ajouté avec succès.')
      setFormOpen(false);setEditing(null);setForm(emptyForm);await load()
    } catch(e) { setError(e instanceof Error?e.message:'Enregistrement impossible.') }
    finally { setSaving(false) }
  }
  async function toggleStatus(c:Client) {
    if(!supabase) return
    setError('');setNotice('')
    const {error:e}=await supabase.from('business_partners').update({is_active:!c.is_active}).eq('id',c.id)
    if(e) setError(e.message)
    else {setNotice(c.is_active?'Client désactivé.':'Client réactivé.');if(selected?.id===c.id)setSelected({...c,is_active:!c.is_active});await load()}
  }
  function exportCsv() {
    const columns = ['Référence','Nom / entreprise','Contact','Téléphone','E-mail','Adresse','NIF','Statut']
    const rows = visible.map(c=>[c.partner_code,c.name,c.contact_person,c.phone,c.email,c.address,c.tax_number,c.is_active?'Actif':'Inactif'])
    const csv = [columns,...rows].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n')
    const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='clients-sib-stock.csv';a.click();URL.revokeObjectURL(url)
  }

  return <div className="content catalog-page clients-page">
    <section className="welcome-row">
      <div><div className="eyebrow"><span className="live-dot"/> GESTION COMMERCIALE</div><h1>Clients</h1><p>Gérez vos clients, leurs coordonnées et leurs informations commerciales.</p></div>
      <button className="primary-button catalog-add" onClick={openNew}><Plus size={15}/> Nouveau client</button>
    </section>
    <section className="stats-grid client-stats">
      <article className="stat-card"><div className="stat-head"><span>Total clients</span><div className="stat-icon blue"><Users size={17}/></div></div><div className="stat-value">{total}</div><div className="stat-note">Clients enregistrés</div></article>
      <article className="stat-card"><div className="stat-head"><span>Clients actifs</span><div className="stat-icon green"><UserRound size={17}/></div></div><div className="stat-value">{active}</div><div className="stat-note">Relations commerciales actives</div></article>
      <article className="stat-card"><div className="stat-head"><span>Clients inactifs</span><div className="stat-icon orange"><Users size={17}/></div></div><div className="stat-value">{inactive}</div><div className="stat-note">Comptes désactivés</div></article>
      <article className="stat-card"><div className="stat-head"><span>Résultats affichés</span><div className="stat-icon violet"><Search size={17}/></div></div><div className="stat-value">{visible.length}</div><div className="stat-note">Selon vos critères</div></article>
    </section>
    {error&&<div className="catalog-error">{error}</div>}{notice&&<div className="catalog-notice">{notice}</div>}
    {formOpen&&<form className="catalog-form" onSubmit={submit}>
      <div className="catalog-form-heading"><strong>{editing?'Modifier la fiche client':'Créer une fiche client'}</strong><button type="button" onClick={()=>setFormOpen(false)}>Fermer</button></div>
      <div className="catalog-fields">
        <label>Type de client<select value={form.partner_type} onChange={e=>setForm({...form,partner_type:e.target.value as ClientForm['partner_type']})}><option value="customer">Client</option><option value="both">Client et fournisseur</option></select></label>
        <label>Référence client<input value={form.partner_code} onChange={e=>setForm({...form,partner_code:e.target.value})} placeholder="Ex. CLI-0001"/></label>
        <label>Nom / Raison sociale<input required minLength={2} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nom du client ou de l'entreprise"/></label>
        <label>Personne à contacter<input value={form.contact_person} onChange={e=>setForm({...form,contact_person:e.target.value})}/></label>
        <label>Téléphone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+224…"/></label>
        <label>Adresse e-mail<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
        <label>Adresse complète<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
        <label>NIF / Identifiant fiscal<input value={form.tax_number} onChange={e=>setForm({...form,tax_number:e.target.value})}/></label>
        <label className="client-notes">Notes internes<textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
      </div>
      <div className="catalog-form-actions"><button type="button" className="outline-button" onClick={()=>setFormOpen(false)}>Annuler</button><button className="primary-button" disabled={saving}>{saving?<LoaderCircle className="spin" size={14}/>:<Plus size={14}/>} Enregistrer le client</button></div>
    </form>}
    {selected&&<section className="panel client-detail">
      <div className="panel-heading"><div><h2>{selected.name}</h2><p>Fiche client · {selected.partner_code||'Sans référence'}</p></div><button className="outline-button" onClick={()=>setSelected(null)}>Fermer</button></div>
      <div className="client-detail-grid"><span><Phone size={14}/>{selected.phone||'Téléphone non renseigné'}</span><span><Mail size={14}/>{selected.email||'E-mail non renseigné'}</span><span><MapPin size={14}/>{selected.address||'Adresse non renseignée'}</span><span><Building2 size={14}/>{selected.contact_person||'Contact non renseigné'}</span></div>
      {selected.tax_number&&<p className="client-tax">NIF : {selected.tax_number}</p>}
      {selected.notes&&<p className="client-notes-text">{selected.notes}</p>}
      <div className="client-history-note">L’historique des ventes, factures et paiements sera alimenté par les modules Ventes et Finance dès leur activation.</div>
    </section>}
    <section className="catalog-toolbar client-toolbar">
      <div className="catalog-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher par nom, référence, téléphone…"/></div>
      <select value={status} onChange={e=>setStatus(e.target.value as typeof status)}><option value="all">Tous les statuts</option><option value="active">Actifs</option><option value="inactive">Inactifs</option></select>
      <button className="outline-button" onClick={exportCsv}><Download size={14}/> Exporter CSV</button>
      <button className="outline-button" onClick={()=>void load()}><RefreshCw size={13}/> Actualiser</button>
      <span className="catalog-total">{visible.length} client(s)</span>
    </section>
    <section className="panel catalog-panel"><div className="panel-heading"><div><h2>Répertoire clients</h2><p>Les données sont isolées par entreprise selon les règles de sécurité Supabase.</p></div><span className="catalog-count">{visible.length} fiche(s)</span></div>
      {loading?<div className="catalog-loading"><LoaderCircle className="spin"/> Chargement des clients…</div>:<div className="table-wrap"><table><thead><tr><th>RÉFÉRENCE</th><th>CLIENT / ENTREPRISE</th><th>TÉLÉPHONE</th><th>E-MAIL</th><th>ADRESSE</th><th>STATUT</th><th>ACTIONS</th></tr></thead><tbody>
        {visible.map(c=><tr key={c.id}><td className="ref-cell">{c.partner_code||'—'}</td><td><strong className="partner-name">{c.name}</strong>{c.contact_person&&<small className="stock-subcell">{c.contact_person}</small>}</td><td>{c.phone?<span className="partner-contact"><Phone size={12}/>{c.phone}</span>:'—'}</td><td>{c.email?<span className="partner-contact"><Mail size={12}/>{c.email}</span>:'—'}</td><td>{c.address?<span className="partner-contact"><MapPin size={12}/>{c.address}</span>:'—'}</td><td><span className={c.is_active?'status-pill':'type-pill out'}>{c.is_active?'Actif':'Inactif'}</span></td><td><div className="partner-actions"><button onClick={()=>setSelected(c)}><Eye size={12}/> Voir</button><button onClick={()=>openEdit(c)}>Modifier</button><button onClick={()=>void toggleStatus(c)}>{c.is_active?'Désactiver':'Réactiver'}</button></div></td></tr>)}
        {visible.length===0&&<tr><td colSpan={7} className="empty-state">{query?'Aucun client ne correspond à votre recherche.':'Aucun client enregistré pour le moment.'}</td></tr>}
      </tbody></table></div>}
    </section>
    <p className="catalog-footnote"><Users size={14}/> La suppression physique est remplacée par la désactivation afin de préserver l’historique commercial.</p>
  </div>
}
