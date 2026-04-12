import type { Meta, StoryObj } from '@storybook/angular';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-design-tokens',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="design-tokens" style="padding: 24px; max-width: 1200px;">
      <h2 style="margin-bottom: 32px;">Design Tokens</h2>

      <!-- Colors -->
      <section style="margin-bottom: 48px;">
        <h3
          style="font-size: 18px; margin-bottom: 16px; border-bottom: 1px solid var(--dl-border, #30363d); padding-bottom: 8px;"
        >
          Colors
        </h3>

        <div
          style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;"
        >
          <div class="token-card">
            <div
              style="height: 60px; background: var(--dl-bg-base, #0d1117); border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--dl-border, #30363d);"
            ></div>
            <div style="font-size: 12px; font-weight: 500;">--dl-bg-base</div>
            <div style="font-size: 11px; color: var(--dl-muted, #8b949e);">Main background</div>
          </div>

          <div class="token-card">
            <div
              style="height: 60px; background: var(--dl-bg-surface, #161b22); border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--dl-border, #30363d);"
            ></div>
            <div style="font-size: 12px; font-weight: 500;">--dl-bg-surface</div>
            <div style="font-size: 11px; color: var(--dl-muted, #8b949e);">
              Card/panel background
            </div>
          </div>

          <div class="token-card">
            <div
              style="height: 60px; background: var(--dl-bg-elevated, #21262d); border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--dl-border, #30363d);"
            ></div>
            <div style="font-size: 12px; font-weight: 500;">--dl-bg-elevated</div>
            <div style="font-size: 11px; color: var(--dl-muted, #8b949e);">Elevated elements</div>
          </div>

          <div class="token-card">
            <div
              style="height: 60px; background: var(--dl-accent, #58a6ff); border-radius: 8px; margin-bottom: 8px;"
            ></div>
            <div style="font-size: 12px; font-weight: 500;">--dl-accent</div>
            <div style="font-size: 11px; color: var(--dl-muted, #8b949e);">Primary accent</div>
          </div>

          <div class="token-card">
            <div
              style="height: 60px; background: var(--dl-success, #3fb950); border-radius: 8px; margin-bottom: 8px;"
            ></div>
            <div style="font-size: 12px; font-weight: 500;">--dl-success</div>
            <div style="font-size: 11px; color: var(--dl-muted, #8b949e);">Success states</div>
          </div>

          <div class="token-card">
            <div
              style="height: 60px; background: var(--dl-warning, #d29922); border-radius: 8px; margin-bottom: 8px;"
            ></div>
            <div style="font-size: 12px; font-weight: 500;">--dl-warning</div>
            <div style="font-size: 11px; color: var(--dl-muted, #8b949e);">Warning states</div>
          </div>

          <div class="token-card">
            <div
              style="height: 60px; background: var(--dl-danger, #f85149); border-radius: 8px; margin-bottom: 8px;"
            ></div>
            <div style="font-size: 12px; font-weight: 500;">--dl-danger</div>
            <div style="font-size: 11px; color: var(--dl-muted, #8b949e);">Error/danger states</div>
          </div>

          <div class="token-card">
            <div
              style="height: 60px; background: var(--dl-text, #e6edf3); border-radius: 8px; margin-bottom: 8px;"
            ></div>
            <div style="font-size: 12px; font-weight: 500;">--dl-text</div>
            <div style="font-size: 11px; color: var(--dl-muted, #8b949e);">Primary text</div>
          </div>
        </div>
      </section>

      <!-- Spacing -->
      <section style="margin-bottom: 48px;">
        <h3
          style="font-size: 18px; margin-bottom: 16px; border-bottom: 1px solid var(--dl-border, #30363d); padding-bottom: 8px;"
        >
          Spacing
        </h3>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div
              style="width: var(--dl-space-1, 4px); height: 24px; background: var(--dl-accent, #58a6ff); border-radius: 2px;"
            ></div>
            <code style="font-size: 12px;">--dl-space-1: 4px</code>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <div
              style="width: var(--dl-space-2, 8px); height: 24px; background: var(--dl-accent, #58a6ff); border-radius: 2px;"
            ></div>
            <code style="font-size: 12px;">--dl-space-2: 8px</code>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <div
              style="width: var(--dl-space-3, 12px); height: 24px; background: var(--dl-accent, #58a6ff); border-radius: 2px;"
            ></div>
            <code style="font-size: 12px;">--dl-space-3: 12px</code>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <div
              style="width: var(--dl-space-4, 16px); height: 24px; background: var(--dl-accent, #58a6ff); border-radius: 2px;"
            ></div>
            <code style="font-size: 12px;">--dl-space-4: 16px</code>
          </div>
        </div>
      </section>

      <!-- Border Radius -->
      <section style="margin-bottom: 48px;">
        <h3
          style="font-size: 18px; margin-bottom: 16px; border-bottom: 1px solid var(--dl-border, #30363d); padding-bottom: 8px;"
        >
          Border Radius
        </h3>

        <div style="display: flex; align-items: center; gap: 24px;">
          <div
            style="width: 48px; height: 48px; background: var(--dl-accent, #58a6ff); border-radius: var(--dl-radius, 8px);"
          ></div>
          <code style="font-size: 12px;">--dl-radius: 8px</code>
        </div>
      </section>

      <!-- Layout -->
      <section>
        <h3
          style="font-size: 18px; margin-bottom: 16px; border-bottom: 1px solid var(--dl-border, #30363d); padding-bottom: 8px;"
        >
          Layout Dimensions
        </h3>

        <div
          style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px;"
        >
          <div
            style="padding: 12px; background: var(--dl-bg-surface, #161b22); border-radius: 8px; border: 1px solid var(--dl-border, #30363d);"
          >
            <div style="font-size: 12px; font-weight: 500; margin-bottom: 4px;">Top Bar Height</div>
            <code style="font-size: 11px; color: var(--dl-muted, #8b949e);"
              >--dl-topbar-height: 48px</code
            >
          </div>

          <div
            style="padding: 12px; background: var(--dl-bg-surface, #161b22); border-radius: 8px; border: 1px solid var(--dl-border, #30363d);"
          >
            <div style="font-size: 12px; font-weight: 500; margin-bottom: 4px;">Sidebar Width</div>
            <code style="font-size: 11px; color: var(--dl-muted, #8b949e);"
              >--dl-sidebar-width: 196px</code
            >
          </div>

          <div
            style="padding: 12px; background: var(--dl-bg-surface, #161b22); border-radius: 8px; border: 1px solid var(--dl-border, #30363d);"
          >
            <div style="font-size: 12px; font-weight: 500; margin-bottom: 4px;">
              Right Sidebar Width
            </div>
            <code style="font-size: 11px; color: var(--dl-muted, #8b949e);"
              >--dl-right-sidebar-width: 260px</code
            >
          </div>
        </div>
      </section>
    </div>
  `,
})
class DesignTokensComponent {}

const meta: Meta<DesignTokensComponent> = {
  title: 'Design System/Tokens',
  component: DesignTokensComponent,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Dev-Lens uses CSS custom properties (variables) for consistent theming across the application. All tokens are defined in `styles.scss` and can be customized per theme.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<DesignTokensComponent>;

export const AllTokens: Story = {
  args: {},
};
