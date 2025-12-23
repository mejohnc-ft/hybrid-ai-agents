-- Create incident_tickets table to map incidents to HaloPSA tickets
create table if not exists incident_tickets (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  halo_ticket_id integer not null,
  created_at timestamp with time zone default now(),

  -- Ensure one-to-one mapping
  unique(incident_id),
  unique(halo_ticket_id)
);

-- Create index for fast lookup by incident_id
create index if not exists idx_incident_tickets_incident_id on incident_tickets(incident_id);

-- Create index for fast lookup by halo_ticket_id
create index if not exists idx_incident_tickets_halo_id on incident_tickets(halo_ticket_id);
