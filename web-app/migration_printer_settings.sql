-- Migration: Shared Printer Settings for MeiiShop POS
-- Enables centralized printer IP and configuration across all POS terminals and devices

create table if not exists public.printer_settings (
  id text primary key default 'default_printer',
  printer_ip text not null default '192.168.1.75',
  printer_port integer not null default 9100,
  paper_width integer default 72,
  auto_cut boolean default true,
  drawer_kick boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS) with open read/write for authenticated and anon users
alter table public.printer_settings enable row level security;

create policy "Allow all users to read printer settings"
  on public.printer_settings for select
  using (true);

create policy "Allow all users to insert or update printer settings"
  on public.printer_settings for all
  using (true)
  with check (true);

-- Insert initial default record if not exists
insert into public.printer_settings (id, printer_ip, printer_port, paper_width, auto_cut, drawer_kick)
values ('default_printer', '192.168.1.75', 9100, 72, true, false)
on conflict (id) do nothing;
