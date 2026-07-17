# Gemini Project Instructions: TibhukeBus - Multi-Company Bus Booking Platform

This document provides instructions and context for working on the TibhukeBus project.

## Project Overview

TibhukeBus is a comprehensive, multi-company bus booking platform. It allows users to search for, compare, and book bus tickets from various operators. The platform includes features like real-time seat selection, user authentication, booking management, and an admin dashboard for bus companies.

The application is built as a modern web application with a Next.js frontend and a backend powered by Supabase and a PostgreSQL database managed with Prisma.

## Key Technologies

*   **Framework**: [Next.js](https://nextjs.org/) (with App Router)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Backend Services**: [Supabase](https://supabase.io/) for authentication and storage.
*   **Database ORM**: [Prisma](https://www.prisma.io/)
*   **Database**: [PostgreSQL](https://www.postgresql.org/)
*   **End-to-End Testing**: [Playwright](https://playwright.dev/)
*   **Internationalization (i18n)**: `next-intl`
*   **Progressive Web App (PWA)**: `next-pwa`

## Project Structure

*   `src/app/`: Main application code using the Next.js App Router. Each folder represents a route.
*   `src/components/`: Shared React components used throughout the application.
*   `src/lib/`: Utility functions, helpers, and configurations.
*   `prisma/`: Contains the Prisma schema (`schema.prisma`), migrations, and seed scripts.
*   `e2e/`: End-to-end tests written with Playwright.
*   `public/`: Static assets like images and logos.

## Getting Started

### 1. Installation

Install the necessary dependencies using npm:

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file by copying the example file:

```bash
cp env.example .env.local
```

You will need to fill in the required environment variables, including your Supabase project URL, anon key, and database connection string.

### 3. Running the Development Server

To run the application in development mode:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### 4. Building for Production

To create a production-ready build:

```bash
npm run build
```

This command first runs `prisma generate` to ensure the Prisma Client is up to date with the schema, then builds the Next.js application.

### 5. Running in Production

To start the application in production mode (after building):

```bash
npm run start
```

## Database

The project uses Prisma to manage the PostgreSQL database schema and queries.

*   **Schema**: The database schema is defined in `prisma/schema.prisma`.
*   **Migrations**: To apply schema changes and create a new migration, use the `prisma migrate dev` command.
*   **Seeding**: To seed the database with initial data, run the seed script:

    ```bash
    npx prisma db seed
    ```
    The seed script is configured in `package.json` under the `prisma.seed` key and uses `tsx` to execute `prisma/seed.ts`.

## Testing

End-to-end tests are located in the `e2e/` directory and are run using Playwright.

To run the tests:

```bash
npx playwright test
```

Ensure the development server is running before executing the tests.
