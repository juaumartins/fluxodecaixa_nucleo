-- Execute este script no SQL Editor do Supabase.
create table if not exists public.app_data (
  id bigint primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'manager' check (role in ('admin', 'manager')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.app_data enable row level security;
alter table public.profiles enable row level security;

create policy "authenticated users read shared data"
  on public.app_data for select to authenticated using (true);
create policy "authenticated users update shared data"
  on public.app_data for update to authenticated using (true) with check (true);
create policy "authenticated users insert shared data"
  on public.app_data for insert to authenticated with check (true);
create policy "users read own profile"
  on public.profiles for select to authenticated using (auth.uid() = id);

insert into public.app_data (id, data) values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- Depois de criar o primeiro usuário em Authentication > Users, promova-o a admin:
-- update public.profiles set role = 'admin' where email = 'seu-email@exemplo.com';
