-- Filter integrity is a confirmation only. Chemists do not record a start or end time.

UPDATE production_process_stages
SET capture_start_date = false,
    capture_end_date = false,
    capture_start_time = false,
    capture_end_time = false,
    capture_start_temp = false,
    capture_end_temp = false,
    capture_integrity = true
WHERE lower(btrim(name)) = 'filter integrity';
