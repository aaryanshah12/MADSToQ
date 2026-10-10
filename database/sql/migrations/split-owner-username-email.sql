-- Split default owner: username owner@madstoq.local, contact email for password reset.
-- Safe to run once when users.email is still owner@madstoq.local.

UPDATE users
SET
  username = 'owner@madstoq.local',
  email = 'mansibusa814@gmail.com',
  updated_at = now()
WHERE email = 'owner@madstoq.local'
  AND (username IS NULL OR username = 'owner@madstoq.local');

UPDATE profiles p
SET email = 'mansibusa814@gmail.com', updated_at = now()
FROM users u
WHERE p.id = u.id
  AND u.email = 'mansibusa814@gmail.com'
  AND p.email = 'owner@madstoq.local';

UPDATE sales_users su
SET email = 'mansibusa814@gmail.com', updated_at = now()
FROM users u
WHERE su.user_id = u.id
  AND u.email = 'mansibusa814@gmail.com'
  AND su.email = 'owner@madstoq.local';

UPDATE pmc_users pu
SET email = 'mansibusa814@gmail.com'
FROM users u
WHERE pu.user_id = u.id
  AND u.email = 'mansibusa814@gmail.com'
  AND pu.email = 'owner@madstoq.local';
