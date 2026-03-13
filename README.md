# AuthPilot

A sleek, cross-platform desktop app for managing auth provider secrets, environments, and projects. Supports multiple providers (Clerk, AWS Cognito, and more). Built with Tauri v2.

![AuthPilot](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![Built with](https://img.shields.io/badge/Built%20with-Tauri%20v2-orange)

## Features

- **Multi-Provider Support** — Manage Clerk, AWS Cognito, and future auth providers from one app
- **Projects & Apps** — Organize by project, each with multiple apps using different providers
- **Per-App Environments** — Dev/Staging/Production environments with provider-specific secrets
- **Secure Storage** — Secrets stored in OS keychain (never plaintext)
- **Provider Tools** — Quick actions per provider (extend token, switch org, login, etc.)
- **One-Click Copy** — Copy any secret or key to clipboard with toast feedback
- **Dark Mode** — Beautiful dark theme by default with light mode toggle
- **Cross-Platform** — Runs natively on macOS and Windows

## Supported Providers

| Provider       | Secrets                                       | Tools                               |
| -------------- | --------------------------------------------- | ----------------------------------- |
| **Clerk**      | Secret Key, Publishable Key, Webhook Secret   | Extend Token, Switch Org, Login     |
| **AWS Cognito**| User Pool ID, Client ID, Client Secret, Region| Get Token, List Users               |
| *More soon...*  | Extensible architecture                      | Add new providers easily            |

## Screenshots

> Coming soon

## Installation

### From Releases

Download the latest release from the [Releases](../../releases) page:

- **macOS (Apple Silicon)**: `AuthPilot_x.x.x_aarch64.dmg`
- **macOS (Intel)**: `AuthPilot_x.x.x_x64.dmg`
- **Windows**: `AuthPilot_x.x.x_x64-setup.exe` or `.msi`

### From Source

Prerequisites: [Node.js 22+](https://nodejs.org/), [pnpm](https://pnpm.io/), [Rust](https://rustup.rs/)

```bash
# Clone the repo
git clone https://github.com/your-org/authpilot.git
cd authpilot

# Install dependencies
pnpm install

# Run in development
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Tech Stack

| Layer          | Technology                   |
| -------------- | ---------------------------- |
| Shell          | Tauri v2                     |
| Frontend       | React 19 + TypeScript        |
| Styling        | Tailwind CSS v4 + shadcn/ui  |
| State          | Zustand                      |
| Routing        | React Router v7              |
| Secure Storage | OS Keychain via keyring crate|
| CI/CD          | GitHub Actions               |

## Project Structure

```
authpilot/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── ui/             # Base primitives (Button, Card, etc.)
│   │   ├── layout/         # Sidebar, Header, AppLayout
│   │   └── shared/         # CopyButton, SecretField, Toast, ProviderTools
│   ├── pages/              # Projects, Settings
│   ├── stores/             # Zustand stores (project, settings, toast)
│   ├── lib/                # Utilities, Tauri bridge, Provider definitions
│   ├── App.tsx             # Root with routing
│   └── main.tsx            # Entry point
├── src-tauri/              # Rust backend
│   ├── src/lib.rs          # Tauri commands (secure storage)
│   └── tauri.conf.json     # Tauri config
├── .github/workflows/      # CI + Release workflows
└── package.json
```

## Releasing

To create a new release:

```bash
# Tag the version
git tag v0.1.0
git push origin v0.1.0
```

The GitHub Actions release workflow will automatically:
1. Build for macOS (arm64 + x64) and Windows
2. Code sign and notarize (macOS — requires Apple Developer secrets)
3. Create a GitHub Release with all installers attached

### Required GitHub Secrets for macOS signing

| Secret                       | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| `APPLE_CERTIFICATE`          | Base64 `.p12` Developer ID Application certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12`                            |
| `APPLE_SIGNING_IDENTITY`     | `Developer ID Application: Name (TEAM_ID)`         |
| `APPLE_ID`                   | Apple ID email                                     |
| `APPLE_PASSWORD`             | App-specific password                              |
| `APPLE_TEAM_ID`              | 10-character Team ID                               |

## License

MIT
