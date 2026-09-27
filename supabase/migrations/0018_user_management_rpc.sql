-- User Management RPC Functions
-- These functions replace server actions for user management

-- Function to create a new user (admin/staff)
CREATE OR REPLACE FUNCTION create_user_account(
  p_email TEXT,
  p_full_name TEXT,
  p_role user_role,
  p_tenant_id UUID DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
  result JSON;
BEGIN
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'A user with this email already exists'
    );
  END IF;

  -- Generate UUID for new user
  new_user_id := gen_random_uuid();

  -- Insert user record
  INSERT INTO users (
    id,
    email,
    full_name,
    role,
    tenant_id,
    platform_role,
    status,
    created_at
  ) VALUES (
    new_user_id,
    p_email,
    p_full_name,
    p_role,
    p_tenant_id,
    CASE 
      WHEN p_role = 'borrower' THEN 'tenant_user'
      ELSE 'staff'
    END,
    'inactive', -- Will be activated when they set password
    NOW()
  );

  result := json_build_object(
    'success', true,
    'user_id', new_user_id,
    'message', 'User created successfully'
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to create user: ' || SQLERRM
    );
END;
$$;

-- Function to update user status
CREATE OR REPLACE FUNCTION update_user_status(
  p_user_id UUID,
  p_status user_status
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update user status
  UPDATE users 
  SET 
    status = p_status,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'User status updated successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to update user status: ' || SQLERRM
    );
END;
$$;

-- Function to update user role
CREATE OR REPLACE FUNCTION update_user_role(
  p_user_id UUID,
  p_role user_role
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update user role
  UPDATE users 
  SET 
    role = p_role,
    platform_role = CASE 
      WHEN p_role = 'borrower' THEN 'tenant_user'
      ELSE 'staff'
    END,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'User role updated successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to update user role: ' || SQLERRM
    );
END;
$$;

-- Function to get user by email
CREATE OR REPLACE FUNCTION get_user_by_email(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  result JSON;
BEGIN
  SELECT * INTO user_record
  FROM users 
  WHERE email = p_email;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  result := json_build_object(
    'success', true,
    'user', row_to_json(user_record)
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to get user: ' || SQLERRM
    );
END;
$$;

-- Function to list users with pagination
CREATE OR REPLACE FUNCTION list_users(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_role user_role DEFAULT NULL,
  p_status user_status DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  users_array JSON;
  total_count INTEGER;
  result JSON;
BEGIN
  -- Get total count
  SELECT COUNT(*) INTO total_count
  FROM users
  WHERE (p_role IS NULL OR role = p_role)
    AND (p_status IS NULL OR status = p_status);

  -- Get users with pagination
  SELECT json_agg(
    json_build_object(
      'id', id,
      'email', email,
      'full_name', full_name,
      'role', role,
      'status', status,
      'tenant_id', tenant_id,
      'created_at', created_at,
      'updated_at', updated_at
    )
  ) INTO users_array
  FROM (
    SELECT *
    FROM users
    WHERE (p_role IS NULL OR role = p_role)
      AND (p_status IS NULL OR status = p_status)
    ORDER BY created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) u;

  result := json_build_object(
    'success', true,
    'users', COALESCE(users_array, '[]'::json),
    'total_count', total_count,
    'limit', p_limit,
    'offset', p_offset
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to list users: ' || SQLERRM
    );
END;
$$;

-- Function to create/update tenant
CREATE OR REPLACE FUNCTION upsert_tenant(
  p_id UUID DEFAULT NULL,
  p_name TEXT,
  p_code TEXT,
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_status tenant_status DEFAULT 'active'
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tenant_id UUID;
  result JSON;
BEGIN
  IF p_id IS NULL THEN
    -- Create new tenant
    tenant_id := gen_random_uuid();
    
    INSERT INTO tenants (
      id, name, code, address, phone, email, status, created_at
    ) VALUES (
      tenant_id, p_name, p_code, p_address, p_phone, p_email, p_status, NOW()
    );
    
    result := json_build_object(
      'success', true,
      'tenant_id', tenant_id,
      'action', 'created',
      'message', 'Tenant created successfully'
    );
  ELSE
    -- Update existing tenant
    UPDATE tenants 
    SET 
      name = p_name,
      code = p_code,
      address = p_address,
      phone = p_phone,
      email = p_email,
      status = p_status,
      updated_at = NOW()
    WHERE id = p_id;

    IF NOT FOUND THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Tenant not found'
      );
    END IF;

    result := json_build_object(
      'success', true,
      'tenant_id', p_id,
      'action', 'updated',
      'message', 'Tenant updated successfully'
    );
  END IF;

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to upsert tenant: ' || SQLERRM
    );
END;
$$;

-- Function to list tenants
CREATE OR REPLACE FUNCTION list_tenants()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tenants_array JSON;
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', id,
      'name', name,
      'code', code,
      'address', address,
      'phone', phone,
      'email', email,
      'status', status,
      'created_at', created_at,
      'updated_at', updated_at
    )
  ) INTO tenants_array
  FROM tenants
  ORDER BY name;

  result := json_build_object(
    'success', true,
    'tenants', COALESCE(tenants_array, '[]'::json)
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to list tenants: ' || SQLERRM
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_user_account TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_status TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION list_users TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_tenant TO authenticated;
GRANT EXECUTE ON FUNCTION list_tenants TO authenticated;