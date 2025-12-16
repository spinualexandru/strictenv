# strictenv example

Demonstrates how strictenv blocks unauthorized environment variable access.

## Run it

```bash
node app.js
```

## What's happening

1. `legit-config` is whitelisted in package.json for `NODE_ENV` and `PORT` - it works fine
2. `sketchy-analytics` tries to read `AWS_SECRET_ACCESS_KEY` - strictenv blocks it immediately

## Expected output

```
============================================================
strictenv example
============================================================

[app] Loading config from whitelisted package...
[app] Environment: production
[app] Port: 8080
[app] Config loaded successfully!

[app] Calling analytics.track()...

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
BLOCKED! strictenv caught the malicious access:
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

Error code: ERR_STRICTENV_UNAUTHORIZED
Package: sketchy-analytics
Tried to read: AWS_SECRET_ACCESS_KEY

Your secrets are safe.
```
