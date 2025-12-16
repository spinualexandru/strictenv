# Postinstall Protection Example

Demonstrates how dotnope protects against malicious npm postinstall/preinstall scripts that try to steal environment variables (a common supply chain attack vector).

## The Attack

Malicious packages often include postinstall scripts that run automatically during `npm install`. These scripts can access environment variables containing secrets like:
- `NPM_TOKEN` - allows publishing packages as you
- `AWS_SECRET_ACCESS_KEY` - cloud access
- `GITHUB_TOKEN` - repository access
- API keys, database credentials, etc.

## The Protection

By using `NODE_OPTIONS` to preload dotnope, you can block unauthorized environment variable access from npm scripts while still allowing safe variables like `NODE_ENV`:

```bash
NODE_OPTIONS="--require ./preload-dotnope.js" npm install
```

## Run the Demo

### 1. Without protection (secrets exposed):
```bash
npm run demo:unprotected
```

Output:
```
[malicious-package] Running postinstall...
[malicious-package] Stolen secrets: {
  NPM_TOKEN: 'npm_XXXXXXXXXXXXXXXXXXXX',
  AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  ...
}
BAD NEWS: The malicious script succeeded!
```

### 2. With dotnope protection (secrets safe):
```bash
npm run demo:protected
```

Output:
```
[malicious-package] Running postinstall...
[malicious-package] BLOCKED: dotnope: Unauthorized environment variable access!

  Package: "malicious-package"
  Attempted to read: "NPM_TOKEN"

GOOD NEWS: dotnope blocked the malicious script!
Your secrets are safe.
```

## Configuration

The `package.json` whitelist allows packages to read only specific safe variables:

```json
{
  "environmentWhitelist": {
    "malicious-package": {
      "allowed": ["NODE_ENV", "FORCE_COLOR", "NO_COLOR", "TERM"]
    }
  }
}
```

Sensitive variables like `NPM_TOKEN`, `AWS_SECRET_ACCESS_KEY`, etc. are NOT whitelisted, so access is blocked.

## Real-World Usage

Add this to your CI/CD or local development:

```bash
# Create a preload script in your project
cat > preload-dotnope.js << 'EOF'
const dotnope = require('dotnope');
dotnope.enableStrictEnv();
EOF

# Run npm install with protection
NODE_OPTIONS="--require ./preload-dotnope.js" npm install
```

Or add to your shell profile:
```bash
alias npm-safe='NODE_OPTIONS="--require $(npm root -g)/dotnope/preload.js" npm'
```

## How It Works

1. `NODE_OPTIONS="--require ./preload-dotnope.js"` tells Node.js to load dotnope before running any script
2. When npm spawns a child process to run postinstall, that process inherits `NODE_OPTIONS`
3. dotnope loads first and intercepts all `process.env` access
4. Safe variables (NODE_ENV, etc.) are allowed per the whitelist
5. Sensitive variables (NPM_TOKEN, AWS keys, etc.) throw an error, stopping the malicious script
