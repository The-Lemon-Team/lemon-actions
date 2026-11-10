import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { PartyRealtimeService } from '../../core/services/party-realtime.service';
import { PartyCloudComponent } from './party-cloud.component';

describe('PartyCloudComponent', () => {
  let component: PartyCloudComponent;
  let arena: NeuronArenaService;
  let realtime: PartyRealtimeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartyCloudComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PartyCloudComponent);
    component = fixture.componentInstance;
    arena = TestBed.inject(NeuronArenaService);
    realtime = TestBed.inject(PartyRealtimeService);
  });

  it('should create the party cloud component', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle between CLOUD_TIMELINE and DAY_FEED view modes', () => {
    expect(component.isCloudView()).toBeTrue();
    component.viewMode.set('DAY_FEED');
    expect(component.isFeedView()).toBeTrue();
    expect(component.isCloudView()).toBeFalse();

    // Backwards compatible aliases
    component.viewMode.set('ORBIT');
    expect(component.isCloudView()).toBeTrue();
    component.viewMode.set('CALENDAR_TIMELINE');
    expect(component.isFeedView()).toBeTrue();
  });

  it('should switch active filter layer and filter notes accordingly', () => {
    expect(component.activeLayer()).toBe('ALL');
    component.activeLayer.set('THOUGHTS');
    expect(component.activeLayer()).toBe('THOUGHTS');
    for (const note of component.visibleNotes()) {
      expect(note.type).toBe('thought');
    }

    component.activeLayer.set('PROPOSALS');
    for (const note of component.visibleNotes()) {
      expect(note.type).toBe('proposal');
    }

    component.activeLayer.set('ACTIONS');
    for (const note of component.visibleNotes()) {
      expect(note.type).toBe('action');
    }
  });

  it('should switch between dates and load date-attached notes', () => {
    expect(component.selectedDateKey()).toBe('2026-11-06');
    const todayNotes = component.activeDateNotes();
    expect(todayNotes.length).toBeGreaterThan(0);

    component.selectDate('2026-11-05');
    expect(component.selectedDateKey()).toBe('2026-11-05');
    const yesterdayNotes = component.activeDateNotes();
    expect(yesterdayNotes.length).toBeGreaterThan(0);
    expect(yesterdayNotes[0].dateKey).toBe('2026-11-05');
  });

  it('should add a new thought from the active character to the daily cloud timeline', () => {
    spyOn(realtime, 'broadcastEvent');

    let actors: any[] = [];
    arena.actors$.subscribe((a) => (actors = a)).unsubscribe();
    if (actors.length > 0) {
      component.selectPitchActor(actors[0]);
    }

    component.selectedActionType.set('thought');
    component.newNoteTime.set('15:45');
    component.newIdeaTitle.set('Пора заварить горный чай и обсудить идеи!');

    const countBefore = component.activeDateNotes().length;
    component.submitNoteOrIdea();

    expect(component.newIdeaTitle()).toBe('');
    expect(component.activeDateNotes().length).toBe(countBefore + 1);

    const added = component.activeDateNotes().find((n) => n.text.includes('горный чай'));
    expect(added).toBeTruthy();
    expect(added?.time).toBe('15:45');
    expect(added?.type).toBe('thought');
    expect(realtime.broadcastEvent).toHaveBeenCalledWith(
      jasmine.objectContaining({
        type: 'CARD_PLAYED',
      }),
    );
  });

  it('should vote for note and increment vote count and supporters', () => {
    spyOn(realtime, 'broadcastEvent');
    const note = component.activeDateNotes()[0];
    const votesBefore = note.votesCount;

    component.voteForNote(note.id);

    const updated = component.activeDateNotes().find((n) => n.id === note.id);
    expect(updated?.votesCount).toBe(votesBefore + 1);
    expect(realtime.broadcastEvent).toHaveBeenCalledWith(
      jasmine.objectContaining({
        type: 'VOTE_CAST',
      }),
    );
  });

  it('should delete a note from the active date', () => {
    const note = component.activeDateNotes()[0];
    const countBefore = component.activeDateNotes().length;

    component.deleteNote(note.id);
    expect(component.activeDateNotes().length).toBe(countBefore - 1);
  });

  it('should pitch a preset thought and add it to the cloud', () => {
    spyOn(realtime, 'broadcastEvent');
    const countBefore = component.activeDateNotes().length;
    const preset = component.thoughtPresets[0];

    component.pitchPreset(preset);

    expect(component.activeDateNotes().length).toBe(countBefore + 1);
    expect(realtime.broadcastEvent).toHaveBeenCalled();
  });

  it('should calculate tiered stem heights for candlestick columns', () => {
    expect(component.getNoteStemHeight(0)).toBe(40);
    expect(component.getNoteStemHeight(1)).toBe(155);
    expect(component.getNoteStemHeight(2)).toBe(270);
    expect(component.getNoteStemHeight(3)).toBe(40); // cycles back to tier 0
  });

  it('should return accent stem classes and glow classes matching theme', () => {
    expect(component.getAccentStemClasses('amber')).toContain('from-amber-500');
    expect(component.getAccentStemClasses('emerald')).toContain('from-emerald-500');
    expect(component.getAccentStemClasses('cyan')).toContain('from-cyan-500');

    expect(component.getAccentGlowClasses('amber')).toContain('bg-amber-500');
    expect(component.getAccentGlowClasses('rose')).toContain('bg-rose-500');
  });

  it('should partition thoughts into top and bottom lanes for alternating layout', () => {
    const top = component.getTopLaneNotes();
    const bottom = component.getBottomLaneNotes();
    const total = component.visibleNotes().length;

    expect(top.length + bottom.length).toBe(total);
  });

  it('should broadcast real-time event when scheduleActiveToSlot is called', () => {
    spyOn(realtime, 'broadcastEvent');
    const slot = component.timelineSlots[0];

    component.scheduleActiveToSlot(slot);

    expect(realtime.broadcastEvent).toHaveBeenCalled();
  });

  it('should open, reset and close create space modal cleanly', () => {
    expect(component.isCreateSpaceModalOpen()).toBeFalse();

    component.openCreateSpaceModal();
    expect(component.isCreateSpaceModalOpen()).toBeTrue();
    expect(component.newSpaceTitle()).toBeTruthy();

    component.closeCreateSpaceModal();
    expect(component.isCreateSpaceModalOpen()).toBeFalse();
    expect(component.newSpaceTitle()).toBe('');
    expect(component.newSpaceDescription()).toBe('');
  });

  it('should create a new party space from host and update activeSpaceTitle', () => {
    spyOn(realtime, 'createRoom').and.callThrough();

    component.newSpaceTitle.set('Логово Кота');
    component.newSpaceDescription.set('Вечер чилла');
    component.submitCreateSpace();

    expect(component.activeSpaceTitle()).toBe('Логово Кота');
    expect(realtime.createRoom).toHaveBeenCalled();
    expect(component.isCreateSpaceModalOpen()).toBeFalse();
  });

  it('should toggle character picker and allow choosing roleplay actor', () => {
    expect(component.isCharacterPickerOpen()).toBeFalse();
    component.toggleCharacterPicker();
    expect(component.isCharacterPickerOpen()).toBeTrue();

    let actors: any[] = [];
    arena.actors$.subscribe((a) => (actors = a)).unsubscribe();

    if (actors.length > 0) {
      component.selectPitchActor(actors[0]);
      expect(component.activePitchActor()?.id).toBe(actors[0].id);
      expect(component.isCharacterPickerOpen()).toBeFalse();
    }
  });

  it('should open and close inspect modal for a cloud note', () => {
    const note = component.activeDateNotes()[0];
    expect(component.inspectedNote()).toBeNull();

    component.inspectNote(note);
    expect(component.inspectedNote()).toEqual(note);

    component.closeInspectModal();
    expect(component.inspectedNote()).toBeNull();
    expect(component.inspectedActor()).toBeNull();
  });

  it('should select pitch actor from inspected note', () => {
    let actors: any[] = [];
    arena.actors$.subscribe((a) => (actors = a)).unsubscribe();
    if (actors.length > 0) {
      component.allActors.set(actors);
      const note = { ...component.activeDateNotes()[0], actorId: actors[0].id };
      component.inspectNote(note);

      component.selectPitchActorFromInspect();
      expect(component.activePitchActor()?.id).toBe(actors[0].id);
      expect(component.inspectedNote()).toBeNull();
    }
  });

  it('should delete note from inspect modal', () => {
    const countBefore = component.activeDateNotes().length;
    const note = component.activeDateNotes()[0];
    component.inspectNote(note);

    component.deleteInspectedNote();
    expect(component.activeDateNotes().length).toBe(countBefore - 1);
    expect(component.inspectedNote()).toBeNull();
  });

  it('should toggle and select day vibe and persist to storage', () => {
    expect(component.isVibePickerOpen()).toBeFalse();
    component.toggleVibePicker();
    expect(component.isVibePickerOpen()).toBeTrue();

    component.selectVibe('SYNTHWAVE');
    expect(component.selectedVibeId()).toBe('SYNTHWAVE');
    expect(component.currentVibe().name).toContain('Неоновый Космос');
    expect(component.isVibePickerOpen()).toBeFalse();

    component.closeVibePickerModal();
    expect(component.isVibePickerOpen()).toBeFalse();
  });

  it('should group notes within 30-minute threshold into a TimelineCluster', () => {
    const clusters = component.groupedTimelineNotes();
    expect(clusters.length).toBeGreaterThan(0);

    // Find the 15:58–16:15 cluster
    const cluster = clusters.find((c) => c.isCluster && c.notes.length >= 2);
    expect(cluster).toBeTruthy();
    expect(cluster!.notes.length).toBeGreaterThanOrEqual(2);
    expect(cluster!.isCluster).toBeTrue();
    expect(cluster!.timeSpanLabel).toBeDefined();

    // Notes in this cluster must all be within CLUSTER_GAP_MINUTES (30 min) of the cluster start
    const startMins = cluster!.notes[0].timeMinutes;
    for (const n of cluster!.notes) {
      expect(n.timeMinutes - startMins).toBeLessThanOrEqual(component.CLUSTER_GAP_MINUTES);
    }
  });

  it('should paginate through clustered notes with prev/next and direct index', () => {
    const clusters = component.groupedTimelineNotes();
    const cluster = clusters.find((c) => c.isCluster)!;
    expect(cluster).toBeTruthy();

    const clusterId = cluster.id;
    const total = cluster.notes.length;
    const fakeEvent = new MouseEvent('click');

    expect(component.getClusterActiveIndex(clusterId)).toBe(0);
    expect(component.getClusterActiveNote(cluster).id).toBe(cluster.notes[0].id);

    // Next note
    component.nextClusterNote(clusterId, total, fakeEvent);
    expect(component.getClusterActiveIndex(clusterId)).toBe(1);
    expect(component.getClusterActiveNote(cluster).id).toBe(cluster.notes[1].id);

    // Direct jump
    component.setClusterIndex(clusterId, total - 1, fakeEvent);
    expect(component.getClusterActiveIndex(clusterId)).toBe(total - 1);
    expect(component.getClusterActiveNote(cluster).id).toBe(cluster.notes[total - 1].id);

    // Previous note wraps around
    component.prevClusterNote(clusterId, total, fakeEvent);
    expect(component.getClusterActiveIndex(clusterId)).toBe(total - 2);
  });

  it('should navigate through cluster notes within the inspect modal', () => {
    const clusters = component.groupedTimelineNotes();
    const cluster = clusters.find((c) => c.isCluster)!;
    expect(cluster).toBeTruthy();

    // Inspect the first note of the cluster
    component.inspectNote(cluster.notes[0]);
    expect(component.inspectedNote()?.id).toBe(cluster.notes[0].id);

    const foundCluster = component.getInspectedNoteCluster();
    expect(foundCluster).toBeTruthy();
    expect(foundCluster?.id).toBe(cluster.id);
    expect(component.getInspectedNoteClusterIndex(foundCluster!)).toBe(0);

    // Next note in modal
    component.nextInspectedClusterNote(foundCluster!);
    expect(component.inspectedNote()?.id).toBe(cluster.notes[1].id);

    // Prev note in modal (back to first)
    component.prevInspectedClusterNote(foundCluster!);
    expect(component.inspectedNote()?.id).toBe(cluster.notes[0].id);
  });
});
