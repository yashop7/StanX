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

export type VideoMetric = 'views' | 'likes' | 'comments';

// Human-readable labels for each metri
export const METRIC_LABELS: Record<VideoMetric, string> = {
  views: 'Views',
  likes: 'Likes',
  comments: 'Comments',
};

// YouTube Data API field names for each metri
export const METRIC_API_FIELDS: Record<VideoMetric, string> = {
  views: 'viewCount',
  likes: 'likeCount',
  comments: 'commentCount',
};

// Build the Metaplex-compatible metadata object from form inputs
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

// Build metadata specifically for a YouTube video prediction market
export function buildVideoMarketMetadata(params: {
  videoId: string;
  videoTitle: string;
  channelName: string;
  thumbnailUrl: string;
  metric: VideoMetric;
  target: number;
  currentValue: number;
  settlementDeadline: number;
}): MarketMetadata {
  const { videoId, videoTitle, channelName, thumbnailUrl, metric, target, currentValue, settlementDeadline } = params;

  const metricLabel = METRIC_LABELS[metric];
  const formattedTarget = formatNumber(target);
  const name = `Will "${videoTitle}" reach ${formattedTarget} ${metricLabel.toLowerCase()}?`;
  const description = `Prediction market on whether the YouTube video "${videoTitle}" by ${channelName} will reach ${formattedTarget} ${metricLabel.toLowerCase()} by the settlement deadline. Current ${metricLabel.toLowerCase()}: ${formatNumber(currentValue)}.`;
  const resolutionCriteria = `This market resolves YES if the video's ${metricLabel.toLowerCase()} count reaches or exceeds ${formattedTarget} by the settlement deadline, as reported by the YouTube Data API. Otherwise it resolves NO.`;

  return {
    name,
    symbol: 'STANX',
    description,
    image: thumbnailUrl,
    attributes: [
      { trait_type: 'Category', value: 'Entertainment' },
      { trait_type: 'Resolution Criteria', value: resolutionCriteria },
      { trait_type: 'Resolution Source', value: 'YouTube Data API v3' },
      { trait_type: 'Settlement Deadline', value: String(settlementDeadline) },
      { trait_type: 'Created At', value: String(Math.floor(Date.now() / 1000)) },
      { trait_type: 'Video ID', value: videoId },
      { trait_type: 'Video URL', value: `https://www.youtube.com/watch?v=${videoId}` },
      { trait_type: 'Channel', value: channelName },
      { trait_type: 'Metric', value: METRIC_API_FIELDS[metric] },
      { trait_type: 'Target', value: String(target) },
      { trait_type: 'Baseline Value', value: String(currentValue) },
    ],
    properties: {
      files: [{ type: 'image/jpeg', uri: thumbnailUrl }],
      creators: [],
    },
  };
}

// Format a number with K/M/B suffixes for display
export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
}
