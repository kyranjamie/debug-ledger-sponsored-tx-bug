import {
  makeUnsignedContractCall,
  deserializeTransaction,
  TransactionSigner,
  AddressVersion,
  createMessageSignature,
  SingleSigSpendingCondition,
} from "@stacks/transactions";

import { useState, useCallback } from "react";
import {
  mnemonicToSeedSync,
  generateMnemonic,
  validateMnemonic,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";
import StacksApp from "@zondax/ledger-stacks";
import { getPublicKeyFromPrivate } from "@stacks/encryption";

type WalletType = "software" | "ledger";

interface HistoryItem {
  timestamp: string;
  walletType: WalletType;
  sponsored: boolean;
  data: Record<string, any>;
  verified: boolean;
}

export default function App() {
  const [error, setError] = useState({
    isError: false,
    error: "",
  });
  const [walletType, setWalletType] = useState<WalletType>("software");
  const [mnemonic, setMnemonic] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sponsored, setSponsored] = useState(true);

  // Helper to create identical unsigned transactions
  const createUnsignedTransaction = useCallback(
    async (publicKey: string) => {
      return await makeUnsignedContractCall({
        sponsored,
        contractAddress: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE",
        contractName: "send-many",
        functionName: "send-many",
        functionArgs: [],
        publicKey,
        nonce: 220, // Fixed nonce for consistent transaction
        fee: 52259, // Fixed fee (0xcc23) for consistent transaction
      });
    },
    [sponsored]
  );

  const verifySigHash = useCallback(({ txHex }: { txHex: string }) => {
    try {
      const tx = deserializeTransaction(txHex);
      tx.verifyOrigin();
      setError({
        isError: false,
        error: "",
      });
      return true;
    } catch (error) {
      console.error("Verification error:", error);

      if (String(error).toLowerCase().includes("invalid signature")) {
        setError({
          isError: true,
          error: "Invalid signature",
        });
      } else if (
        String(error)
          .toLowerCase()
          .includes("signer hash does not equal hash of public key")
      ) {
        setError({
          isError: true,
          error: "Public key mismatch",
        });
      } else {
        setError({
          isError: true,
          error: `Error verifying signature: ${String(error)}`,
        });
      }
      throw error;
    }
  }, []);

  const handleSoftwareWalletSign = useCallback(async () => {
    if (!mnemonic) {
      alert("Please enter a mnemonic phrase");
      return;
    }

    try {
      setError({ isError: false, error: "" });

      // Validate mnemonic
      if (!validateMnemonic(mnemonic, wordlist)) {
        throw new Error("Invalid mnemonic phrase");
      }

      // Derive seed from mnemonic using @scure/bip39
      const seed = mnemonicToSeedSync(mnemonic);

      // Derive root keychain using @scure/bip32
      const rootKeychain = HDKey.fromMasterSeed(seed);

      // Derive address keychain (m/44'/5757'/0'/0/0)
      const addressKeychain = rootKeychain.derive("m/44'/5757'/0'/0/0");

      if (!addressKeychain.privateKey) {
        throw new Error("Failed to derive private key");
      }

      const privateKey = addressKeychain.privateKey;
      const publicKey = getPublicKeyFromPrivate(privateKey);

      console.log("Public key:", publicKey);

      // Create unsigned transaction using shared helper
      const contractCall = await createUnsignedTransaction(publicKey);

      // Sign the transaction
      const signer = new TransactionSigner(contractCall);
      signer.signOrigin(privateKey);

      const signedTx = signer.transaction;
      const signedTxHex = signedTx.serialize();

      // Extract the signature from the serialized transaction
      // For a standard transaction: version(1) + chainId(4) + authType(1) + hashMode(1) + signer(20) + nonce(8) + fee(8) + keyEncoding(1) = 44 bytes
      // Signature is the next 65 bytes (VRS format: 1 byte recovery + 32 bytes r + 32 bytes s)
      const signatureStartByte = 44;
      const signatureEndByte = signatureStartByte + 65;
      const signatureVRSHex = signedTxHex.substring(
        signatureStartByte * 2,
        signatureEndByte * 2
      );

      console.log("Signed transaction hex:", signedTxHex);
      console.log("SignatureVRS (software):", signatureVRSHex);

      // Verify signature and add to history
      let verified = true;
      let errorMessage: string | undefined;
      try {
        verifySigHash({ txHex: signedTxHex });
      } catch (verifyError) {
        verified = false;
        errorMessage = String(verifyError);
        console.error("Verification failed:", verifyError);
      }

      setHistory((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          walletType: "software",
          sponsored,
          data: {
            publicKey,
            signatureVRS: signatureVRSHex,
            txHex: signedTxHex,
            ...(errorMessage && { error: errorMessage }),
          },
          verified,
        },
      ]);
    } catch (error) {
      console.error("Software wallet error:", error);
      setError({
        isError: true,
        error: `Software wallet error: ${String(error)}`,
      });
    }
  }, [mnemonic, createUnsignedTransaction, verifySigHash]);

  const handleLedgerSign = useCallback(async () => {
    try {
      setError({ isError: false, error: "" });

      // Dynamically import TransportWebUSB to avoid Buffer issues at bundle time
      const TransportWebUSB = (await import("@ledgerhq/hw-transport-webusb"))
        .default;

      // Connect to Ledger device via WebUSB
      const transport = await TransportWebUSB.create();
      const stacksApp = new StacksApp(transport);

      // Get version to verify connection
      const version = await stacksApp.getVersion();
      console.log("Ledger Stacks app version:", version);

      // Get address and public key from Ledger (m/44'/5757'/0'/0/0)
      const pathStr = "m/44'/5757'/0'/0/0";
      const addressResponse = await stacksApp.getAddressAndPubKey(
        pathStr,
        AddressVersion.MainnetSingleSig
      );

      if (addressResponse.returnCode !== 0x9000) {
        throw new Error(
          `Failed to get address: ${addressResponse.errorMessage}`
        );
      }

      const publicKeyString = addressResponse.publicKey.toString("hex");
      console.log("Ledger public key:", publicKeyString);

      // Create unsigned transaction using shared helper
      const contractCall = await createUnsignedTransaction(publicKeyString);

      const unsignedTxHex = contractCall.serialize();

      // Sign transaction with Ledger
      const signResponse = await stacksApp.sign(
        pathStr,
        Buffer.from(unsignedTxHex, "hex")
      );

      if (signResponse.returnCode !== 0x9000) {
        throw new Error(`Failed to sign: ${signResponse.errorMessage}`);
      }

      // The signatureVRS from Ledger is in format: [v (1 byte), r (32 bytes), s (32 bytes)]
      // Apply the signature to the transaction using the same approach as the user's implementation
      const signatureVRS = signResponse.signatureVRS;
      const signatureVRSHex = signatureVRS.toString("hex");

      console.log("SignatureVRS (Ledger):", signatureVRSHex);

      // Create the message signature from the Ledger signature
      const messageSignature = createMessageSignature(signatureVRSHex);

      // Apply signature to the spending condition (similar to user's signStacksTransactionWithSignature)
      (
        contractCall.auth.spendingCondition as SingleSigSpendingCondition
      ).signature = messageSignature;

      const signedTxHex = contractCall.serialize();

      console.log("Signed transaction hex:", signedTxHex);

      // Verify signature and add to history
      let verified = true;
      let errorMessage: string | undefined;
      try {
        verifySigHash({ txHex: signedTxHex });
      } catch (verifyError) {
        verified = false;
        errorMessage = String(verifyError);
        console.error("Verification failed:", verifyError);
      }

      setHistory((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          walletType: "ledger",
          sponsored,
          data: {
            publicKey: publicKeyString,
            address: addressResponse.address,
            signatureVRS: signatureVRSHex,
            txHex: signedTxHex,
            ...(errorMessage && { error: errorMessage }),
          },
          verified,
        },
      ]);

      await transport.close();
    } catch (error) {
      console.error("Ledger error:", error);
      setError({
        isError: true,
        error: `Ledger error: ${String(error)}`,
      });
    }
  }, [createUnsignedTransaction, verifySigHash]);

  const handleGenerateMnemonic = useCallback(() => {
    const newMnemonic = generateMnemonic(wordlist, 256); // 24 words
    setMnemonic(newMnemonic);
  }, []);

  return (
    <div className="App" style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>Ledger Stacks Sponsored transaction signing issue demo</h1>

      <a
        href="https://github.com/Zondax/ledger-stacks/issues/205"
        target="_blank"
        rel="noreferrer"
      >
        View Related GitHub Issue on zondax/ledger-stacks
      </a>

      <div style={{ marginBottom: "20px" }}>
        <h2>Select Wallet Type</h2>
        <label>
          <input
            type="radio"
            value="software"
            checked={walletType === "software"}
            onChange={(e) => setWalletType(e.target.value as WalletType)}
          />
          Software Wallet (Mnemonic)
        </label>
        <br />
        <label>
          <input
            type="radio"
            value="ledger"
            checked={walletType === "ledger"}
            onChange={(e) => setWalletType(e.target.value as WalletType)}
          />
          Ledger Hardware Wallet
        </label>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h2>Transaction Type</h2>
        <label>
          <input
            type="radio"
            value="sponsored"
            checked={sponsored === true}
            onChange={() => setSponsored(true)}
          />
          Sponsored Transaction
        </label>
        <br />
        <label>
          <input
            type="radio"
            value="non-sponsored"
            checked={sponsored === false}
            onChange={() => setSponsored(false)}
          />
          Non-Sponsored Transaction
        </label>
      </div>

      {walletType === "software" && (
        <div style={{ marginBottom: "20px" }}>
          <h2>Software Wallet Configuration</h2>
          <div style={{ marginBottom: "10px" }}>
            <label>
              Mnemonic Phrase (24 words):
              <br />
              <textarea
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                rows={4}
                cols={80}
                style={{ fontFamily: "monospace", fontSize: "12px" }}
              />
            </label>
            <br />
            <button
              onClick={handleGenerateMnemonic}
              style={{ marginTop: "5px" }}
            >
              Generate New Mnemonic
            </button>
          </div>
          <button onClick={handleSoftwareWalletSign}>
            Sign Sponsored Contract Call (Software Wallet)
          </button>
        </div>
      )}

      {walletType === "ledger" && (
        <div style={{ marginBottom: "20px" }}>
          <h2>Ledger Wallet Configuration</h2>
          <p>Make sure your Ledger is connected and the Stacks app is open.</p>
          <button onClick={handleLedgerSign}>
            Sign Sponsored Contract Call (Ledger)
          </button>
        </div>
      )}

      {error.isError && (
        <div
          style={{
            marginTop: "20px",
            padding: "10px",
            backgroundColor: "#ffebee",
            border: "1px solid #f44336",
          }}
        >
          <h3 style={{ color: "#f44336", margin: "0 0 10px 0" }}>Error</h3>
          <p style={{ color: "#c62828", margin: 0 }}>{error.error}</p>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <h3 style={{ margin: 0 }}>Transaction History</h3>
            <button
              onClick={() => setHistory([])}
              style={{
                padding: "5px 10px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Clear History
            </button>
          </div>
          {history
            .slice()
            .reverse()
            .map((item, index) => (
              <div
                key={history.length - 1 - index}
                style={{
                  marginBottom: "20px",
                  padding: "10px",
                  backgroundColor: item.verified ? "#e8f5e9" : "#ffebee",
                  border: item.verified
                    ? "1px solid #4caf50"
                    : "1px solid #f44336",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                  }}
                >
                  <div>
                    <strong style={{ color: item.verified ? "#2e7d32" : "#c62828" }}>
                      {item.walletType === "software"
                        ? "Software Wallet"
                        : "Ledger Wallet"}
                    </strong>
                    {" • "}
                    <span>{item.sponsored ? "Sponsored" : "Non-Sponsored"}</span>
                    {" • "}
                    <span style={{ fontSize: "0.9em", color: "#666" }}>
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <strong style={{ color: item.verified ? "#2e7d32" : "#c62828" }}>
                      {item.verified ? "✓ Verified" : "✗ Failed"}
                    </strong>
                  </div>
                </div>
                <pre
                  style={{
                    margin: 0,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    fontSize: "12px",
                  }}
                >
                  {JSON.stringify(item.data, null, 2)}
                </pre>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
