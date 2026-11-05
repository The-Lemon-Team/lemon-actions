import { FlowStatus, FlowType } from '@prisma/client';

export interface SeedProfile {
  handle: string;
  displayName: string;
  avatarIcon: string;
}

export interface SeedFolder {
  name: string;
  path: string;
}

export interface SeedFlow {
  name: string;
  description: string;
  type: FlowType;
  status: FlowStatus;
  isExclusive: boolean;
  folder: string;
  tags: string[];
  config?: Record<string, unknown>;
  orchestratorRules?: Record<string, unknown>;
}
