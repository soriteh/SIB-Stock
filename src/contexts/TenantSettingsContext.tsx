import {createContext,useContext,useEffect,useState,type ReactNode} from 'react'
import {supabase} from '../lib/supabase'

export type TenantSettings={
 id:string;name:string;legal_name:string|null;logo_url:string|null;currency_code:string;
 country_code:string|null;address:string|null;phone:string|null;email:string|null;
 website:string|null;tax_number:string|null;legal_form:string|null;timezone:string
}
const defaults:TenantSettings={id:'',name:'Mon entreprise',legal_name:null,logo_url:null,currency_code:'GNF',country_code:'GN',address:null,phone:null,email:null,website:null,tax_number:null,legal_form:null,timezone:'Africa/Conakry'}
const SettingsContext=createContext<TenantSettings>(defaults)
export function TenantSettingsProvider({children}:{children:ReactNode}){
 const [settings,setSettings]=useState<TenantSettings>(defaults)
 useEffect(()=>{
  let alive=true
  async function load(){
   if(!supabase)return
   const {data:tenantId}=await supabase.rpc('current_tenant_id')
   if(!tenantId)return
   const {data}=await supabase.from('tenants').select('id,name,legal_name,logo_url,currency_code,country_code,address,phone,email,website,tax_number,legal_form,timezone').eq('id',tenantId).maybeSingle()
   if(alive&&data)setSettings({...defaults,...data})
  }
  void load()
  const refresh=(event:Event)=>{const value=(event as CustomEvent<Partial<TenantSettings>>).detail;if(value&&alive)setSettings(current=>({...current,...value}))}
  window.addEventListener('tenant-settings-updated',refresh)
  return()=>{alive=false;window.removeEventListener('tenant-settings-updated',refresh)}
 },[])
 return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}
export function useTenantSettings(){return useContext(SettingsContext)}
export function formatTenantMoney(value:number,currencyCode='GNF'){
 return new Intl.NumberFormat('fr-FR',{style:'currency',currency:currencyCode,maximumFractionDigits:currencyCode==='GNF'||currencyCode==='XOF'?0:2}).format(Number.isFinite(value)?value:0)
}
export function formatTenantDate(value:string|Date,settings:TenantSettings,options:Intl.DateTimeFormatOptions={dateStyle:'medium'}){
 return new Intl.DateTimeFormat('fr-FR',{...options,timeZone:settings.timezone||'Africa/Conakry'}).format(new Date(value))
}
