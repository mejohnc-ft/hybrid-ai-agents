-- Create incidents table
create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  summary text not null,
  description text not null,
  category text,
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null check (status in ('open', 'in_progress', 'resolved', 'escalated', 'closed')),
  user_email text not null,
  user_name text not null,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create index on status for faster filtering
create index if not exists idx_incidents_status on incidents(status);

-- Create index on created_at for sorting
create index if not exists idx_incidents_created_at on incidents(created_at desc);

-- Create index on priority for filtering
create index if not exists idx_incidents_priority on incidents(priority);

-- Create updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_incidents_updated_at
  before update on incidents
  for each row
  execute function update_updated_at_column();
