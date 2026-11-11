insert into public.subscription_plans(code,name,description,price_amount,currency_code,billing_interval,features,is_active,sort_order,plan_tier,limits)
values ('premium','Premium','Pour les entreprises qui pilotent des stocks avancés et plusieurs dépôts',null,'GNF','monthly',
'["Toutes les fonctionnalités Business","Analyse des marges et valorisation du stock","Rapports avancés et indicateurs de performance","Jusqu’à 15 utilisateurs et 10 entrepôts"]'::jsonb,true,3,'premium',
'{"users":15,"products":15000,"warehouses":10,"establishments":3,"history_months":36}'::jsonb)
on conflict(code) do update set plan_tier='premium',limits=excluded.limits,features=excluded.features;

drop function if exists public.admin_save_subscription_plan(uuid,text,text,text,numeric,text,text,jsonb,boolean,integer);
drop function if exists public.admin_save_subscription_plan(uuid,text,text,text,numeric,text,text,jsonb,boolean,integer,text);
