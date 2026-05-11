# Piko Privacy Policy Draft

Last updated: 2026-05-12

Piko is a browser extension that provides goal-based focus nudges and optional AI chat.

## Data Piko Stores Locally

Piko stores extension data in Chrome local extension storage on your device:

- current goal,
- extension settings,
- recent tab titles,
- domains,
- visit duration,
- tab switch patterns,
- optional recent browser history imported after you grant Chrome History permission,
- local chat history.

By default, Piko stores page titles and domains. Full URLs are stored only if you enable URL storage in settings.

## Data Sent to Gemini

If you add a Gemini API key, Piko may send a compact browser-context summary to the Gemini API to generate chat replies or nudge wording. This may include your current goal, current tab title/domain, top recent domains, tab switch count, and recent activity summaries.

Piko does not send full page contents and does not keylog.

## Permissions

Piko requests the minimum permissions needed for its features:

- `tabs`: read active tab titles and URLs for focus context,
- `storage`: store settings and local activity,
- `alarms`: run periodic nudge checks,
- `scripting`: ensure the page overlay can be shown on normal web pages,
- optional `history`: import a rough recent browsing snapshot only when you click the import button.

## Data Sharing

Piko does not sell user data.

Piko does not share user data with third parties except when you configure Gemini and request AI features that require sending compact context to Gemini.

## Data Deletion

You can clear local Piko activity and chat data from the extension settings or popup.

Uninstalling the extension also removes its local extension storage.

## Limited Use Statement

Piko's use of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Contact

Replace this section with your public support email or website before publishing.
