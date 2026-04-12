import { TestBed } from '@angular/core/testing';
import { WorkspaceService } from './workspace.service';
import { PersistedStateService } from './persisted-state.service';
import { signal } from '@angular/core';
import type { DevLensStoreSnapshot } from '@dev-lens/shared';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let persistedSpy: jasmine.SpyObj<PersistedStateService>;

  const mockWorkspaces = [
    { id: 'ws-1', name: 'Personal', color: '#4a90d9' },
    { id: 'ws-2', name: 'Work', color: '#e74c3c' },
  ];

  beforeEach(() => {
    persistedSpy = jasmine.createSpyObj('PersistedStateService', ['patch'], {
      snapshot: signal<DevLensStoreSnapshot | null>({
        workspaces: mockWorkspaces,
        activeWorkspaceId: 'ws-1',
      } as unknown as DevLensStoreSnapshot),
    });

    TestBed.configureTestingModule({
      providers: [WorkspaceService, { provide: PersistedStateService, useValue: persistedSpy }],
    });

    service = TestBed.inject(WorkspaceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('workspaces computed', () => {
    it('should return workspaces from snapshot', () => {
      const workspaces = service.workspaces();
      expect(workspaces.length).toBe(2);
      expect(workspaces[0].name).toBe('Personal');
      expect(workspaces[1].name).toBe('Work');
    });

    it('should return empty array when snapshot is null', () => {
      persistedSpy.snapshot.set(null);
      const workspaces = service.workspaces();
      expect(workspaces.length).toBe(0);
    });
  });

  describe('activeWorkspaceId computed', () => {
    it('should return active workspace id from snapshot', () => {
      const id = service.activeWorkspaceId();
      expect(id).toBe('ws-1');
    });

    it('should return default id when snapshot is null', () => {
      persistedSpy.snapshot.set(null);
      const id = service.activeWorkspaceId();
      expect(id).toBe('ws-default');
    });
  });

  describe('setActiveWorkspace', () => {
    it('should call patch with activeWorkspaceId', async () => {
      await service.setActiveWorkspace('ws-2');

      expect(persistedSpy.patch).toHaveBeenCalledWith({
        activeWorkspaceId: 'ws-2',
      });
    });
  });

  describe('createWorkspace', () => {
    it('should create new workspace and set it as active', async () => {
      await service.createWorkspace('New Project', '#2ecc71');

      expect(persistedSpy.patch).toHaveBeenCalled();
      const patchArg = persistedSpy.patch.calls.mostRecent().args[0] as {
        workspaces: { id: string; name: string; color: string }[];
        activeWorkspaceId: string;
      };

      expect(patchArg.workspaces.length).toBe(3);
      expect(patchArg.workspaces[2].name).toBe('New Project');
      expect(patchArg.workspaces[2].color).toBe('#2ecc71');
      expect(patchArg.workspaces[2].id).toBeTruthy(); // UUID generated
      expect(patchArg.activeWorkspaceId).toBe(patchArg.workspaces[2].id);
    });
  });
});
