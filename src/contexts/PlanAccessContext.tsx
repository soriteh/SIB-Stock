import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export type PlanTier = 'trial' | 'essential' | 'business' | 'premium' | 'enterprise'
type PlanAccess = {
  tier: PlanTier
  status: string
  loading: boolean
  canAccess: (required: PlanTier) => boolean
  refresh: () => Promise<void>
}
const rank: Record<PlanTier, number> = { trial: 0, essential: 1, business: 2, premium: 3, enterprise: 4 }
const PlanAccessContext = createContext<PlanAccess>({
  tier: 'trial', status: 'trial', loading: true, canAccess: () => false, refresh: async () => {}
})
export function PlanAccessProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<PlanTier>('trial')
  const [status, setStatus] = useState('trial')
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    const { data: tenantId, error } = await supabase.rpc('current_tenant_id')
    if (error || !tenantId) { setTier('trial'); setStatus('trial'); setLoading(false); return }
    const { data, error: subscriptionError } = await supabase
      .from('tenant_subscriptions')
      .select('status,subscription_plans(plan_tier)')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (subscriptionError || !data) {
      setTier('trial'); setStatus('trial'); setLoading(false); return
    }
    const currentStatus = String(data.status || 'trial')
    const planRelation = data.subscription_plans as unknown as { plan_tier?: string } | null
    const rawTier = (planRelation?.plan_tier || 'trial') as PlanTier
    const validTier = rawTier in rank ? rawTier : 'trial'
    const blocked = ['expired', 'cancelled', 'suspended', 'past_due'].includes(currentStatus)
    setTier(blocked ? 'trial' : validTier)
    setStatus(currentStatus)
    setLoading(false)
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  const canAccess = useCallback((required: PlanTier) => rank[tier] >= rank[required], [tier])
  return <PlanAccessContext.Provider value={{ tier, status, loading, canAccess, refresh }}>{children}</PlanAccessContext.Provider>
}
export function usePlanAccess() { return useContext(PlanAccessContext) }
