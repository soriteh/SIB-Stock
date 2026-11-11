import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export type Establishment = { id: string; tenant_id: string; code: string; name: string; address: string | null; phone: string | null; email: string | null; is_primary: boolean; is_active: boolean }
type EstablishmentState = {
  establishments: Establishment[]
  activeEstablishment: Establishment | null
  loading: boolean
  error: string
  setActive: (id: string) => Promise<void>
  refresh: () => Promise<void>
}
const Context = createContext<EstablishmentState>({
  establishments: [], activeEstablishment: null, loading: true, error: '',
  setActive: async () => {}, refresh: async () => {}
})
export function EstablishmentProvider({ children }: { children: ReactNode }) {
  const [establishments, setEstablishments] = useState<Establishment[]>([])
  const [activeId, setActiveId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true); setError('')
    const [{ data: rows, error: listError }, { data: userData }] = await Promise.all([
      supabase.from('establishments').select('id,tenant_id,code,name,address,phone,email,is_primary,is_active').eq('is_active', true).order('is_primary', { ascending: false }).order('name'),
      supabase.auth.getUser()
    ])
    if (listError) { setError(listError.message); setLoading(false); return }
    const items = (rows ?? []) as Establishment[]
    setEstablishments(items)
    const userId = userData.user?.id
    let selected = ''
    if (userId) {
      const { data: profile } = await supabase.from('profiles').select('active_establishment_id').eq('id', userId).maybeSingle()
      selected = profile?.active_establishment_id ?? ''
    }
    if (!items.some(item => item.id === selected)) selected = items.find(item => item.is_primary)?.id ?? items[0]?.id ?? ''
    setActiveId(selected)
    setLoading(false)
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  const setActive = useCallback(async (id: string) => {
    if (!supabase || !establishments.some(item => item.id === id)) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { error: updateError } = await supabase.from('profiles').update({ active_establishment_id: id }).eq('id', userData.user.id)
    if (updateError) { setError(updateError.message); return }
    setActiveId(id)
    window.dispatchEvent(new CustomEvent('establishment-changed', { detail: { id } }))
  }, [establishments])
  const activeEstablishment = establishments.find(item => item.id === activeId) ?? null
  return <Context.Provider value={{ establishments, activeEstablishment, loading, error, setActive, refresh }}>{children}</Context.Provider>
}
export function useEstablishment() { return useContext(Context) }
