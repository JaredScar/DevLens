import { TestBed } from '@angular/core/testing';
import { LayoutService } from './layout.service';
import { PersistedStateService } from './persisted-state.service';
import { FeatureFlagsService } from './feature-flags.service';
import { signal } from '@angular/core';
import type { DevLensStoreSnapshot } from '@dev-lens/shared';

describe('LayoutService', () => {
  let service: LayoutService;
  let persistedSpy: jasmine.SpyObj<PersistedStateService>;
  let featuresMock: { flags: ReturnType<typeof signal> };

  beforeEach(() => {
    persistedSpy = jasmine.createSpyObj('PersistedStateService', ['patch'], {
      snapshot: signal<DevLensStoreSnapshot | null>({
        settings: { rightSidebarWidthPx: 300 },
      } as unknown as DevLensStoreSnapshot),
    });

    featuresMock = {
      flags: signal({ rightSidebar: true }),
    };

    TestBed.configureTestingModule({
      providers: [
        LayoutService,
        { provide: PersistedStateService, useValue: persistedSpy },
        { provide: FeatureFlagsService, useValue: featuresMock },
      ],
    });

    service = TestBed.inject(LayoutService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('toggleLeftSidebar', () => {
    it('should toggle collapsed state', () => {
      expect(service.leftSidebarCollapsed()).toBe(false);

      service.toggleLeftSidebar();
      expect(service.leftSidebarCollapsed()).toBe(true);

      service.toggleLeftSidebar();
      expect(service.leftSidebarCollapsed()).toBe(false);
    });
  });

  describe('toggleRightSidebar', () => {
    it('should toggle right sidebar open state', () => {
      expect(service.rightSidebarOpen()).toBe(false);

      service.toggleRightSidebar();
      expect(service.rightSidebarOpen()).toBe(true);

      service.toggleRightSidebar();
      expect(service.rightSidebarOpen()).toBe(false);
    });
  });

  describe('openRightSidebar', () => {
    it('should set right sidebar to open', () => {
      service.openRightSidebar();
      expect(service.rightSidebarOpen()).toBe(true);
    });
  });

  describe('closeRightSidebar', () => {
    it('should set right sidebar to closed', () => {
      service.openRightSidebar();
      expect(service.rightSidebarOpen()).toBe(true);

      service.closeRightSidebar();
      expect(service.rightSidebarOpen()).toBe(false);
    });
  });

  describe('setRightSidebarWidthPx', () => {
    it('should set width within valid range', () => {
      service.setRightSidebarWidthPx(400);
      expect(service.rightSidebarWidthPx()).toBe(400);
    });

    it('should clamp width to minimum 200', () => {
      service.setRightSidebarWidthPx(100);
      expect(service.rightSidebarWidthPx()).toBe(200);
    });

    it('should clamp width to maximum 560', () => {
      service.setRightSidebarWidthPx(800);
      expect(service.rightSidebarWidthPx()).toBe(560);
    });
  });

  describe('effect: feature flag rightSidebar', () => {
    it('should close right sidebar when feature is disabled', () => {
      service.openRightSidebar();
      expect(service.rightSidebarOpen()).toBe(true);

      // Disable right sidebar feature
      featuresMock.flags.set({ rightSidebar: false });

      // Wait for effect to run (Angular change detection would handle this in component)
      TestBed.flushEffects();

      expect(service.rightSidebarOpen()).toBe(false);
    });
  });
});
