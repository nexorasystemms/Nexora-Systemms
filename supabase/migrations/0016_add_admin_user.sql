-- Add admin user and create admin management system
-- This migration adds Saya Mubiana as an admin/super admin user

-- First, get the default tenant ID (TMU CashLoan CC)
DO $$
DECLARE
    tenant_uuid uuid;
    new_user_id uuid;
BEGIN
    -- Get the first active tenant (TMU CashLoan CC)
    SELECT id INTO tenant_uuid 
    FROM public.tenants 
    WHERE status = 'active' 
    ORDER BY created_at ASC 
    LIMIT 1;

    -- If no tenant exists, create one
    IF tenant_uuid IS NULL THEN
        INSERT INTO public.tenants (name, slug, namfisa_reg_number, status)
        VALUES ('TMU CashLoan CC', 'tmu-cashloan', '25/11/1138', 'active')
        RETURNING id INTO tenant_uuid;
    END IF;

    -- Generate a UUID for the new admin user
    new_user_id := gen_random_uuid();

    -- Create the auth user first (this would normally be done through Supabase Auth)
    -- Note: In production, you should create this user through the Supabase dashboard
    -- or use the admin API. This is just for the user profile.
    
    -- Insert the admin user profile
    INSERT INTO public.users (
        id,
        tenant_id,
        applicant_id,
        email,
        full_name,
        phone,
        platform_role,
        role,
        status,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,
        tenant_uuid,
        null, -- admins don't have applicant profiles
        'mubianasaya@gmail.com',
        'Saya Mubiana',
        '+264815580036',
        'super_admin', -- platform role
        'super_admin', -- staff role
        'active',
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;

    -- Output the user ID for reference
    RAISE NOTICE 'Created admin user with ID: %', new_user_id;
    RAISE NOTICE 'Admin user email: mubianasaya@gmail.com';
    RAISE NOTICE 'You will need to create the auth user manually in Supabase Dashboard with this email';
    RAISE NOTICE 'Then update the user ID in the users table to match the auth.users ID';

END $$;

-- Create a view for easy admin management
CREATE OR REPLACE VIEW public.admin_users AS
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.phone,
    u.platform_role,
    u.role,
    u.status,
    t.name as tenant_name,
    u.created_at,
    u.updated_at,
    CASE 
        WHEN u.role = 'super_admin' THEN 'Super Administrator'
        WHEN u.role = 'admin' THEN 'Administrator'
        WHEN u.role = 'intake' THEN 'Intake Officer'
        WHEN u.role = 'officer' THEN 'Loan Officer'
        WHEN u.role = 'approver' THEN 'Approver'
        WHEN u.role = 'finance' THEN 'Finance Officer'
        ELSE u.role
    END as role_display
FROM public.users u
LEFT JOIN public.tenants t ON u.tenant_id = t.id
WHERE u.role IN ('super_admin', 'admin', 'intake', 'officer', 'approver', 'finance')
ORDER BY 
    CASE u.role
        WHEN 'super_admin' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'intake' THEN 3
        WHEN 'officer' THEN 4
        WHEN 'approver' THEN 5
        WHEN 'finance' THEN 6
        ELSE 7
    END,
    u.full_name;

-- Create a function to easily add new admin users
CREATE OR REPLACE FUNCTION public.add_admin_user(
    p_email text,
    p_full_name text,
    p_phone text DEFAULT NULL,
    p_role text DEFAULT 'admin',
    p_tenant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_user_id uuid;
    target_tenant_id uuid;
BEGIN
    -- Validate role
    IF p_role NOT IN ('super_admin', 'admin', 'intake', 'officer', 'approver', 'finance') THEN
        RAISE EXCEPTION 'Invalid role. Must be one of: super_admin, admin, intake, officer, approver, finance';
    END IF;

    -- Get tenant ID
    IF p_tenant_id IS NULL THEN
        SELECT id INTO target_tenant_id 
        FROM public.tenants 
        WHERE status = 'active' 
        ORDER BY created_at ASC 
        LIMIT 1;
    ELSE
        target_tenant_id := p_tenant_id;
    END IF;

    -- Generate UUID for new user
    new_user_id := gen_random_uuid();

    -- Insert the user profile
    INSERT INTO public.users (
        id,
        tenant_id,
        applicant_id,
        email,
        full_name,
        phone,
        platform_role,
        role,
        status
    ) VALUES (
        new_user_id,
        target_tenant_id,
        null,
        p_email,
        p_full_name,
        p_phone,
        CASE WHEN p_role = 'super_admin' THEN 'super_admin' ELSE 'tenant_user' END,
        p_role,
        'inactive' -- Will be activated when auth user is created
    );

    RETURN new_user_id;
END;
$$;

-- Create a function to activate admin user after auth user creation
CREATE OR REPLACE FUNCTION public.activate_admin_user(
    p_auth_user_id uuid,
    p_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the user record with the actual auth user ID and activate
    UPDATE public.users 
    SET 
        id = p_auth_user_id,
        status = 'active',
        updated_at = now()
    WHERE email = p_email 
    AND role IN ('super_admin', 'admin', 'intake', 'officer', 'approver', 'finance');

    RETURN FOUND;
END;
$$;

-- Add some helpful comments
COMMENT ON VIEW public.admin_users IS 'View of all administrative users with role display names';
COMMENT ON FUNCTION public.add_admin_user IS 'Helper function to add new admin users to the system';
COMMENT ON FUNCTION public.activate_admin_user IS 'Activate admin user after Supabase Auth user creation';