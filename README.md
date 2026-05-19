# School Memory Photobook

A production-ready responsive React/Vite photobook app inspired by school memories, Korean photobooths, graduation, scrapbook journals, and nostalgic student life.

## Features

- Cinematic landing page with ambient music toggle and lightweight motion
- Photobooth-style join flow for name and class
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

## ZIP Export

This folder is already a complete website project. Zip the project directory after installing or before installing dependencies. For a clean handoff, exclude `node_modules` and `dist`; the recipient can run `npm install`.
