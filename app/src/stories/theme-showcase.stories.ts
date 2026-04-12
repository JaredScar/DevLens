import type { Meta, StoryObj } from '@storybook/angular';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-theme-showcase',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="theme-showcase" style="padding: 24px;">
      <h2 style="margin-bottom: 24px;">Dev-Lens Themes</h2>

      <div
        style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;"
      >
        <!-- Dark Theme -->
        <div
          class="theme-card"
          style="
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        "
          data-theme="dark"
        >
          <div
            style="
            height: 120px;
            background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
            border: 1px solid #30363d;
            display: flex;
            align-items: center;
            justify-content: center;
          "
          >
            <div style="text-align: center; color: #e6edf3;">
              <div style="font-size: 24px; margin-bottom: 8px;">🌙</div>
              <div style="font-size: 14px; font-weight: 500;">Dark</div>
            </div>
          </div>
          <div style="padding: 16px; background: #161b22; color: #e6edf3;">
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
              <span
                style="width: 20px; height: 20px; border-radius: 4px; background: #58a6ff;"
              ></span>
              <span
                style="width: 20px; height: 20px; border-radius: 4px; background: #3fb950;"
              ></span>
              <span
                style="width: 20px; height: 20px; border-radius: 4px; background: #f85149;"
              ></span>
            </div>
            <div style="font-size: 12px; color: #8b949e;">
              Default theme with GitHub-inspired colors
            </div>
          </div>
        </div>

        <!-- Light Theme -->
        <div
          class="theme-card"
          style="
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        "
          data-theme="light"
        >
          <div
            style="
            height: 120px;
            background: linear-gradient(135deg, #f6f8fa 0%, #ffffff 100%);
            border: 1px solid #d0d7de;
            display: flex;
            align-items: center;
            justify-content: center;
          "
          >
            <div style="text-align: center; color: #1f2328;">
              <div style="font-size: 24px; margin-bottom: 8px;">☀️</div>
              <div style="font-size: 14px; font-weight: 500;">Light</div>
            </div>
          </div>
          <div style="padding: 16px; background: #ffffff; color: #1f2328;">
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
              <span
                style="width: 20px; height: 20px; border-radius: 4px; background: #0969da;"
              ></span>
              <span
                style="width: 20px; height: 20px; border-radius: 4px; background: #1a7f37;"
              ></span>
              <span
                style="width: 20px; height: 20px; border-radius: 4px; background: #cf222e;"
              ></span>
            </div>
            <div style="font-size: 12px; color: #656d76;">Clean light theme for daytime use</div>
          </div>
        </div>

        <!-- Midnight Theme -->
        <div
          class="theme-card"
          style="
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        "
          data-theme="midnight"
        >
          <div
            style="
            height: 120px;
            background: linear-gradient(135deg, #050810 0%, #0c1220 100%);
            border: 1px solid #1e2a40;
            display: flex;
            align-items: center;
            justify-content: center;
          "
          >
            <div style="text-align: center; color: #e8edf5;">
              <div style="font-size: 24px; margin-bottom: 8px;">🌃</div>
              <div style="font-size: 14px; font-weight: 500;">Midnight</div>
            </div>
          </div>
          <div style="padding: 16px; background: #0c1220; color: #e8edf5;">
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
              <span
                style="width: 20px; height: 20px; border-radius: 4px; background: #7eb8ff;"
              ></span>
              <span
                style="width: 20px; height: 20px; border-radius: 4px; background: #5bdc8a;"
              ></span>
              <span
                style="width: 20px; height: 20px; border-radius: 4px; background: #ff7b72;"
              ></span>
            </div>
            <div style="font-size: 12px; color: #7a8aa8;">
              Deep blue theme for late night sessions
            </div>
          </div>
        </div>

        <!-- Solarized Theme -->
        <div
          class="theme-card"
          style="
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        "
          data-theme="solarized"
        >
          <div
            style="
            height: 120px;
            background: linear-gradient(135deg, #002b36 0%, #073642 100%);
            border: 1px solid #586e75;
            display: flex;
            align-items: center;
            justify-content: center;
          "
          >
            <div style="text-align: center; color: #eee8d5;">
              <div style="font-size: 24px; margin-bottom: 8px;">🌅</div>
              <div style="font-size: 14px; font-weight: 500;">Solarized</div>
            </div>
          </div>
          <div style="padding: 16px; background: #073642; color: #eee8d5;">
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
              <span
                style="width: 20px; height: 20px; border-radius: 4px; background: #268bd2;"
              ></span>
              <span
                style="width: 20px; height: 20px; border-radius: 4px; background: #859900;"
              ></span>
              <span
                style="width: 20px; height: 20px; border-radius: 4px; background: #dc322f;"
              ></span>
            </div>
            <div style="font-size: 12px; color: #93a1a1;">Classic solarized color palette</div>
          </div>
        </div>

        <!-- High Contrast Theme -->
        <div
          class="theme-card"
          style="
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        "
          data-theme="high-contrast"
        >
          <div
            style="
            height: 120px;
            background: #000000;
            border: 2px solid #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
          "
          >
            <div style="text-align: center; color: #ffffff;">
              <div style="font-size: 24px; margin-bottom: 8px;">⚡</div>
              <div style="font-size: 14px; font-weight: 500;">High Contrast</div>
            </div>
          </div>
          <div
            style="padding: 16px; background: #0a0a0a; color: #ffffff; border: 2px solid #ffffff; border-top: none;"
          >
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
              <span
                style="width: 20px; height: 20px; border-radius: 4px; background: #ffff00;"
              ></span>
              <span
                style="width: 20px; height: 20px; border-radius: 4px; background: #00ff00;"
              ></span>
              <span
                style="width: 20px; height: 20px; border-radius: 4px; background: #ff6666;"
              ></span>
            </div>
            <div style="font-size: 12px; color: #cccccc;">Maximum contrast for accessibility</div>
          </div>
        </div>
      </div>
    </div>
  `,
})
class ThemeShowcaseComponent {}

const meta: Meta<ThemeShowcaseComponent> = {
  title: 'Design System/Themes',
  component: ThemeShowcaseComponent,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Dev-Lens includes 5 built-in themes: Dark (default), Light, Midnight, Solarized, and High Contrast. All themes are WCAG AA compliant for color contrast.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<ThemeShowcaseComponent>;

export const AllThemes: Story = {
  args: {},
};
