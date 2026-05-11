# Piko

Piko is a tiny AI focus companion for Chrome. It watches consented browser activity locally, keeps a current goal, and gives occasional gentle nudges through a small page overlay. Chat is Gemini API based.

## Why Piko Exists

Piko is Clippy with taste and consent: small, cute, dismissible, and focused on helping you notice attention drift without turning productivity into guilt.

## What is implemented

- Chrome Manifest V3 extension.
- Local activity tracking from browser tabs: title, domain, time spent, tab switching.
- Optional rough browser-history import for the last six hours, only after Chrome History permission is granted.
- Privacy controls for allowed domains, blocked domains, and URL storage.
- `/goal` command in chat and a dedicated goal input.
- Variable nudge timing with gentle, balanced, and active modes.
- Gemini REST integration through `x-goog-api-key`.
- Fallback non-AI nudges if no Gemini key is present.
- Content-page Piko overlay with dismiss and quiet controls.
- Popup dashboard with goal, recent activity summary, and chat.
- Options page for Gemini and privacy settings.
- Extension icons and a privacy policy draft for store submission.

## Screens

- Popup: goal, sleep controls, recent context, and chat.
- Options: Gemini API key, nudge mode, privacy controls, and optional history import.
- Overlay: a small Piko nudge on normal web pages.

## Install locally

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select this folder:

```text
C:\Users\ByteMyBootloader\Documents\Codex\2026-05-12\i-have-a-very-small-but
```

## Store packaging

Package the extension root into a ZIP before uploading to the Chrome Web Store. Do not include unrelated scratch files.

The current release package is generated as:

```text
dist/piko-0.1.0.zip
```

## Gemini setup

1. Open Piko settings from the extension popup.
2. Paste a Gemini API key.
3. Keep the default model `gemini-2.5-flash` unless you want to test another Gemini model.
4. Save settings.

Piko calls:

```text
https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

with the `x-goog-api-key` header.

## Commands

Use these inside the popup chat:

```text
/goal finish the Piko MVP
/goal
/sleep
/sleep 20
/wake
/pause
/resume
```

## Privacy model

Piko does not keylog and does not read full page text. V1 only uses browser tab signals.

By default it stores:

- page titles,
- domains,
- visit duration,
- tab switch pattern.

URLs are only stored if you change the privacy setting to `Titles, domains, and URLs`.

The optional browser-history import is off by default. It asks for Chrome History permission only when you click `Import recent browser history`.

## Current limits

- Whole-PC history is not included yet. That requires a native desktop companion app.
- Chrome system pages cannot show the overlay.
- The API key is stored in Chrome local extension storage, which is acceptable for a local prototype but not a final multi-user cloud product.

## Suggested next build

1. Add a native companion app only after the browser nudge loop feels useful.
2. Add provider abstraction later: Gemini first, then OpenAI/Anthropic/local.
3. Add a stronger permission screen before any Web Store release.

## License

MIT
