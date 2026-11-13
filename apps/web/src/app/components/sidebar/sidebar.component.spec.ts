import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SidebarComponent } from './sidebar.component';
import { TagWithCount } from '../../core/models/flow.models';
import { I18nService } from '../../core/i18n/i18n.service';

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let component: SidebarComponent;

  const mockTags: TagWithCount[] = [
    { id: 't1', name: 'billing', flowCount: 15, isSelected: false },
    { id: 't2', name: 'webhook', flowCount: 12, isSelected: false },
    { id: 't3', name: 'auth', flowCount: 10, isSelected: false },
    { id: 't4', name: 'deploy', flowCount: 9, isSelected: false },
    { id: 't5', name: 'database', flowCount: 8, isSelected: false },
    { id: 't6', name: 'cron', flowCount: 7, isSelected: false },
    { id: 't7', name: 'api', flowCount: 6, isSelected: false },
    { id: 't8', name: 'frontend', flowCount: 5, isSelected: false },
    { id: 't9', name: 'backend', flowCount: 4, isSelected: false },
    { id: 't10', name: 'notifications', flowCount: 3, isSelected: true },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [I18nService],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    component.tags = mockTags;
    fixture.detectChanges();
  });

  it('should create the sidebar component', () => {
    expect(component).toBeTruthy();
  });

  it('should identify the selectedTag', () => {
    expect(component.selectedTag?.name).toBe('notifications');
  });

  it('should pin the selectedTag first in stripTags', () => {
    const strip = component.stripTags;
    expect(strip[0].name).toBe('notifications');
    expect(strip.length).toBe(mockTags.length);
  });

  it('should limit gridTags to limit when not showAll and search is empty', () => {
    component.showAll = false;
    component.searchQuery = '';
    const grid = component.gridTags;
    expect(grid.length).toBe(component.limit);
    // Must include the selected tag even if its rank was beyond the limit
    expect(grid.some((t) => t.name === 'notifications')).toBeTrue();
  });

  it('should show all tags when showAll is true', () => {
    component.showAll = true;
    expect(component.gridTags.length).toBe(mockTags.length);
  });

  it('should filter gridTags by searchQuery', () => {
    component.searchQuery = 'bill';
    const grid = component.gridTags;
    expect(grid.length).toBe(1);
    expect(grid[0].name).toBe('billing');
  });

  it('should toggle isCollapsed state', () => {
    expect(component.isCollapsed).toBeFalse();
    component.toggleCollapse();
    expect(component.isCollapsed).toBeTrue();
    component.toggleCollapse();
    expect(component.isCollapsed).toBeFalse();
  });

  it('should toggle mobile view mode (strip vs grid)', () => {
    expect(component.isMobileGrid).toBeFalse();
    component.toggleMobileViewMode();
    expect(component.isMobileGrid).toBeTrue();
    component.toggleMobileViewMode();
    expect(component.isMobileGrid).toBeFalse();
  });

  it('should emit tagSelect and tagClear when clearFilter is called', () => {
    spyOn(component.tagSelect, 'emit');
    spyOn(component.tagClear, 'emit');

    component.clearFilter();

    expect(component.tagSelect.emit).toHaveBeenCalledWith('notifications');
    expect(component.tagClear.emit).toHaveBeenCalled();
  });

  it('should reset search query when clearSearch is called', () => {
    component.searchQuery = 'test';
    component.clearSearch();
    expect(component.searchQuery).toBe('');
  });
});
