# Aria Wallet Chrome Extension

## Technologies:

- React
- Tailwind.css
- Vite
- TypeScript
- Jotai
- SymphonyJS
- React Query
- WalletKit
- EsLint
- Prettier

## Prerequisites:

- This project is using `yarn` as a package manager
- Node: v20.18.3

## Setup:

```
git clone https://github.com/your-org/aria-wallet.git
cd aria-wallet
yarn install
```

## Load the Extension in Chrome:

1. Run `yarn build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the `dist/` folder

## Publishing to Chrome Web Store

1. Run `yarn prepare-zip`  
   This generates `aria-wallet.zip` inside the project root.
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Click **“Add a New Item”** or select an existing item to update
4. Upload the `aria-wallet.zip` file
5. Fill out the required listing details:
   - Description
   - Screenshots
   - Category
   - Permissions
6. Submit for review
7. Monitor review status in the dashboard. Approval usually takes a few days.

> **Note:** Make sure the `manifest.json` includes all required permissions and matches Chrome Web Store policy. Run the extension locally first to verify no runtime errors.

## Scripts:

In the project directory, you can run:

### `yarn dev`

Runs the app in the development mode.

### `yarn build`

Builds the app for production to the `build` folder.
It correctly bundles React in production mode and optimizes the build for the best performance.

### `yarn check-types`

Performs a full TypeScript type check.

### `yarn prepare-zip`

Builds the app and creates a aria-wallet.zip file for distribution.

### `yarn reset`

Deletes node_modules and yarn.lock and reinstalls dependencies.

### `yarn set-version <version>`

Updates both `package.json` and `manifest.json` to the specified version number.

#### Usage:

- **Patch version** (e.g. bump `1.3.2` → `1.3.3`)

  ```bash
  yarn set-version 1.3.3
  ```

- **Minor version** (e.g. `1.3.2` → `1.4.0`)

  ```bash
  yarn set-version 1.4.0
  ```

- **Major version** (e.g. `1.3.2` → `2.0.0`)

  ```bash
  yarn set-version 2.0.0
  ```

- **Specific version**
  ```bash
  yarn set-version 2.1.5
  ```

> ⚠️ This does not auto-increment. You must specify the full version explicitly.
