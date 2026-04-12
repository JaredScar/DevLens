import { TestBed } from '@angular/core/testing';
import { NotesService } from './notes.service';
import { PersistedStateService } from './persisted-state.service';
import { WorkspaceService } from './workspace.service';
import { signal } from '@angular/core';
import type { NoteDTO } from '@dev-lens/shared';

describe('NotesService', () => {
  let service: NotesService;
  let persistedSpy: jasmine.SpyObj<PersistedStateService>;
  let workspaceMock: { activeWorkspaceId: ReturnType<typeof signal> };

  const mockNote: NoteDTO = {
    id: 'note-1',
    title: 'Test Note',
    body: 'Test body',
    url: 'https://example.com',
    workspaceId: 'ws-1',
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    persistedSpy = jasmine.createSpyObj('PersistedStateService', ['patch'], {
      snapshot: signal({ notes: [mockNote] }),
    });

    workspaceMock = {
      activeWorkspaceId: signal('ws-1'),
    };

    TestBed.configureTestingModule({
      providers: [
        NotesService,
        { provide: PersistedStateService, useValue: persistedSpy },
        { provide: WorkspaceService, useValue: workspaceMock },
      ],
    });

    service = TestBed.inject(NotesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('notes computed', () => {
    it('should filter notes by active workspace', () => {
      const notes = service.notes();
      expect(notes.length).toBe(1);
      expect(notes[0].id).toBe('note-1');
    });

    it('should return empty array when no notes match workspace', () => {
      workspaceMock.activeWorkspaceId.set('different-ws');
      const notes = service.notes();
      expect(notes.length).toBe(0);
    });
  });

  describe('upsert', () => {
    it('should add new note', async () => {
      const newNote = {
        id: 'note-2',
        title: 'New Note',
        body: 'New body',
        url: '',
      };

      await service.upsert(newNote);

      expect(persistedSpy.patch).toHaveBeenCalled();
      const patchArg = persistedSpy.patch.calls.mostRecent().args[0] as { notes: NoteDTO[] };
      expect(patchArg.notes.length).toBe(2);
      expect(patchArg.notes.some((n) => n.id === 'note-2')).toBe(true);
    });

    it('should update existing note', async () => {
      const updatedNote = {
        id: 'note-1',
        title: 'Updated Title',
        body: 'Updated body',
        url: 'https://example.com',
      };

      await service.upsert(updatedNote);

      expect(persistedSpy.patch).toHaveBeenCalled();
      const patchArg = persistedSpy.patch.calls.mostRecent().args[0] as { notes: NoteDTO[] };
      const note = patchArg.notes.find((n) => n.id === 'note-1');
      expect(note?.title).toBe('Updated Title');
      expect(note?.body).toBe('Updated body');
    });

    it('should use current workspace id when not provided', async () => {
      const newNote = {
        id: 'note-3',
        title: 'Note without workspace',
        body: 'Body',
      };

      await service.upsert(newNote);

      const patchArg = persistedSpy.patch.calls.mostRecent().args[0] as { notes: NoteDTO[] };
      const note = patchArg.notes.find((n) => n.id === 'note-3');
      expect(note?.workspaceId).toBe('ws-1');
    });
  });

  describe('remove', () => {
    it('should remove note by id', async () => {
      await service.remove('note-1');

      expect(persistedSpy.patch).toHaveBeenCalled();
      const patchArg = persistedSpy.patch.calls.mostRecent().args[0] as { notes: NoteDTO[] };
      expect(patchArg.notes.length).toBe(0);
      expect(patchArg.notes.some((n) => n.id === 'note-1')).toBe(false);
    });
  });

  describe('requestFocusNote', () => {
    it('should set highlightNoteId', () => {
      expect(service.highlightNoteId()).toBeNull();
      service.requestFocusNote('note-1');
      expect(service.highlightNoteId()).toBe('note-1');
    });

    it('should clear highlightNoteId when null passed', () => {
      service.requestFocusNote('note-1');
      expect(service.highlightNoteId()).toBe('note-1');
      service.requestFocusNote(null);
      expect(service.highlightNoteId()).toBeNull();
    });
  });
});
