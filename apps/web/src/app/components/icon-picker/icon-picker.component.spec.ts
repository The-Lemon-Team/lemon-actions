import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IconPickerComponent } from './icon-picker.component';
import { ICON_CATALOG, findIconItem, getIconLabel } from './icon-catalog';

describe('IconPickerComponent', () => {
  let component: IconPickerComponent;
  let fixture: ComponentFixture<IconPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconPickerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IconPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and have default values', () => {
    expect(component).toBeTruthy();
    expect(component.value).toBe('casino');
    expect(component.totalCount).toBeGreaterThan(100);
  });

  it('should correctly resolve icon label', () => {
    expect(component.getLabel('casino')).toBe('Настольная игра');
    expect(component.getLabel('local_pizza')).toBe('Пицца / Гастротур');
  });

  it('should filter icons by search query in Russian and English', () => {
    component.searchQuery.set('пицца');
    expect(component.filteredIcons().length).toBeGreaterThan(0);
    expect(component.filteredIcons().some((i) => i.name === 'local_pizza')).toBeTrue();

    component.searchQuery.set('karting');
    expect(component.filteredIcons().some((i) => i.name === 'sports_motorsports')).toBeTrue();
  });

  it('should filter icons by category', () => {
    component.selectedCategory.set('food');
    const foodIcons = component.filteredIcons();
    expect(foodIcons.length).toBeGreaterThan(5);
    expect(foodIcons.every((i) => i.category === 'food')).toBeTrue();
  });

  it('should open and close the visual browser dialog', () => {
    expect(component.isOpen()).toBeFalse();
    component.openPicker();
    expect(component.isOpen()).toBeTrue();
    component.closePicker();
    expect(component.isOpen()).toBeFalse();
  });

  it('should emit valueChange and iconSelected on selection', () => {
    spyOn(component.valueChange, 'emit');
    spyOn(component.iconSelected, 'emit');

    component.confirmSelection('local_pizza');

    expect(component.value).toBe('local_pizza');
    expect(component.valueChange.emit).toHaveBeenCalledWith('local_pizza');
    expect(component.iconSelected.emit).toHaveBeenCalledWith(jasmine.objectContaining({
      name: 'local_pizza',
      label: 'Пицца / Гастротур',
    }));
  });
});
