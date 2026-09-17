-- 0007_storage.sql
-- Nexora Systems: Storage Bucket Provisioning (FR-CORE-10/12)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false, -- private, short-lived signed URLs only (FR-CORE-12)
  20971520, -- 20 MB max file size
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Storage bucket access policies
create policy "Authenticated users can read documents with signed URLs"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents');

create policy "Authenticated users can upload documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents');
