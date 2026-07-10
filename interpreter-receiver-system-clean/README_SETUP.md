# Interpreter Receiver System - GitHub/Netlify/Supabase Deployment

Upload the contents of this folder to the root of a GitHub repository, then connect that repository to Netlify.

Before pushing, run:

```sh
npm run check
```

## Netlify build settings

- Branch to deploy: `main`
- Base directory: leave blank
- Build command: `npm run check` (also defined in `netlify.toml`)
- Publish directory: `public` (also defined in `netlify.toml`)
- Functions directory: `netlify/functions` (also defined in `netlify.toml`)
- Node version: `22` (defined in `.nvmrc` and `netlify.toml`)

## Required Netlify environment variables

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase server-side service role/secret key
- `STAFF_PIN`: A PIN you choose for staff access

After adding or changing environment variables, trigger a new deployment.

Do not put `SUPABASE_SERVICE_ROLE_KEY` in frontend JavaScript or commit it to GitHub. It must only be stored in Netlify environment variables.

## Supabase setup

Open Supabase SQL Editor and run:

`supabase/schema.sql`

The app uses Netlify Functions as the server layer. Browser pages call `/api/...`, and those functions access Supabase with the service role key.

## Main pages

- Home: `/`
- Member registration: `/register`
- Staff/admin dashboard: `/staff`
- QR ticket: `/ticket`
