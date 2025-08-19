# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development server**: `npm run dev` - Uses ts-node-dev for hot reload
- **Build for production**: `npm run build` - Compiles TypeScript to `dist/` directory  
- **Start production server**: `npm start` - Runs compiled JavaScript from `dist/server.js`
- **Database migrations**: `npm run prisma:migrate` - Creates and applies new database migrations
- **Generate Prisma client**: `npm run prisma:generate` - Regenerates the Prisma client after schema changes

## Architecture Overview

This is an Express.js REST API service for a photo-sharing social platform with authentication, posts, and user management.

### Core Structure
- **Entry Point**: `src/server.ts` - Database connection and server startup
- **App Configuration**: `src/app.ts` - Express middleware, CORS, and route mounting
- **Database**: MySQL with Prisma ORM using `schema.prisma`
- **Authentication**: JWT-based with access/refresh token pattern, Kakao OAuth integration

### Key Directories
- `src/routes/` - Route definitions (auth, user, post)
- `src/controllers/` - Business logic handlers
- `src/middlewares/` - Authentication, error handling, optional auth
- `src/utils/` - Helper functions for JWT, user mapping, JSON parsing
- `src/config/` - Environment variables and database connection
- `src/types/` - TypeScript type definitions
- `prisma/` - Database schema and migrations

### Database Schema Features
The Prisma schema defines a comprehensive social media platform with:
- **User system**: Profiles with bio, location, achievements, social links
- **Posts**: Title, description, photo sets with effects, privacy controls, soft deletion
- **Photos**: Original, background, foreground, and thumbnail versions stored in S3
- **Social features**: Follow system, likes, comments with mentions, bookmarks, collections
- **Analytics**: View counts, exposure tracking, detailed user interaction logs

### Authentication Flow
- Uses JWT with separate access (15m) and refresh (7d) tokens stored as HTTP-only cookies
- Kakao OAuth integration for social login
- Refresh tokens stored in database with automatic cleanup
- Middleware supports both required (`auth.ts`) and optional (`optionalAuth.ts`) authentication

### Environment Configuration
The `src/config/env.ts` uses Zod for validation of required environment variables:
- Database URL, JWT secrets, token TTLs
- CORS origins and Kakao OAuth credentials
- Frontend and redirect URLs

### Development Notes
- TypeScript compilation target: ES2020 with CommonJS modules
- Node.js version requirement: >=20.0.0
- All database operations use Prisma Client with MySQL
- Error handling centralized in `middlewares/error.ts`
- CORS configured for credentials support