# Contributing

Piko is intentionally small. The product should stay focused on gentle browser nudges, local-first activity context, and a minimal AI chat surface.

## Local Setup

1. Clone the repo.
2. Open Chrome.
3. Go to `chrome://extensions`.
4. Enable `Developer mode`.
5. Click `Load unpacked`.
6. Select the repo root.

## Development Rules

- Keep the extension dependency-free unless a dependency clearly earns its weight.
- Do not add full-page scraping by default.
- Do not add keylogging or hidden tracking.
- Keep AI provider logic isolated so providers can be added later.
- Keep Piko's tone gentle, useful, and easy to dismiss.
- Prefer local storage and explicit consent over cloud sync.

## Validation

Run syntax checks before submitting changes:

```powershell
node --check src\core.js
node --check src\background.js
node --check src\popup.js
node --check src\options.js
node --check src\content.js
```

Then reload the unpacked extension and smoke test:

- popup opens,
- settings save,
- `/goal test Piko` works,
- Gemini chat replies if an API key is configured,
- sleep/wake controls work,
- page overlay appears on normal web pages.
