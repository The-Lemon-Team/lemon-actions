import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateFlowModalComponent } from './create-flow-modal.component';
import { FlowType } from '../../core/models/flow.models';

describe('CreateFlowModalComponent', () => {
  let component: CreateFlowModalComponent;
  let fixture: ComponentFixture<CreateFlowModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateFlowModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateFlowModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not submit if name is blank', () => {
    spyOn(component.submitFlow, 'emit');
    component.name = '   ';
    component.submit();
    expect(component.submitFlow.emit).not.toHaveBeenCalled();
  });

  it('should emit submitFlow with correct payload when valid', () => {
    spyOn(component.submitFlow, 'emit');
    component.name = 'New Ingestion Flow';
    component.description = 'Handles inbound records';
    component.selectedType = FlowType.TIMER;
    component.timerIntervalSeconds = 60;
    component.tagsString = 'records, ingest, timer';
    component.isExclusive = true;
    component.onConflict = 'pause';

    component.submit();

    expect(component.submitFlow.emit).toHaveBeenCalledWith(
      jasmine.objectContaining({
        name: 'New Ingestion Flow',
        description: 'Handles inbound records',
        type: FlowType.TIMER,
        isExclusive: true,
        tags: ['records', 'ingest', 'timer'],
        config: { intervalSeconds: 60 },
        orchestratorRules: { onConflict: 'pause' },
      }),
    );
  });

  it('should emit close on onEscape', () => {
    spyOn(component.close, 'emit');
    component.onEscape();
    expect(component.close.emit).toHaveBeenCalled();
  });
});
