# Jellyfin Mobile Client

A lightweight Expo React Native mobile client for Jellyfin. The app signs in to a Jellyfin server, stores the active session locally, lists the user's libraries, and shows recently added media with poster art.

## Features

- Jellyfin server URL probing through `/System/Info/Public`.
- Username/password authentication through `/Users/AuthenticateByName`.
- Persisted sessions with `@react-native-async-storage/async-storage`.
- Home screen with user libraries and recently added media.
- Pull-to-refresh and sign-out support.
- Dark Jellyfin-inspired mobile UI.

## Getting started

```bash
npm install
npm start
```

Then open the app in Expo Go or an emulator and enter your Jellyfin server URL plus account credentials.

## Available scripts

- `npm start` - start the Expo development server.
- `npm run android` - open the app on Android.
- `npm run ios` - open the app on iOS.
- `npm run web` - run the web preview.
- `npm run typecheck` - run TypeScript without emitting files.

## Notes

The app communicates directly with your Jellyfin server. For remote access, configure HTTPS and make sure your server is reachable from the device running the app.
