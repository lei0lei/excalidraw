# Deploy

This fork can be deployed to **Vercel** or **Netlify** as a static Vite app.

## Build output

- Build command: `yarn build`
- Output directory: `excalidraw-app/build`

I verified the project builds successfully locally.

---

## 1. Production environment variables

Create a production env file from:

- `.env.production.example`

At minimum, if you want **Google Drive workspace** in production, set:

- `VITE_APP_GOOGLE_CLIENT_ID`
- `VITE_APP_GOOGLE_API_KEY`
- `VITE_APP_GOOGLE_APP_ID`

If you also want collaboration / external services, set the related URLs as needed.

> Do not commit real production secrets or credentials.

---

## 2. Vercel

This repo already contains `vercel.json`.

### Recommended Vercel settings

- Framework preset: **Other**
- Root directory: **repository root**
- Install command: `yarn install`
- Build command: `yarn build`
- Output directory: `excalidraw-app/build`
- Node.js version: **20** or **22**

### Deploy steps

1. Import the Git repository into Vercel
2. Add production environment variables from `.env.production.example`
3. Deploy
4. Bind your custom domain if needed

---

## 3. Netlify

This repo now contains `netlify.toml`.

### Included Netlify config

- build command: `yarn build`
- publish directory: `excalidraw-app/build`
- SPA redirect: `/* -> /index.html`
- Node version: `20`

### Deploy steps

1. Import the Git repository into Netlify
2. Build command will be read from `netlify.toml`
3. Add production environment variables
4. Deploy

---

## 4. Google Drive production config

For Google Drive auth / Picker to work on your deployed domain, update your Google Cloud project:

### OAuth client

In **Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client ID**

Add your production origins to:

- **Authorized JavaScript origins**

Examples:

- `https://your-domain.vercel.app`
- `https://your-domain.netlify.app`
- `https://yourdomain.com`
- `https://www.yourdomain.com`

If you want preview deployments to also support Google login, add those preview domains too.

### Google Drive API

Make sure **Google Drive API** is enabled in the same Google Cloud project.

### API key restrictions

If your API key is restricted by HTTP referrer, add your production domains there too.

---

## 5. PWA notes

If you want installable PWA behavior in production:

- keep `VITE_APP_ENABLE_PWA=true`
- deploy over **HTTPS**

Both Vercel and Netlify support HTTPS by default.

---

## 6. Recommended release path

For your current fork, the simplest path is:

1. Prepare `.env.production`
2. Deploy to **Vercel** first
3. Fix Google OAuth production origins
4. Verify:
   - editor opens
   - workspace opens
   - local backend works
   - Google Drive connect works
   - save / load works
   - PWA install works

If you prefer, Netlify is also ready now.
