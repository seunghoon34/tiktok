Build a simple Next.js website hosted on Vercel for the app "S2" (a social/dating app). The site needs 3 pages:

## 1. Home page (`/`)

- App name "S2" with logo
- Brief app description: "A video-based social app for meeting new people"
- Links to Privacy Policy and Terms of Service
- Support email: shootyourshot@gmail.com

## 2. Privacy Policy (`/privacy`)

Generate a privacy policy for a social/dating app that collects:

- Email address and password (authentication)
- Profile information (name, username, birthdate, bio, height, location, lifestyle preferences)
- Profile photos and video content
- Location data (for matching users nearby)
- Chat messages between matched users
- Push notification tokens
- Device information

Third-party services used: Supabase (database, auth, storage), Expo (push notifications), Google OAuth

- Users must be 18+ to use the app
- Users can delete their account and all associated data from within the app
- Data is stored on Supabase servers
- Contact email: shootyourshot@gmail.com

## 3. Terms of Service (`/terms`)

Generate terms of service for a social/dating app covering:

- Users must be 18 or older
- User-generated content rules (no harassment, spam, inappropriate content, fake profiles)
- Users are responsible for their content
- The app can remove content or accounts that violate the terms
- No tolerance for harassment or hate speech
- The app is provided "as is" with no warranty
- Limitation of liability
- Account termination rights
- Contact email: shootyourshot@gmail.com

## Tech stack

Next.js with App Router, Tailwind CSS, deployed on Vercel. Keep it minimal and clean — white background, simple typography, no heavy design needed.
