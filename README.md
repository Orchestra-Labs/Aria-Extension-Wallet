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

git clone https://github.com/your-org/aria-wallet.git

cd aria-wallet

yarn install

## Load the Extension in Chrome:

Run yarn build

Open chrome://extensions

Enable Developer mode

Click Load unpacked

Select the dist/ folder

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
