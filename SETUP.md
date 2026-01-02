# UnityCredit Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd unitycredit-app
npm install
```

### 2. Supabase Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Wait for the project to be ready

2. **Get API Credentials**
   - Go to Settings > API
   - Copy your `Project URL` (NEXT_PUBLIC_SUPABASE_URL)
   - Copy your `anon public` key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - Copy your `service_role` key (SUPABASE_SERVICE_ROLE_KEY) - Keep this secret!

3. **Create Database Table**
   - Go to SQL Editor in Supabase
   - Run the SQL from `supabase-setup.sql` file
   - This creates the `credit_cards` table with Row Level Security

### 3. Environment Variables

Create a `.env.local` file in the `unitycredit-app` directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Professional advice provider (server-side only)
ANTHROPIC_API_KEY=your_provider_api_key

# Plaid (optional)
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox
PLAID_REDIRECT_URI=

# Stripe Billing (optional, enables real Trial → Subscription flow)
# If omitted, the app falls back to demo billing for investor demos.
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PREMIUM_PRICE_ID=price_...
# Webhook secret for /api/stripe/webhook (recommended for production)
STRIPE_WEBHOOK_SECRET=whsec_...
# Optional display/override values (cents)
NEXT_PUBLIC_PREMIUM_PRICE_CENTS=4900
PREMIUM_PRICE_CENTS=4900
PREMIUM_CURRENCY=usd
```

### 4. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

### Authentication
- ✅ Email/Password signup
- ✅ Email/Password login
- ✅ Session management
- ✅ Protected routes

### Credit Card Management
- ✅ Add credit cards
- ✅ View all cards
- ✅ Delete cards
- ✅ Real-time totals

### Professional Credit Advice
- ✅ Professional guidance responses (human-expert tone)
- ✅ Context-aware responses
- ✅ Uses user's credit data
- ✅ Yiddish and English support

### Security
- ✅ Row Level Security (RLS)
- ✅ Protected API routes
- ✅ User data isolation
- ✅ Secure API key storage

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env.local` exists
- Check that all variables are set correctly
- Restart the dev server after adding variables

### "Unauthorized" errors
- Check that RLS policies are set up correctly
- Verify user is logged in
- Check Supabase credentials

### Advice service errors
- Verify `ANTHROPIC_API_KEY` is set in `.env.local`
- Check the provider account is active and not rate-limited

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

Make sure to:
- Set all environment variables
- Use Node.js 18+ runtime
- Enable serverless functions

## Support

For issues or questions, check the README.md file or the project documentation.

