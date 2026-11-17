# Kingsfall Chess Android app

This app uses the existing production Kingsfall site and its shared Supabase backend.
The native WebView identifies itself with the `KingsfallAndroid/1` user-agent suffix.

## Administration

Admin navigation is intentionally unavailable in the Android app, including for
an owner account. The public website remains the management interface for the
authorized administrator. These UI restrictions are **not security controls**:
Supabase RLS, database RPCs and Edge Functions must enforce admin privileges.

## Build APK from a phone

1. GitHub > Actions > **Build Kingsfall Android APK** > **Run workflow**.
2. Open the successful run and download `KingsfallChess-Android-debug`.
3. Unzip the artifact, then install `app-debug.apk` on Android.

The debug APK is suitable for testing, not store distribution; a production
release needs a permanently held signing key and release configuration.
A fresh debug build might require uninstalling the previous debug APK because
its signing key may differ.

## Device QA

Test sign-in and sign-out, opening live games, realtime reconnects, premoves,
clock/background handling, analysis workers, browser redirects, and uploads.
Verify an admin account sees **no Admin tab or admin page in the app**, yet
retains admin access in Chrome using the same account.
