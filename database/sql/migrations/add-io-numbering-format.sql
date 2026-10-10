-- Per-factory IO number format (Master → Numbering). Safe to re-run.
alter table io_numbering_config
  add column if not exists number_format text not null default 'standard';
