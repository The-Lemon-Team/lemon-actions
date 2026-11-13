import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TagCloudComponent } from './tag-cloud.component';
import { TagWithCount } from '../../core/models/flow.models';

describe('TagCloudComponent', () => {
  let fixture: ComponentFixture<TagCloudComponent>;
  let component: TagCloudComponent;

  const mockTags: TagWithCount[] = [
    { id: 't1', name: 'billing', flowCount: 5, isSelected: false },
    { id: 't2', name: 'webhook', flowCount: 12, isSelected: true },
    { id: 't3', name: 'auth', flowCount: 3, isSelected: false },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagCloudComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TagCloudComponent);
    component = fixture.componentInstance;
    component.tags = mockTags;
    fixture.detectChanges();
  });

  it('should create the tag cloud component', () => {
    expect(component).toBeTruthy();
  });

  it('should render all tags with names and counts', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('button');
    expect(buttons.length).toBe(3);
    expect(buttons[0].textContent).toContain('#billing');
    expect(buttons[0].textContent).toContain('5');
    expect(buttons[1].textContent).toContain('#webhook');
    expect(buttons[1].textContent).toContain('12');
  });

  it('should emit select event when a tag is clicked', () => {
    spyOn(component.select, 'emit');
    const compiled = fixture.nativeElement as HTMLElement;
    const firstButton = compiled.querySelector('button') as HTMLButtonElement;
    firstButton.click();

    expect(component.select.emit).toHaveBeenCalledWith('billing');
  });

  it('should apply selected styling and aria-pressed to the selected tag', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('button');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('should apply strip layout classes when layout is strip', () => {
    fixture.componentRef.setInput('layout', 'strip');
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('div');
    expect(container.classList.contains('flex-nowrap')).toBeTrue();
    expect(container.classList.contains('overflow-x-auto')).toBeTrue();
  });
});
