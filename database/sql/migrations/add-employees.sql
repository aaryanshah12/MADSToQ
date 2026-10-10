-- Employee HR directory + document blobs (factory-scoped, independent of login users).

CREATE TABLE IF NOT EXISTS employees (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id                  uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  profile_id                  uuid UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  employee_code               text NOT NULL,
  full_name                   text NOT NULL,
  father_name                 text,
  gender                      text,
  date_of_birth               date,
  department                  text NOT NULL,
  designation                 text NOT NULL,
  employment_type             text NOT NULL DEFAULT 'permanent'
    CHECK (employment_type IN ('permanent', 'contract', 'intern', 'trainee')),
  employment_status           text NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('active', 'on_leave', 'resigned', 'terminated')),
  joining_date                date NOT NULL,
  leaving_date                date,
  phone                       text,
  email                       text,
  current_address             text,
  permanent_address           text,
  emergency_contact_name      text,
  emergency_contact_phone     text,
  emergency_contact_relation  text,
  blood_group                 text,
  pan                         text,
  aadhaar                     text,
  uan                         text,
  pf_number                   text,
  esi_number                  text,
  bank_name                   text,
  account_holder_name         text,
  account_number              text,
  ifsc                        text,
  monthly_gross               text,
  annual_ctc                  text,
  basic_pay                   text,
  pf_eligible                 boolean NOT NULL DEFAULT false,
  esi_eligible                boolean NOT NULL DEFAULT false,
  is_active                   boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (factory_id, employee_code)
);
CREATE INDEX IF NOT EXISTS employees_factory_id_idx ON employees(factory_id);

CREATE TABLE IF NOT EXISTS employee_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doc_type     text NOT NULL
    CHECK (doc_type IN (
      'photo', 'aadhaar', 'pan', 'bank_proof', 'offer_letter',
      'appointment_letter', 'resume', 'contract', 'other'
    )),
  title        text,
  file_name    text NOT NULL,
  mime_type    text NOT NULL,
  size_bytes   integer NOT NULL,
  file_bytes   bytea NOT NULL,
  uploaded_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_documents_employee_id_idx ON employee_documents(employee_id);
