import type { Meta, StoryObj } from '@storybook/angular';
import { FormsModule } from '@angular/forms';

// Create a simple notes widget wrapper for Storybook
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notes-widget-story',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="notes-widget"
      style="
      width: 320px;
      height: 500px;
      background: var(--dl-bg-surface, #161b22);
      border: 1px solid var(--dl-border, #30363d);
      border-radius: 8px;
      padding: 16px;
      color: var(--dl-text, #e6edf3);
      font-family: system-ui, -apple-system, sans-serif;
    "
    >
      <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Notes</h3>

      <textarea
        placeholder="Write a note..."
        style="
          width: 100%;
          height: 80px;
          background: var(--dl-bg-base, #0d1117);
          border: 1px solid var(--dl-border, #30363d);
          border-radius: 6px;
          padding: 8px;
          color: inherit;
          font: inherit;
          resize: none;
          margin-bottom: 12px;
        "
      ></textarea>

      <button
        style="
        width: 100%;
        padding: 8px 16px;
        background: var(--dl-accent, #58a6ff);
        color: #000;
        border: none;
        border-radius: 6px;
        font: inherit;
        font-weight: 500;
        cursor: pointer;
        margin-bottom: 16px;
      "
      >
        Add Note
      </button>

      <div class="note-list" style="display: flex; flex-direction: column; gap: 8px;">
        <div
          class="note-card"
          style="
          background: var(--dl-bg-elevated, #21262d);
          border-radius: 6px;
          padding: 12px;
          border-left: 3px solid var(--dl-accent, #58a6ff);
        "
        >
          <div style="font-weight: 500; font-size: 13px; margin-bottom: 4px;">Project Ideas</div>
          <div style="font-size: 12px; color: var(--dl-muted, #8b949e); line-height: 1.4;">
            Build a browser with workspaces and dev tools integration...
          </div>
          <div
            style="font-size: 11px; color: var(--dl-muted, #8b949e); margin-top: 8px; display: flex; justify-content: space-between;"
          >
            <span>https://github.com/dev-lens</span>
            <span>2 hours ago</span>
          </div>
        </div>

        <div
          class="note-card"
          style="
          background: var(--dl-bg-elevated, #21262d);
          border-radius: 6px;
          padding: 12px;
          border-left: 3px solid #3fb950;
        "
        >
          <div style="font-weight: 500; font-size: 13px; margin-bottom: 4px;">API Endpoints</div>
          <div
            style="font-size: 12px; color: var(--dl-muted, #8b949e); line-height: 1.4; font-family: monospace;"
          >
            GET /api/v1/tabs<br />
            POST /api/v1/sessions
          </div>
          <div style="font-size: 11px; color: var(--dl-muted, #8b949e); margin-top: 8px;">
            Yesterday
          </div>
        </div>
      </div>
    </div>
  `,
})
class NotesWidgetStoryComponent {}

const meta: Meta<NotesWidgetStoryComponent> = {
  title: 'Widgets/Notes',
  component: NotesWidgetStoryComponent,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0d1117' },
        { name: 'light', value: '#f6f8fa' },
      ],
    },
  },
};

export default meta;

type Story = StoryObj<NotesWidgetStoryComponent>;

export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story:
          'Notes widget showing a compose textarea and existing note cards with title, preview, URL link, and timestamp.',
      },
    },
  },
};
