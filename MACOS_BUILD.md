# macOS Build, Signing, and Notarization Guide

Since macOS has strict security controls (Gatekeeper), users will see warnings or blockages when opening applications that are not signed or notarized by a verified Apple Developer account. 

This guide explains how to compile the macOS production executable (`.dmg` or `.app` bundle) on a Mac computer, sign it, and notarize it.

---

## Prerequisites

1. **Apple Developer Account**: You need an active membership in the Apple Developer Program ($99/year).
2. **Mac Computer**: macOS is required to code-sign and notarize the app.
3. **Xcode Command Line Tools**: Install them by running:
   ```bash
   xcode-select --install
   ```
4. **App-Specific Password**: Create an App-Specific Password for your Apple ID under [appleid.apple.com](https://appleid.apple.com) for notarization.

---

## Step 1: Install and Configure Developer Certificates

1. Open **Xcode** on your Mac.
2. Go to **Xcode > Settings > Accounts** and sign in with your Apple ID.
3. Select your team and click **Manage Certificates...**.
4. Add a **Developer ID Application** certificate. Xcode will request it and download it to your local Keychain.
5. In your Keychain Access app, make sure you see:
   * `Developer ID Application: <Your Name / Company Name> (<Team ID>)`

---

## Step 2: Configure Environment Variables

Create or update your `.env.local` file on the Mac with the following environment variables (do not commit this to GitHub):

```bash
# Apple Developer credentials for signing & notarization
APPLE_ID="your-apple-id@email.com"
APPLE_ID_PASSWORD="xxxx-xxxx-xxxx-xxxx" # The App-Specific Password you created
APPLE_TEAM_ID="YOUR_10_CHARACTER_TEAM_ID"
```

---

## Step 3: Configure `package.json`

Ensure your `package.json` file has the macOS build configuration setup correctly:

```json
"build": {
  "appId": "com.getodevel.pesos",
  "productName": "PESOS",
  "afterSign": "scripts/notarize.js", // Script to run notarization
  "mac": {
    "category": "public.app-category.productivity",
    "target": ["dmg", "zip"],
    "hardenedRuntime": true, // Required for notarization
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist"
  }
}
```

---

## Step 4: Run the Build Command

1. Install dependencies on the Mac:
   ```bash
   npm install
   ```
2. Build and package the application:
   ```bash
   npm run electron-pack -- --mac
   ```

Electron Builder will:
1. Compile the Next.js production build.
2. package it into a macOS application.
3. Automatically search your Keychain for the `Developer ID Application` certificate and sign the executable binaries.
4. Run the notarization script (`scripts/notarize.js`) which uploads the packaged app to Apple's notary service for verification.

---

## Step 5: Verification

Once the process finishes successfully, you will get a `.dmg` and `.zip` inside the `dist/` directory.

When users download and open `PESOS Setup.dmg` or the `.app` on their macOS computers:
* Gatekeeper will scan it and show: `"Apple checked it for malicious software and none was detected."`
* They will be able to open it with a single click.
