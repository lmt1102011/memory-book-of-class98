# School Memory Photobook

A production-ready responsive React/Vite photobook app inspired by school memories, Korean photobooths, graduation, scrapbook journals, and nostalgic student life.

## Features

- Cinematic landing page with ambient music toggle and lightweight motion
- Class 9/8 check-in flow: new name creates a password, existing name requires the saved password
- Firebase Auth for student passwords
- Firestore memory feed, reactions, and guestbook shared by everyone
- Firestore-only public photobook images, compressed to fit without Firebase Storage
- Nhat ky bi mat: students only see their own diary entries in the app, while `manager.html` can show the writer name
- Responsive Pinterest/scrapbook memory feed with search, filters, reactions, and guestbook
- High-quality webcam capture with countdown, flash, retake, and next-photo flow
- Canvas-generated printable photobook strips in 1080p, 2K, or 4K export widths
- Pastel, classroom, vintage paper, and custom-upload backgrounds
- Public sharing to the local memory feed or private local download
- Lazy-loaded photobook route, responsive images, memoized filtering, and GPU-friendly animation

## Tech Stack

- React
- Vite
- TypeScript
- TailwindCSS
- Framer Motion
- React Webcam
- HTML Canvas API

## Run Locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Production Build

```bash
npm run build
npm run preview
```

## Firebase Setup

The app is already configured for Firebase project `memorybook-of-class98`.

In Firebase Console:

1. Enable **Authentication > Sign-in method > Email/Password**.
2. Create/enable **Cloud Firestore**.
3. Publish the included Firestore rules:

```bash
npm run firebase:login
npm run firebase:deploy:rules
```

For GitHub Pages, also add your GitHub Pages domain in:

```text
Firebase Console > Authentication > Settings > Authorized domains
```

Example:

```text
your-username.github.io
```

## GitHub Pages Deploy

This project includes `.github/workflows/deploy.yml`. After pushing to `main` or `master`:

1. Open your GitHub repo settings.
2. Go to **Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push again or run the workflow manually.

Vite uses `base: './'`, so the app works from a GitHub Pages project path.
The app is a static client. It stays online through GitHub Pages and Firebase, so it does not need your computer or a Node server to stay on.

## Manager Page

After deploy, open:

```text
https://your-username.github.io/your-repo/manager.html
```

Default manager code:

```text
lmt1102011
```

The manager page can:

- View all class accounts from `students98`
- Add a new account
- Soft-delete/lock an account from the app
- View Nhat ky bi mat entries with the real writer name

Because this is a no-server static site, the manager code is client-side. Change it in both `public/manager.html` and `firestore.rules` before sharing widely.

## No Firebase Storage Needed

This version does not require Firebase Storage. Public feed images are compressed and saved directly inside Firestore documents as data URLs. The private download button still exports the sharp local canvas image for the student who took the photos.

## ZIP Export

This folder is already a complete website project. Zip the project directory after installing or before installing dependencies. For a clean handoff, exclude `node_modules` and `dist`; the recipient can run `npm install`.

## Image Sources

The seed and landing images use optimized Pexels CDN links about school life, graduation, and student memories.
