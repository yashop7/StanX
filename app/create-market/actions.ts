'use server';

/**
 * Server actions — upload image & metadata to Arweave via Irys (UMI).
 *
 * Same pattern as nft_image.ts / nft_metadata.ts:
 *   umi + irysUploader + signerIdentity
 *
 * Setup:
 *   1. cat ~/.config/solana/id.json  →  copy the array
 *   2. .env.local:  IRYS_WALLET=[174,47,154,...,221]
 *   3. Make sure that wallet has devnet SOL (use faucet.solana.com)
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createGenericFile,
  createSignerFromKeypair,
  signerIdentity,
} from '@metaplex-foundation/umi';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';
import type { MarketMetadata } from './metadata';

function getUmi() {
  const walletJson = process.env.IRYS_WALLET;
  if (!walletJson) {
    throw new Error(
      'IRYS_WALLET not set in .env.local\n' +
        'Run:  cat ~/.config/solana/id.json\n' +
        'Then add to .env.local:  IRYS_WALLET=[the array you copied]',
    );
  }

  const umi = createUmi('https://api.devnet.solana.com');
  const secretKey = new Uint8Array(JSON.parse(walletJson));
  const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  const signer = createSignerFromKeypair(umi, keypair);

  umi.use(irysUploader({ address: 'https://devnet.irys.xyz/' }));
  umi.use(signerIdentity(signer));

  return umi;
}

/** Upload image to Arweave. Returns gateway URI (e.g. https://gateway.irys.xyz/...). */
export async function uploadImageAction(formData: FormData): Promise<string> {
  const file = formData.get('image') as File | null;
  if (!file) throw new Error('No image file provided');

  const umi = getUmi();
  const buffer = new Uint8Array(await file.arrayBuffer());
  const genericFile = createGenericFile(buffer, file.name, {
    contentType: file.type || 'image/png',
  });

  const [uri] = await umi.uploader.upload([genericFile]);
  console.log('[upload] Image URI:', uri);
  return uri;
}

/** Upload metadata JSON to Arweave. Returns gateway URI. */
export async function uploadMetadataAction(metadata: MarketMetadata): Promise<string> {
  const umi = getUmi();
  const uri = await umi.uploader.uploadJson(metadata);
  console.log('[upload] Metadata URI:', uri);
  return uri;
}
