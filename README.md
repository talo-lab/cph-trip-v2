# CPH Trip Planner

Copenhagen 3 Days of Design 2026 trip planner for two travelers. The app runs as a Vercel-hosted static/PWA frontend with a few serverless API routes for auth, saved plans, place extraction, event lookup, and transit data.

## Project Structure

- `index.html` - app shell and markup.
- `src/styles.css` - extracted application styles.
- `src/app.js` - extracted browser application logic.
- `events-data.js` - generated static event dataset.
- `api/` - Vercel serverless functions.
- `sw.js` - service worker for app shell and map tile caching.
- `generate_events.py` - helper script for regenerating event data.

## Local Development

Install dependencies first:

```bash
npm install
```

Run with Vercel's local runtime:

```bash
npm run dev
```

Check browser JavaScript syntax:

```bash
npm run check
```

## Required Environment Variables

Set these in Vercel project settings before production deployment:

- `ANTHROPIC_API_KEY` - used by `api/extract.js`.
- `REDIS_URL` or `STORAGE_URL` or `KV_URL` - used by `api/auth.js` and `api/plan.js`.
- `PASS_MIJU` - login password for the `miju` user.
- `PASS_SANGHYO` - login password for the `sanghyo` user.

After changing environment variables, redeploy the project so serverless functions receive the new values.

## Deployment Notes

The source repository `talo-lab/cph-trip` is currently read-only for this session, so active development should happen on a fork or a new writable repository. Once the fork exists, update the local remote and push the refactor branch:

```bash
git remote set-url origin https://github.com/<owner>/cph-trip.git
git push -u origin codex/refactor-baseline
```

Vercel should import the forked repository and deploy from the branch or from `main` after the changes are merged.
