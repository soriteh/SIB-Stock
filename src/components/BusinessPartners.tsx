import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Building2, LoaderCircle, Mail, MapPin, Phone, Plus, RefreshCw, Search, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

type PartnerType = 'supplier' | 'customer' | 'both'
type Partner = {
  id: string; partner_type: PartnerType; partner_code: string | null; name: string
  contact_person: string | null; phone: string | null; email: string | null
  address: string | null; tax_number: string | null; notes: string | null; is_active: boolean
}
const typeLabel: Record<PartnerType,string> = { supplier: 'Fournisseur', customer: 'Client', both: 'Client & fournisseur' }

export default function BusinessPartners() {
  const [rows,setRows] = useState<Partner[]>([])
  const [filter,setFilter] = useState<'all'|PartnerType>('all')
  const [query,setQuery] = useState('')
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [showForm,setShowForm] = useState(false)
  const [editing,setEditing] = useState<string|null>(null)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [form,setForm] = useState({partner_type:'supplier' as PartnerType,partner_code:'',name:'',contact_person:'',phone:'',email:'',address:'',tax_number:'',notes:''})

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true); setError('')
    const {data,error:err} = await supabase.from('business_partners')
      .select('id,partner_type,partner_code,name,contact_person,phone,email,address,tax_number,notes,is_active')
      .order('name')
    if (err) setError(err.message)
    setRows((data ?? []) as Partner[])
    setLoading(false)
  },[])
  useEffect(()=>{void load()},[load])

  const filtered = useMemo(()=>rows.filter(p=>
    (filter==='all'||p.partner_type===filter||p.partner_type==='both') &&
    [p.name,p.partner_code??'',p.phone??'',p.email??'',p.contact_person??''].join(' ').toLowerCase().includes(query.toLowerCase())
  ),[rows,filter,query])

  function resetForm() {
    setForm({partner_type:'supplier',partner_code:'',name:'',contact_person:'',phone:'',email:'',address:'',tax_number:'',notes:''})
    setEditing(null); setShowForm(false)
  }
  function startEdit(p:Partner) {
    setForm({partner_type:p.partner_type,partner_code:p.partner_code??'',name:p.name,contact_person:p.contact_person??'',phone:p.phone??'',email:p.email??'',address:p.address??'',tax_number:p.tax_number??'',notes:p.notes??''})
    setEditing(p.id); setShowForm(true); setError(''); setNotice('')
  }
  async function submit(e:FormEvent) {
    e.preventDefault(); if(!supabase) return
    setBusy(true);setError('');setNotice('')
    const {data:tenantId,error:tenantError}=await supabase.rpc('current_tenant_id')
      if(tenantError || !tenantId) throw tenantError ?? new Error('Aucun espace entreprise actif.')
      const payload = {...form,tenant_id:tenantId,partner_code:form.partner_code.trim()||null,name:form.name.trim(),contact_person:form.contact_person.trim()||null,phone:form.phone.trim()||null,email:form.email.trim()||null,address:form.address.trim()||null,tax_number:form.tax_number.trim()||null,notes:form.notes.trim()||null}
    try {
      const result = editing
        ? await supabase.from('business_partners').update(payload).eq('id',editing)
        : await supabase.from('business_partners').insert(payload)
      if(result.error) throw result.error
      setNotice(editing?'Fiche partenaire mise à jour.':'Partenaire enregistré.')
      resetForm(); await load()
    } catch(err) { setError(err instanceof Error?err.message:'Enregistrement impossible.') }
    finally { setBusy(false) }
  }
  async function toggleActive(p:Partner) {
    if(!supabase) return
    setError('');setNotice('')
    const {error:err}=await supabase.from('business_partners').update({is_active:!p.is_active}).eq('id',p.id)
    if(err) setError(err.message); else {setNotice(p.is_active?'Partenaire désactivé.':'Partenaire réactivé.');await load()}
  }

  return <div className="content catalog-page partners-page">
    <section className="welcome-row">
      <div><div className="eyebrow"><span className="live-dot"/> RELATIONS COMMERCIALES</div><h1>Fournisseurs & clients</h1><p>Centralisez vos contacts commerciaux pour les achats, ventes et règlements.</p></div>
      <button className="primary-button catalog-add" onClick={()=>{resetForm();setShowForm(true);setError('');setNotice('')}}><Plus size={15}/> Nouveau partenaire</button>
    </section>
    <section className="partners-stats stats-grid">
      <article className="stat-card"><div className="stat-head"><span>Total partenaires</span><div className="stat-icon blue"><Users size={17}/></div></div><div className="stat-value">{rows.length}</div><div className="stat-note">Toutes catégories</div></article>
      <article className="stat-card"><div className="stat-head"><span>Fournisseurs</span><div className="stat-icon violet"><Building2 size={17}/></div></div><div className="stat-value">{rows.filter(p=>p.partner_type==='supplier'||p.partner_type==='both').length}</div><div className="stat-note">Approvisionnement</div></article>
      <article className="stat-card"><div className="stat-head"><span>Clients</span><div className="stat-icon green"><Users size={17}/></div></div><div className="stat-value">{rows.filter(p=>p.partner_type==='customer'||p.partner_type==='both').length}</div><div className="stat-note">Ventes et facturation</div></article>
      <article className="stat-card"><div className="stat-head"><span>Partenaires actifs</span><div className="stat-icon orange"><Building2 size={17}/></div></div><div className="stat-value">{rows.filter(p=>p.is_active).length}</div><div className="stat-note">Comptes opérationnels</div></article>
    </section>
    <section className="catalog-toolbar partners-toolbar">
      <div className="catalog-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nom, code, téléphone, e-mail…"/></div>
      <select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="all">Tous les partenaires</option><option value="supplier">Fournisseurs</option><option value="customer">Clients</option></select>
      <button className="outline-button" onClick={()=>void load()}><RefreshCw size={13}/> Actualiser</button><span className="catalog-total">{filtered.length} résultat(s)</span>
    </section>
    {error&&<div className="catalog-error">{error}</div>}{notice&&<div className="catalog-notice">{notice}</div>}
    {showForm&&<form className="catalog-form" onSubmit={submit}>
      <div className="catalog-form-heading"><strong>{editing?'Modifier le partenaire':'Nouveau partenaire'}</strong><button type="button" onClick={resetForm}>Fermer</button></div>
      <div className="catalog-fields">
        <label>Type de partenaire<select value={form.partner_type} onChange={e=>setForm({...form,partner_type:e.target.value as PartnerType})}><option value="supplier">Fournisseur</option><option value="customer">Client</option><option value="both">Client & fournisseur</option></select></label>
        <label>Code partenaire<input value={form.partner_code} onChange={e=>setForm({...form,partner_code:e.target.value})} placeholder="Ex. FOUR-001"/></label>
        <label>Raison sociale / Nom<input required minLength={2} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nom de l'entreprise ou du client"/></label>
        <label>Personne à contacter<input value={form.contact_person} onChange={e=>setForm({...form,contact_person:e.target.value})}/></label>
        <label>Téléphone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+224…"/></label>
        <label>E-mail<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
        <label>Adresse<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
        <label>NIF / Identifiant fiscal<input value={form.tax_number} onChange={e=>setForm({...form,tax_number:e.target.value})}/></label>
        <label className="partner-notes">Notes<textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
      </div>
      <div className="catalog-form-actions"><button type="button" className="outline-button" onClick={resetForm}>Annuler</button><button className="primary-button" disabled={busy}>{busy?<LoaderCircle className="spin" size={14}/>:null} Enregistrer</button></div>
    </form>}
    <section className="panel catalog-panel"><div className="panel-heading"><div><h2>Répertoire commercial</h2><p>Informations privées de l’entreprise active</p></div><span className="catalog-count">{filtered.length} fiche(s)</span></div>
      {loading?<div className="catalog-loading"><LoaderCircle className="spin"/> Chargement des partenaires…</div>:<div className="table-wrap"><table><thead><tr><th>CODE</th><th>NOM / RAISON SOCIALE</th><th>TYPE</th><th>CONTACT</th><th>COORDONNÉES</th><th>STATUT</th><th>ACTIONS</th></tr></thead><tbody>
        {filtered.map(p=><tr key={p.id}><td className="ref-cell">{p.partner_code||'—'}</td><td><strong className="partner-name">{p.name}</strong>{p.contact_person&&<small className="stock-subcell">{p.contact_person}</small>}</td><td><span className="partner-type-pill">{typeLabel[p.partner_type]}</span></td><td>{p.phone?<span className="partner-contact"><Phone size={12}/>{p.phone}</span>:'—'}</td><td>{p.email?<span className="partner-contact"><Mail size={12}/>{p.email}</span>:p.address?<span className="partner-contact"><MapPin size={12}/>{p.address}</span>:'—'}</td><td><span className={p.is_active?'status-pill':'type-pill out'}>{p.is_active?'Actif':'Inactif'}</span></td><td><div className="partner-actions"><button onClick={()=>startEdit(p)}>Modifier</button><button onClick={()=>void toggleActive(p)}>{p.is_active?'Désactiver':'Réactiver'}</button></div></td></tr>)}
        {filtered.length===0&&<tr><td colSpan={7} className="empty-state">Aucun partenaire trouvé. Ajoutez un fournisseur ou un client.</td></tr>}
      </tbody></table></div>}
    </section>
    <p className="catalog-footnote"><Users size={14}/> Les partenaires sont isolés par entreprise et accessibles selon les rôles autorisés.</p>
  </div>
}
