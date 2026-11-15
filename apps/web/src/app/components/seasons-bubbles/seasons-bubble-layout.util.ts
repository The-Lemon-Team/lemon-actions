import { SeasonsFeedNodeView, SeasonsStreamNodeView } from '../../core/models/seasons.models';

export interface PositionedFeedBubble {
  feed: SeasonsFeedNodeView;
  /** Offset in % relative to parent stream bubble box (0..100). */
  relXPercent: number;
  relYPercent: number;
  sizePx: number;
  delayMs: number;
}

export interface PositionedStreamBubble {
  stream: SeasonsStreamNodeView;
  feeds: SeasonsFeedNodeView[];
  innerFeeds: PositionedFeedBubble[];
  /** Center X in container percentage (12..88). */
  xPercent: number;
  /** Center Y in container percentage (16..84). */
  yPercent: number;
  diameterPx: number;
  floatDelaySec: number;
  floatDurationSec: number;
}

const DEFAULT_PALETTE = [
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#ef4444',
  '#84cc16',
];

export function resolveBubbleAccent(color: string | null | undefined, index: number): string {
  if (color && /^#[0-9a-fA-F]{3,8}$/.test(color.trim())) {
    return color.trim();
  }
  return DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
}

export function resolveStreamFeeds(
  stream: SeasonsStreamNodeView,
  allFeeds: SeasonsFeedNodeView[],
): SeasonsFeedNodeView[] {
  const tabSlugs = new Set(
    (stream.tabs || [])
      .filter((t) => t.type === 'feed' && !t.isHidden)
      .map((t) => t.slug.toLowerCase()),
  );

  const matched = allFeeds.filter(
    (f) =>
      f.streamSlugs.some((s) => s.toLowerCase() === stream.slug.toLowerCase()) ||
      tabSlugs.has(f.slug.toLowerCase()),
  );

  if (matched.length > 0) {
    return matched;
  }

  // Fallback to stream tabs when feed summary list omits empty feeds
  return (stream.tabs || [])
    .filter((t) => t.type === 'feed' && !t.isHidden)
    .map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.label,
      icon: t.icon,
      privacy: stream.privacy,
      totalNotes: t.count,
      publishedNotes: t.count,
      stagingNotes: 0,
      streamSlugs: [stream.slug],
    }));
}

/**
 * Computes non-overlapping floating bubble positions for all Streams inside a 2D container,
 * and positions each Stream's inner Feed bubbles in radial rings inside the expanded Stream bubble.
 */
export function computeStreamBubblesLayout(
  streams: SeasonsStreamNodeView[],
  allFeeds: SeasonsFeedNodeView[],
  selectedStreamSlug: string | null,
): PositionedStreamBubble[] {
  if (!streams.length) return [];

  const count = streams.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.35)));
  const rows = Math.max(1, Math.ceil(count / cols));

  // Initial deterministic grid + golden-angle jitter
  const nodes = streams.map((stream, index) => {
    const feeds = resolveStreamFeeds(stream, allFeeds);
    const isSelected = stream.slug === selectedStreamSlug;
    const weight = Math.log10(Math.max(1, stream.totalNotes) + 1) * 26 + Math.min(feeds.length, 8) * 6;
    const baseDiameter = Math.round(Math.min(190, Math.max(114, 106 + weight)));
    const diameterPx = isSelected ? Math.max(310, baseDiameter + 140) : baseDiameter;

    const col = index % cols;
    const row = Math.floor(index / cols);
    const cellW = 76 / cols;
    const cellH = 68 / rows;
    const jitterX = Math.sin(index * 2.399) * (cellW * 0.16);
    const jitterY = Math.cos(index * 2.399) * (cellH * 0.14);

    return {
      stream,
      feeds,
      x: 12 + cellW * (col + 0.5) + jitterX,
      y: 16 + cellH * (row + 0.5) + jitterY,
      diameterPx,
      isSelected,
      index,
    };
  });

  // Gentle repulsion pass in normalized 1000x620 virtual box so bubbles stay separated
  const width = 1000;
  const height = 620;
  for (let iter = 0; iter < 18; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const ax = (a.x / 100) * width;
        const ay = (a.y / 100) * height;
        const bx = (b.x / 100) * width;
        const by = (b.y / 100) * height;

        let dx = bx - ax;
        let dy = by - ay;
        let dist = Math.hypot(dx, dy);
        if (dist < 1) {
          dx = 1;
          dy = 0.5;
          dist = 1.12;
        }
        const minDist = (a.diameterPx + b.diameterPx) * 0.52 + 18;
        if (dist < minDist) {
          const push = ((minDist - dist) / dist) * 0.45;
          const moveX = (dx * push * 100) / width;
          const moveY = (dy * push * 100) / height;
          if (!a.isSelected) {
            a.x -= moveX;
            a.y -= moveY;
          }
          if (!b.isSelected) {
            b.x += moveX;
            b.y += moveY;
          }
        }
      }
      // Keep inside container bounds
      const padX = Math.min(22, (nodes[i].diameterPx / width) * 55 + 6);
      const padY = Math.min(28, (nodes[i].diameterPx / height) * 55 + 8);
      nodes[i].x = Math.min(100 - padX, Math.max(padX, nodes[i].x));
      nodes[i].y = Math.min(100 - padY, Math.max(padY, nodes[i].y));
    }
  }

  return nodes.map((n) => ({
    stream: n.stream,
    feeds: n.feeds,
    innerFeeds: computeInnerFeedBubbles(n.feeds, n.diameterPx),
    xPercent: Number(n.x.toFixed(2)),
    yPercent: Number(n.y.toFixed(2)),
    diameterPx: n.diameterPx,
    floatDelaySec: Number(((n.index * 0.65) % 4).toFixed(2)),
    floatDurationSec: Number((6.2 + (n.index % 4) * 0.9).toFixed(2)),
  }));
}

function computeInnerFeedBubbles(
  feeds: SeasonsFeedNodeView[],
  parentDiameterPx: number,
): PositionedFeedBubble[] {
  if (!feeds.length) return [];

  const count = feeds.length;
  const maxInnerSize = count > 8 ? 58 : count > 4 ? 68 : 78;
  const minInnerSize = count > 8 ? 44 : 52;

  return feeds.map((feed, idx) => {
    const sizePx = Math.round(
      Math.min(maxInnerSize, Math.max(minInnerSize, minInnerSize + Math.log10(feed.totalNotes + 1) * 14)),
    );

    if (count === 1) {
      return { feed, relXPercent: 50, relYPercent: 54, sizePx, delayMs: 40 };
    }

    // Arrange feeds in 1 or 2 concentric rings inside the expanded parent bubble
    const innerRingCapacity = count <= 6 ? count : 6;
    const isOuterRing = idx >= innerRingCapacity;
    const ringCount = isOuterRing ? count - innerRingCapacity : innerRingCapacity;
    const ringIndex = isOuterRing ? idx - innerRingCapacity : idx;
    const radiusPct = count <= 3 ? 23 : isOuterRing ? 34 : count > 6 ? 19 : 27;
    const angleOffset = isOuterRing ? Math.PI / Math.max(1, ringCount) : -Math.PI / 2;
    const angle = angleOffset + (ringIndex / Math.max(1, ringCount)) * Math.PI * 2;

    const usableSpan = Math.max(0.75, 1 - sizePx / Math.max(200, parentDiameterPx));
    const rx = 50 + Math.cos(angle) * radiusPct * usableSpan;
    const ry = 54 + Math.sin(angle) * radiusPct * usableSpan;

    return {
      feed,
      relXPercent: Number(rx.toFixed(2)),
      relYPercent: Number(ry.toFixed(2)),
      sizePx,
      delayMs: Math.min(280, idx * 35),
    };
  });
}
