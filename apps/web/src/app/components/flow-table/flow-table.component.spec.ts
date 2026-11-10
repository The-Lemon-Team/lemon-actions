import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FlowTableComponent } from './flow-table.component';
import { Flow, FlowRowState, FlowStatus, FlowType } from '../../core/models/flow.models';
import { I18nService } from '../../core/i18n/i18n.service';

describe('FlowTableComponent', () => {
  let component: FlowTableComponent;
  let fixture: ComponentFixture<FlowTableComponent>;

  const createMockRow = (id: string, name: string): FlowRowState => {
    const flow: Flow = {
      id,
      name,
      description: `Description ${id}`,
      type: FlowType.MUTEX,
      status: FlowStatus.ACTIVE,
      isExclusive: false,
      folderId: null,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return {
      flow,
      flow$: of(flow),
      status$: of(FlowStatus.ACTIVE),
      isActive$: of(true),
      currentDuration$: of(10),
    };
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlowTableComponent],
      providers: [I18nService],
    }).compileComponents();

    fixture = TestBed.createComponent(FlowTableComponent);
    component = fixture.componentInstance;
  });

  it('should initialize with default page size and calculate total pages correctly', () => {
    const rows = Array.from({ length: 25 }, (_, i) => createMockRow(`flow-${i + 1}`, `Flow ${i + 1}`));
    component.setPageSize(10);
    component.rows = rows;
    fixture.detectChanges();

    expect(component.totalPages()).toBe(3);
    expect(component.paginatedRows().length).toBe(10);
    expect(component.startIndex()).toBe(1);
    expect(component.endIndex()).toBe(10);
    expect(component.activeViewCurrent()).toBe('1-10');
  });

  it('should navigate between pages accurately', () => {
    const rows = Array.from({ length: 25 }, (_, i) => createMockRow(`flow-${i + 1}`, `Flow ${i + 1}`));
    component.setPageSize(10);
    component.rows = rows;

    component.nextPage();
    expect(component.currentPage()).toBe(2);
    expect(component.paginatedRows().length).toBe(10);
    expect(component.activeViewCurrent()).toBe('11-20');

    component.lastPage();
    expect(component.currentPage()).toBe(3);
    expect(component.paginatedRows().length).toBe(5);
    expect(component.activeViewCurrent()).toBe('21-25');

    component.firstPage();
    expect(component.currentPage()).toBe(1);
    expect(component.activeViewCurrent()).toBe('1-10');
  });

  it('should support "All" mode when pageSize is 0', () => {
    const rows = Array.from({ length: 25 }, (_, i) => createMockRow(`flow-${i + 1}`, `Flow ${i + 1}`));
    component.rows = rows;
    component.setPageSize(0);

    expect(component.totalPages()).toBe(1);
    expect(component.paginatedRows().length).toBe(25);
    expect(component.activeViewCurrent()).toBe('1-25');
  });

  it('should manage row selection and select-all per page', () => {
    const rows = Array.from({ length: 5 }, (_, i) => createMockRow(`flow-${i + 1}`, `Flow ${i + 1}`));
    component.setPageSize(10);
    component.rows = rows;

    expect(component.isAllPageSelected()).toBe(false);

    component.toggleSelectAllPage(true);
    expect(component.isAllPageSelected()).toBe(true);
    expect(component.selectedCount()).toBe(5);

    component.toggleSelectRow('flow-1', false);
    expect(component.isAllPageSelected()).toBe(false);
    expect(component.isSomePageSelected()).toBe(true);
    expect(component.selectedCount()).toBe(4);
  });
});
