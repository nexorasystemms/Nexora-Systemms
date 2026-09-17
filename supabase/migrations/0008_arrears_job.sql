-- 0008_arrears_job.sql
-- Nexora Systems: Automated Arrears Tracking & 90-Day Penalty Stop (FR-REPAY-03/04, Rules R-05, R-06)

create or replace function public.raise_arrears_events()
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer := 0;
  v_rec record;
  v_days integer;
  v_penalty numeric(12,2);
  v_max_penalty numeric(12,2);
  v_handover boolean;
begin
  for v_rec in
    select
      s.id as schedule_id,
      s.tenant_id,
      s.loan_id,
      s.due_date,
      s.amount_due,
      l.application_id,
      coalesce(sum(r.amount_paid), 0) as paid_so_far
    from public.schedules s
    join public.loans l on s.loan_id = l.id
    left join public.repayments r on r.schedule_id = s.id
    where s.status in ('due', 'partial')
      and s.due_date < current_date
    group by s.id, s.tenant_id, s.loan_id, s.due_date, s.amount_due, l.application_id
  loop
    v_days := (current_date - v_rec.due_date);
    v_handover := (v_days >= 90); -- Rule R-06: 90-day stop

    -- Rule R-05: 30% penalty ceiling
    v_max_penalty := round((v_rec.amount_due - v_rec.paid_so_far) * 0.30, 2);

    -- Calculate default interest (capped at 90 days / 30% ceiling)
    if v_days > 90 then
      v_penalty := v_max_penalty;
    else
      v_penalty := round(((v_rec.amount_due - v_rec.paid_so_far) * 0.30) * (least(v_days, 90)::numeric / 90.0), 2);
    end if;

    -- Upsert arrears event
    insert into public.arrears_events (
      tenant_id, loan_id, schedule_id, days_past_due, penalty_charged, status, hand_over_required, updated_at
    ) values (
      v_rec.tenant_id, v_rec.loan_id, v_rec.schedule_id, v_days, v_penalty,
      case when v_handover then 'handed_over' else 'open' end,
      v_handover,
      now()
    )
    on conflict (id) do update set
      days_past_due = excluded.days_past_due,
      penalty_charged = excluded.penalty_charged,
      status = excluded.status,
      hand_over_required = excluded.hand_over_required,
      updated_at = now();

    -- Transition application and loan status
    update public.applications
    set status = case when v_handover then 'handed_over' else 'in_arrears' end,
        updated_at = now()
    where id = v_rec.application_id
      and status not in ('settled', 'handed_over');

    update public.loans
    set status = case when v_handover then 'handed_over' else 'in_arrears' end,
        updated_at = now()
    where id = v_rec.loan_id
      and status not in ('settled', 'handed_over');

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- To run automatically every day at 01:00 AM, enable pg_cron in Supabase (Database -> Extensions)
-- and uncomment the line below:
-- select cron.schedule('daily-arrears-job', '0 1 * * *', 'select public.raise_arrears_events();');
