import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Activity, Camera, CheckCircle2, Clock3, KeyRound, LoaderCircle, Mail, Save, ShieldCheck, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'

type ProfileRecord = {
  full_name: string | null
  phone: string | null
  avatar_path: string | null
  preferred_theme: 'light' | 'dark' | 'system'
  preferred_language: 'fr' | 'en'
  notifications_enabled: boolean
}

export default function ProfilePage() {
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarPath, setAvatarPath] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light')
  const [language, setLanguage] = useState<'fr' | 'en'>('fr')
  const [notifications, setNotifications] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [lastSignIn, setLastSignIn] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) return
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        if (active) { setError(authError?.message ?? 'Session introuvable.'); setLoading(false) }
        return
      }
      const user = authData.user
      const { data, error: profileError } = await supabase.from('profiles')
        .select('full_name,phone,avatar_path,preferred_theme,preferred_language,notifications_enabled')
        .eq('id', user.id).single()
      if (!active) return
      if (profileError) setError('Chargement du profil impossible : ' + profileError.message)
      const profile = data as ProfileRecord | null
      setUserId(user.id)
      setEmail(user.email ?? '')
      setNewEmail(user.email ?? '')
      setLastSignIn(user.last_sign_in_at ?? null)
      setFullName(profile?.full_name ?? String(user.user_metadata?.full_name ?? ''))
      setPhone(profile?.phone ?? '')
      setAvatarPath(profile?.avatar_path ?? null)
      setTheme(profile?.preferred_theme ?? 'light')
      setLanguage(profile?.preferred_language ?? 'fr')
      setNotifications(profile?.notifications_enabled ?? true)
      if (profile?.avatar_path) {
        const { data: signed } = await supabase.storage.from('profile-avatars').createSignedUrl(profile.avatar_path, 3600)
        if (active) setAvatarUrl(signed?.signedUrl ?? '')
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !userId) return
    setSaving(true); setError(''); setMessage('')
    try {
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: fullName.trim(), phone: phone.trim() || null,
        preferred_theme: theme, preferred_language: language,
        notifications_enabled: notifications, updated_at: new Date().toISOString(),
      }).eq('id', userId)
      if (profileError) throw profileError
      if (newEmail.trim().toLowerCase() !== email.toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({ email: newEmail.trim() })
        if (emailError) throw emailError
        setMessage('Profil enregistré. Un lien de confirmation a été envoyé à la nouvelle adresse e-mail.')
      } else setMessage('Vos informations et préférences ont été enregistrées.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Enregistrement impossible.') }
    finally { setSaving(false) }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !email) return
    setError(''); setMessage('')
    if (newPassword.length < 8) { setError('Le nouveau mot de passe doit contenir au moins 8 caractères.'); return }
    if (newPassword !== confirmPassword) { setError('La confirmation du nouveau mot de passe ne correspond pas.'); return }
    setPasswordBusy(true)
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
      if (verifyError) throw new Error('Le mot de passe actuel est incorrect.')
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setMessage('Mot de passe modifié avec succès.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Modification du mot de passe impossible.') }
    finally { setPasswordBusy(false) }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!supabase || !file || !userId) return
    setError(''); setMessage('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Format accepté : JPG, PNG ou WebP.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('La photo ne doit pas dépasser 5 Mo.'); return }
    setUploading(true)
    try {
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = userId + '/avatar-' + Date.now() + '.' + extension
      const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, file, { upsert: false, contentType: file.type })
      if (uploadError) throw uploadError
      const { error: updateError } = await supabase.from('profiles').update({ avatar_path: path, updated_at: new Date().toISOString() }).eq('id', userId)
      if (updateError) {
        await supabase.storage.from('profile-avatars').remove([path])
        throw updateError
      }
      if (avatarPath) await supabase.storage.from('profile-avatars').remove([avatarPath])
      const { data: signed } = await supabase.storage.from('profile-avatars').createSignedUrl(path, 3600)
      setAvatarPath(path); setAvatarUrl(signed?.signedUrl ?? '')
      setMessage('Photo de profil mise à jour.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Envoi de la photo impossible.') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  if (loading) return <div className="profile-loading"><LoaderCircle className="spin" size={22}/> Chargement de votre profil…</div>

  return <div className="content profile-page">
    <section className="welcome-row">
      <div><div className="eyebrow"><span className="live-dot"/> ESPACE PERSONNEL</div><h1>Mon profil</h1><p>Gérez vos informations personnelles, votre sécurité et vos préférences.</p></div>
    </section>
    {(error || message) && <div className={'profile-message ' + (error ? 'error' : 'success')}>{error ? <ShieldCheck size={17}/> : <CheckCircle2 size={17}/>}<span>{error || message}</span></div>}
    <section className="profile-hero panel">
      <div className="profile-avatar-large">{avatarUrl ? <img src={avatarUrl} alt="Photo de profil"/> : <span>{(fullName || email || 'U').trim().slice(0,1).toUpperCase()}</span>}</div>
      <div className="profile-hero-copy"><span className="profile-kicker">COMPTE UTILISATEUR</span><h2>{fullName || 'Utilisateur SIB Stock'}</h2><p>{email}</p><small>Photo JPG, PNG ou WebP · 5 Mo maximum</small></div>
      <input ref={fileRef} className="profile-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar}/>
      <button type="button" className="outline-button profile-photo-button" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <LoaderCircle className="spin" size={15}/> : <Camera size={15}/>} {uploading ? 'Envoi…' : 'Changer la photo'}</button>
    </section>
    <form className="profile-form" onSubmit={saveProfile}>
      <section className="panel profile-panel">
        <div className="profile-section-heading"><div className="profile-section-icon"><UserRound size={18}/></div><div><h2>Informations personnelles</h2><p>Ces informations permettent d’identifier votre compte.</p></div></div>
        <div className="profile-grid">
          <label>Nom complet<input required maxLength={120} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Nom et prénom"/></label>
          <label>Téléphone<input maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+224 6XX XX XX XX"/></label>
          <label className="profile-wide">Adresse e-mail<input type="email" required value={newEmail} onChange={e=>setNewEmail(e.target.value)}/><small>Une confirmation sera nécessaire si vous changez d’adresse.</small></label>
        </div>
      </section>
      <section className="panel profile-panel">
        <div className="profile-section-heading"><div className="profile-section-icon"><Activity size={18}/></div><div><h2>Préférences</h2><p>Personnalisez les paramètres de votre compte.</p></div></div>
        <div className="profile-grid">
          <label>Thème de l’interface<select value={theme} onChange={e=>setTheme(e.target.value as typeof theme)}><option value="light">Clair</option><option value="dark">Sombre</option><option value="system">Selon le système</option></select></label>
          <label>Langue préférée<select value={language} onChange={e=>setLanguage(e.target.value as typeof language)}><option value="fr">Français</option><option value="en">English</option></select></label>
          <label className="profile-toggle"><span><Mail size={16}/><span><strong>Notifications du compte</strong><small>Recevoir les notifications liées à votre espace.</small></span></span><input type="checkbox" checked={notifications} onChange={e=>setNotifications(e.target.checked)}/></label>
        </div>
        <div className="profile-save-row"><span>Les préférences sont enregistrées sur votre profil.</span><button className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>} Enregistrer le profil</button></div>
      </section>
    </form>
    <section className="panel profile-panel">
      <div className="profile-section-heading"><div className="profile-section-icon orange"><KeyRound size={18}/></div><div><h2>Sécurité du compte</h2><p>Modifiez votre mot de passe en vérifiant d’abord l’ancien.</p></div></div>
      <form className="profile-grid" onSubmit={changePassword}>
        <label>Mot de passe actuel<input type="password" autoComplete="current-password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label>
        <label>Nouveau mot de passe<input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
        <label>Confirmer le nouveau mot de passe<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>
        <div className="profile-security-submit"><button className="outline-button" disabled={passwordBusy}>{passwordBusy ? <LoaderCircle className="spin" size={15}/> : <KeyRound size={15}/>} Modifier le mot de passe</button></div>
      </form>
    </section>
    <section className="panel profile-session">
      <div className="profile-section-heading"><div className="profile-section-icon"><Clock3 size={18}/></div><div><h2>Activité de connexion</h2><p>Informations disponibles sur votre session actuelle.</p></div></div>
      <div className="profile-session-row"><div><strong>Dernière connexion</strong><small>{lastSignIn ? new Date(lastSignIn).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US') : 'Information non disponible'}</small></div><span className="profile-session-badge"><i/> Session authentifiée</span></div>
      <p className="profile-session-note">L’historique détaillé des appareils et des connexions n’est pas encore activé dans cette version.</p>
    </section>
    <p className="profile-id">Identifiant du compte : <code>{userId}</code></p>
  </div>
}
