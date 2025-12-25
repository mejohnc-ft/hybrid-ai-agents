-- Create tenants table for multi-tenant MSP support
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now()
);

-- Ensure a default tenant exists for initial data
insert into tenants (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Default Tenant')
on conflict (id) do nothing;

-- Add tenant_id to incidents
alter table incidents
  add column if not exists tenant_id uuid default '00000000-0000-0000-0000-000000000001';

update incidents
set tenant_id = '00000000-0000-0000-0000-000000000001'
where tenant_id is null;

alter table incidents
  alter column tenant_id set not null;

alter table incidents
  add constraint incidents_tenant_id_fkey
  foreign key (tenant_id) references tenants(id);

create index if not exists idx_incidents_tenant_id on incidents(tenant_id);

-- Add tenant_id to incident_tickets
alter table incident_tickets
  add column if not exists tenant_id uuid default '00000000-0000-0000-0000-000000000001';

update incident_tickets
set tenant_id = '00000000-0000-0000-0000-000000000001'
where tenant_id is null;

alter table incident_tickets
  alter column tenant_id set not null;

alter table incident_tickets
  add constraint incident_tickets_tenant_id_fkey
  foreign key (tenant_id) references tenants(id);

create index if not exists idx_incident_tickets_tenant_id on incident_tickets(tenant_id);

-- Add tenant_id to incident_resolutions
alter table incident_resolutions
  add column if not exists tenant_id uuid default '00000000-0000-0000-0000-000000000001';

update incident_resolutions
set tenant_id = '00000000-0000-0000-0000-000000000001'
where tenant_id is null;

alter table incident_resolutions
  alter column tenant_id set not null;

alter table incident_resolutions
  add constraint incident_resolutions_tenant_id_fkey
  foreign key (tenant_id) references tenants(id);

create index if not exists idx_incident_resolutions_tenant_id on incident_resolutions(tenant_id);

-- Add tenant_id to incident_escalations
alter table incident_escalations
  add column if not exists tenant_id uuid default '00000000-0000-0000-0000-000000000001';

update incident_escalations
set tenant_id = '00000000-0000-0000-0000-000000000001'
where tenant_id is null;

alter table incident_escalations
  alter column tenant_id set not null;

alter table incident_escalations
  add constraint incident_escalations_tenant_id_fkey
  foreign key (tenant_id) references tenants(id);

create index if not exists idx_incident_escalations_tenant_id on incident_escalations(tenant_id);

-- Update analytics view to include tenant_id
create or replace view incident_analytics as
select
  i.id,
  i.tenant_id,
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
