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
  getAddressEncoder,
  getBytesEncoder,
  getU32Encoder,
  getProgramDerivedAddress,
  AccountRole,
  type AccountMeta,
  type Address,
  type TransactionSigner,
} from "@solana/kit";

// Codama-generated instruction builders
import { getInitializeMarketInstructionAsync } from "@/generated/instructions/initializeMarket";
import { getCloseMarketInstruction } from "@/generated/instructions/closeMarket";
import { getClaimRewardsInstructionAsync } from "@/generated/instructions/claimRewards";
import { getCancelOrderInstructionAsync } from "@/generated/instructions/cancelOrder";
import { getPlaceOrderInstructionAsync } from "@/generated/instructions/placeOrder";
import { getMarketOrderInstructionAsync } from "@/generated/instructions/marketOrder";
import { getSplitTokensInstructionAsync } from "@/generated/instructions/splitTokens";
import { getMergeTokensInstruction } from "@/generated/instructions/mergeTokens";
import { getUpdateMetadataInstruction } from "@/generated/instructions/updateMetadata";
import { getClaimFundsInstructionAsync } from "@/generated/instructions/claimFunds";
import { getSetWinnerInstruction } from "@/generated/instructions/setWinner";
import {
  fetchMarket,
  fetchAllMaybeMarket,
  type Market,
  MARKET_DISCRIMINATOR,
} from "@/generated/accounts/market";
import { fetchMaybeOrderBook } from "@/generated/accounts/orderBook";
import { fetchMaybeUserStats, type UserStats } from "@/generated/accounts/userStats";
import { OrderSide, TokenType, WinningOutcome } from "@/generated/types";
import { PREDICTION_MARKET_TURBIN3_PROGRAM_ADDRESS } from "@/generated/programs";

// Shared RPC clients
import { rpc, rpcSubscriptions } from "./client";

// Pre-built sender for server-side initializeMarket calls
const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions,
});

// ── Shared constants & helpers ────────────────────────────────────────────────

export const PRICE_SCALE = 1_000_000; // 1 USDC = 1_000_000 micro-USDC

const TOKEN_PROGRAM  = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address;
const ATA_PROGRAM    = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" as Address;
const MARKET_SEED    = new Uint8Array([109,97,114,107,101,116]);              // "market"
const ORDERBOOK_SEED = new Uint8Array([111,114,100,101,114,98,111,111,107]);  // "orderbook"
const USER_STATS_SEED = new Uint8Array([117,115,101,114,95,115,116,97,116,115]); // "user_stats"

async function deriveATA(wallet: Address, mint: Address): Promise<Address> {
  const enc = getAddressEncoder();
  const [ata] = await getProgramDerivedAddress({
    programAddress: ATA_PROGRAM,
    seeds: [enc.encode(wallet), enc.encode(TOKEN_PROGRAM), enc.encode(mint)],
  });
  return ata;
}

async function resolveUserTokenAccount(wallet: Address, mint: Address): Promise<Address> {
  const tokenAccounts = await rpc
    .getTokenAccountsByOwner(wallet, { mint }, { encoding: "jsonParsed" })
    .send();

  if (tokenAccounts.value.length > 0) {
    return tokenAccounts.value[0].pubkey as Address;
  }

  return deriveATA(wallet, mint);
}

async function getMarketContext(marketId: number) {
  const [marketPda] = await getProgramDerivedAddress({
    programAddress: PREDICTION_MARKET_TURBIN3_PROGRAM_ADDRESS,
    seeds: [getBytesEncoder().encode(MARKET_SEED), getU32Encoder().encode(marketId)],
  });
  const [orderbookPda] = await getProgramDerivedAddress({
    programAddress: PREDICTION_MARKET_TURBIN3_PROGRAM_ADDRESS,
    seeds: [getBytesEncoder().encode(ORDERBOOK_SEED), getU32Encoder().encode(marketId)],
  });
  const { data } = await fetchMarket(rpc, marketPda);
  return { marketPda, orderbookPda, market: data };
}


async function deriveUserStatsPDA(marketId: number, userAddress: Address): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: PREDICTION_MARKET_TURBIN3_PROGRAM_ADDRESS,
    seeds: [
      getBytesEncoder().encode(USER_STATS_SEED),
      getU32Encoder().encode(marketId),
      getAddressEncoder().encode(userAddress),
    ],
  });
  return pda;
}

/**
 * Fetches the orderbook and derives writable UserStats PDAs for all unique
 * counterparties on the matching side.  These must be passed as remaining
 * accounts so the contract can credit the maker when a fill occurs.
 */
async function getCounterpartyRemainingAccounts(
  marketId: number,
  orderbookPda: Address,
  tokenType: "YES" | "NO",
  orderSide: "BUY" | "SELL",
  taker: Address,
  maxMatches = 10,
): Promise<AccountMeta<string>[]> {
  const maybeBook = await fetchMaybeOrderBook(rpc, orderbookPda);
  if (!maybeBook.exists) return [];

  const book = maybeBook.data;

  // For a BUY taker we scan sell orders; for a SELL taker we scan buy orders.
  const relevantOrders =
    tokenType === "YES"
      ? orderSide === "BUY" ? book.yesSellOrders : book.yesBuyOrders
      : orderSide === "BUY" ? book.noSellOrders  : book.noBuyOrders;

  const seen = new Set<string>();
  const counterparties: Address[] = [];
  const takerStr = taker as string;

  for (const order of relevantOrders) {
    if (counterparties.length >= maxMatches) break;
    const key = order.userKey as string;
    if (key === takerStr) continue;        // skip self (contract prevents self-trading)
    if (seen.has(key)) continue;           // already included
    seen.add(key);
    counterparties.push(order.userKey);
  }

  const pdas = await Promise.all(counterparties.map(addr => deriveUserStatsPDA(marketId, addr)));
  return pdas.map(address => ({ address, role: AccountRole.WRITABLE } as AccountMeta<string>));
}

// ── Place limit order ─────────────────────────────────────────────────────────

export interface PlaceOrderParams {
  userSigner: TransactionSigner; // real wallet signer — same instance used by send()
  marketId: number;
  tokenType: "YES" | "NO";   // which outcome token
  orderSide: "BUY" | "SELL"; // buy or sell that token
  quantity: bigint;          // outcome token base units (1 token = 1_000_000)
  price: bigint;             // micro-USDC  e.g. 50¢ → 500_000
}

export async function buildLimitOrderInstruction(params: PlaceOrderParams): Promise<unknown[]> {
  const { userSigner, marketId, tokenType, orderSide, quantity, price } = params;
  const walletAddress = userSigner.address;

  const { marketPda, orderbookPda, market } = await getMarketContext(marketId);

  const [userCollateral, remainingAccounts] = await Promise.all([
    resolveUserTokenAccount(walletAddress, market.collateralMint),
    getCounterpartyRemainingAccounts(marketId, orderbookPda, tokenType, orderSide, walletAddress),
  ]);

  // For BUY orders: outcome token ATAs must NOT be passed — they are Option<None> in the contract.
  // Passing a non-existent ATA address would cause Anchor to fail deserialization.
  // For SELL orders: only the relevant outcome ATA is needed (it must exist since user has tokens).
  let userOutcomeYes: Address | undefined;
  let userOutcomeNo: Address | undefined;
  if (orderSide === "SELL") {
    if (tokenType === "YES") {
      userOutcomeYes = await resolveUserTokenAccount(walletAddress, market.outcomeYesMint);
    } else {
      userOutcomeNo = await resolveUserTokenAccount(walletAddress, market.outcomeNoMint);
    }
  }

  const orderIx = await getPlaceOrderInstructionAsync({
    user:            userSigner,
    market:          marketPda,
    orderbook:       orderbookPda,
    collateralVault: market.collateralVault,
    userCollateral,
    ...(userOutcomeYes ? { userOutcomeYes } : {}),
    ...(userOutcomeNo  ? { userOutcomeNo  } : {}),
    yesEscrow:       market.yesEscrow,
    noEscrow:        market.noEscrow,
    marketId,
    side:            orderSide === "BUY" ? OrderSide.Buy : OrderSide.Sell,
    tokenType:       tokenType === "YES" ? TokenType.Yes : TokenType.No,
    quantity,
    price,
    maxIteration:    BigInt(10),
  });

  const finalOrderIx = remainingAccounts.length === 0
    ? orderIx
    : { ...orderIx, accounts: [...orderIx.accounts, ...remainingAccounts] };

  return [finalOrderIx];
}

// ── Split tokens (initialises userOutcomeYes + userOutcomeNo ATAs) ────────────

export interface SplitParams {
  userSigner: TransactionSigner;
  marketId: number;
  /** micro-USDC to split — minimum 1 just to initialise ATAs */
  amount: bigint;
}

export async function buildSplitInstruction(params: SplitParams) {
  const { userSigner, marketId, amount } = params;
  const walletAddress = userSigner.address;
  const { marketPda, market } = await getMarketContext(marketId);

  const userCollateral = await resolveUserTokenAccount(walletAddress, market.collateralMint);
  const userOutcomeYes = await deriveATA(walletAddress, market.outcomeYesMint);
  const userOutcomeNo  = await deriveATA(walletAddress, market.outcomeNoMint);

  return getSplitTokensInstructionAsync({
    market:          marketPda,
    user:            userSigner,
    userCollateral,
    collateralVault: market.collateralVault,
    outcomeYesMint:  market.outcomeYesMint,
    outcomeNoMint:   market.outcomeNoMint,
    userOutcomeYes,
    userOutcomeNo,
    marketId,
    amount,
  });
}

// ── Market order ──────────────────────────────────────────────────────────────

export interface MarketOrderParams {
  userSigner: TransactionSigner; // real wallet signer — same instance used by send()
  marketId: number;
  tokenType: "YES" | "NO";   // which outcome token
  orderSide: "BUY" | "SELL"; // buy or sell that token
  orderAmount: bigint;       // micro-USDC (buy) or micro-tokens (sell)
}

export async function buildMarketOrderInstruction(params: MarketOrderParams): Promise<unknown[]> {
  const { userSigner, marketId, tokenType, orderSide, orderAmount } = params;
  const walletAddress = userSigner.address;

  const { marketPda, orderbookPda, market } = await getMarketContext(marketId);

  const [userCollateral, remainingAccounts] = await Promise.all([
    resolveUserTokenAccount(walletAddress, market.collateralMint),
    getCounterpartyRemainingAccounts(marketId, orderbookPda, tokenType, orderSide, walletAddress),
  ]);

  // Market orders have init_if_needed on userOutcomeYes/No in the contract.
  // Let the async client auto-derive them from the mints — no need to resolve manually.
  const orderIx = await getMarketOrderInstructionAsync({
    user:            userSigner,
    market:          marketPda,
    orderbook:       orderbookPda,
    collateralVault: market.collateralVault,
    userCollateral,
    outcomeYesMint:  market.outcomeYesMint,
    outcomeNoMint:   market.outcomeNoMint,
    yesEscrow:       market.yesEscrow,
    noEscrow:        market.noEscrow,
    marketId,
    side:            orderSide === "BUY" ? OrderSide.Buy : OrderSide.Sell,
    tokenType:       tokenType === "YES" ? TokenType.Yes : TokenType.No,
    orderAmount,
    maxIteration:    BigInt(10),
  });

  const finalOrderIx = remainingAccounts.length === 0
    ? orderIx
    : { ...orderIx, accounts: [...orderIx.accounts, ...remainingAccounts] };

  return [finalOrderIx];
}

// ── Cancel order ─────────────────────────────────────────────────────────────

export interface CancelOrderParams {
  userSigner: TransactionSigner;
  marketId: number;
  orderId: bigint;
  // The order's side and token type — needed to pass the correct optional accounts.
  // BUY cancellations: neither outcome ATA needed (same as placing a BUY).
  // SELL cancellations: only the relevant outcome ATA needed (it already exists).
  orderSide: "BUY" | "SELL";
  tokenType: "YES" | "NO";
}

export async function buildCancelOrderInstruction(params: CancelOrderParams) {
  const { userSigner, marketId, orderId, orderSide, tokenType } = params;
  const walletAddress = userSigner.address;
  const { marketPda, orderbookPda, market } = await getMarketContext(marketId);

  const [userCollateral, userStatsPda] = await Promise.all([
    resolveUserTokenAccount(walletAddress, market.collateralMint),
    deriveUserStatsPDA(marketId, walletAddress),
  ]);

  // For SELL cancellations only: pass the relevant outcome ATA (it exists since user locked tokens).
  // For BUY cancellations: outcome ATAs are Option<None> in the contract — don't pass them.
  let userOutcomeYes: Address | undefined;
  let userOutcomeNo: Address | undefined;
  if (orderSide === "SELL") {
    if (tokenType === "YES") {
      userOutcomeYes = await resolveUserTokenAccount(walletAddress, market.outcomeYesMint);
    } else {
      userOutcomeNo = await resolveUserTokenAccount(walletAddress, market.outcomeNoMint);
    }
  }

  return getCancelOrderInstructionAsync({
    user:               userSigner,
    market:             marketPda,
    orderbook:          orderbookPda,
    collateralVault:    market.collateralVault,
    userCollateral,
    userStatsAccount:   userStatsPda,
    ...(userOutcomeYes ? { userOutcomeYes } : {}),
    ...(userOutcomeNo  ? { userOutcomeNo  } : {}),
    yesEscrow:          market.yesEscrow,
    noEscrow:           market.noEscrow,
    marketId,
    orderId,
  });
}

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

  metaDataUrl: string;
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
  params: InitializeMarketParams
): Promise<InitializeMarketResult> {
  const {
    authority,
    collateralMint,
    marketId,
    settlementDeadline,
    metaDataUrl,
  } = params;

  // ── Step 1: Build the instruction ──────────────────────────────────────────
  //
  // `getInitializeMarketInstructionAsync` is what Codama generated.
  // It is `async` because it needs to derive PDAs (which involves hashing).
  //
  // We only pass the things WE know. Everything else (PDAs, default programs)
  // is resolved by the generated function automatically.
  const instruction = await getInitializeMarketInstructionAsync({
    authority, // signer — will be set as writable + signer account meta
    collateralMint, // the mint address we provide
    marketId, // u32 — used to derive all PDAs
    settlementDeadline, // i64 as bigint
    metaDataUrl,
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
    (tx) => appendTransactionMessageInstruction(instruction, tx)
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
  try {
    await sendAndConfirmTransaction(
      signedTransaction as Parameters<typeof sendAndConfirmTransaction>[0],
      {
        commitment: "confirmed",
      }
    );
  } catch (error: any) {
    // Enhanced error logging for debugging
    console.error("❌ Transaction failed:");
    console.error("Error:", error);
    console.error("Error context:", error?.context);
    console.error("Cause:", error?.cause);
    
    // Log transaction parameters for debugging
    console.error("\nTransaction params:");
    console.error("- Market ID:", marketId);
    console.error("- Settlement Deadline:", new Date(Number(settlementDeadline) * 1000).toISOString());
    console.error("- Collateral Mint:", collateralMint);
    console.error("- Authority:", authority.address);
    
    throw error;
  }

  // ── Return the signature ──────────────────────────────────────────────────
  const signature = getSignatureFromTransaction(signedTransaction);

  return { signature };
}

// ── Merge tokens ──────────────────────────────────────────────────────────────

export interface MergeParams {
  userSigner: TransactionSigner;
  marketId: number;
  /** micro-USDC worth of paired YES+NO tokens to merge back into collateral */
  amount: bigint;
}

export async function buildMergeInstruction(params: MergeParams) {
  const { userSigner, marketId, amount } = params;
  const walletAddress = userSigner.address;
  const { marketPda, market } = await getMarketContext(marketId);

  const [userCollateral, userOutcomeYes, userOutcomeNo] = await Promise.all([
    resolveUserTokenAccount(walletAddress, market.collateralMint),
    resolveUserTokenAccount(walletAddress, market.outcomeYesMint),
    resolveUserTokenAccount(walletAddress, market.outcomeNoMint),
  ]);

  return getMergeTokensInstruction({
    market:          marketPda,
    user:            userSigner,
    userCollateral,
    collateralVault: market.collateralVault,
    outcomeYesMint:  market.outcomeYesMint,
    outcomeNoMint:   market.outcomeNoMint,
    userOutcomeYes,
    userOutcomeNo,
    marketId,
    amount,
  });
}

// ── Claim funds ───────────────────────────────────────────────────────────────

export interface ClaimFundsParams {
  userSigner: TransactionSigner;
  marketId: number;
}

export async function buildClaimFundsInstruction(params: ClaimFundsParams) {
  const { userSigner, marketId } = params;
  const { marketPda, market } = await getMarketContext(marketId);

  return getClaimFundsInstructionAsync({
    user:            userSigner,
    market:          marketPda,
    collateralMint:  market.collateralMint,
    outcomeYesMint:  market.outcomeYesMint,
    outcomeNoMint:   market.outcomeNoMint,
    collateralVault: market.collateralVault,
    yesEscrow:       market.yesEscrow,
    noEscrow:        market.noEscrow,
    marketId,
  });
}

// ── Set winner ────────────────────────────────────────────────────────────────

export interface SetWinnerParams {
  userSigner: TransactionSigner;
  marketId: number;
  outcome: "YES" | "NO" | "NEITHER";
}

export async function buildSetWinnerInstruction(params: SetWinnerParams) {
  const { userSigner, marketId, outcome } = params;
  const { marketPda, market } = await getMarketContext(marketId);
  const winningOutcome =
    outcome === "YES" ? WinningOutcome.OutcomeA :
    outcome === "NO"  ? WinningOutcome.OutcomeB :
                        WinningOutcome.Neither;
  return getSetWinnerInstruction({
    authority:      userSigner,
    market:         marketPda,
    outcomeYesMint: market.outcomeYesMint,
    outcomeNoMint:  market.outcomeNoMint,
    marketId,
    winningOutcome,
  });
}

// ── Close market ──────────────────────────────────────────────────────────────

export interface CloseMarketParams {
  userSigner: TransactionSigner;
  marketId: number;
}

export async function buildCloseMarketInstruction(params: CloseMarketParams) {
  const { userSigner, marketId } = params;
  const { marketPda, orderbookPda } = await getMarketContext(marketId);
  return getCloseMarketInstruction({
    authority: userSigner,
    market:    marketPda,
    orderbook: orderbookPda,
    marketId,
  });
}

// ── Claim rewards ─────────────────────────────────────────────────────────────

export interface ClaimRewardsParams {
  userSigner: TransactionSigner;
  marketId: number;
}

export async function buildClaimRewardsInstruction(params: ClaimRewardsParams) {
  const { userSigner, marketId } = params;
  const walletAddress = userSigner.address;
  const { marketPda, market } = await getMarketContext(marketId);

  const [userOutcomeYes, userOutcomeNo] = await Promise.all([
    resolveUserTokenAccount(walletAddress, market.outcomeYesMint),
    resolveUserTokenAccount(walletAddress, market.outcomeNoMint),
  ]);

  return getClaimRewardsInstructionAsync({
    user:            userSigner,
    market:          marketPda,
    collateralMint:  market.collateralMint,
    collateralVault: market.collateralVault,
    outcomeYesMint:  market.outcomeYesMint,
    outcomeNoMint:   market.outcomeNoMint,
    userOutcomeYes,
    userOutcomeNo,
    marketId,
  });
}

// ── Fetch UserStats ───────────────────────────────────────────────────────────

export { type UserStats };

export async function getUserStats(
  marketId: number,
  userAddress: Address,
): Promise<UserStats | null> {
  const pda = await deriveUserStatsPDA(marketId, userAddress);
  const maybeAccount = await fetchMaybeUserStats(rpc, pda);
  return maybeAccount.exists ? maybeAccount.data : null;
}

// ── Update metadata ───────────────────────────────────────────────────────────

export interface UpdateMetadataParams {
  userSigner: TransactionSigner;
  marketId: number;
  newMetadataUrl: string;
}

export async function buildUpdateMetadataInstruction(params: UpdateMetadataParams) {
  const { userSigner, marketId, newMetadataUrl } = params;
  const { marketPda } = await getMarketContext(marketId);
  return getUpdateMetadataInstruction({
    authority: userSigner,
    market:    marketPda,
    marketId,
    newMetadataUrl,
  });
}

// ── getAllMarkets ─────────────────────────────────────────────────────────────

/**
 * Fetches all market accounts from the blockchain.
 *
 * Two-step process:
 *   1. Use getProgramAccounts to DISCOVER all market addresses (with discriminator filter)
 *   2. Use fetchAllMaybeMarket to FETCH all markets in a single batched call
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
export async function getAllMarkets(): Promise<
  Array<{ address: Address; data: Market }>
> {
  try {
    // ── Step 1: Discover all market addresses ───────────────────────────────
    // getProgramAccounts finds ALL accounts owned by our program
    // that start with the Market discriminator (first 8 bytes)
    const response = await rpc
      .getProgramAccounts(PREDICTION_MARKET_TURBIN3_PROGRAM_ADDRESS, {
        encoding: "base64",
        filters: [
          {
            memcmp: {
              offset: BigInt(0),
              bytes: Buffer.from(MARKET_DISCRIMINATOR).toString(
                "base64"
              ) as any,
              encoding: "base64",
            },
          },
        ],
      })
      .send();

    // Extract just the addresses
    const addresses = response.map((account: any) => account.pubkey);

    if (addresses.length === 0) {
      return [];
    }

    // ── Step 2: Fetch all markets in one batched call ──────────────────────
    // fetchAllMaybeMarket sends a SINGLE RPC call (getMultipleAccounts)
    // instead of N individual calls. Much more efficient!
    const marketAccounts = await fetchAllMaybeMarket(rpc, addresses);

    // Filter out any null accounts and map to our return format
    const markets = marketAccounts
      .map((maybeAccount, index) => {
        if (!maybeAccount.exists) return null;
        return {
          address: addresses[index],
          data: maybeAccount.data,
        };
      })
      .filter((m): m is { address: Address; data: Market } => m !== null);

    return markets;
  } catch (error) {
    console.error("Error fetching markets:", error);
    return [];
  }
}
