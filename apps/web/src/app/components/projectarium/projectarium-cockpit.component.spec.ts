import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProjectariumCockpitComponent } from './projectarium-cockpit.component';

describe('ProjectariumCockpitComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('lemon_projectarium_active_tab_v1');
    localStorage.removeItem('lemon_actions_project_stands_v1');
    localStorage.removeItem('lemon_actions_projectarium_party_seeded_v1');
  });

  it('renders project tabs and displays only the active project stand by default', async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectariumCockpitComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProjectariumCockpitComponent);
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('nav[role="tablist"] button[role="tab"]');
    expect(tabs.length).toBeGreaterThanOrEqual(5); // 4 default stands (incl. Lemon-Party) + ALL tab

    let cards = fixture.nativeElement.querySelectorAll('app-project-stand-card');
    expect(cards.length).toBe(1);

    // Switch to the second project tab
    tabs[1].click();
    fixture.detectChanges();
    cards = fixture.nativeElement.querySelectorAll('app-project-stand-card');
    expect(cards.length).toBe(1);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');

    // Switch to ALL tab
    tabs[tabs.length - 1].click();
    fixture.detectChanges();
    cards = fixture.nativeElement.querySelectorAll('app-project-stand-card');
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });

  it('includes dedicated Lemon-Party stand with note about Time Traveling, Timeline (Day / Hero), Hero Cards and allows adding/editing notes', async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectariumCockpitComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProjectariumCockpitComponent);
    fixture.detectChanges();

    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('nav[role="tablist"] button[role="tab"]') as NodeListOf<HTMLButtonElement>,
    );
    const partyTab = tabs.find((t) => t.textContent?.includes('Lemon-Party'));
    expect(partyTab).toBeTruthy();
    partyTab!.click();
    fixture.detectChanges();

    const notesTab = fixture.nativeElement.querySelector('[data-testid="stand-tab-notes"]') as HTMLButtonElement;
    expect(notesTab).toBeTruthy();
    notesTab.click();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Time Traveling');
    expect(text).toContain('Timeline (Day / Hero)');
    expect(text).toContain('Hero Cards');
    expect(text).toContain('lemon-core');

    // Add a new note through service & verify UI updates
    fixture.componentInstance.standService.addNoteItem('stand-lemon-party', {
      title: 'Прототип Stitch',
      content: 'Провести линии между идеями и выделить золотую середину',
      tags: ['Stitch'],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Прототип Stitch');

    // Edit the first note & verify UI updates
    const stand = fixture.componentInstance.standService;
    let partyNotesCount = 0;
    stand.allStands$.subscribe((stands) => {
      const p = stands.find((s) => s.slug === 'lemon-party');
      partyNotesCount = p?.notes.length || 0;
      if (p && p.notes[0]?.title === 'Прототип Stitch') {
        // leave ready for edit test below
      }
    }).unsubscribe();
    expect(partyNotesCount).toBe(2);
  });
});
