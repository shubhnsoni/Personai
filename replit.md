# PersonaLink

AI-powered professional profile platform where service providers can create chatbots with shareable links.

## Overview

PersonaLink enables designers, consultants, editors, coaches, developers, and job-seekers to create AI-powered profile chatbots. Visitors can chat with AI, view portfolios/work, book meetings, purchase products/courses, and make payments via Stripe.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **AI**: OpenAI via Replit AI Integrations
- **Payments**: Stripe via Replit connector
- **Styling**: Tailwind CSS with shadcn/ui components
- **Animations**: Framer Motion

## Project Structure

```
aiclone/
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── api/          # API routes (chat, bookings, stripe, etc.)
│   │   ├── dashboard/    # Dashboard pages (profile, products, courses, events, orders)
│   │   ├── onboarding/   # Onboarding flow
│   │   └── [slug]/       # Dynamic profile pages
│   ├── components/       # React components
│   │   ├── booking/      # Booking modal
│   │   ├── chat/         # Chat interface
│   │   ├── dashboard/    # Dashboard components
│   │   ├── onboarding/   # Onboarding wizard
│   │   ├── profile/      # Profile view components
│   │   └── ui/           # shadcn/ui components
│   └── lib/              # Utilities (prisma, stripe, email, auth)
└── prisma/
    └── schema.prisma     # Database schema
```

## Key Features

1. **AI Chat**: Streaming responses with conversation persistence
2. **Profile Builder**: Multi-step onboarding with role templates
3. **Content Panels**: Experience, Projects, Services, Products, Courses, Events, Communities
4. **Booking System**: Service selection, date/time picking
5. **Digital Products**: Sell downloadable products (PDFs, templates, etc.)
6. **Courses**: Create and sell online courses with modules and lessons
7. **Events**: Host webinars, workshops, and meetups with registration
8. **Communities**: Build paid communities on Telegram/Discord
9. **Lead Magnets**: Capture leads with free downloads and forms
10. **Short Links**: Create trackable short links for marketing
11. **Dashboard**: Analytics, leads management, orders tracking, profile editing
12. **Stripe Integration**: Secure payment processing for all offerings

## Development

The app runs on port 5000. Start with:
```bash
cd aiclone && npm run dev -- -p 5000
```

## Database

Run migrations:
```bash
cd aiclone && npx prisma db push
```

Seed animation presets:
```bash
cd aiclone && npx prisma db seed
```

## Recent Changes

- Migrated database from SQLite to PostgreSQL for Stripe sync
- Added Stripe payment integration via Replit connector
- Added Digital Products, Courses, Events, Communities management
- Added Lead Magnets for lead capture
- Added Short Links for marketing
- Created Orders dashboard to track all purchases/enrollments
- Updated chat interface to present new offerings to visitors
- Added purchase flow with Stripe checkout and fulfillment
- Added email notification service (stub - ready for provider integration)
- Enhanced content panels with Products, Courses, Events, Communities views
- Added success notification after checkout completion

## Payment Integration

Stripe is integrated via Replit's connector. The webhook handler at `/api/webhooks/stripe` processes:
- Checkout session completions for products, courses, events, communities
- Subscription cancellations for community memberships

Revenue is tracked using actual Stripe session totals (not catalog prices) for accurate reporting.

## Development Notes

The Next.js configuration includes `allowedDevOrigins` to allow cross-origin requests from the Replit proxy environment. This is required for client-side JavaScript to work properly when the app is viewed through the Replit webview.
