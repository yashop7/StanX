import type { Metadata } from 'next';
import { fetchDisplayMarketById } from '@/lib/blockchain/markets';

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const marketId = parseInt(id, 10);

  if (isNaN(marketId)) {
    return { title: 'Market — Stanx' };
  }

  try {
    const market = await fetchDisplayMarketById(marketId);
    if (!market) return { title: 'Market not found — Stanx' };

    const title = market.question;
    const yesStr = (market.yesPrice * 100).toFixed(0);
    const noStr  = (market.noPrice  * 100).toFixed(0);

    // Build a rich description from what we know
    const parts: string[] = [];
    if (market.metric && market.target) {
      const metricLabel =
        market.metric === 'viewCount'    ? 'views' :
        market.metric === 'likeCount'    ? 'likes' :
        market.metric === 'commentCount' ? 'comments' :
        market.metric;
      const targetFmt = market.target >= 1_000_000_000
        ? `${(market.target / 1_000_000_000).toFixed(1)}B`
        : market.target >= 1_000_000
          ? `${(market.target / 1_000_000).toFixed(1)}M`
          : market.target >= 1_000
            ? `${(market.target / 1_000).toFixed(0)}K`
            : String(market.target);
      parts.push(`Target: ${targetFmt} ${metricLabel}`);
    }
    parts.push(`YES ${yesStr}¢ · NO ${noStr}¢`);
    if (market.channelName) parts.push(`by ${market.channelName}`);
    const deadline = market.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    parts.push(`Resolves ${deadline}`);

    const description = parts.join(' · ');

    // Use YouTube thumbnail if available, otherwise the stored image
    const ogImage = market.videoId
      ? `https://i.ytimg.com/vi/${market.videoId}/maxresdefault.jpg`
      : market.image;

    return {
      title: `${title} — Stanx`,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images: [{ url: ogImage, width: 1280, height: 720, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return { title: `Market #${marketId} — Stanx` };
  }
}

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
