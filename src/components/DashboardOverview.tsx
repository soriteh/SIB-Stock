import {useCallback,useEffect,useMemo,useState} from 'react'
import {Activity,ArrowDownLeft,ArrowUpRight,Boxes,Building2,CalendarDays,Clock3,Package,ShoppingCart,Truck,Wallet,ArrowLeftRight,Users} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {formatTenantMoney,useTenantSettings} from '../contexts/TenantSettingsContext'

type Product={id:string;sku:string;name:string;purchase_price:number;minimum_stock:number}
type Level={product_id:string;quantity:number;products:Product|null}
type Move={id:string;movement_type:string;quantity_delta:number;created_at:string;products:{name:string;sku:string}|null;warehouses:{name:string}|null}
type Doc={id:string;document_type:string;status:string;total_amount:number;document_date:string}
type Account={id:string;name:string;account_type:'cash'|'bank';current_balance:number}
type Fin={id:string;transaction_type:string;amount:number;created_at:string}
const dayKey=(d:Date)=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day}
const labels:Record<string,string>={opening:'Stock initial',receipt:'Réception',sale:'Sortie / vente',transfer_in:'Transfert entrant',transfer_out:'Transfert sortant',adjustment_in:'Ajustement positif',adjustment_out:'Ajustement négatif',customer_return:'Retour client',supplier_return:'Retour fournisseur',reversal:'Annulation'}
export default function DashboardOverview({onNavigate,displayName,currentTime}:{onNavigate:(section:string)=>void;displayName:string;currentTime:Date}){
 const company=useTenantSettings(),currency=company.currency_code||'GNF'
 const money=(n:number)=>formatTenantMoney(n,currency)
 const [levels,setLevels]=useState<Level[]>([]),[moves,setMoves]=useState<Move[]>([]),[docs,setDocs]=useState<Doc[]>([]),[accounts,setAccounts]=useState<Account[]>([]),[finance,setFinance]=useState<Fin[]>([])
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[updated,setUpdated]=useState<Date|null>(null)
 const load=useCallback(async()=>{
  if(!supabase){setLoading(false);setError('Connexion à la base de données indisponible.');return}
  setLoading(true);setError('')
  const [l,m,d,a,f]=await Promise.all([
   supabase.from('stock_levels').select('product_id,quantity,products(id,sku,name,purchase_price,minimum_stock)').order('updated_at',{ascending:false}).limit(2000),
   supabase.from('stock_movements').select('id,movement_type,quantity_delta,created_at,products(name,sku),warehouses(name)').order('created_at',{ascending:false}).limit(500),
   supabase.from('inventory_documents').select('id,document_type,status,total_amount,document_date').order('document_date',{ascending:false}).limit(2000),
   supabase.from('financial_accounts').select('id,name,account_type,current_balance').eq('is_active',true),
   supabase.from('financial_transactions').select('id,transaction_type,amount,created_at').order('created_at',{ascending:false}).limit(1000)
  ])
  const first=l.error||m.error||d.error||a.error||f.error
  if(first)setError(first.message)
  setLevels((l.data??[]) as unknown as Level[]);setMoves((m.data??[]) as unknown as Move[]);setDocs((d.data??[]) as Doc[]);setAccounts((a.data??[]) as Account[]);setFinance((f.data??[]) as Fin[])
  setUpdated(new Date());setLoading(false)
 },[])
 useEffect(()=>{void load()},[load])
 const now=currentTime,today=dayKey(now),month=today.slice(0,7),since=new Date(now);since.setDate(now.getDate()-13)
 const moves14=moves.filter(x=>x.created_at.slice(0,10)>=dayKey(since)&&x.created_at.slice(0,10)<=today)
 const posted=docs.filter(x=>x.status==='posted')
 const todayDocs=posted.filter(x=>x.document_date.slice(0,10)===today)
 const monthDocs=posted.filter(x=>x.document_date.slice(0,7)===month)
 const todayFin=finance.filter(x=>x.created_at.slice(0,10)===today)
 const stockValue=levels.reduce((s,x)=>s+Number(x.quantity||0)*Number(x.products?.purchase_price||0),0)
 const lowStock=levels.filter(x=>x.products&&Number(x.quantity)<=Number(x.products.minimum_stock||0))
 const cash=accounts.filter(x=>x.account_type==='cash').reduce((s,x)=>s+Number(x.current_balance||0),0)
 const bank=accounts.filter(x=>x.account_type==='bank').reduce((s,x)=>s+Number(x.current_balance||0),0)
 const salesToday=todayDocs.filter(x=>x.document_type==='sale').reduce((s,x)=>s+Number(x.total_amount||0),0)
 const purchasesMonth=monthDocs.filter(x=>x.document_type==='purchase').reduce((s,x)=>s+Number(x.total_amount||0),0)
 const salesMonth=monthDocs.filter(x=>x.document_type==='sale').reduce((s,x)=>s+Number(x.total_amount||0),0)
 const depositsToday=todayFin.filter(x=>x.transaction_type==='deposit').reduce((s,x)=>s+Number(x.amount||0),0)
 const expensesToday=todayFin.filter(x=>x.transaction_type==='withdrawal').reduce((s,x)=>s+Number(x.amount||0),0)
 const chart=useMemo(()=>Array.from({length:14},(_,i)=>{const date=new Date(since);date.setDate(since.getDate()+i);const key=dayKey(date);const rows=moves14.filter(x=>x.created_at.slice(0,10)===key);return{key,label:String(date.getDate()).padStart(2,'0'),inQty:rows.filter(x=>Number(x.quantity_delta)>0).reduce((s,x)=>s+Number(x.quantity_delta),0),outQty:rows.filter(x=>Number(x.quantity_delta)<0).reduce((s,x)=>s+Math.abs(Number(x.quantity_delta)),0)}}),[moves14])
 const maxBar=Math.max(1,...chart.map(x=>Math.max(x.inQty,x.outQty)))
 const inbound=moves14.filter(x=>Number(x.quantity_delta)>0).reduce((s,x)=>s+Number(x.quantity_delta),0),outbound=moves14.filter(x=>Number(x.quantity_delta)<0).reduce((s,x)=>s+Math.abs(Number(x.quantity_delta)),0)
 const totalFlow=inbound+outbound, inPct=totalFlow?inbound/totalFlow*100:0
 const topProducts=useMemo(()=>{const grouped=new Map<string,{product:Product;quantity:number;value:number}>();for(const row of levels){if(!row.products)continue;const old=grouped.get(row.product_id)||{product:row.products,quantity:0,value:0};old.quantity+=Number(row.quantity||0);old.value+=Number(row.quantity||0)*Number(row.products.purchase_price||0);grouped.set(row.product_id,old)}return [...grouped.values()].sort((a,b)=>b.value-a.value).slice(0,5)},[levels])
 const latest=moves.slice(0,6)
 const totalTop=Math.max(1,...topProducts.map(x=>x.value))
 const hour=Number(new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',hourCycle:'h23',timeZone:'Africa/Conakry'}).format(now))
 const greeting=hour>=5&&hour<12?'Bonjour':hour>=12&&hour<18?'Bon après-midi':hour>=18&&hour<22?'Bonsoir':'Bonne nuit'
 const welcomeText=hour>=5&&hour<12?'Nous vous souhaitons une excellente matinée de travail.':hour>=12&&hour<18?'Nous vous souhaitons un excellent après-midi de travail.':hour>=18&&hour<22?'Nous vous souhaitons une agréable soirée.':'Nous vous souhaitons une excellente nuit.'
 const shortcuts=[{label:'Nouveau produit',icon:Package,section:'Produits',tone:'blue'},{label:'Entrée de stock',icon:ArrowDownLeft,section:'Mouvements',tone:'violet'},{label:'Sortie de stock',icon:ArrowUpRight,section:'Mouvements',tone:'orange'},{label:'Transfert',icon:ArrowLeftRight,section:'Transferts',tone:'teal'},{label:'Inventaire',icon:Boxes,section:'Inventaires',tone:'green'},{label:'Achats',icon:Truck,section:'Achats',tone:'cyan'},{label:'Ventes',icon:ShoppingCart,section:'Ventes',tone:'gray'},{label:'Clients',icon:Users,section:'Clients',tone:'navy'}]
 return <div className="content dashboard-page">
  <section className="dashboard-welcome"><div className="dashboard-welcome-copy"><span className="dashboard-welcome-brand"><i/> SORITECH INNOV BUSINESS <b>/</b> ESPACE DE GESTION</span><h2>{greeting}, {displayName||'Utilisateur'} <span aria-hidden="true">👋</span></h2><p>{welcomeText}</p><div className="dashboard-welcome-date"><CalendarDays size={14}/>{new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:company.timezone||'Africa/Conakry'}).format(now)}</div></div>{company.logo_url&&<img className="dashboard-welcome-logo" src={company.logo_url} alt={'Logo '+company.name}/>}</section>
  
  <section className="dashboard-shortcuts"><div className="dashboard-shortcuts-heading"><h3>Raccourcis</h3><span>Accès rapide aux opérations</span></div><div className="dashboard-shortcuts-grid">{shortcuts.map(({label,icon:Icon,section,tone})=><button className={'dashboard-shortcut '+tone} key={label} onClick={()=>onNavigate(section)}><Icon size={21} strokeWidth={2}/><span>{label}</span></button>)}</div></section>
  {error&&<div className="catalog-error">Certaines données n’ont pas pu être chargées : {error}</div>}
  <section className="dashboard-kpi-grid">
   <article className="dashboard-kpi"><div className="dashboard-kpi-icon green"><ArrowDownLeft size={19}/></div><div><span>ENTRÉES AUJOURD’HUI</span><strong>{loading?'—':moves14.filter(x=>x.created_at.slice(0,10)===today&&Number(x.quantity_delta)>0).reduce((s,x)=>s+Number(x.quantity_delta),0).toLocaleString('fr-FR')}</strong><small>Quantités reçues</small></div></article>
   <article className="dashboard-kpi"><div className="dashboard-kpi-icon blue"><ShoppingCart size={19}/></div><div><span>VENTES DU JOUR</span><strong>{loading?'—':money(salesToday)}</strong><small>Documents de vente validés</small></div></article>
   <article className="dashboard-kpi"><div className="dashboard-kpi-icon violet"><Truck size={19}/></div><div><span>ACHATS DU MOIS</span><strong>{loading?'—':money(purchasesMonth)}</strong><small>Achats comptabilisés</small></div></article>
   <article className="dashboard-kpi"><div className="dashboard-kpi-icon green"><Activity size={19}/></div><div><span>VENTES DU MOIS</span><strong>{loading?'—':money(salesMonth)}</strong><small>Ventes comptabilisées</small></div></article>
   <article className="dashboard-kpi"><div className="dashboard-kpi-icon teal"><Package size={19}/></div><div><span>VALEUR DU STOCK</span><strong>{loading?'—':money(stockValue)}</strong><small>Valorisation au coût d’achat</small></div></article>
   <article className="dashboard-kpi"><div className="dashboard-kpi-icon blue"><Wallet size={19}/></div><div><span>ESPÈCES EN CAISSE</span><strong>{loading?'—':money(cash)}</strong><small>Soldes des caisses actives</small></div></article>
   <article className="dashboard-kpi"><div className="dashboard-kpi-icon orange"><Building2 size={19}/></div><div><span>COMPTES BANCAIRES</span><strong>{loading?'—':money(bank)}</strong><small>Soldes bancaires actifs</small></div></article>
   <article className="dashboard-kpi"><div className="dashboard-kpi-icon red"><Boxes size={19}/></div><div><span>ALERTES DE STOCK</span><strong>{loading?'—':lowStock.length.toLocaleString('fr-FR')}</strong><small>Seuil minimum atteint</small></div></article>
  </section>
  <section className="dashboard-analytics-grid">
   <article className="dashboard-panel dashboard-chart-panel"><div className="dashboard-panel-heading"><div><h3>Entrées et sorties des 14 derniers jours</h3><p>Évolution des quantités enregistrées</p></div><span className="dashboard-period"><CalendarDays size={13}/> 14 jours</span></div><div className="dashboard-legend"><span><i className="legend-in"/> Entrées</span><span><i className="legend-out"/> Sorties</span></div><div className="dashboard-bar-chart">{chart.map(d=><div className="dashboard-bar-day" key={d.key}><div className="dashboard-bars"><i className="bar-in" title={'Entrées : '+d.inQty} style={{height:(d.inQty/maxBar*100)+'%'}}/><i className="bar-out" title={'Sorties : '+d.outQty} style={{height:(d.outQty/maxBar*100)+'%'}}/></div><span>{d.label}</span></div>)}</div>{!loading&&moves14.length===0&&<div className="dashboard-chart-empty">Aucun mouvement enregistré sur les 14 derniers jours.</div>}</article>
   <article className="dashboard-panel dashboard-flow-panel"><div className="dashboard-panel-heading"><div><h3>Répartition des mouvements</h3><p>Sur les 14 derniers jours, en quantité</p></div></div><div className="dashboard-donut-wrap"><div className="dashboard-donut" style={{background:totalFlow?'conic-gradient(#2f6de0 0 '+inPct+'%, #f58a36 '+inPct+'% 100%)':'#e8edf5'}}><div/></div></div><div className="dashboard-flow-legend"><div><span><i className="legend-in"/> Entrées</span><strong>{loading?'—':inPct.toFixed(0)+'%'}</strong></div><div><span><i className="legend-out"/> Sorties</span><strong>{loading?'—':(100-inPct).toFixed(0)+'%'}</strong></div></div>{!loading&&totalFlow===0&&<div className="dashboard-chart-empty">Aucun mouvement à répartir.</div>}</article>
  </section>
  <section className="dashboard-bottom-grid">
   <article className="dashboard-panel"><div className="dashboard-panel-heading"><div><h3>Top 5 des produits en stock</h3><p>Classement par valeur au coût d’achat</p></div><button className="dashboard-text-link" onClick={()=>onNavigate('Produits')}>Tout voir</button></div>{topProducts.length?topProducts.map(x=><div className="dashboard-top-product" key={x.product.id}><div className="dashboard-product-name"><span>{x.product.name}</span><strong>{money(x.value)}</strong></div><div className="dashboard-product-track"><i style={{width:(x.value/totalTop*100)+'%'}}/></div></div>):<div className="dashboard-panel-empty"><Package size={19}/>Aucun produit en stock enregistré.</div>}</article>
   <article className="dashboard-panel"><div className="dashboard-panel-heading"><div><h3>Trésorerie du jour</h3><p>Opérations financières enregistrées aujourd’hui</p></div><button className="dashboard-text-link" onClick={()=>onNavigate('Caisse & finances')}>Ouvrir</button></div><div className="dashboard-cash-row"><span>Encaissements</span><strong className="positive">{loading?'—':money(depositsToday)}</strong></div><div className="dashboard-cash-row"><span>Décaissements</span><strong className="negative">{loading?'—':money(expensesToday)}</strong></div><div className="dashboard-cash-row cash-net"><span>Solde net du jour</span><strong>{loading?'—':money(depositsToday-expensesToday)}</strong></div><div className="dashboard-cash-foot"><Wallet size={14}/> Données issues des opérations de caisse et banque</div></article>
   <article className="dashboard-panel dashboard-recent-panel"><div className="dashboard-panel-heading"><div><h3>Dernières opérations de stock</h3><p>Historique des mouvements récents</p></div><button className="dashboard-text-link" onClick={()=>onNavigate('Mouvements')}>Tout voir</button></div>{latest.length?latest.map(x=><div className="dashboard-recent-row" key={x.id}><span className={Number(x.quantity_delta)>=0?'recent-movement-icon in':'recent-movement-icon out'}>{Number(x.quantity_delta)>=0?<ArrowDownLeft size={15}/>:<ArrowUpRight size={15}/>}</span><div><strong>{x.products?.name||'Produit'}</strong><small>{labels[x.movement_type]||x.movement_type} · {x.warehouses?.name||'Entrepôt'}</small></div><b className={Number(x.quantity_delta)>=0?'positive':'negative'}>{Number(x.quantity_delta)>0?'+':''}{Number(x.quantity_delta).toLocaleString('fr-FR')}</b></div>):<div className="dashboard-panel-empty"><Clock3 size={18}/>Aucune opération enregistrée.</div>}</article>
  </section>
  <div className="dashboard-footnote">{updated?'Dernière actualisation : '+new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'}).format(updated):'Chargement des données…'} · Tous les indicateurs sont calculés à partir des données enregistrées.</div>
 </div>
}
