-- Contact person salutation (Mr., Mrs., etc.) for io_companies
ALTER TABLE io_companies ADD COLUMN IF NOT EXISTS person_title text;
