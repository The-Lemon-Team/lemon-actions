export interface HomeActivityItem {
  id: string;
  flowId: string;
  flowName: string;
  eventType: 'RESTOCKED' | 'DEPLETED' | 'ROUTINE_DONE' | 'WIDGET_CREATED' | 'SPEC_CHANGED';
  note: string;
  createdAt: string;
  icon: string;
}

export interface CreateHomeWidgetInput {
  name: string;
  description?: string;
  kind: 'supply' | 'routine';
  room: string;
  icon: string;
  brand?: string;
  price?: string;
  note?: string;
  expectedDays?: number;
  unitHint?: string;
  currentQty?: number;
  maxQty?: number;
  unit?: string;
  step?: number;
  daysPerUnit?: number;
  scheduleDays?: number[];
  scheduleStart?: string;
  scheduleEnd?: string;
}

export interface RestockWithSpecInput {
  flowId: string;
  brand?: string;
  unitHint?: string;
  price?: string;
  expectedDays?: number;
  currentQty?: number;
  maxQty?: number;
  unit?: string;
  step?: number;
  note?: string;
}

export interface UpdateWidgetSpecInput {
  flowId: string;
  name?: string;
  brand?: string;
  unitHint?: string;
  price?: string;
  expectedDays?: number;
  currentQty?: number;
  maxQty?: number;
  unit?: string;
  step?: number;
  room?: string;
  note?: string;
}
