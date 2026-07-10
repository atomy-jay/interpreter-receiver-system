# Interpreter Receiver System - Deployment

Upload the contents of this folder to the root of a GitHub repository.

## Netlify build settings

- Branch to deploy: `main`
- Base directory: leave blank
- Build command: `npm run check`
- Publish directory: `public`
- Functions directory: `netlify/functions`

## Required Netlify environment variables

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase server-side service role/secret key
- `STAFF_PIN`: A PIN you choose for staff access

After adding or changing environment variables, trigger a new deployment.

## Supabase setup

Open Supabase SQL Editor and run:

`supabase/schema.sql`

## Main pages

- Home: `/`
- Member registration: `/register`
- Staff/admin dashboard: `/staff`
- QR ticket: `/ticket`
