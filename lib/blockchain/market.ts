/**
 * Blockchain interaction layer — Market instructions.
 *
 * This file is the ONLY place in the codebase that calls Solana directly for
 * market-related actions.  React components import the plain async functions
 * from here; they never touch @solana/kit themselves.
 *
 * Pattern for every on-chain call:
 *   1. Build the instruction with the Codama-generated helper
 *   2. Wrap it in a TransactionMessage (version 0)
 *   3. Set fee payer + recent blockhash
 *   4. Sign with the wallet signer
 *   5. Send + confirm
 */

import {
  appendTransactionMessageInstruction,
  createTransactionMessage,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type TransactionSigner,
  type FullySignedTransaction,
  type TransactionBlockhashLifetime,
} from "@solana/kit";

// Codama-generated instruction builder for initialize_market
import { getInitializeMarketInstructionAsync } from "@/generated/instructions/initializeMarket";
import { 
  fetchMarket, 
  type Market, 
  MARKET_DISCRIMINATOR 
} from "@/generated/accounts/market";
import { PREDICTION_MARKET_PROGRAM_ADDRESS } from "@/generated/programs";

// Shared RPC clients
import { rpc, rpcSubscriptions } from "./client";

// Pre-built sender — factory is called once at module level
const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InitializeMarketParams {
  /** The wallet/keypair that will own and pay for the market. */
  authority: TransactionSigner;

  /**
   * The SPL token mint used as collateral in this market.
   * On devnet you can use a devnet USDC mint, or create your own test mint.
   * Example: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" (mainnet USDC)
   */
  collateralMint: Address;

  /**
   * A unique u32 number that identifies this market on-chain.
   * The program derives all PDAs from this ID, so it must never be reused.
   */
  marketId: number;

  /**
   * Unix timestamp (seconds) at which the market can be settled.
   * Must be in the future relative to the current block time.
   * e.g.  BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60)  // 7 days from now
   */
  settlementDeadline: bigint;

  metadataUrl: string;
}

export interface InitializeMarketResult {
  /** The base-58 transaction signature you can look up on an explorer. */
  signature: string;
}

// ── initializeMarket ──────────────────────────────────────────────────────────

/**
 * Calls the `initialize_market` instruction on-chain.
 *
 * What happens under the hood:
 *  - Codama's `getInitializeMarketInstructionAsync` derives ALL PDAs for you:
 *      market, collateralVault, outcomeYesMint, outcomeNoMint,
 *      yesEscrow, noEscrow, orderbook
 *  - systemProgram / tokenProgram / rent are also defaulted automatically.
 *  - You only need to supply: authority signer, collateralMint, marketId, settlementDeadline.
 *
 * @example
 * ```ts
 * const result = await initializeMarket({
 *   authority: walletSigner,          // TransactionSigner from your wallet adapter
 *   collateralMint: address("EPjF..."),
 *   marketId: 1,
 *   settlementDeadline: BigInt(Math.floor(Date.now() / 1000) + 604800), // +7 days
 * });
 * console.log("Transaction:", result.signature);
 * ```
 */
export async function initializeMarket(
  params: InitializeMarketParams,
): Promise<InitializeMarketResult> {
  const { authority, collateralMint, marketId, settlementDeadline, metadataUrl } = params;

  // ── Step 1: Build the instruction ──────────────────────────────────────────
  //
  // `getInitializeMarketInstructionAsync` is what Codama generated.
  // It is `async` because it needs to derive PDAs (which involves hashing).
  //
  // We only pass the things WE know. Everything else (PDAs, default programs)
  // is resolved by the generated function automatically.
  const instruction = await getInitializeMarketInstructionAsync({
    authority,          // signer — will be set as writable + signer account meta
    collateralMint,     // the mint address we provide
    marketId,           // u32 — used to derive all PDAs
    settlementDeadline, // i64 as bigint
    metadataUrl
    // market, collateralVault, outcomeYesMint, outcomeNoMint,
    // yesEscrow, noEscrow, orderbook → all auto-derived from marketId ✅
    // systemProgram, tokenProgram, rent → all defaulted ✅
  });

  // ── Step 2: Fetch a recent blockhash ───────────────────────────────────────
  //
  // Every transaction needs a "lifetime" — a recent blockhash.
  // The transaction will expire if not confirmed within ~60-90 seconds.
  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash({ commitment: "confirmed" })
    .send();

  // ── Step 3: Build the TransactionMessage ──────────────────────────────────
  //
  // `pipe` is just a functional utility: pipe(value, fn1, fn2) === fn2(fn1(value))
  // We use it here to compose the transaction message step by step.
  const transactionMessage = pipe(
    // Start with a v0 transaction (supports address lookup tables if needed later)
    createTransactionMessage({ version: 0 }),

    // Set who pays for the transaction fees (the authority/wallet)
    (tx) => setTransactionMessageFeePayerSigner(authority, tx),

    // Set the lifetime (recent blockhash + last valid block height)
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),

    // Attach our initialize_market instruction
    (tx) => appendTransactionMessageInstruction(instruction, tx),
  );

  // ── Step 4: Sign the transaction ───────────────────────────────────────────
  //
  // `signTransactionMessageWithSigners` scans the instruction's account metas,
  // finds all accounts marked as signers, and asks them to sign.
  // Since `authority` is the only signer here, it will prompt the wallet once.
  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);

  // ── Step 5: Send + Confirm ─────────────────────────────────────────────────
  //
  // Sends the transaction and WAITS until it is finalized on-chain
  // (or throws if it fails / times out).
  await sendAndConfirmTransaction(signedTransaction as Parameters<typeof sendAndConfirmTransaction>[0], {
    commitment: "confirmed",
  });

  // ── Return the signature ──────────────────────────────────────────────────
  const signature = getSignatureFromTransaction(signedTransaction);

  return { signature };
}

// ── getAllMarkets ─────────────────────────────────────────────────────────────

/**
 * Fetches all market accounts from the blockchain.
 * 
 * Uses getProgramAccounts to find all accounts owned by the prediction market
 * program that start with the Market discriminator.
 * 
 * @returns Array of all market accounts with their addresses
 * 
 * @example
 * ```ts
 * const markets = await getAllMarkets();
 * console.log(`Found ${markets.length} markets`);
 * markets.forEach(m => console.log(`Market ${m.data.marketId}: ${m.address}`));
 * ```
 */
export async function getAllMarkets(): Promise<Array<{ address: Address; data: Market }>> {
  try {
    // Use getProgramAccounts to fetch all accounts owned by the program
    // that match the Market discriminator
    const response = await rpc
      .getProgramAccounts(PREDICTION_MARKET_PROGRAM_ADDRESS, {
        encoding: "base64",
        filters: [
          {
            memcmp: {
              offset: BigInt(0),
              bytes: Buffer.from(MARKET_DISCRIMINATOR).toString("base64") as any,
              encoding: "base64",
            },
          },
        ],
      })
      .send();

    // Fetch and decode each market account
    const markets = await Promise.all(
      response.map(async (account: any) => {
        const marketData = await fetchMarket(rpc, account.pubkey);
        return {
          address: account.pubkey,
          data: marketData.data,
        };
      })
    );

    return markets;
  } catch (error) {
    console.error("Error fetching markets:", error);
    return [];
  }
}
