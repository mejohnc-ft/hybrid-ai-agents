-- Create incident_escalations table to track human escalations
create table if not exists incident_escalations (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  reason text not null,
  agent_chain jsonb,
  escalated_at timestamp with time zone default now()
);

-- Create index for fast lookup by incident_id
create index if not exists idx_incident_escalations_incident_id on incident_escalations(incident_id);

-- Create index for time-based analytics
create index if not exists idx_incident_escalations_escalated_at on incident_escalations(escalated_at desc);

-- Create a view for incident analytics
create or replace view incident_analytics as
select
  i.id,
  i.summary,
  i.priority,
  i.status,
  i.created_at,
  i.updated_at,
  it.halo_ticket_id,
  ir.agent as resolution_agent,
  ir.confidence as resolution_confidence,
  ir.resolved_at,
  ie.reason as escalation_reason,
  ie.escalated_at,
  case
    when ir.agent = 'npu' then 'T1 - Local NPU'
    when ir.agent = 'cloud' then 'T2+ - Cloud'
    when ie.id is not null then 'Escalated to Human'
    else 'Pending'
  end as resolution_type,
  extract(epoch from (coalesce(ir.resolved_at, ie.escalated_at, now()) - i.created_at)) as resolution_time_seconds
from incidents i
left join incident_tickets it on i.id = it.incident_id
left join incident_resolutions ir on i.id = ir.incident_id
left join incident_escalations ie on i.id = ie.incident_id;
