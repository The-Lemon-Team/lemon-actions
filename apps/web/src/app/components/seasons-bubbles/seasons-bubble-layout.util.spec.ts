import {
  computeStreamBubblesLayout,
  resolveStreamFeeds,
} from './seasons-bubble-layout.util';
import { SeasonsFeedNodeView, SeasonsStreamNodeView } from '../../core/models/seasons.models';

describe('seasons-bubble-layout.util', () => {
  const streams: SeasonsStreamNodeView[] = [
    {
      id: 's1',
      slug: 'projectarium',
      title: 'Projectarium',
      privacy: 'private',
      totalNotes: 12,
      tabs: [
        { id: 'f1', slug: 'projectarium-todos', label: 'Todos', type: 'feed', count: 5 },
        { id: 'f2', slug: 'projectarium-notes', label: 'Notes', type: 'feed', count: 7 },
      ],
    },
    {
      id: 's2',
      slug: 'it_dev',
      title: 'IT & Dev',
      privacy: 'public',
      totalNotes: 150,
      tabs: [{ id: 'f3', slug: 'habr', label: 'Habr', type: 'feed', count: 150 }],
    },
  ];

  const feeds: SeasonsFeedNodeView[] = [
    {
      id: 'f1',
      slug: 'projectarium-todos',
      title: 'Projectarium Todos',
      privacy: 'private',
      totalNotes: 5,
      publishedNotes: 5,
      stagingNotes: 0,
      streamSlugs: ['projectarium'],
    },
    {
      id: 'f2',
      slug: 'projectarium-notes',
      title: 'Projectarium Notes',
      privacy: 'private',
      totalNotes: 7,
      publishedNotes: 7,
      stagingNotes: 0,
      streamSlugs: ['projectarium'],
    },
    {
      id: 'f3',
      slug: 'habr',
      title: 'Habr',
      privacy: 'public',
      totalNotes: 150,
      publishedNotes: 150,
      stagingNotes: 0,
      streamSlugs: ['it_dev'],
    },
  ];

  it('should resolve inner feeds belonging to a stream', () => {
    const resolved = resolveStreamFeeds(streams[0], feeds);
    expect(resolved.length).toBe(2);
    expect(resolved.map((f) => f.slug)).toEqual(['projectarium-todos', 'projectarium-notes']);
  });

  it('should enlarge the selected stream bubble and position inner feed bubbles inside it', () => {
    const layout = computeStreamBubblesLayout(streams, feeds, 'projectarium');
    const selected = layout.find((b) => b.stream.slug === 'projectarium')!;
    const unselected = layout.find((b) => b.stream.slug === 'it_dev')!;

    expect(selected.diameterPx).toBeGreaterThan(unselected.diameterPx);
    expect(selected.innerFeeds.length).toBe(2);
    for (const inner of selected.innerFeeds) {
      expect(inner.relXPercent).toBeGreaterThan(10);
      expect(inner.relXPercent).toBeLessThan(90);
      expect(inner.relYPercent).toBeGreaterThan(10);
      expect(inner.relYPercent).toBeLessThan(90);
    }
  });
});
