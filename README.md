# Stacks Sponsored Transaction Signing Demo

This demo app compares sponsored transaction signatures between software wallets (derived from mnemonic) and Ledger hardware wallets to help debug signature mismatches.

## Related Issue

**GitHub Issue**: [Zondax/ledger-stacks#205 - Sponsored transaction signature mismatch](https://github.com/Zondax/ledger-stacks/issues/205)

### Issue Summary

**Problem**: Sponsored transactions are not being signed correctly on Ledger devices when using the ledger-stacks library, causing signature verification to fail despite using identical mnemonics between software and hardware wallets.

**Key Details**:
- **Software wallet signature**: `01131ab41e87249c7b8a203ff8e2c3efa938f2fba22d06fceeb079cf144e0d64867ac16e2...` ✅
- **Ledger wallet signature**: `003de63722bda76970697b6029dc2724d79876be552989526f9a9faea9e7e7f3e15edb447fa...` ❌
- Both wallets have identical signer, nonce, fee, and key encoding values
- Only the signature data differs, causing verification failure

**Status**: Open - The issue persists in version 0.26.0 despite attempted fixes in PRs #207 and #208. The root cause may involve the Stacks SDK's verification function for sponsored transactions.

## Features

This demo allows you to:
- Generate a software wallet from a mnemonic (24 words)
- Sign sponsored transactions with the software wallet
- Sign sponsored transactions with a Ledger hardware wallet
- Compare `signatureVRS` values between both signing methods
- Verify transaction signatures
- View detailed diagnostic information including public keys and transaction hex

## Setup

### Prerequisites
- Node.js 18+
- pnpm (installed automatically if needed)
- For Ledger testing: Ledger device with Stacks app installed

### Installation

```bash
pnpm install
```

## Usage

### Development

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
pnpm build
pnpm preview
```

## How to Use

### Software Wallet Testing

1. Click "Generate New Mnemonic" or paste your own 24-word mnemonic
2. Click "Sign Sponsored Contract Call (Software Wallet)"
3. View the result including:
   - Public key
   - **signatureVRS** (hex-encoded signature)
   - Transaction hex
   - Verification status

### Ledger Wallet Testing

1. Connect your Ledger device
2. Open the Stacks app on your Ledger
3. Switch to "Ledger Hardware Wallet" mode
4. Click "Sign Sponsored Contract Call (Ledger)"
5. Approve the transaction on your Ledger device
6. View the result including:
   - Public key
   - Ledger address
   - **signatureVRS** (hex-encoded signature from Ledger)
   - Transaction hex
   - Verification status

### Comparing Signatures

The app displays the `signatureVRS` for both wallet types, allowing you to:
- Compare the signature formats
- Verify if signatures match between software and hardware wallets
- Debug signature verification failures
- Analyze the signature structure (v, r, s components)

## Technical Details

### Transaction Details
- **Type**: Sponsored contract call
- **Contract**: `SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.send-many`
- **Function**: `send-many`
- **Derivation Path**: `m/44'/5757'/0'/0/0` (account index 0)

### Libraries Used
- `@stacks/transactions` v7.3.0 - Stacks transaction construction
- `@stacks/encryption` v7.3.1 - Key derivation for software wallet
- `@scure/bip32` & `@scure/bip39` - Mnemonic and key derivation
- `@zondax/ledger-stacks` v1.1.0 - Ledger hardware wallet integration
- `@ledgerhq/hw-transport-webusb` - WebUSB transport for Ledger

### Buffer Polyfill

The app includes Buffer polyfills for browser compatibility:
- `buffer` package is globally available via `window.Buffer`
- `process` is globally available via `window.process`
- Polyfills are set up in `src/index.tsx`

## Development

Built with:
- **Vite** - Fast build tool and dev server
- **React 18** - UI framework
- **TypeScript 5.7** - Type safety
- **pnpm** - Fast, disk space efficient package manager

## License

MIT
