-- Run once in the Supabase SQL Editor after creating the two Auth users.
-- Add each user's Auth UUID and display name to couple_members below.

create table if not exists public.couple_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

create or replace function public.is_couple_member(member_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.couple_members
    where user_id = member_id
  );
$$;

revoke all on function public.is_couple_member(uuid) from public;
grant execute on function public.is_couple_member(uuid) to authenticated;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  text text,
  image_url text,
  reaction text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint messages_content_present check (
    (text is not null and char_length(text) between 1 and 4000)
    or image_url is not null
  ),
  constraint messages_reaction_allowed check (reaction is null or reaction in ('❤️'))
);

create index if not exists messages_created_at_idx on public.messages (created_at desc);

create table if not exists public.bucket_list (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 240),
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists bucket_list_created_at_idx on public.bucket_list (created_at desc);

create table if not exists public.couple_memories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  memory_date date not null default current_date,
  mood text not null check (mood in ('First Date', 'Trip to Sea', 'Cozy Dinner', 'Adventure', 'Celebration', 'Everyday Magic')),
  image_path text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint couple_memories_image_owner_path check (
    (storage.foldername(image_path))[1] = created_by::text
  )
);

create index if not exists couple_memories_date_idx on public.couple_memories (memory_date desc, created_at desc);

create table if not exists public.couple_memory_likes (
  memory_id uuid not null references public.couple_memories (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (memory_id, user_id)
);

create table if not exists public.daily_moods (
  user_id uuid not null references auth.users (id) on delete cascade,
  mood_date date not null default current_date,
  mood text not null check (mood in ('Happy', 'Tired', 'Need hugs', 'Excited', 'Hungry')),
  updated_at timestamptz not null default now(),
  primary key (user_id, mood_date)
);

create table if not exists public.pin_attempt_windows (
  attempt_key text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0)
);

alter table public.pin_attempt_windows enable row level security;
revoke all on public.pin_attempt_windows from public, anon, authenticated;

drop function if exists public.consume_pin_attempt(text, integer, integer);

create function public.consume_pin_attempt(
  p_attempt_key text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempts integer;
begin
  insert into public.pin_attempt_windows as attempt_window (attempt_key, window_started_at, attempts)
  values (p_attempt_key, now(), 1)
  on conflict (attempt_key) do update
  set
    window_started_at = case
      when attempt_window.window_started_at <= now() - (p_window_seconds * interval '1 second') then now()
      else attempt_window.window_started_at
    end,
    attempts = case
      when attempt_window.window_started_at <= now() - (p_window_seconds * interval '1 second') then 1
      else attempt_window.attempts + 1
    end
  returning attempt_window.attempts into current_attempts;

  return current_attempts <= p_max_attempts;
end;
$$;

drop function if exists public.clear_pin_attempts(text);

create or replace function public.clear_pin_attempts(attempt_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.pin_attempt_windows
  where pin_attempt_windows.attempt_key = $1;
$$;

revoke all on function public.consume_pin_attempt(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_pin_attempt(text, integer, integer) to service_role;
revoke all on function public.clear_pin_attempts(text) from public, anon, authenticated;
grant execute on function public.clear_pin_attempts(text) to service_role;

alter table public.couple_members enable row level security;
alter table public.messages enable row level security;
alter table public.bucket_list enable row level security;
alter table public.couple_memories enable row level security;
alter table public.couple_memory_likes enable row level security;
alter table public.daily_moods enable row level security;

drop policy if exists "Couple members can view members" on public.couple_members;
create policy "Couple members can view members"
  on public.couple_members for select to authenticated
  using (public.is_couple_member());

drop policy if exists "Couple can read messages" on public.messages;
create policy "Couple can read messages"
  on public.messages for select to authenticated
  using (public.is_couple_member());

drop policy if exists "Couple members can send messages as themselves" on public.messages;
create policy "Couple members can send messages as themselves"
  on public.messages for insert to authenticated
  with check (public.is_couple_member() and sender_id = (select auth.uid()));

drop policy if exists "Couple members can update messages" on public.messages;
create policy "Couple members can update messages"
  on public.messages for update to authenticated
  using (public.is_couple_member())
  with check (public.is_couple_member());

drop policy if exists "Couple can read bucket list" on public.bucket_list;
create policy "Couple can read bucket list"
  on public.bucket_list for select to authenticated
  using (public.is_couple_member());

drop policy if exists "Couple can add bucket list items" on public.bucket_list;
create policy "Couple can add bucket list items"
  on public.bucket_list for insert to authenticated
  with check (public.is_couple_member());

drop policy if exists "Couple can update bucket list items" on public.bucket_list;
create policy "Couple can update bucket list items"
  on public.bucket_list for update to authenticated
  using (public.is_couple_member())
  with check (public.is_couple_member());

drop policy if exists "Couple can read memories" on public.couple_memories;
create policy "Couple can read memories"
  on public.couple_memories for select to authenticated
  using (public.is_couple_member());

drop policy if exists "Couple can add memories in their own folder" on public.couple_memories;
create policy "Couple can add memories in their own folder"
  on public.couple_memories for insert to authenticated
  with check (
    public.is_couple_member()
    and created_by = (select auth.uid())
    and (storage.foldername(image_path))[1] = (select auth.uid())::text
  );

drop policy if exists "Couple can read memory likes" on public.couple_memory_likes;
create policy "Couple can read memory likes"
  on public.couple_memory_likes for select to authenticated
  using (public.is_couple_member());

drop policy if exists "Members can like memories as themselves" on public.couple_memory_likes;
create policy "Members can like memories as themselves"
  on public.couple_memory_likes for insert to authenticated
  with check (public.is_couple_member() and user_id = (select auth.uid()));

drop policy if exists "Members can remove their own memory likes" on public.couple_memory_likes;
create policy "Members can remove their own memory likes"
  on public.couple_memory_likes for delete to authenticated
  using (public.is_couple_member() and user_id = (select auth.uid()));

drop policy if exists "Couple can read daily moods" on public.daily_moods;
create policy "Couple can read daily moods"
  on public.daily_moods for select to authenticated
  using (public.is_couple_member());

drop policy if exists "Members can add their own daily mood" on public.daily_moods;
create policy "Members can add their own daily mood"
  on public.daily_moods for insert to authenticated
  with check (public.is_couple_member() and user_id = (select auth.uid()));

drop policy if exists "Members can update their own daily mood" on public.daily_moods;
create policy "Members can update their own daily mood"
  on public.daily_moods for update to authenticated
  using (public.is_couple_member() and user_id = (select auth.uid()))
  with check (public.is_couple_member() and user_id = (select auth.uid()));

grant select on public.couple_members to authenticated;
grant select, insert, update on public.messages to authenticated;
grant select, insert, update on public.bucket_list to authenticated;
grant select, insert on public.couple_memories to authenticated;
grant select, insert, delete on public.couple_memory_likes to authenticated;
grant select, insert, update on public.daily_moods to authenticated;

-- Add the two Auth UUIDs. Do not use an anon/public policy for app data.
-- insert into public.couple_members (user_id, display_name) values
--   ('00000000-0000-0000-0000-000000000001', 'Alex'),
--   ('00000000-0000-0000-0000-000000000002', 'Sam');

-- Both buckets are private. App pages download images through authenticated
-- Storage requests so the browser never exposes a shareable public URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('chat-media', 'chat-media', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('couple-memories', 'couple-memories', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view chat media" on storage.objects;
drop policy if exists "Couple can view private images" on storage.objects;
create policy "Couple can view private images"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('chat-media', 'couple-memories')
    and public.is_couple_member()
  );

drop policy if exists "Couple can upload their own chat media" on storage.objects;
drop policy if exists "Couple can upload their own private images" on storage.objects;
create policy "Couple can upload their own private images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('chat-media', 'couple-memories')
    and public.is_couple_member()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Couple can update their own chat media" on storage.objects;
drop policy if exists "Couple can update their own private images" on storage.objects;
create policy "Couple can update their own private images"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('chat-media', 'couple-memories')
    and public.is_couple_member()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('chat-media', 'couple-memories')
    and public.is_couple_member()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Couple can delete their own chat media" on storage.objects;
drop policy if exists "Couple can delete their own private images" on storage.objects;
create policy "Couple can delete their own private images"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('chat-media', 'couple-memories')
    and public.is_couple_member()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Realtime messages are not emitted if already present in the publication.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bucket_list'
  ) then
    alter publication supabase_realtime add table public.bucket_list;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'couple_memories'
  ) then
    alter publication supabase_realtime add table public.couple_memories;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'couple_memory_likes'
  ) then
    alter publication supabase_realtime add table public.couple_memory_likes;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'daily_moods'
  ) then
    alter publication supabase_realtime add table public.daily_moods;
  end if;
end
$$;

notify pgrst, 'reload schema';
