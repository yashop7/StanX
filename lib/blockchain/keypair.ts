/**
 * Keypair utilities for server-side signing.
 * 
 * SECURITY WARNING: Never expose private keys in client-side code.
 * This should only be used in server actions or API routes.
 */

import { createKeyPairSignerFromBytes } from "@solana/kit";
import type { TransactionSigner } from "@solana/kit";

/**
 * Creates a transaction signer from a keypair byte array.
 * 
 * @param keypairBytes - Uint8Array of 64 bytes (secret key)
 * @returns TransactionSigner that can sign transactions
 * 
 * @example
 * ```ts
 * const keypair = new Uint8Array([0, 61, 26, ...]);
 * const signer = await createSignerFromKeypair(keypair);
 * ```
 */
export async function createSignerFromKeypair(
  keypairBytes: Uint8Array
): Promise<TransactionSigner> {
  return await createKeyPairSignerFromBytes(keypairBytes);
}

/**
 * Loads the authority keypair from environment variable.
 * 
 * Expects KEYPAIR env var to be a JSON array of numbers like:
 * KEYPAIR=[0,61,26,5,141,...]
 * 
 * @returns TransactionSigner for the authority wallet
 */
export async function getAuthorityFromEnv(): Promise<TransactionSigner> {
  const keypairEnv = process.env.KEYPAIR;
  
  if (!keypairEnv) {
    throw new Error("KEYPAIR environment variable not set");
  }

  try {
    const keypairArray = JSON.parse(keypairEnv) as number[];
    const keypairBytes = new Uint8Array(keypairArray);
    
    if (keypairBytes.length !== 64) {
      throw new Error(`Invalid keypair length: expected 64 bytes, got ${keypairBytes.length}`);
    }

    return await createSignerFromKeypair(keypairBytes);
  } catch (error) {
    throw new Error(`Failed to parse KEYPAIR from env: ${error}`);
  }
}
