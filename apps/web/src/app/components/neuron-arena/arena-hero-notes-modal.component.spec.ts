import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArenaActorCard, CloudDayNote } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ProfileService } from '../../core/services/profile.service';
import { ArenaHeroNotesModalComponent } from './arena-hero-notes-modal.component';

describe('ArenaHeroNotesModalComponent', () => {
  let component: ArenaHeroNotesModalComponent;
  let fixture: ComponentFixture<ArenaHeroNotesModalComponent>;
  let arena: NeuronArenaService;
  let profile: ProfileService;

  const mockActor: ArenaActorCard = {
    id: 'actor-alexey',
    handle: 'alexey_bathrobe',
    flowId: 'flow-actor-alexey',
    name: 'Алексей (в халате)',
    title: 'Архитектор Уюта',
    category: 'HUMAN',
    categoryLabel: 'Главный Герой',
    avatarIcon: 'alexey',
    accentColor: 'rose',
    rankLabel: 'Голос Дома',
    quote: 'Халат надет, чай заварен.',
    paradoxPhilosophy: 'Уют превыше суеты.',
    favoriteDesire: 'Чай с мятой',
    affinities: ['Уют', 'Чай'],
    traits: { charisma: 90, analytical: 80, rebelVersus: 60 },
    voicePitch: 1.0,
    voiceRate: 1.0,
    sampleVoices: { support: 'Отлично!', counter: 'Не уверен', paradox: 'А может чай?' },
    isLead: true,
    voicesCount: 5,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArenaHeroNotesModalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ArenaHeroNotesModalComponent);
    component = fixture.componentInstance;
    arena = TestBed.inject(NeuronArenaService);
    profile = TestBed.inject(ProfileService);
    component.actor = mockActor;
    component.isOpen = true;
    fixture.detectChanges();
  });

  it('should create the hero notes modal component', () => {
    expect(component).toBeTruthy();
  });

  it('should submit note through arena.addHeroNote with selected visibility and pins', () => {
    spyOn(arena, 'addHeroNote').and.callThrough();

    component.newNoteText = 'Секретный тактический план для Алексея';
    component.newNoteType.set('action');
    component.newNoteVisibility.set('PRIVATE');
    component.newNotePinToHero = true;
    component.newNotePinToCloud = true;

    component.submitNote();

    expect(arena.addHeroNote).toHaveBeenCalledWith(
      jasmine.objectContaining({
        actorId: 'actor-alexey',
        text: 'Секретный тактический план для Алексея',
        type: 'action',
        visibility: 'PRIVATE',
        isPinnedToHero: true,
        isPinnedToCloud: true,
      }),
    );

    // Form should reset
    expect(component.newNoteText).toBe('');
    expect(component.newNoteVisibility()).toBe('PUBLIC');
  });

  it('should adopt note to private when adoptToPrivate is called', () => {
    spyOn(arena, 'adoptNoteToPrivate').and.callThrough();
    component.adoptToPrivate('note-today-6');
    expect(arena.adoptNoteToPrivate).toHaveBeenCalledWith('note-today-6');
  });

  it('should filter notes correctly across tabs (ALL, PINNED, PRIVATE, PUBLIC)', () => {
    const sampleNotes: CloudDayNote[] = [
      {
        id: 'n1',
        dateKey: '2026-11-06',
        time: '10:00',
        timeMinutes: 600,
        type: 'thought',
        actorId: 'actor-alexey',
        actorName: 'Алексей',
        actorAvatar: 'alexey',
        actorAccent: 'rose',
        text: 'Публичная закрепленная',
        supporters: [],
        votesCount: 0,
        createdAt: '2026-11-06T10:00:00Z',
        visibility: 'PUBLIC',
        isPinnedToHero: true,
      },
      {
        id: 'n2',
        dateKey: '2026-11-06',
        time: '11:00',
        timeMinutes: 660,
        type: 'action',
        actorId: 'actor-alexey',
        actorName: 'Алексей',
        actorAvatar: 'alexey',
        actorAccent: 'rose',
        text: 'Личная приватная',
        supporters: [],
        votesCount: 0,
        createdAt: '2026-11-06T11:00:00Z',
        visibility: 'PRIVATE',
        isPinnedToHero: false,
      },
      {
        id: 'n3',
        dateKey: '2026-11-06',
        time: '12:00',
        timeMinutes: 720,
        type: 'thought',
        actorId: 'actor-alexey',
        actorName: 'Алексей',
        actorAvatar: 'alexey',
        actorAccent: 'rose',
        text: 'Архаичный лор мастера',
        supporters: [],
        votesCount: 0,
        createdAt: '2026-11-06T12:00:00Z',
        visibility: 'GM_ONLY',
        isPinnedToHero: true,
      },
    ];

    component.activeTab.set('ALL');
    expect(component.filterNotes(sampleNotes).length).toBe(3);

    component.activeTab.set('PINNED');
    expect(component.filterNotes(sampleNotes).length).toBe(2);

    component.activeTab.set('PRIVATE');
    expect(component.filterNotes(sampleNotes).length).toBe(1);
    expect(component.filterNotes(sampleNotes)[0].id).toBe('n2');

    component.activeTab.set('PUBLIC');
    expect(component.filterNotes(sampleNotes).length).toBe(1);
    expect(component.filterNotes(sampleNotes)[0].id).toBe('n1');

    component.activeTab.set('GM_ONLY');
    expect(component.filterNotes(sampleNotes).length).toBe(1);
    expect(component.filterNotes(sampleNotes)[0].id).toBe('n3');
  });

  it('should emit close on dismiss and reset form fields', () => {
    spyOn(component.close, 'emit');
    component.newNoteText = 'Несохраненный черновик';
    component.onDismiss();

    expect(component.close.emit).toHaveBeenCalled();
    expect(component.newNoteText).toBe('');
  });
});
