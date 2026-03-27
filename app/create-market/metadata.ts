/**
 * Market metadata type + builder.
 * Shared between the client (page.tsx) and server (actions.ts).
 *
 * Follows the Metaplex Token Metadata JSON standard.
 */

export interface MarketMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string }>;
  properties: {
    files: Array<{ type: string; uri: string }>;
    creators: Array<unknown>;
  };
}

/** Build the Metaplex-compatible metadata object from form inputs. */
export function buildMarketMetadata(params: {
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  resolutionCriteria: string;
  resolutionSource: string;
  settlementDeadline: number;
}): MarketMetadata {
  const { name, description, imageUrl, category, resolutionCriteria, resolutionSource, settlementDeadline } = params;

  return {
    name,
    symbol: 'STANX',
    description,
    image: imageUrl,
    attributes: [
      { trait_type: 'Category', value: category },
      { trait_type: 'Resolution Criteria', value: resolutionCriteria },
      ...(resolutionSource ? [{ trait_type: 'Resolution Source', value: resolutionSource }] : []),
      { trait_type: 'Settlement Deadline', value: String(settlementDeadline) },
      { trait_type: 'Created At', value: String(Math.floor(Date.now() / 1000)) },
    ],
    properties: {
      files: imageUrl ? [{ type: 'image/png', uri: imageUrl }] : [],
      creators: [],
    },
  };
}
