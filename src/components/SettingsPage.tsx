import { useEffect, useState, type FormEvent } from 'react'
import { Building2, CheckCircle2, Globe, LoaderCircle, Mail, MapPin, Phone, Save, Settings2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type CompanySettings = {
  id: string; name: string; legal_name: string | null; slug: string; country_code: string | null
  currency_code: string; address: string | null; phone: string | null; email: string | null
  website: string | null; tax_number: string | null; legal_form: string | null; timezone: string
}
const empty: CompanySettings = { id:'', name:'', legal_name:'', slug:'', country_code:'GN', currency_code:'GNF', address:'', phone:'', email:'', website:'', tax_number:'', legal_form:'', timezone:'Africa/Conakry' }

export default function SettingsPage() {
  const [form, setForm] = useState<CompanySettings>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { setError('Connexion Supabase indisponible.'); setLoading(false); return }
      const [{ data: tenantId, error: tenantIdError }, { data: userData }] = await Promise.all([
        supabase.rpc('current_tenant_id'), supabase.auth.getUser(),
      ])
      if (tenantIdError || !tenantId || !userData.user) {
        if (active) { setError(tenantIdError?.message || 'Aucune entreprise active trouvée.'); setLoading(false) }
        return
      }
      const [{ data, error: loadError }, { data: membership }] = await Promise.all([
        supabase.from('tenants').select('id,name,legal_name,slug,country_code,currency_code,address,phone,email,website,tax_number,legal_form,timezone').eq('id', tenantId).single(),
        supabase.from('tenant_members').select('role').eq('tenant_id', tenantId).eq('user_id', userData.user.id).eq('status','active').maybeSingle(),
      ])
      if (!active) return
      if (loadError) setError(loadError.message)
      else setForm({ ...empty, ...(data as CompanySettings) })
      setCanEdit(['owner','admin'].includes(membership?.role || ''))
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  function change<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setForm(current => ({ ...current, [key]: value }))
    setNotice('')
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !form.id || !canEdit) return
    setSaving(true); setError(''); setNotice('')
    const payload = {
      name: form.name.trim(), legal_name: form.legal_name?.trim() || null,
      country_code: form.country_code?.trim().toUpperCase() || null,
      currency_code: form.currency_code.trim().toUpperCase(),
      address: form.address?.trim() || null, phone: form.phone?.trim() || null,
      email: form.email?.trim() || null, website: form.website?.trim() || null,
      tax_number: form.tax_number?.trim() || null, legal_form: form.legal_form?.trim() || null,
      timezone: form.timezone,
    }
    const { error: saveError } = await supabase.from('tenants').update(payload).eq('id', form.id)
    if (saveError) setError(saveError.message)
    else setNotice('Les paramètres de votre entreprise ont été enregistrés.')
    setSaving(false)
  }

  if (loading) return <div className="content settings-page"><div className="panel settings-loading"><LoaderCircle className="spin" size={22}/> Chargement des paramètres…</div></div>

  return <div className="content settings-page">
    <section className="welcome-row"><div><div className="eyebrow"><Settings2 size={13}/> CONFIGURATION DE L’ESPACE</div><h1>Paramètres</h1><p>Configurez les informations et les préférences de votre entreprise.</p></div></section>
    {error && <div className="settings-message error">{error}</div>}
    {notice && <div className="settings-message success"><CheckCircle2 size={16}/>{notice}</div>}
    {!canEdit && <div className="settings-readonly">Vous pouvez consulter ces informations. Seuls le propriétaire et les administrateurs peuvent les modifier.</div>}
    <form onSubmit={save}>
      <section className="panel settings-panel">
        <div className="settings-section-title"><Building2 size={18}/><div><h2>Identité de l’entreprise</h2><p>Informations affichées dans votre espace de gestion.</p></div></div>
        <div className="settings-grid">
          <label>Nom commercial<input required value={form.name} onChange={e=>change('name',e.target.value)} disabled={!canEdit}/></label>
          <label>Raison sociale<input value={form.legal_name || ''} onChange={e=>change('legal_name',e.target.value)} disabled={!canEdit} placeholder="Nom légal de l’entreprise"/></label>
          <label>Forme juridique<input value={form.legal_form || ''} onChange={e=>change('legal_form',e.target.value)} disabled={!canEdit} placeholder="SARL, SARLU, SA…"/></label>
          <label>NIF / Identifiant fiscal<input value={form.tax_number || ''} onChange={e=>change('tax_number',e.target.value)} disabled={!canEdit}/></label>
          <label>Pays (code ISO)<input maxLength={2} value={form.country_code || ''} onChange={e=>change('country_code',e.target.value)} disabled={!canEdit} placeholder="GN"/></label>
          <label>Devise principale<select value={form.currency_code} onChange={e=>change('currency_code',e.target.value)} disabled={!canEdit}><option value="GNF">GNF — Franc guinéen</option><option value="XOF">XOF — Franc CFA BCEAO</option><option value="USD">USD — Dollar américain</option><option value="EUR">EUR — Euro</option></select></label>
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="settings-section-title"><MapPin size={18}/><div><h2>Coordonnées</h2><p>Coordonnées utilisées pour identifier votre entreprise.</p></div></div>
        <div className="settings-grid">
          <label className="settings-wide">Adresse<input value={form.address || ''} onChange={e=>change('address',e.target.value)} disabled={!canEdit} placeholder="Quartier, commune, ville"/></label>
          <label><span><Phone size={13}/> Téléphone</span><input value={form.phone || ''} onChange={e=>change('phone',e.target.value)} disabled={!canEdit}/></label>
          <label><span><Mail size={13}/> E-mail professionnel</span><input type="email" value={form.email || ''} onChange={e=>change('email',e.target.value)} disabled={!canEdit}/></label>
          <label className="settings-wide"><span><Globe size={13}/> Site web</span><input value={form.website || ''} onChange={e=>change('website',e.target.value)} disabled={!canEdit} placeholder="https://…"/></label>
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="settings-section-title"><Settings2 size={18}/><div><h2>Préférences régionales</h2><p>Fuseau horaire utilisé pour les dates et opérations.</p></div></div>
        <div className="settings-grid"><label>Fuseau horaire<select value={form.timezone} onChange={e=>change('timezone',e.target.value)} disabled={!canEdit}><option value="Africa/Conakry">Africa/Conakry (GMT)</option><option value="Africa/Abidjan">Africa/Abidjan (GMT)</option><option value="Europe/Paris">Europe/Paris</option><option value="UTC">UTC</option></select></label><label>Identifiant de l’espace<input value={form.slug} disabled readOnly/><small>Identifiant technique non modifiable.</small></label></div>
      </section>
      {canEdit && <div className="settings-save-row"><span>Les changements sont enregistrés dans l’espace de votre entreprise.</span><button className="primary-button" disabled={saving || !form.name.trim()}>{saving ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>} Enregistrer les paramètres</button></div>}
    </form>
  </div>
}
