-- 004 Scripts as client code (JS with client variables)
-- Run in Supabase SQL editor AFTER 003

-- Allow 'code' action_type (was send_email|webhook|mock)
do $$ begin
  alter table business_scripts drop constraint if exists business_scripts_action_type_check;
  alter table business_scripts add constraint business_scripts_action_type_check
    check (action_type in ('send_email','webhook','mock','code'));
exception when others then null; end $$;
