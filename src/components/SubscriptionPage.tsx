import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarClock, CheckCircle2, Clock3, CreditCard, Crown, LoaderCircle, ReceiptText, ShieldCheck, Sparkles, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Plan = {
  id: string; code: string; name: string; description: string | null; price_amount: number | null
  currency_code: string; billing_interval: string; features: string[]
}
type Subscription = {
  id: string; status: string; trial_started_at: string | null; trial_ends_at: string | null
  current_period_start: string | null; current_period_end: string | null; cancel_at_period_end: boolean
  subscription_plans: Plan | null
}
type RequestRow = {
  id: string; status: string; payment_method: string; payment_reference: string | null
  note: string | null; created_at: string; review_note: string | null
  plan: { name: string } | null
}
const methods = [
  { value:'orange_money', label:'Orange Money' },
  { value:'mobile_money', label:'Autre Mobile Money' },
  { value:'bank_transfer', label:'Virement bancaire' },
  { value:'cash', label:'Espèces' },
  { value:'other', label:'Autre' },
]
const dateFormat = new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeZone:'Africa/Conakry'})
const formatDate = (value: string | null) => value ? dateFormat.format(new Date(value)) : 'Non définie'
const formatPrice = (amount: number | null, currency: string) => amount === null ? 'Tarif sur demande' : amount === 0 ? 'Gratuit' : new Intl.NumberFormat('fr-GN',{style:'currency',currency,maximumFractionDigits:0}).format(amount)
const statusLabel: Record<string,string> = { trial:'Période d’essai',active:'Actif',past_due:'Paiement en attente',expired:'Expiré',cancelled:'Résilié',suspended:'Suspendu',pending:'En attente',approved:'Approuvée',rejected:'Refusée',cancelled_request:'Annulée' }
const methodLabel = (value:string) => methods.find(m=>m.value===value)?.label || value

export default function SubscriptionPage() {
  const [subscription,setSubscription] = useState<Subscription | null>(null)
  const [tenantId,setTenantId] = useState('')
  const [userId,setUserId] = useState('')
  const [plans,setPlans] = useState<Plan[]>([])
  const [requests,setRequests] = useState<RequestRow[]>([])
  const [selectedPlan,setSelectedPlan] = useState('')
  const [paymentMethod,setPaymentMethod] = useState('orange_money')
  const [paymentReference,setPaymentReference] = useState('')
  const [note,setNote] = useState('')
  const [canManage,setCanManage] = useState(false)
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')

  const load = useCallback(async () => {
    if (!supabase) { setError('Connexion Supabase indisponible.'); setLoading(false); return }
    setLoading(true); setError('')
    const [{data:tenantId,error:tenantError},{data:userData}] = await Promise.all([
      supabase.rpc('current_tenant_id'),supabase.auth.getUser()
    ])
    if (tenantError || !tenantId || !userData.user) {
      setError(tenantError?.message || 'Aucune entreprise active trouvée.'); setLoading(false); return
    }
    setTenantId(tenantId); setUserId(userData.user.id)
    const [subResult,planResult,memberResult,requestResult] = await Promise.all([
      supabase.from('tenant_subscriptions').select('id,status,trial_started_at,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,subscription_plans(id,code,name,description,price_amount,currency_code,billing_interval,features)').eq('tenant_id',tenantId).maybeSingle(),
      supabase.from('subscription_plans').select('id,code,name,description,price_amount,currency_code,billing_interval,features').eq('is_active',true).order('sort_order'),
      supabase.from('tenant_members').select('role').eq('tenant_id',tenantId).eq('user_id',userData.user.id).eq('status','active').maybeSingle(),
      supabase.from('subscription_requests').select('id,status,payment_method,payment_reference,note,created_at,review_note,plan:subscription_plans(name)').eq('tenant_id',tenantId).order('created_at',{ascending:false}).limit(10)
    ])
    if (subResult.error) setError(subResult.error.message)
    else setSubscription(subResult.data as unknown as Subscription | null)
    if (planResult.error) setError(planResult.error.message)
    else {
      const available = (planResult.data || []) as unknown as Plan[]
      setPlans(available.filter(p=>p.code!=='trial'))
      setSelectedPlan(current=>current || available.find(p=>p.code==='business')?.id || available.find(p=>p.code!=='trial')?.id || '')
    }
    setCanManage(['owner','admin'].includes(memberResult.data?.role || ''))
    if (requestResult.error) setError(requestResult.error.message)
    else setRequests((requestResult.data || []) as unknown as RequestRow[])
    setLoading(false)
  },[])

  useEffect(()=>{ void load() },[load])

  const pendingRequest = useMemo(()=>requests.some(r=>r.status==='pending'),[requests])
  const remainingDays = useMemo(()=>{
    if (!subscription?.trial_ends_at) return null
    return Math.max(0,Math.ceil((new Date(subscription.trial_ends_at).getTime()-Date.now())/86400000))
  },[subscription])
  const expiredTrial = subscription?.status==='trial' && remainingDays===0
  const currentPlanName = subscription?.subscription_plans?.name || (subscription?.status==='active' ? 'Offre existante' : 'Aucune offre attribuée')
  const currentEnd = subscription?.current_period_end || subscription?.trial_ends_at || null

  async function submitRequest(event:FormEvent) {
    event.preventDefault()
    if (!supabase || !selectedPlan || !canManage || pendingRequest) return
    setSaving(true); setError(''); setNotice('')
    const {error:requestError} = await supabase.from('subscription_requests').insert({
      tenant_id:tenantId,requested_plan_id:selectedPlan,payment_method:paymentMethod,
      payment_reference:paymentReference.trim() || null,note:note.trim() || null,
      created_by:userId,status:'pending'
    })
    if (requestError) setError(requestError.message)
    else {
      setNotice('Votre demande a été transmise. Elle sera examinée par l’équipe SIB.')
      setPaymentReference(''); setNote('')
      await load()
    }
    setSaving(false)
  }

  if (loading) return <div className="content subscription-page"><div className="panel subscription-loading"><LoaderCircle className="spin" size={22}/> Chargement de votre abonnement…</div></div>

  return <div className="content subscription-page">
    <section className="welcome-row"><div><div className="eyebrow"><CreditCard size={13}/> ESPACE CLIENT</div><h1>Gérer l’abonnement</h1><p>Consultez votre offre, suivez sa validité et envoyez vos demandes de renouvellement.</p></div></section>
    {error && <div className="subscription-message error"><AlertTriangle size={16}/>{error}</div>}
    {notice && <div className="subscription-message success"><CheckCircle2 size={16}/>{notice}</div>}
    <section className="subscription-current panel">
      <div className="subscription-current-head"><div className="subscription-crown"><Crown size={22}/></div><div><span className="subscription-overline">VOTRE ABONNEMENT ACTUEL</span><h2>{currentPlanName}</h2><p>{subscription?.subscription_plans?.description || 'Statut et période de validité de votre espace SIB Stock.'}</p></div><span className={'subscription-status '+(expiredTrial?'expired':subscription?.status || 'unknown')}>{expiredTrial?'Essai terminé':statusLabel[subscription?.status || ''] || 'À configurer'}</span></div>
      <div className="subscription-metrics">
        <div><span><CalendarClock size={14}/> Début de période</span><strong>{formatDate(subscription?.trial_started_at || subscription?.current_period_start || null)}</strong></div>
        <div><span><Clock3 size={14}/> Fin de validité</span><strong>{currentEnd ? formatDate(currentEnd) : 'Non définie'}</strong></div>
        <div><span><CreditCard size={14}/> Facturation</span><strong>{subscription?.subscription_plans?.billing_interval==='yearly'?'Annuelle':subscription?.subscription_plans?.billing_interval==='monthly'?'Mensuelle':subscription?.status==='trial'?'Essai gratuit':'À confirmer'}</strong></div>
      </div>
      {subscription?.status==='trial' && <div className={'trial-progress '+(expiredTrial?'is-expired':'')}><div><strong>{expiredTrial?'Votre période d’essai est terminée':remainingDays+' jour(s) restant(s) sur votre essai'}</strong><span>Essai initial de 33 jours</span></div><div className="trial-track"><i style={{width:Math.min(100,Math.max(0,((33-(remainingDays||0))/33)*100))+'%'}}/></div></div>}
      {subscription?.cancel_at_period_end && <p className="subscription-warning">La résiliation est programmée à la fin de la période en cours.</p>}
    </section>

    <section className="subscription-section-heading"><div><h2>Choisir une offre</h2><p>Les tarifs seront confirmés par l’équipe SIB avant toute activation.</p></div><span><ShieldCheck size={14}/> Demande sécurisée</span></section>
    <div className="subscription-plans">
      {plans.map(plan=><article key={plan.id} className={'subscription-plan '+(selectedPlan===plan.id?'selected':'')}>
        <div className="subscription-plan-top"><div className="subscription-plan-icon"><Sparkles size={18}/></div>{plan.code==='business'&&<span className="plan-recommended">POPULAIRE</span>}</div>
        <h3>{plan.name}</h3><p>{plan.description}</p><div className="subscription-price">{formatPrice(plan.price_amount,plan.currency_code)}{plan.price_amount!==null&&plan.price_amount>0&&<small> / {plan.billing_interval==='yearly'?'an':'mois'}</small>}</div>
        <ul>{(plan.features||[]).map((feature,i)=><li key={i}><CheckCircle2 size={14}/>{feature}</li>)}</ul>
        <button type="button" className={selectedPlan===plan.id?'selected-plan-button':'outline-button'} onClick={()=>setSelectedPlan(plan.id)}>{selectedPlan===plan.id?'Offre sélectionnée':'Choisir cette offre'}</button>
      </article>)}
      {plans.length===0&&<div className="panel subscription-empty">Aucune offre n’est actuellement disponible. Contactez l’assistance SIB.</div>}
    </div>

    <section className="panel subscription-request">
      <div className="panel-heading"><div><h2>Demander un renouvellement ou un changement d’offre</h2><p>Votre demande sera vérifiée avant toute modification de l’abonnement.</p></div><ReceiptText size={19}/></div>
      {!canManage ? <div className="subscription-readonly">Seuls le propriétaire et les administrateurs de l’entreprise peuvent gérer l’abonnement.</div> : pendingRequest ? <div className="subscription-pending"><Clock3 size={18}/><div><strong>Une demande est déjà en cours de traitement.</strong><p>Vous pourrez envoyer une nouvelle demande après la réponse de l’équipe SIB.</p></div></div> : <form onSubmit={submitRequest} className="subscription-form">
        <label>Offre souhaitée<select required value={selectedPlan} onChange={e=>setSelectedPlan(e.target.value)}><option value="" disabled>Choisir une offre</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name} — {formatPrice(p.price_amount,p.currency_code)}</option>)}</select></label>
        <label>Moyen de paiement prévu<select required value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>{methods.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
        <label>Référence de transaction (facultatif)<input value={paymentReference} onChange={e=>setPaymentReference(e.target.value)} placeholder="Référence de paiement, si déjà réglé"/></label>
        <label className="subscription-form-wide">Message complémentaire<textarea rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Précisez votre demande ou vos besoins…"/></label>
        <div className="subscription-form-footer"><p>Aucun paiement n’est prélevé depuis cette page. L’équipe SIB confirme les modalités et active l’offre après vérification.</p><button className="primary-button" disabled={saving||!selectedPlan}>{saving?<LoaderCircle className="spin" size={15}/>:<CreditCard size={15}/>} Envoyer la demande</button></div>
      </form>}
    </section>

    <section className="panel subscription-history"><div className="panel-heading"><div><h2>Historique des demandes</h2><p>Suivi de vos demandes de souscription et renouvellement.</p></div><ReceiptText size={18}/></div>
      {requests.length===0?<div className="subscription-empty">Aucune demande enregistrée pour le moment.</div>:<div className="subscription-history-list">{requests.map(r=><article key={r.id}><div className="subscription-history-icon"><ReceiptText size={16}/></div><div className="subscription-history-main"><strong>{r.plan?.name || 'Demande d’abonnement'}</strong><span>{formatDate(r.created_at)} · {methodLabel(r.payment_method)}{r.payment_reference?' · '+r.payment_reference:''}</span>{r.review_note&&<small>Réponse : {r.review_note}</small>}</div><span className={'subscription-status '+r.status}>{statusLabel[r.status]||r.status}</span></article>)}</div>}
    </section>
    <p className="subscription-security-note"><ShieldCheck size={14}/> Vos demandes sont rattachées à votre entreprise. Seul le propriétaire ou un administrateur peut les consulter et les créer.</p>
  </div>
}
