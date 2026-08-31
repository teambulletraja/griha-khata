# Gori's Griha Khata

A shared household budgeting app for the family — built with React, Firebase Firestore, and installable as a PWA on any phone.

## What's already done
- Firebase project `griha-khata` is wired in (`src/firebase.js`)
- All data (members, categories, monthly expenses) is stored in one Firestore collection: `griha_khata`
- App builds cleanly with `npm run build` (already verified)
- PWA manifest + service worker configured (installable, works offline for the UI shell)

## 1. Run it locally first (optional but recommended)
```bash
npm install
npm run dev
```
Open the printed localhost URL, add a test expense, then check the Firebase console → Firestore Database → Data tab. You should see a `griha_khata` collection appear with documents like `members`, `categories`, `expenses:2026-08`.

## 2. Set Firestore security rules
Right now Firestore is in "test mode," which expires in 30 days and is wide open to the whole internet in the meantime. Before sharing the live link with the family:

1. Go to Firebase console → your project → Databases & Storage → Firestore Database → Rules tab
2. Replace the contents with what's in `firestore.rules` in this folder
3. Click Publish

This scopes access to just the one collection the app uses, and denies everything else — reasonable for a private family tool where the risk is a stranger stumbling on the link, not a targeted attacker. If you want real access control later (e.g. only the 6 of you can read/write), the next step up is adding Firebase Authentication (email link or Google sign-in) — happy to wire that in when you're ready.

## 3. Push to GitHub
```bash
cd griha-khata
git init
git add .
git commit -m "Initial commit: Gori's Griha Khata"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/griha-khata.git
git push -u origin main
```
(Create the empty `griha-khata` repo on GitHub first, without a README, so the push doesn't conflict.)

## 4. Deploy for free (Vercel)
1. Go to vercel.com, sign in with GitHub
2. Click "Add New" → "Project", select the `griha-khata` repo
3. Leave all settings as default (Vercel auto-detects Vite) and click Deploy
4. You'll get a live URL like `griha-khata.vercel.app` in about a minute
5. Every future `git push` to `main` redeploys automatically

## 5. Install on everyone's phone
Share the Vercel URL with the family. On each phone:
- **iPhone (Safari):** open the link → Share button → "Add to Home Screen"
- **Android (Chrome):** open the link → ⋮ menu → "Add to Home screen" / "Install app"

It'll appear as a normal app icon and open full-screen, no browser chrome. Everyone reads and writes the same shared Firestore data, so an expense anyone adds shows up for everyone.

## Notes
- The Firebase config in `src/firebase.js` is safe to be public — it identifies the project, it doesn't grant access. Access is controlled entirely by the Firestore rules above.
- If a month's data ever looks wrong, check Firebase console → Firestore Database → Data → `griha_khata` → the relevant `expenses:YYYY-MM` document directly; it's just a JSON array you can inspect or hand-edit if needed.
