-- 005 Scripts: only code + webhook. Per-script Gmail creds live inside each script.
-- Run in Supabase SQL editor AFTER 004.
-- Clients store their OWN Gmail address + App Password in their script's
-- settings (action_config). Nothing shared, nothing in server env.

-- 1) Convert any legacy send_email/mock rows into equivalent code scripts
update business_scripts
set action_type = 'code',
    action_config = jsonb_build_object(
      'language', 'javascript',
      'code', $$if (!params.email) throw new Error("email required");
sendEmail(params.email, "Your request", "Hi, your request was processed.");
result = { emailed: params.email };$$,
      'legacy', action_config
    )
where action_type in ('send_email', 'mock');

-- 2) Narrow constraint to code + webhook only
do $$ begin
  alter table business_scripts drop constraint if exists business_scripts_action_type_check;
  alter table business_scripts add constraint business_scripts_action_type_check
    check (action_type in ('code','webhook'));
end $$;
