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
import { fetchVideoPreview, fetchBackendMarkets, type VideoPreview } from '@/lib/api/backend';

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

/** Fetch YouTube video preview data via the backend. */
export async function previewVideoAction(url: string): Promise<VideoPreview> {
  return fetchVideoPreview(url);
}

/** Result returned by checkVideoMarketExistsAction */
export interface ExistingVideoMarket {
  marketId: number;
  question: string;
  metaDataUrl: string;
  status: 'Active' | 'Settled' | 'Closed';
}

/**
 * Check if a market already exists for a given YouTube video ID.
 * Fetches the list of backend markets, then reads each market's Arweave
 * metadata (with a per-fetch timeout) to look for the "Video ID" attribute.
 * Returns the first matching market, or null if none found.
 */
export async function checkVideoMarketExistsAction(
  videoId: string,
): Promise<ExistingVideoMarket | null> {
  let markets;
  try {
    markets = await fetchBackendMarkets();
  } catch {
    // Backend unreachable — can't check, allow creation to proceed
    return null;
  }

  // For each market, fetch metadata with a 5s timeout to avoid hanging
  const results = await Promise.allSettled(
    markets.map(async (m) => {
      if (!m.meta_data_url?.startsWith('http')) return null;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5_000);
        const res = await fetch(m.meta_data_url, {
          signal: controller.signal,
          next: { revalidate: 300 },
        });
        clearTimeout(timer);
        if (!res.ok) return null;
        const json = (await res.json()) as Record<string, unknown>;
        const attrs = Array.isArray(json.attributes)
          ? (json.attributes as Array<{ trait_type: string; value: string }>)
          : [];
        const attr = (key: string) => attrs.find(a => a.trait_type === key)?.value;
        const foundVideoId = attr('Video ID');
        if (!foundVideoId || foundVideoId !== videoId) return null;
        return {
          marketId: m.market_id,
          question: (json.name ?? json.title ?? json.question ?? `Market #${m.market_id}`) as string,
          metaDataUrl: m.meta_data_url,
          status: m.status,
        } satisfies ExistingVideoMarket;
      } catch {
        return null;
      }
    }),
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value !== null) return r.value;
  }
  return null;
}
