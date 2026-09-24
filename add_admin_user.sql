-- Add Saya Mubiana as Super Admin User
-- Run this SQL directly in your Supabase SQL Editor

-- Step 1: Create the user profile record
-- Note: You'll need to update the ID after creating the auth user

DO $$
DECLARE
    tenant_uuid uuid;
    temp_user_id uuid := gen_random_uuid();
BEGIN
    -- Get the default tenant (TMU CashLoan CC)
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
        
        RAISE NOTICE 'Created new tenant: TMU CashLoan CC with ID: %', tenant_uuid;
    END IF;

    -- Insert the admin user profile with temporary ID
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
        temp_user_id,
        tenant_uuid,
        null, -- admins don't have applicant profiles
        'mubianasaya@gmail.com',
        'Saya Mubiana',
        '+264815580036',
        'super_admin', -- platform role for system-wide access
        'super_admin', -- staff role with highest permissions
        'inactive', -- Will activate after auth user creation
        now(),
        now()
    );

    RAISE NOTICE '✅ Created admin user profile with temporary ID: %', temp_user_id;
    RAISE NOTICE '📧 Email: mubianasaya@gmail.com';
    RAISE NOTICE '👤 Name: Saya Mubiana';
    RAISE NOTICE '📱 Phone: +264815580036';
    RAISE NOTICE '';
    RAISE NOTICE '🔑 NEXT STEPS:';
    RAISE NOTICE '1. Go to Authentication > Users in Supabase Dashboard';
    RAISE NOTICE '2. Click "Create user" and add:';
    RAISE NOTICE '   Email: mubianasaya@gmail.com';
    RAISE NOTICE '   Password: [choose a secure password]';
    RAISE NOTICE '   Email confirm: ✓ (checked)';
    RAISE NOTICE '3. Copy the new auth user ID';
    RAISE NOTICE '4. Run the update query below with that ID';

END $$;

-- Step 2: After creating the auth user, run this update query
-- Replace 'YOUR_AUTH_USER_ID_HERE' with the actual UUID from auth.users

/*
UPDATE public.users 
SET 
    id = 'YOUR_AUTH_USER_ID_HERE', -- Replace with actual auth user ID
    status = 'active',
    updated_at = now()
WHERE email = 'mubianasaya@gmail.com' 
AND role = 'super_admin';
*/

-- Create admin management view
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

-- Query to view all admin users
SELECT * FROM public.admin_users;