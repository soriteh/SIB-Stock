import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Building2, LoaderCircle, Plus, RefreshCw, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useEstablishment } from '../contexts/EstablishmentContext'

type PlanLimits = { establishments?: number | null }
export default function Establishments() {
  const { establishments, activeEstablishment, loading, error: contextError, refresh, setActive } = useEstablishment()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [limit, setLimit] = useState<number | null>(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const loadLimit = useCallback(async () => {
    if (!supabase) return
    const { data: tenantId } = await supabase.rpc('current_tenant_id')
    if (!tenantId) return
    const { data } = await supabase.from('tenant_subscriptions').select('subscription_plans(limits)').eq('tenant_id', tenantId).maybeSingle()
    const plan = data?.subscription_plans as unknown as { limits?: PlanLimits } | null
    const raw = plan?.limits?.establishments
    setLimit(raw === null || raw === undefined ? null : Number(raw))
  }, [])
  useEffect(() => { void loadLimit() }, [loadLimit])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { data: tenantId, error: tenantError } = await supabase.rpc('current_tenant_id')
      if (tenantError || !tenantId) throw tenantError ?? new Error('Entreprise active introuvable.')
      const { error: insertError } = await supabase.from('establishments').insert({
        tenant_id: tenantId, code: code.trim().toUpperCase(), name: name.trim(),
        address: address.trim() || null, phone: phone.trim() || null, email: email.trim() || null,
        is_primary: establishments.length === 0
      })
      if (insertError) throw insertError
      setName(''); setCode(''); setAddress(''); setPhone(''); setEmail(''); setShowForm(false)
      setNotice('Établissement créé et quota mis à jour.')
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Création impossible.') }
    finally { setBusy(false) }
  }
  async function choosePrimary(id: string) {
    if (!supabase) return
    setBusy(true); setError(''); setNotice('')
    const { error: updateError } = await supabase.from('establishments').update({ is_primary: true }).eq('id', id)
    if (updateError) setError(updateError.message)
    else { setNotice('Établissement principal mis à jour.'); await refresh() }
    setBusy(false)
  }
  return <div className="content catalog-page establishment-page">
    <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> ORGANISATION MULTI-SITES</div><h1>Établissements</h1><p>Gérez vos sites, dépôts et opérations séparément au sein de votre entreprise.</p></div><button className="primary-button catalog-add" onClick={() => { setShowForm(v => !v); setError('') }}><Plus size={15}/> Nouvel établissement</button></section>
    <section className="stats-grid commercial-stats">
      <article className="stat-card"><div className="stat-head"><span>Établissements actifs</span><Building2 size={18}/></div><div className="stat-value">{establishments.length}</div><div className="stat-note">Sites opérationnels</div></article>
      <article className="stat-card"><div className="stat-head"><span>Quota de l’offre</span></div><div className="stat-value">{limit === null ? 'Illimité' : limit}</div><div className="stat-note">Limite configurée par abonnement</div></article>
      <article className="stat-card"><div className="stat-head"><span>Places disponibles</span></div><div className="stat-value">{limit === null ? '—' : Math.max(0, limit - establishments.length)}</div><div className="stat-note">Selon votre formule actuelle</div></article>
      <article className="stat-card"><div className="stat-head"><span>Site sélectionné</span></div><div className="stat-value establishment-current">{activeEstablishment?.name ?? '—'}</div><div className="stat-note">Périmètre de travail courant</div></article>
    </section>
    {(error || contextError) && <div className="catalog-error">{error || contextError}</div>}
    {notice && <div className="catalog-notice">{notice}</div>}
    {showForm && <form className="catalog-form" onSubmit={submit}><div className="catalog-form-heading"><strong>Nouvel établissement</strong><button type="button" onClick={() => setShowForm(false)}>Fermer</button></div><div className="catalog-fields">
      <label>Nom de l’établissement<input required value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Agence de Ratoma"/></label>
      <label>Code unique<input required value={code} onChange={e => setCode(e.target.value)} placeholder="Ex. RATOMA-01"/></label>
      <label>Adresse<input value={address} onChange={e => setAddress(e.target.value)} placeholder="Ville, quartier, adresse"/></label>
      <label>Téléphone<input value={phone} onChange={e => setPhone(e.target.value)}/></label>
      <label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)}/></label>
    </div><div className="catalog-form-actions"><button className="primary-button" disabled={busy || (limit !== null && establishments.length >= limit)}>{busy ? <LoaderCircle className="spin" size={14}/> : <Plus size={14}/>} Créer l’établissement</button></div>{limit !== null && establishments.length >= limit && <p className="catalog-note">Quota atteint : passez à une offre supérieure pour ajouter un site.</p>}</form>}
    <section className="panel catalog-panel"><div className="panel-heading"><div><h2>Vos établissements</h2><p>Le sélecteur définit le périmètre des entrepôts, stocks et opérations.</p></div><button className="outline-button" onClick={() => { void refresh(); void loadLimit() }}><RefreshCw size={13}/> Actualiser</button></div>
      {loading ? <div className="catalog-loading"><LoaderCircle className="spin"/> Chargement…</div> : <div className="establishment-list">{establishments.map(item => <article className={activeEstablishment?.id === item.id ? 'establishment-card selected' : 'establishment-card'} key={item.id}>
        <div className="establishment-card-icon"><Building2 size={20}/></div><div className="establishment-card-copy"><strong>{item.name}</strong><small>{item.code}{item.address ? ' · ' + item.address : ''}</small>{item.phone && <small>{item.phone}</small>}</div>
        {item.is_primary && <span className="establishment-primary"><Star size={13}/> Principal</span>}
        {activeEstablishment?.id === item.id ? <span className="establishment-active">Actif</span> : <button className="outline-button" disabled={busy} onClick={() => void setActive(item.id)}>Sélectionner</button>}
        {!item.is_primary && <button className="text-button" disabled={busy} onClick={() => void choosePrimary(item.id)}>Définir principal</button>}
      </article>)}
      {!establishments.length && <div className="empty-state">Aucun établissement disponible. Créez le premier site.</div>}</div>}
    </section>
  </div>
}
