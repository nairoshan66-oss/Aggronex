# Deploying AgroNex to Netlify

AgroNex's Netlify deployment serves its HTML, CSS, and JavaScript as a static site and runs backend routes through a JavaScript Netlify Function. Netlify Functions do not run this repository's Flask application. `application.py` remains for local Flask development; the Netlify function uses Netlify Blobs for account and password-reset records instead of SQLite.

Connect the repository to Netlify. `netlify.toml` configures `npm run build`, publishes `dist`, and routes API requests to `netlify/functions/api.mjs`.

Configure these values in **Project configuration → Environment variables**:

| Variable | Used for | Notes |
| --- | --- | --- |
| `SESSION_SECRET` | Signed login and password-reset cookies | Use a long, random secret. Required for authentication. |
| `GOOGLE_CLIENT_ID` | Google sign-in | Set for the build and runtime. Add the Netlify site origin to the OAuth web client's authorized JavaScript origins. |
| `OPENWEATHER_API_KEY` | Live weather | Used by the weather function. |
| `MAIL_USERNAME` | Password reset | Gmail SMTP username. |
| `MAIL_PASSWORD` | Password reset | Gmail app password or SMTP credential; never commit it. |
| `MAIL_SERVER` | Optional SMTP override | Defaults to Gmail's SMTP host. |
| `MAIL_PORT` | Optional SMTP override | Defaults to `587`. |

Redeploy after setting environment variables. For local Netlify development, install the npm dependencies, place these settings in an ignored `.env` file, and run `npm run dev`.

The soil classifier remains a brightness-based demo, not a trained agronomy model. Netlify Blobs provides lightweight key/value persistence here; use a relational database if you need transactions or richer account queries.
