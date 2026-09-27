-- Application Processing RPC Functions
-- These functions replace server actions for application processing

-- Function to create a new applicant
CREATE OR REPLACE FUNCTION create_applicant_profile(
  p_tenant_id UUID,
  p_full_name TEXT,
  p_sex CHAR(1) DEFAULT NULL,
  p_id_type id_type_enum,
  p_id_number TEXT,
  p_document_number TEXT DEFAULT NULL,
  p_mobile TEXT,
  p_email TEXT DEFAULT NULL,
  p_residential_address TEXT,
  p_marital_status marital_status_enum,
  p_dependants_count INTEGER,
  p_next_of_kin_name TEXT,
  p_next_of_kin_mobile TEXT,
  p_created_by UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  id_hash TEXT;
  id_token TEXT;
  doc_token TEXT;
  existing_applicant RECORD;
  new_applicant_id UUID;
  result JSON;
BEGIN
  -- Hash ID number for duplicate check
  SELECT hash_secure_value(p_id_number) INTO id_hash;
  
  -- Check for existing applicant
  SELECT id, full_name INTO existing_applicant
  FROM applicants
  WHERE tenant_id = p_tenant_id AND id_number_hash = id_hash;
  
  IF FOUND THEN
    RETURN json_build_object(
      'success', false,
      'status', 'duplicate',
      'message', 'An applicant with this ID number already exists: ' || existing_applicant.full_name,
      'duplicateApplicantId', existing_applicant.id
    );
  END IF;
  
  -- Tokenize ID number
  SELECT tokenize_secure_value(p_tenant_id, 'id_number', p_id_number) INTO id_token;
  
  -- Tokenize document number if provided
  IF p_document_number IS NOT NULL AND p_document_number != '' THEN
    SELECT tokenize_secure_value(p_tenant_id, 'passport_number', p_document_number) INTO doc_token;
  END IF;
  
  -- Generate new applicant ID
  new_applicant_id := gen_random_uuid();
  
  -- Insert applicant
  INSERT INTO applicants (
    id,
    tenant_id,
    full_name,
    sex,
    id_type,
    id_number_token,
    id_number_hash,
    document_number_token,
    mobile,
    email,
    residential_address,
    marital_status,
    dependants_count,
    next_of_kin_name,
    next_of_kin_mobile,
    created_by,
    created_at
  ) VALUES (
    new_applicant_id,
    p_tenant_id,
    p_full_name,
    p_sex,
    p_id_type,
    id_token,
    id_hash,
    doc_token,
    p_mobile,
    NULLIF(p_email, ''),
    p_residential_address,
    p_marital_status,
    p_dependants_count,
    p_next_of_kin_name,
    p_next_of_kin_mobile,
    p_created_by,
    NOW()
  );
  
  result := json_build_object(
    'success', true,
    'status', 'success',
    'applicantId', new_applicant_id,
    'message', 'Applicant created successfully'
  );
  
  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'status', 'error',
      'message', 'Failed to create applicant: ' || SQLERRM
    );
END;
$$;

-- Function to create a new application
CREATE OR REPLACE FUNCTION create_loan_application(
  p_tenant_id UUID,
  p_applicant_id UUID,
  p_amount_requested NUMERIC,
  p_term_months INTEGER,
  p_product_type product_type_enum,
  p_next_pay_date DATE DEFAULT NULL,
  p_purpose_category TEXT DEFAULT NULL,
  p_purpose_text TEXT DEFAULT NULL,
  p_referral_source TEXT DEFAULT NULL,
  p_has_prior_credit prior_credit_enum DEFAULT NULL,
  p_created_by UUID,
  p_duplicate_override_reason TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ref_number TEXT;
  live_apps_count INTEGER;
  new_application_id UUID;
  result JSON;
BEGIN
  -- Check for existing live applications
  SELECT COUNT(*) INTO live_apps_count
  FROM applications
  WHERE applicant_id = p_applicant_id
    AND status NOT IN ('settled', 'declined', 'withdrawn', 'handed_over');
  
  -- If live applications exist and no override reason provided
  IF live_apps_count > 0 AND (p_duplicate_override_reason IS NULL OR p_duplicate_override_reason = '') THEN
    RETURN json_build_object(
      'success', false,
      'status', 'error',
      'message', 'This applicant already has a live application (rule R-15). A compliance/admin user must supply an override reason to proceed.'
    );
  END IF;
  
  -- Generate reference number
  SELECT next_reference_number(p_tenant_id, 'application', 'APP-') INTO ref_number;
  IF ref_number IS NULL THEN
    ref_number := 'APP-' || EXTRACT(EPOCH FROM NOW())::TEXT;
  END IF;
  
  -- Generate new application ID
  new_application_id := gen_random_uuid();
  
  -- Insert application
  INSERT INTO applications (
    id,
    tenant_id,
    applicant_id,
    reference_number,
    amount_requested,
    term_months,
    product_type,
    next_pay_date,
    purpose_category,
    purpose_text,
    referral_source,
    has_prior_credit,
    status,
    created_by,
    created_at
  ) VALUES (
    new_application_id,
    p_tenant_id,
    p_applicant_id,
    ref_number,
    p_amount_requested,
    p_term_months,
    p_product_type,
    p_next_pay_date,
    NULLIF(p_purpose_category, ''),
    NULLIF(p_purpose_text, ''),
    NULLIF(p_referral_source, ''),
    p_has_prior_credit,
    'draft',
    p_created_by,
    NOW()
  );
  
  -- If override reason provided, record the override
  IF live_apps_count > 0 AND p_duplicate_override_reason IS NOT NULL AND p_duplicate_override_reason != '' THEN
    INSERT INTO application_overrides (
      tenant_id,
      application_id,
      override_type,
      reason_code,
      notes,
      overridden_by,
      created_at
    ) VALUES (
      p_tenant_id,
      new_application_id,
      'duplicate_application',
      'R-15-OVERRIDE',
      p_duplicate_override_reason,
      p_created_by,
      NOW()
    );
  END IF;
  
  result := json_build_object(
    'success', true,
    'status', 'success',
    'applicationId', new_application_id,
    'referenceNumber', ref_number,
    'message', 'Application created successfully'
  );
  
  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'status', 'error',
      'message', 'Failed to create application: ' || SQLERRM
    );
END;
$$;

-- Function to update application status
CREATE OR REPLACE FUNCTION update_application_status(
  p_application_id UUID,
  p_status application_status_enum,
  p_updated_by UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE applications 
  SET 
    status = p_status,
    updated_at = NOW(),
    updated_by = p_updated_by
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Application not found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Application status updated successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to update application status: ' || SQLERRM
    );
END;
$$;

-- Function to save employment information
CREATE OR REPLACE FUNCTION save_employment_info(
  p_application_id UUID,
  p_employer_name TEXT,
  p_job_title TEXT DEFAULT NULL,
  p_employment_type employment_type_enum DEFAULT NULL,
  p_monthly_salary NUMERIC DEFAULT NULL,
  p_years_employed NUMERIC DEFAULT NULL,
  p_updated_by UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE applications 
  SET 
    employer_name = NULLIF(p_employer_name, ''),
    job_title = NULLIF(p_job_title, ''),
    employment_type = p_employment_type,
    monthly_salary = p_monthly_salary,
    years_employed = p_years_employed,
    updated_at = NOW(),
    updated_by = p_updated_by
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Application not found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Employment information saved successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to save employment information: ' || SQLERRM
    );
END;
$$;

-- Function to save bank details
CREATE OR REPLACE FUNCTION save_bank_details(
  p_application_id UUID,
  p_bank_name TEXT DEFAULT NULL,
  p_account_number TEXT DEFAULT NULL,
  p_account_type account_type_enum DEFAULT NULL,
  p_updated_by UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE applications 
  SET 
    bank_name = NULLIF(p_bank_name, ''),
    account_number = NULLIF(p_account_number, ''),
    account_type = p_account_type,
    updated_at = NOW(),
    updated_by = p_updated_by
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Application not found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Bank details saved successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to save bank details: ' || SQLERRM
    );
END;
$$;

-- Function to save income and expenditure
CREATE OR REPLACE FUNCTION save_income_expenditure(
  p_application_id UUID,
  p_gross_monthly_income NUMERIC DEFAULT NULL,
  p_net_monthly_income NUMERIC DEFAULT NULL,
  p_monthly_expenses NUMERIC DEFAULT NULL,
  p_other_income NUMERIC DEFAULT NULL,
  p_updated_by UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE applications 
  SET 
    gross_monthly_income = p_gross_monthly_income,
    net_monthly_income = p_net_monthly_income,
    monthly_expenses = p_monthly_expenses,
    other_income = p_other_income,
    updated_at = NOW(),
    updated_by = p_updated_by
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Application not found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Income and expenditure saved successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to save income and expenditure: ' || SQLERRM
    );
END;
$$;

-- Function to add credit history row
CREATE OR REPLACE FUNCTION add_credit_history_row(
  p_application_id UUID,
  p_lender_name TEXT,
  p_amount NUMERIC,
  p_status credit_status_enum,
  p_updated_by UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_row_id UUID;
BEGIN
  new_row_id := gen_random_uuid();
  
  INSERT INTO application_credit_history (
    id,
    application_id,
    lender_name,
    amount,
    status,
    created_by,
    created_at
  ) VALUES (
    new_row_id,
    p_application_id,
    p_lender_name,
    p_amount,
    p_status,
    p_updated_by,
    NOW()
  );

  RETURN json_build_object(
    'success', true,
    'rowId', new_row_id,
    'message', 'Credit history row added successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to add credit history row: ' || SQLERRM
    );
END;
$$;

-- Function to remove credit history row
CREATE OR REPLACE FUNCTION remove_credit_history_row(
  p_row_id UUID,
  p_updated_by UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM application_credit_history 
  WHERE id = p_row_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Credit history row not found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Credit history row removed successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to remove credit history row: ' || SQLERRM
    );
END;
$$;

-- Function to get application details
CREATE OR REPLACE FUNCTION get_application_details(p_application_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  app_record RECORD;
  applicant_record RECORD;
  credit_history JSON;
  result JSON;
BEGIN
  -- Get application data
  SELECT * INTO app_record
  FROM applications 
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Application not found'
    );
  END IF;

  -- Get applicant data
  SELECT * INTO applicant_record
  FROM applicants 
  WHERE id = app_record.applicant_id;

  -- Get credit history
  SELECT json_agg(
    json_build_object(
      'id', id,
      'lender_name', lender_name,
      'amount', amount,
      'status', status
    )
  ) INTO credit_history
  FROM application_credit_history
  WHERE application_id = p_application_id;

  result := json_build_object(
    'success', true,
    'application', row_to_json(app_record),
    'applicant', row_to_json(applicant_record),
    'creditHistory', COALESCE(credit_history, '[]'::json)
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to get application details: ' || SQLERRM
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_applicant_profile TO authenticated;
GRANT EXECUTE ON FUNCTION create_loan_application TO authenticated;
GRANT EXECUTE ON FUNCTION update_application_status TO authenticated;
GRANT EXECUTE ON FUNCTION save_employment_info TO authenticated;
GRANT EXECUTE ON FUNCTION save_bank_details TO authenticated;
GRANT EXECUTE ON FUNCTION save_income_expenditure TO authenticated;
GRANT EXECUTE ON FUNCTION add_credit_history_row TO authenticated;
GRANT EXECUTE ON FUNCTION remove_credit_history_row TO authenticated;
GRANT EXECUTE ON FUNCTION get_application_details TO authenticated;