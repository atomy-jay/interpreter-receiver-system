# Interpreter Receiver Rental and Return System

A receiver management system built with Netlify and Supabase.

## Included features

- Member pre-registration
- Automatic personal QR ticket generation
- Member QR scanning at the event venue
- Receiver assignment and rental processing
- Duplicate rental prevention
- Prevention of assigning a receiver that is already rented
- Return processing by receiver number
- Return conditions: normal, damaged, or lost
- Registration, collection, and active rental status by language
- List of members who have not collected a receiver
- List of currently active rentals
- Receiver status board by number
- CSV export for uncollected registrations
- Live dashboard refresh every 5 seconds
- Event creation and receiver number range setup

## Operating flow

1. A member registers before the event at `/register?event=EVENT-CODE`.
2. A personal QR ticket is generated after registration.
3. At the venue, staff log in at `/staff`.
4. Staff scan the member QR code and enter the receiver number being assigned.
5. After the event, staff enter or scan the receiver number to process the return.
6. Administrators monitor active rentals, availability, uncollected registrations, and return issues on the live dashboard.

## 1. Set up the Supabase database

Open your Supabase project and go to `SQL Editor` -> `New query`. Paste and run the complete contents of `supabase/schema.sql`.

The SQL creates the tables, duplicate-prevention rules, rental and return functions, and security settings.

## 2. Configure Netlify environment variables

In Netlify, go to `Project configuration` -> `Environment variables`. Add these variables and ensure the scope includes **Functions**:

```text
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STAFF_PIN=your-staff-pin
```

Important:

- Never place `SUPABASE_SERVICE_ROLE_KEY` in HTML or browser-side JavaScript.
- This project uses the service key only inside Netlify Functions.
- Change `STAFF_PIN` for each event when practical.

## 3. Deploy

Upload the project to a GitHub repository and connect it to Netlify.

```bash
npm install
npm run check
netlify dev
```

For direct production deployment with Netlify CLI:

```bash
netlify deploy --prod
```

## 4. Create the first event

After deployment, open `https://your-domain.com/staff`. Enter the staff name and `STAFF_PIN`, then open **Event setup**.

Example settings:

- Event code: `SA-GERMANY-2026`
- Event name: `Success Academy Germany`
- Event date and location
- First receiver number: `1`
- Last receiver number: `200`
- Number digits: `3`

The system automatically creates receiver numbers from `001` to `200`.

## 5. Member registration link

```text
https://your-domain.com/register?event=SA-GERMANY-2026
```

Members enter their 8-digit member number, full name, email or phone number, interpretation language, and return agreement. A QR ticket is displayed after successful registration.

## Main URLs

- Member registration: `/register?event=EVENT-CODE`
- Member QR ticket: `/ticket?t=PERSONAL-TOKEN`
- Staff operations: `/staff?event=EVENT-CODE`

## Recommended venue equipment

- Rental desk: 1-2 smartphones or tablets
- Return desk: 1-2 smartphones or tablets
- Administrator dashboard: one laptop or large monitor
- Number labels such as `001`, `002`, and `003` on every receiver
- Optional receiver QR labels in the format `RECEIVER:001`

## Security

- The browser does not connect directly to the database.
- All database operations go through Netlify Functions.
- Staff features require PIN verification.
- Row Level Security is enabled on Supabase tables.
- The service-role key is stored only in server environment variables.
