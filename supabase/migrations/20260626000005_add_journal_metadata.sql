-- Add metadata column to public.journal_entries table
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'journal_entries'
      and column_name = 'metadata'
  ) then
    alter table public.journal_entries add column metadata jsonb default '{}'::jsonb;
  end if;
end;
$$;
