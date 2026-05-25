# Contributing

Thanks for helping improve Kakehashi.

## Setup

Install dependencies:

```bash
npm install
```

Create local environment config:

```bash
cp .env.example .env
```

Start the app:

```bash
npm start
```

## Helpful Checks

These are useful to run before opening a pull request, especially when your
change touches app behavior:

```bash
npm run lint
npm test
```

Some provider-backed features require local environment values. Do not commit
real credentials, generated native build outputs, Expo caches, or personal
configuration.

## Pull Requests

- Keep changes focused and describe the user-visible behavior.
- Share how you tested the change when that context is helpful.
- Mention provider setup, schema changes, native build steps, or follow-up work
  when they matter for review.
- Update documentation when behavior, setup, permissions, or configuration
  changes.

## Issues

Bug reports are easiest to act on when they include whatever you can share from
this list:

- Platform and OS version.
- App version or commit.
- Steps to reproduce.
- Expected behavior.
- Actual behavior.
- Relevant screenshots, logs, or error messages.

Please do not include API tokens, provider credentials, private account data, or
other secrets in issues.

## Security

Please follow [SECURITY.md](SECURITY.md) for suspected secrets, account tokens,
backend access problems, or user data exposure.
