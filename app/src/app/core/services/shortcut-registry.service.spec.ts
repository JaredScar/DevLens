import {
  SHORTCUT_DEFAULTS,
  buildMergedShortcutBindings,
  describeShortcutConflicts,
  normalizeShortcutBinding,
} from './shortcut-registry.service';

describe('normalizeShortcutBinding', () => {
  it('normalizes modifier order and meta→ctrl', () => {
    expect(normalizeShortcutBinding('shift+ctrl+k')).toBe('ctrl+shift+k');
    expect(normalizeShortcutBinding('meta+shift+i')).toBe('ctrl+shift+i');
  });
});

describe('buildMergedShortcutBindings', () => {
  it('applies custom overrides', () => {
    const m = buildMergedShortcutBindings({ newTab: 'ctrl+shift+t' });
    expect(m['newTab']).toBe('ctrl+shift+t');
    expect(m['spotlight']).toBe(SHORTCUT_DEFAULTS['spotlight']);
  });
});

describe('describeShortcutConflicts', () => {
  it('detects duplicate combos', () => {
    const merged = { ...SHORTCUT_DEFAULTS, newTab: 'ctrl+k' };
    const lines = describeShortcutConflicts(merged);
    expect(lines.some((l) => l.includes('spotlight') && l.includes('newTab'))).toBe(true);
  });
});
