# Kakehashi

Kakehashi is an Expo/React Native companion app for WaniKani learners. It
includes review and lesson flows, progress views, study tools, listening
practice, song/lyrics helpers, OCR/text tools, widgets, and a small marketing
website.

Kakehashi is not affiliated with WaniKani or Tofugu LLC.

## Setup

Install dependencies:

```bash
npm install
```

Install iOS pods:

```bash
cd ios
pod install
cd ..
```

Run the app on a simulator or emulator:

```bash
npm run ios
npm run android
```

Run on a connected device:

```bash
npx expo run:ios --device
npx expo run:android --device
```

Run common checks:

```bash
npm run lint
npm test
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md)
before opening an issue or pull request.
