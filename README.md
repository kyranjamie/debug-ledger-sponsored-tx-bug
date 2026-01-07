# Stacks Sponsored Transaction Signing Demo

> [!WARNING]  
> Vibe coded POC of an issue. Only enter throwaway test mnemonics

This demo app compares sponsored transaction signatures between software wallets (derived directly from mnemonic) and Ledger hardware wallets to help debug an issue with signature mismatches.

## Related Issue

**GitHub Issue**: [Zondax/ledger-stacks#205 - Sponsored transaction signature mismatch](https://github.com/Zondax/ledger-stacks/issues/205)

### Issue Summary

**Problem**: Sponsored transactions are not being signed correctly on Ledger devices when using the ledger-stacks library and a Ledger hardware wallet, causing signature verification to fail.

## Setup

To reproduce, you'll need a throwaway mnemonic also installed on a Ledger device to compare software / Ledger.


```bash
pnpm i
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Screenshot

![screenshot of app](./public/screenshot.png)