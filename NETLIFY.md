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

### Enable live weather

1. Create or sign in to an account at [OpenWeather](https://openweathermap.org/).
2. Open your account's **API keys** page and copy an API key. OpenWeather documents that its API key is required on each weather request. [OpenWeather API key guide](https://openweathermap.org/appid)
3. In Netlify, open **Project configuration → Environment variables** and add `OPENWEATHER_API_KEY` with the copied value. Keep it in the Functions/runtime scope; the browser never needs the key.
4. Trigger a new deploy so the function receives the variable. The dashboard requests weather for the visitor's location when permitted, and falls back to Ahmedabad when location access is denied. It refreshes weather every 10 minutes.

For local development only, put the key after `OPENWEATHER_API_KEY=` in your ignored `.env` file. Never commit or share the key.

The soil classifier remains a brightness-based demo, not a trained agronomy model. Netlify Blobs provides lightweight key/value persistence here; use a relational database if you need transactions or richer account queries.
