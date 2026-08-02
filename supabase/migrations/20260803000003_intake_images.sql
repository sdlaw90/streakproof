-- ============================================================
--  Intake images — a private bucket for the "inspo pic" on /build
--
--  Private, not public. A reference photo is personal: it may be a picture of
--  the user, and even when it isn't, "what I want to look like" is not
--  something to serve from a guessable public URL. Reads go through signed
--  URLs, which expire.
-- ============================================================

-- --------------------------------------------------------------------------
-- The bucket.
--
--   public = false        -> no unauthenticated URL works; signed URLs only
--   file_size_limit       -> 5 MB, enforced by storage itself rather than only
--                            by the client, which can be bypassed
--   allowed_mime_types    -> images only. Without this the bucket happily
--                            accepts an HTML file, which is a stored-XSS
--                            vector the moment anything renders it inline.
-- --------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'intake',
  'intake',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- --------------------------------------------------------------------------
-- Per-user folders.
--
-- Every object must live at `<user_id>/<filename>`. The policies below compare
-- the first path segment to auth.uid(), so a user can only ever touch their own
-- folder — reading, writing, replacing or deleting. There is no policy that
-- lets one user see another's, and no "public read" policy at all.
-- --------------------------------------------------------------------------
drop policy if exists "intake images are readable by their owner" on storage.objects;
create policy "intake images are readable by their owner" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'intake'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "intake images are writable by their owner" on storage.objects;
create policy "intake images are writable by their owner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'intake'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "intake images are replaceable by their owner" on storage.objects;
create policy "intake images are replaceable by their owner" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'intake'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "intake images are deletable by their owner" on storage.objects;
create policy "intake images are deletable by their owner" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'intake'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
