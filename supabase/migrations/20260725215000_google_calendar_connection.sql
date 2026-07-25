alter table public.profiles
  add column if not exists google_provider_token text,
  add column if not exists google_provider_refresh_token text,
  add column if not exists google_calendar_connected_at timestamptz;

comment on column public.profiles.google_provider_token is
  'Google OAuth provider access token; readable only by the profile owner through RLS.';
comment on column public.profiles.google_provider_refresh_token is
  'Google OAuth provider refresh token; readable only by the profile owner through RLS.';
