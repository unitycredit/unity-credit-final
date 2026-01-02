# Supabase Integration Setup Guide

This guide will walk you through setting up Supabase Auth and Database for your UnityCredit application.

## Prerequisites

1. A Supabase account (sign up at [supabase.com](https://supabase.com))
2. Node.js 18+ installed
3. Next.js 15 project initialized

## Step 1: Create a Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - **Name**: UnityCredit (or your preferred name)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to your users
4. Click "Create new project"
5. Wait for the project to be provisioned (2-3 minutes)

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. You'll need:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys" → "anon public")
   - **service_role key** (under "Project API keys" → "service_role" - keep this secret!)

## Step 3: Set Up Environment Variables

1. In your project root (`unitycredit-app/`), create a `.env.local` file:

```bash
# Copy the example file
cp .env.local.example .env.local
```

2. Open `.env.local` and fill in your Supabase credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Professional advice provider (server-side only)
ANTHROPIC_API_KEY=your_provider_api_key_here

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Important**: Never commit `.env.local` to version control! It's already in `.gitignore`.

## Step 4: Set Up the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `supabase-setup.sql` from your project
4. Paste it into the SQL Editor
5. Click "Run" (or press Ctrl+Enter)
6. You should see "Success. No rows returned"

This will create:
- ✅ `users` table (extends auth.users)
- ✅ `credit_cards` table
- ✅ `audit_logs` table
- ✅ Row Level Security (RLS) policies
- ✅ Database triggers for auto-creating user profiles
- ✅ Indexes for performance

## Step 5: Verify Database Setup

1. In Supabase dashboard, go to **Table Editor**
2. You should see:
   - `users` table
   - `credit_cards` table
   - `audit_logs` table

3. Check RLS policies:
   - Go to **Authentication** → **Policies**
   - Verify policies are enabled for `credit_cards` and `users`

## Step 6: Test Authentication

1. Start your development server:
```bash
npm run dev
```

2. Navigate to `http://localhost:3000/login`
3. Try creating a new account at `/signup`
4. Check Supabase dashboard → **Authentication** → **Users** to see your new user

## Step 7: Test Database Operations

1. After logging in, go to the Dashboard
2. Try adding a credit card
3. Check Supabase dashboard → **Table Editor** → `credit_cards` to verify the data

## Troubleshooting

### Issue: "Invalid API key"
- **Solution**: Double-check your `.env.local` file. Make sure there are no extra spaces or quotes around the values.

### Issue: "Row Level Security policy violation"
- **Solution**: Make sure you ran the `supabase-setup.sql` script completely. Check that RLS policies exist in the Supabase dashboard.

### Issue: "User profile not created"
- **Solution**: Check the database trigger in `supabase-setup.sql`. The trigger should automatically create a user profile when a user signs up.

### Issue: "Cannot connect to Supabase"
- **Solution**: 
  - Verify your `NEXT_PUBLIC_SUPABASE_URL` is correct
  - Check your internet connection
  - Verify your Supabase project is active (not paused)

## Security Best Practices

1. ✅ **Never commit `.env.local`** - It's already in `.gitignore`
2. ✅ **Use RLS policies** - All database operations are protected
3. ✅ **Server Actions** - All database operations use secure Server Actions
4. ✅ **Input validation** - All inputs are validated with Zod schemas
5. ✅ **Rate limiting** - API endpoints have rate limiting enabled

## Next Steps

- [ ] Set up email templates in Supabase (Settings → Auth → Email Templates)
- [ ] Configure email provider (Settings → Auth → SMTP Settings)
- [ ] Set up password reset flow
- [ ] Configure OAuth providers (optional)
- [ ] Set up database backups
- [ ] Configure monitoring and alerts

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js + Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

