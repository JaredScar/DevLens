import { TestBed } from '@angular/core/testing';
import { SplitViewService } from './split-view.service';
import { FeatureFlagsService } from './feature-flags.service';
import { signal } from '@angular/core';
import type { UiTab, TabsService } from './tabs.service';

describe('SplitViewService', () => {
  let service: SplitViewService;
  let featuresMock: { flags: ReturnType<typeof signal> };
  let tabsMock: {
    visibleTabs: ReturnType<typeof signal<UiTab[]>>;
    activeTabId: ReturnType<typeof signal<string>>;
    activeTab: ReturnType<typeof signal<UiTab | null>>;
  };

  beforeEach(() => {
    featuresMock = {
      flags: signal({ splitView: true }),
    };

    tabsMock = {
      visibleTabs: signal<UiTab[]>([
        {
          id: 'tab-1',
          workspaceId: 'ws-1',
          kind: 'browser',
          title: 'Tab 1',
          url: 'https://example.com',
        },
        {
          id: 'tab-2',
          workspaceId: 'ws-1',
          kind: 'browser',
          title: 'Tab 2',
          url: 'https://test.com',
        },
      ]),
      activeTabId: signal('tab-1'),
      activeTab: signal<UiTab | null>({
        id: 'tab-1',
        workspaceId: 'ws-1',
        kind: 'browser',
        title: 'Tab 1',
        url: 'https://example.com',
      }),
    };

    TestBed.configureTestingModule({
      providers: [SplitViewService, { provide: FeatureFlagsService, useValue: featuresMock }],
    });

    service = TestBed.inject(SplitViewService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have enabled as false initially', () => {
      expect(service.enabled()).toBe(false);
    });

    it('should have primaryRatio as 0.5 initially', () => {
      expect(service.primaryRatio()).toBe(0.5);
    });

    it('should have secondaryTabId as null initially', () => {
      expect(service.secondaryTabId()).toBeNull();
    });
  });

  describe('attemptToggle', () => {
    it('should enable split view with second tab as secondary', () => {
      service.attemptToggle(tabsMock as unknown as TabsService);

      expect(service.enabled()).toBe(true);
      expect(service.secondaryTabId()).toBe('tab-2');
    });

    it('should disable split view when already enabled', () => {
      service.attemptToggle(tabsMock as unknown as TabsService);
      expect(service.enabled()).toBe(true);

      service.attemptToggle(tabsMock as unknown as TabsService);
      expect(service.enabled()).toBe(false);
      expect(service.secondaryTabId()).toBeNull();
    });

    it('should not enable when fewer than 2 browser tabs', () => {
      tabsMock.visibleTabs.set([
        {
          id: 'tab-1',
          workspaceId: 'ws-1',
          kind: 'browser',
          title: 'Tab 1',
          url: 'https://example.com',
        },
      ]);

      service.attemptToggle(tabsMock as unknown as TabsService);
      expect(service.enabled()).toBe(false);
    });

    it('should not enable when splitView feature is disabled', () => {
      featuresMock.flags.set({ splitView: false });
      service.attemptToggle(tabsMock as unknown as TabsService);
      expect(service.enabled()).toBe(false);
    });
  });

  describe('setRatio', () => {
    it('should set primary ratio', () => {
      service.setRatio(0.7);
      expect(service.primaryRatio()).toBe(0.7);
    });

    it('should clamp ratio to minimum 0.15', () => {
      service.setRatio(0.05);
      expect(service.primaryRatio()).toBe(0.15);
    });

    it('should clamp ratio to maximum 0.85', () => {
      service.setRatio(0.95);
      expect(service.primaryRatio()).toBe(0.85);
    });
  });

  describe('reconcile', () => {
    beforeEach(() => {
      service.attemptToggle(tabsMock as unknown as TabsService);
      expect(service.enabled()).toBe(true);
    });

    it('should disable split when fewer than 2 browser tabs', () => {
      tabsMock.visibleTabs.set([
        {
          id: 'tab-1',
          workspaceId: 'ws-1',
          kind: 'browser',
          title: 'Tab 1',
          url: 'https://example.com',
        },
      ]);

      service.reconcile(tabsMock as unknown as TabsService);
      expect(service.enabled()).toBe(false);
      expect(service.secondaryTabId()).toBeNull();
    });

    it('should keep enabled when secondary tab exists and is not active', () => {
      service.reconcile(tabsMock as unknown as TabsService);
      expect(service.enabled()).toBe(true);
      expect(service.secondaryTabId()).toBe('tab-2');
    });
  });
});
