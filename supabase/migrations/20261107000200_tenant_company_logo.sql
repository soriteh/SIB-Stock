-- Allow tenant owners and admins to upload a public company logo.
alter table public.tenants
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenant-logos', 'tenant-logos', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/png','image/jpeg','image/webp'];

drop policy if exists "Tenant admins upload company logos" on storage.objects;
create policy "Tenant admins upload company logos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'tenant-logos'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
  and public.has_tenant_role(array['owner','admin'])
);

grant update (logo_url) on table public.tenants to authenticated;
