-- Insert default tenant for TMU CashLoan CC
INSERT INTO public.tenants (name, slug, status)
VALUES ('TMU CashLoan CC', 'tmu-cashloan', 'active')
ON CONFLICT (slug) DO NOTHING;
