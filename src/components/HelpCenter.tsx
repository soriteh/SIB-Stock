import { useMemo, useState } from 'react'
import { BookOpen, ChevronDown, CircleHelp, LifeBuoy, Mail, MessageCircle, Package, Search, ShieldCheck, Wallet } from 'lucide-react'

const articles = [
  { category:'Démarrage', icon:BookOpen, title:'Comment configurer mon entreprise ?', body:'Ouvrez Paramètres depuis le menu Configuration. Renseignez le nom commercial, la raison sociale, les coordonnées, la devise et le fuseau horaire. Seuls le propriétaire et les administrateurs peuvent enregistrer les changements.' },
  { category:'Produits & stock', icon:Package, title:'Comment ajouter un produit ?', body:'Ouvrez Produits, sélectionnez Ajouter un produit, puis renseignez le nom, la référence SKU, la catégorie, les prix, l’unité et le seuil minimum. Enregistrez ensuite la fiche.' },
  { category:'Produits & stock', icon:Package, title:'Comment enregistrer une entrée ou une sortie ?', body:'Ouvrez Mouvements, choisissez le produit et l’entrepôt, sélectionnez le type de mouvement puis indiquez la quantité. Vérifiez les informations avant validation. Une sortie ne peut pas dépasser le stock disponible.' },
  { category:'Produits & stock', icon:Package, title:'À quoi sert un inventaire physique ?', body:'Dans Inventaires, créez une session pour un entrepôt, saisissez les quantités réellement comptées pour chaque produit puis finalisez. L’application génère les ajustements nécessaires et conserve l’historique.' },
  { category:'Produits & stock', icon:Package, title:'Comment transférer des produits entre entrepôts ?', body:'Ouvrez Transferts, sélectionnez le produit, l’entrepôt source, l’entrepôt de destination et la quantité. Le transfert enregistre simultanément la sortie et l’entrée.' },
  { category:'Achats & ventes', icon:Wallet, title:'Comment enregistrer un achat ou une vente ?', body:'Utilisez les modules Achats ou Ventes. Ajoutez les lignes de produits, quantités et prix, vérifiez le total puis enregistrez le document.' },
  { category:'Finances', icon:Wallet, title:'Comment faire un dépôt, un retrait ou un virement ?', body:'Dans Caisse & finances, sélectionnez le compte concerné et saisissez le montant. Pour un virement, choisissez les comptes source et destination. Le transfert est refusé si le solde source est insuffisant.' },
  { category:'Sécurité', icon:ShieldCheck, title:'Qui peut modifier les paramètres et les utilisateurs ?', body:'Les paramètres de l’entreprise sont modifiables par le propriétaire et les administrateurs. La gestion des membres dépend du rôle attribué dans Administration. Ne partagez jamais votre mot de passe.' },
]
const categories = ['Tous','Démarrage','Produits & stock','Achats & ventes','Finances','Sécurité']

export default function HelpCenter() {
  const [query,setQuery] = useState('')
  const [category,setCategory] = useState('Tous')
  const [opened,setOpened] = useState<string | null>(null)
  const filtered = useMemo(() => articles.filter(a => (category === 'Tous' || a.category === category) && (a.title+' '+a.body+' '+a.category).toLowerCase().includes(query.toLowerCase())),[query,category])
  return <div className="content help-page">
    <section className="help-hero"><div className="help-hero-icon"><LifeBuoy size={24}/></div><div><div className="eyebrow">ASSISTANCE SIB STOCK</div><h1>Centre d’aide</h1><p>Guides pratiques et réponses aux questions fréquentes pour utiliser votre application.</p></div></section>
    <section className="help-search"><Search size={18}/><input aria-label="Rechercher dans l’aide" placeholder="Rechercher une question, un module ou une fonctionnalité…" value={query} onChange={e=>setQuery(e.target.value)}/></section>
    <div className="help-categories">{categories.map(c=><button key={c} className={category===c?'selected':''} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    <section className="panel help-articles"><div className="panel-heading"><div><h2>Questions fréquentes</h2><p>{filtered.length} article(s) disponible(s)</p></div><CircleHelp size={19}/></div>
      {filtered.map((article)=>{const Icon=article.icon;const isOpen=opened===article.title;return <article className="help-article" key={article.title}><button className="help-question" onClick={()=>setOpened(isOpen?null:article.title)} aria-expanded={isOpen}><span className="help-article-icon"><Icon size={16}/></span><span><small>{article.category}</small><strong>{article.title}</strong></span><ChevronDown className={isOpen?'rotated':''} size={17}/></button>{isOpen&&<p className="help-answer">{article.body}</p>}</article>})}
      {filtered.length===0&&<div className="empty-state">Aucun article ne correspond à votre recherche.</div>}
    </section>
    <section className="help-contact"><div><div className="help-contact-icon"><MessageCircle size={20}/></div><div><h2>Vous n’avez pas trouvé votre réponse ?</h2><p>Contactez l’équipe SIB pour obtenir une assistance complémentaire.</p></div></div><a href="mailto:soritechn@gmail.com?subject=Assistance%20SIB%20Stock"><Mail size={15}/> Contacter l’assistance</a></section>
    <p className="help-footnote">Pour votre sécurité, ne transmettez jamais votre mot de passe ni vos clés d’accès.</p>
  </div>
}
