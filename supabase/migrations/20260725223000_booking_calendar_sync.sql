alter table public.bookings
  add column if not exists google_calendar_event_id text,
  add column if not exists google_meet_url text,
  add column if not exists calendar_sync_status text not null default 'not_connected',
  add column if not exists calendar_sync_error text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_calendar_sync_status_check'
  ) then
    alter table public.bookings
      add constraint bookings_calendar_sync_status_check
      check (calendar_sync_status in ('not_connected', 'pending', 'synced', 'failed'));
  end if;
end $$;

comment on column public.bookings.google_calendar_event_id is
  'Google Calendar event id created for this booking.';
comment on column public.bookings.google_meet_url is
  'Google Meet URL returned by Calendar conferenceData.';
