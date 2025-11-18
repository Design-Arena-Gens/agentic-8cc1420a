## ShortShift Agent

ShortShift Agent is a Next.js app that orchestrates the entire workflow for publishing YouTube Shorts: metadata planning, scheduling, and direct uploads via the YouTube Data API v3. The UI is optimized for fast iteration and can be deployed to Vercel without additional tooling.

### Local development

```bash
npm install
npm run dev
```

### Required environment variables

Create a `.env.local` file (or configure the same variables in Vercel) with:

```
YOUTUBE_CLIENT_ID=your_google_oauth_client_id
YOUTUBE_CLIENT_SECRET=your_google_oauth_client_secret
YOUTUBE_REFRESH_TOKEN=offline_refresh_token_with_youtube_scope
YOUTUBE_DEFAULT_PRIVACY=private # optional
NEXT_PUBLIC_DEFAULT_HASHTAGS=#shorts,#foryou,#vertical # optional
```

The refresh token must be generated with the `https://www.googleapis.com/auth/youtube.upload` scope. The runtime exchanges the refresh token for short-lived access tokens automatically.

### Deployment

```
npm run build
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-8cc1420a
```

After the deployment succeeds, verify the production URL:

```
curl https://agentic-8cc1420a.vercel.app
```

### How it works

- `/api/upload` accepts a multipart form payload, validates it with Zod, and streams the file to `youtube.videos.insert`.
- `src/lib/youtube.ts` configures the Google OAuth2 client with refresh tokens.
- `src/app/page.tsx` renders the Short planner UI with auto-hashtagging, scheduling helpers, and a launch queue.
- All styling is built with Tailwind CSS v4 using the new `@tailwindcss/postcss` plugin.
