export type SupportedLocale = 'ru' | 'en';

export interface Translations {
  app: {
    title: string;
    version: string;
  };
  nav: {
    flows: string;
    triggers: string;
    telemetry: string;
    secrets: string;
    settings: string;
  };
  cluster: {
    status: string;
  };
  search: {
    buttonText: string;
    shortcut: string;
  };
  theme: {
    light: string;
    dark: string;
    switchToLight: string;
    switchToDark: string;
  };
  notifications: {
    ariaLabel: string;
  };
  language: {
    ariaLabel: string;
    toggleTitle: string;
    ru: string;
    en: string;
  };
  sidebar: {
    channelsActive: string;
    mutexLockedEngaged: string;
    systemGuardClear: string;
    lockedBadge: string;
    readyBadge: string;
    exclusiveLockDesc: string;
    dependentRulesDesc: string;
    noConflictsDesc: string;
    taxonomyFilters: string;
    tagsCount: string;
  };
  folderTree: {
    collapse: string;
    expand: string;
  };
  dashboard: {
    home: string;
    createFlowChannel: string;
    searchPlaceholder: string;
    refreshTitle: string;
  };
  commandRibbon: {
    title: string;
    newFolder: string;
    allFlows: string;
    subDomainsOf: string;
    allIn: string;
    toggleSubfolders: string;
    newFolderPlaceholder: string;
    rootNoParent: string;
    inFolder: string;
    saveFolder: string;
    cancel: string;
  };
  metrics: {
    registered: string;
    flowsCount: string;
    executing: string;
    activeCount: string;
    paused: string;
    pausedCount: string;
    standby: string;
    idleCount: string;
  };
  table: {
    selectAllAria: string;
    colFlow: string;
    colArchitecture: string;
    colTelemetry: string;
    colTaxonomy: string;
    colPower: string;
    emptyMessage: string;
    activeView: string;
    legendRunning: string;
    legendPaused: string;
    legendStandby: string;
    pageSize: string;
    all: string;
    firstPageAria: string;
    prevPageAria: string;
    nextPageAria: string;
    lastPageAria: string;
    pageOf: string;
    selectedCount: string;
  };
  row: {
    selectFlow: string;
    exclusiveMutexTooltip: string;
    exclusiveLockBadge: string;
    lockEngaged: string;
    cycleSeconds: string;
    stream: string;
    switchOn: string;
    switchOff: string;
    deactivateFlow: string;
    activateFlow: string;
    clickToPause: string;
    clickToActivate: string;
    manageRules: string;
  };
  flowTypes: {
    MUTEX: string;
    FSM: string;
    TIMER: string;
    OBSERVER: string;
    CONTEXT: string;
  };
  flowStatuses: {
    ACTIVE: string;
    PROCESSING: string;
    PAUSED: string;
    INACTIVE: string;
  };
  fsm: {
    idle: string;
    focusing: string;
    break: string;
    startFocus: string;
    takeBreak: string;
    stop: string;
    resume: string;
  };
  createModal: {
    title: string;
    subtitle: string;
    closeAria: string;
    nameLabel: string;
    namePlaceholder: string;
    descLabel: string;
    descPlaceholder: string;
    archTypeLabel: string;
    types: {
      mutex: { label: string; desc: string };
      fsm: { label: string; desc: string };
      timer: { label: string; desc: string };
      observer: { label: string; desc: string };
      context: { label: string; desc: string };
    };
    folderLabel: string;
    rootOption: string;
    tagsLabel: string;
    tagsPlaceholder: string;
    exclusiveTitle: string;
    exclusiveDesc: string;
    onConflictLabel: string;
    onConflictReject: string;
    onConflictPause: string;
    timerIntervalLabel: string;
    fsmTemplateLabel: string;
    fsmTemplateHint: string;
    fsmTemplates: {
      deepWork: string;
      approval: string;
      operational: string;
    };
    cancel: string;
    creating: string;
    submit: string;
  };
  standardFolders: Record<string, string>;
  standardFlows: Record<string, { name: string; description: string }>;
  errors: {
    fsmUpdateFailed: string;
    statusUpdateFailed: string;
    folderCreateFailed: string;
    createFlowFailed: string;
    deleteFlowFailed: string;
  };
}
