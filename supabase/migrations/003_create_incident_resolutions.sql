-- Create incident_resolutions table to track AI agent resolutions
create table if not exists incident_resolutions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  agent text not null check (agent in ('npu', 'cloud')),
  resolution text not null,
  confidence real not null check (confidence >= 0 and confidence <= 1),
  agent_chain jsonb,
  resolved_at timestamp with time zone default now()
);

-- Create index for fast lookup by incident_id
create index if not exists idx_incident_resolutions_incident_id on incident_resolutions(incident_id);

-- Create index for agent type analytics
create index if not exists idx_incident_resolutions_agent on incident_resolutions(agent);

-- Create index for confidence analytics
create index if not exists idx_incident_resolutions_confidence on incident_resolutions(confidence desc);

-- Create index for time-based analytics
create index if not exists idx_incident_resolutions_resolved_at on incident_resolutions(resolved_at desc);
