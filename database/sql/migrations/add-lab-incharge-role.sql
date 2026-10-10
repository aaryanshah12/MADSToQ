-- Lab incharge role + migrate plant_supervisor profiles to chemist (Ananta persona review).
-- Safe to re-run.

DO $$ BEGIN
  ALTER TYPE "ProfileRole" ADD VALUE IF NOT EXISTS 'lab_incharge';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Plant supervisor persona folded into chemist (plant batches).
UPDATE profiles
SET role = 'chemist',
    updated_at = now()
WHERE role = 'plant_supervisor';
