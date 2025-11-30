# PersonaLink

AI-powered professional profile platform where service providers can create chatbots with shareable links.

## Overview

PersonaLink enables designers, consultants, editors, coaches, developers, and job-seekers to create AI-powered profile chatbots. Visitors can chat with AI, view portfolios/work, book meetings, and make payments.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Database**: SQLite with Prisma ORM
- **AI**: OpenAI via Replit AI Integrations
- **Styling**: Tailwind CSS with shadcn/ui components
- **Animations**: Framer Motion

## Project Structure

```
aiclone/
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── api/          # API routes (chat, bookings, etc.)
│   │   ├── dashboard/    # Dashboard pages
│   │   ├── onboarding/   # Onboarding flow
│   │   └── [slug]/       # Dynamic profile pages
│   ├── components/       # React components
│   │   ├── booking/      # Booking modal
│   │   ├── chat/         # Chat interface
│   │   ├── dashboard/    # Dashboard components
│   │   ├── onboarding/   # Onboarding wizard
│   │   ├── profile/      # Profile view components
│   │   └── ui/           # shadcn/ui components
│   └── lib/              # Utilities (prisma, rag, auth)
└── prisma/
    ├── schema.prisma     # Database schema
    ├── seed.ts           # Seed data (animation presets)
    └── dev.db            # SQLite database
```

## Key Features

1. **AI Chat**: Streaming responses with conversation persistence
2. **Profile Builder**: Multi-step onboarding with role templates
3. **Content Panels**: Experience, Projects, Services, About views
4. **Booking System**: Service selection, date/time picking
5. **Dashboard**: Analytics, leads management, profile editing

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

- Fixed onboarding aura selection (seeded animation presets)
- Added mobile responsiveness improvements
- Enhanced error handling with toast notifications
- Fixed TypeScript issues in onboarding wizard
