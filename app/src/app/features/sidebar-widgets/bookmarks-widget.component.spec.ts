import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookmarksWidgetComponent } from './bookmarks-widget.component';
import { FormsModule } from '@angular/forms';
import { PersistedStateService } from '@core/services/persisted-state.service';
import { TabsService } from '@core/services/tabs.service';
import { signal } from '@angular/core';
import type { BookmarkDTO } from '@dev-lens/shared';

describe('BookmarksWidgetComponent', () => {
  let component: BookmarksWidgetComponent;
  let fixture: ComponentFixture<BookmarksWidgetComponent>;
  let persistedServiceMock: { snapshot: ReturnType<typeof signal>; patch: jasmine.Spy };
  let tabsServiceMock: { addBrowserTab: jasmine.Spy };

  const mockBookmarks: BookmarkDTO[] = [
    { id: 'bm-1', title: 'Google', url: 'https://google.com' },
    { id: 'bm-2', title: 'GitHub', url: 'https://github.com' },
  ];

  beforeEach(async () => {
    persistedServiceMock = {
      snapshot: signal({ bookmarks: mockBookmarks }),
      patch: jasmine.createSpy('patch').and.returnValue(Promise.resolve()),
    };

    tabsServiceMock = {
      addBrowserTab: jasmine.createSpy('addBrowserTab').and.returnValue(Promise.resolve()),
    };

    await TestBed.configureTestingModule({
      imports: [BookmarksWidgetComponent, FormsModule],
      providers: [
        { provide: PersistedStateService, useValue: persistedServiceMock },
        { provide: TabsService, useValue: tabsServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BookmarksWidgetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display bookmarks from service', () => {
    const bookmarks = component.bookmarks();
    expect(bookmarks.length).toBe(2);
    expect(bookmarks[0].title).toBe('Google');
  });

  it('should call tabs.addBrowserTab when opening a bookmark', async () => {
    await component.open('https://google.com', 'Google');

    expect(tabsServiceMock.addBrowserTab).toHaveBeenCalledWith('https://google.com', 'Google');
  });

  it('should remove bookmark and call patch', async () => {
    await component.remove('bm-1');

    expect(persistedServiceMock.patch).toHaveBeenCalled();
    const patchArg = persistedServiceMock.patch.calls.mostRecent().args[0];
    expect(patchArg.bookmarks.length).toBe(1);
    expect(patchArg.bookmarks[0].id).toBe('bm-2');
  });

  it('should start editing bookmark', () => {
    const bookmark = mockBookmarks[0];
    component.startEdit(bookmark);

    expect(component.editingId()).toBe(bookmark.id);
    expect(component.editTitle()).toBe(bookmark.title);
    expect(component.editUrl()).toBe(bookmark.url);
  });

  it('should cancel editing and clear fields', () => {
    component.startEdit(mockBookmarks[0]);
    expect(component.editingId()).toBe('bm-1');

    component.cancelEdit();

    expect(component.editingId()).toBeNull();
    expect(component.editTitle()).toBe('');
    expect(component.editUrl()).toBe('');
  });

  it('should save edited bookmark', async () => {
    component.startEdit(mockBookmarks[0]);
    component.editTitle.set('Updated Google');
    component.editUrl.set('https://google.com/updated');

    await component.saveEdit();

    expect(persistedServiceMock.patch).toHaveBeenCalled();
    const patchArg = persistedServiceMock.patch.calls.mostRecent().args[0];
    const updated = patchArg.bookmarks.find((b: BookmarkDTO) => b.id === 'bm-1');
    expect(updated.title).toBe('Updated Google');
    expect(updated.url).toBe('https://google.com/updated');
  });

  it('should not save if URL is empty', async () => {
    component.startEdit(mockBookmarks[0]);
    component.editUrl.set('');

    await component.saveEdit();

    expect(persistedServiceMock.patch).not.toHaveBeenCalled();
  });

  it('should use default title if empty', async () => {
    component.startEdit(mockBookmarks[0]);
    component.editTitle.set('');
    component.editUrl.set('https://example.com');

    await component.saveEdit();

    const patchArg = persistedServiceMock.patch.calls.mostRecent().args[0];
    const updated = patchArg.bookmarks.find((b: BookmarkDTO) => b.id === 'bm-1');
    expect(updated.title).toBe('Bookmark');
  });
});
