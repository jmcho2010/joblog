// Prints the DB migration steps from docs/design/RUNBOOK.md §2-§3. It never touches a database.
console.log(`DB migrations (supabase/migrations/*.sql) are applied only by you, never by this repo's scripts.

  Local Supabase : supabase start, then supabase db reset   (re-creates the LOCAL database)
  Schema tests   : npm run test:db                          (supabase/run_local_check.sh, needs PGHOST/PGPORT/PGUSER)
  Hosted         : supabase db push                         (after approval; see RUNBOOK §7)

Applied migrations are never edited; a change is a new numbered file.`);
