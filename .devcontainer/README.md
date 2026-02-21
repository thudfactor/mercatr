# Mercatr Development Container

This devcontainer provides a complete development environment for Mercatr with all necessary tools and dependencies pre-configured.

## What's Included

- **Node.js 22** (LTS) with npm
- **TypeScript** language support
- **Git** for version control
- Pre-configured VS Code extensions:
  - ESLint
  - Prettier
  - TypeScript language features

## Getting Started

1. **Open in devcontainer**: 
   - VS Code will prompt you to "Reopen in Container" when you open this repository
   - Or use Command Palette: `Dev Containers: Reopen in Container`

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your API keys:
   - `LASTFM_API_KEY` - Get from https://www.last.fm/api/account/create
   - `ANTHROPIC_API_KEY` - Get from https://console.anthropic.com/
   - `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` - For web server authentication

3. **Dependencies are auto-installed** via `postCreateCommand`

## Usage

Once the container is running:

```bash
# Run the CLI
npm run cli -- explore --artist "Elliott Smith"

# Start the web server (port 3000)
npm run serve

# Type-check
npx tsc --noEmit
```

## Port Forwarding

Port 3000 is automatically forwarded for the web server. Access it at `http://localhost:3000` once the server is running.

## Notes

- Node modules are stored in the container for faster I/O
- Logs and cache directories are persisted within the container
- API keys are configured via `.env` file only
