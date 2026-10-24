# RepForm — 12 Week Workout Tracker

A phone-first, installable workout tracker for the 12-week program in the supplied workbook. It runs as a static web app and saves workout logs in the browser on the current device. There is no account or server-side database.

## Run locally

Serve this folder over HTTP; opening `index.html` as a `file://` URL will not enable offline caching.

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000` on the development computer. To test on an iPhone, publish the folder to an HTTPS static host, open its URL in Safari, and use **Share → Add to Home Screen**.

## Use

- Start the program to begin with workout 1 on that day. After you finish, the next session is scheduled for the next weekday; weekends are recovery days. An unfinished workout stays current until you complete it.
- Check off sets as you go. Optional squat, bench, deadlift, and overhead press maxes produce suggested working loads from the plan's percentages. The workbook's example maxes are not used.
- The home screen reminds you of the daily step target: 8,000 on workout days and 10,000 on recovery days.
- Export a JSON backup from **Settings** before clearing browser/site data or moving to another device. Importing replaces the workout data currently saved on the device.

## Data and offline use

Workout data is stored in this browser's local storage. It is not encrypted, synced, or automatically backed up. Clearing the browser's site data can remove logs. Export/import is required to transfer a backup between devices.

The service worker caches the app shell and the full workout program after the first successful HTTPS/localhost visit. Subsequent visits can load offline.
Exercise demonstration videos are embedded from YouTube when opened and require an internet connection; video playback is not available offline.

## Free hosting with GitHub Pages

GitHub Pages gives the app an HTTPS address Safari can install. The repository must be public on the GitHub Free plan; the workout logs remain only on the iPhone, but the app's source files and program are public.

1. Create a new **public** repository on GitHub (for example, `repform-workout-tracker`).
2. Upload all files in this folder to the repository's root, including the RepForm logo and PNG app icons.
3. In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select the `main` branch and `/ (root)`, then save.
4. Wait for GitHub Pages to finish publishing. Its address will look like `https://YOUR-USERNAME.github.io/repform-workout-tracker/`.
5. On your iPhone, open that HTTPS address in **Safari**. Load it once while online, then tap **Share → Add to Home Screen → Add**.
6. Launch **RepForm** from the new Home Screen icon. Reopen it once online after future app updates so the offline copy can refresh.

This is a personal home-screen web app (PWA), not an App Store app. It does not require an Apple Developer membership or a paid hosting plan.
