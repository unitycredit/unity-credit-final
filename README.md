# UnityCredit - Enterprise Financial Services Platform

A world-class, enterprise-level Next.js application for financial credit management with advanced security, professional guidance, and full RTL support for Yiddish speakers.

## 🚀 Features

- ✅ **Supabase Authentication** - Secure login/signup with email verification
- ✅ **Server Actions** - Type-safe, secure database operations
- ✅ **Credit Card Management** - Track multiple cards with limits, balances, and utilization
- ✅ **Professional Guidance** - Get personalized credit guidance (delivered in a human-expert tone)
- ✅ **Row Level Security (RLS)** - Database-level security policies
- ✅ **RTL Support** - Full Right-to-Left support for Yiddish interface
- ✅ **Enterprise Security** - Input validation, rate limiting, audit logging
- ✅ **Modern UI/UX** - Built with Shadcn/UI and Tailwind CSS
- ✅ **Responsive Design** - Works perfectly on all devices

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/UI
- **Database & Auth**: Supabase
- **Professional Guidance Engine**: Server-side provider integration (configured to respond in a human-expert tone)
- **Validation**: Zod
- **Forms**: React Hook Form
- **Language**: TypeScript

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account ([sign up here](https://supabase.com))
- Professional advice provider key (for guidance features)

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd unitycredit-app
npm install
```

### 2. Set Up Supabase

Follow the detailed guide in [SETUP_SUPABASE.md](./SETUP_SUPABASE.md) to:
- Create a Supabase project
- Get your API credentials
- Set up the database schema

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Professional advice provider (server-side only)
EXTERNAL_ADVICE_PROVIDER_KEY=your_provider_api_key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Plaid (optional)
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox
PLAID_REDIRECT_URI=
```

**Important**: Copy `env.example` as a template, but never commit `.env.local` to version control!

### 4. Run Database Setup

1. Go to your Supabase dashboard → SQL Editor
2. Copy and paste the contents of `supabase-setup.sql`
3. Run the SQL script to create tables, policies, and triggers

### 5. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
unitycredit-app/
├── app/
│   ├── api/              # API routes (advice, rate limiting)
│   ├── dashboard/        # Protected dashboard page
│   ├── login/            # Login page
│   ├── signup/           # Signup page
│   ├── settings/         # Settings page
│   ├── layout.tsx        # Root layout with RTL support
│   └── page.tsx          # Landing page (redirects to login)
├── components/
│   ├── ui/               # Shadcn/UI components
│   ├── Navbar.tsx        # Navigation bar
│   ├── CreditCardForm.tsx # Credit card form
│   └── ContactSupportCard.tsx # Contact Admin/Support (only allowed free-text interface)
├── lib/
│   ├── actions/          # Server Actions
│   │   ├── auth.ts       # Authentication actions
│   │   └── cards.ts      # Credit card CRUD actions
│   ├── supabase.ts       # Client-side Supabase client
│   ├── supabase-server.ts # Server-side Supabase client
│   ├── validations.ts    # Zod schemas
│   ├── security.ts       # Security utilities
│   └── utils.ts          # Utility functions
├── middleware.ts         # Route protection & auth
├── supabase-setup.sql    # Database schema
└── .env.local.example    # Environment variables template
```

## 🔐 Security Features

### Authentication & Authorization
- Supabase Row Level Security (RLS) policies
- Server Actions for secure database operations
- Session validation middleware
- Protected routes

### Input Validation & Sanitization
- Zod schema validation for all inputs
- HTML sanitization to prevent XSS
- Financial amount validation
- Credit card number sanitization

### Rate Limiting
- API request rate limiting (100/15min)
- Advice request rate limiting (20/hour)
- Login attempt rate limiting (5/15min)

### Security Headers
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
- Referrer-Policy

### Audit Logging
- User action tracking
- Database audit log table
- Ready for production monitoring

## 🌐 RTL Support

The entire application supports Right-to-Left (RTL) text direction for Yiddish:
- All UI components are RTL-compatible
- Yiddish text throughout the interface
- Proper text alignment and layout
- Form inputs support RTL

## 📚 Documentation

- [SETUP_SUPABASE.md](./SETUP_SUPABASE.md) - Detailed Supabase setup guide
- [ENTERPRISE_SETUP.md](./ENTERPRISE_SETUP.md) - Enterprise security and production guide
- [SETUP.md](./SETUP.md) - General setup instructions

## 🧪 Development

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Start Production Server
```bash
npm start
```

### Type Checking
```bash
npm run type-check
```

## 🚢 Deployment

### Recommended Platforms
- **Vercel** (recommended for Next.js)
- **Netlify**
- **AWS Amplify**
- **Railway**

### Environment Variables
Make sure to set all environment variables in your deployment platform:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EXTERNAL_ADVICE_PROVIDER_KEY`
- `NEXT_PUBLIC_APP_URL`
- `PLAID_CLIENT_ID` (optional)
- `PLAID_SECRET` (optional)
- `PLAID_ENV` (optional)
- `PLAID_REDIRECT_URI` (optional)

### Database
- Ensure your Supabase project is active
- Verify RLS policies are enabled
- Set up automated backups

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

This project is proprietary and confidential.

## 🆘 Support

For issues or questions:
1. Check the [SETUP_SUPABASE.md](./SETUP_SUPABASE.md) guide
2. Review [ENTERPRISE_SETUP.md](./ENTERPRISE_SETUP.md) for production setup
3. Check Supabase dashboard for database issues
4. Verify environment variables are set correctly

## 🎯 Roadmap

- [ ] Email verification flow
- [ ] Password reset functionality
- [ ] OAuth providers (Google, Apple)
- [ ] Advanced analytics dashboard
- [ ] Export financial reports
- [ ] Mobile app (React Native)
- [ ] Multi-language support (English, Hebrew)
- [ ] Real-time notifications

---

Built with ❤️ for the UnityCredit community
