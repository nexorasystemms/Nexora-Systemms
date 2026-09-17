-- 0006_seed_policy_params.sql
-- Nexora Systems: Initial Tenant, Regulatory Caps, and Agreement Template Seeding

do $$
declare
  v_tenant_id uuid;
begin
  -- 1. Seed Pilot Tenant: TMU CashLoan CC
  insert into public.tenants (id, name, slug, namfisa_reg_number, status)
  values (
    'a0000000-0000-0000-0000-000000000001',
    'TMU CashLoan CC',
    'tmu-cashloan',
    '25/11/1138',
    'active'
  )
  on conflict (slug) do update set name = excluded.name
  returning id into v_tenant_id;

  if v_tenant_id is null then
    select id into v_tenant_id from public.tenants where slug = 'tmu-cashloan';
  end if;

  -- 2. Seed Policy Parameters (Dated Versioning, FR-CORE-40/41, Rules R-01 to R-15)
  insert into public.policy_params (tenant_id, param_key, param_value, effective_from, note)
  values
    (v_tenant_id, 'loan_ceiling_nad', '100000'::jsonb, '2026-01-01', 'R-01: Microlending Act max principal ceiling N$100,000'),
    (v_tenant_id, 'term_ceiling_months', '60'::jsonb, '2026-01-01', 'R-02: Microlending Act max term 60 months'),
    (v_tenant_id, 'finance_charge_cap_short_term_months', '5'::jsonb, '2026-01-01', 'R-03: Boundary for short-term once-off loans'),
    (v_tenant_id, 'finance_charge_cap_short_pct', '0.30'::jsonb, '2026-01-01', 'R-03: NAMFISA short term cap 30% of principal'),
    (v_tenant_id, 'finance_charge_cap_long_prime_multiplier', '2'::jsonb, '2026-01-01', 'R-04: Usury Act long-term cap 2x prime rate'),
    (v_tenant_id, 'prime_rate_pct', '0.1075'::jsonb, '2026-01-01', 'Bank of Namibia prevailing prime rate (10.75%)'),
    (v_tenant_id, 'penalty_cap_pct', '0.30'::jsonb, '2026-01-01', 'R-05: General Notice 263 default penalty ceiling 30%'),
    (v_tenant_id, 'penalty_duration_days', '90'::jsonb, '2026-01-01', 'R-06: General Notice 263 default interest stops at 90 days'),
    (v_tenant_id, 'alpha_instalment_coverage', '0.60'::jsonb, '2026-01-01', 'R-08: Max instalment as fraction of surplus (alpha = 0.60)'),
    (v_tenant_id, 'beta_dsr_ceiling', '0.35'::jsonb, '2026-01-01', 'R-09: Debt-service ratio ceiling (beta = 0.35)'),
    (v_tenant_id, 'min_living_allowance_nad', '1500'::jsonb, '2026-01-01', 'R-10: Minimum living allowance floor per dependant (N$1,500)'),
    (v_tenant_id, 'income_variance_threshold_pct', '0.10'::jsonb, '2026-01-01', 'R-12: Declared vs payslip variance flag threshold (10%)'),
    (v_tenant_id, 'expenditure_plausibility_min_pct', '0.40'::jsonb, '2026-01-01', 'R-13: Expenditure plausibility minimum fraction (40%)');

  -- 3. Seed Default Active Agreement Template (FR-AGR-01/05/08)
  insert into public.agreement_templates (
    tenant_id, name, version, content, status, includes_notary_clause, includes_cession_clause, attorney_reviewed, attorney_reviewed_by, attorney_reviewed_at
  ) values (
    v_tenant_id,
    'TMU Standard Personal Loan Agreement',
    '1.0',
    'PERSONAL LOAN AGREEMENT\n\nLender: TMU CashLoan CC (NAMFISA Reg: 25/11/1138)\nBorrower: {{applicant_name}}\nPrincipal: N${{principal}}\nTotal Finance Charge: N${{finance_charge}}\nTotal Repayable: N${{total_repayable}}\n\nRepayment Terms: Due on {{next_pay_date}}.\nExecution taking place in Windhoek, Namibia without requiring notary public intervention.',
    'active',
    false, -- FR-AGR-05: no unperformed notary public clause
    true,
    true,  -- FR-AGR-08: attorney reviewed gate
    'TMU Legal Advisor',
    now()
  );

end $$;

-- Instructions for bootstrapping first Super Admin (Nexora):
-- 1. Create a user in Supabase Auth (Authentication -> Users -> Add user).
-- 2. Run the query below with that user's Auth UUID:
/*
insert into public.users (
  id, tenant_id, email, full_name, platform_role, role, status
) values (
  '<YOUR-SUPABASE-AUTH-UUID-HERE>',
  null,
  'admin@nexora-systems.com',
  'Nexora Super Admin',
  'super_admin',
  'super_admin',
  'active'
);
*/
