import type { Meta, StoryObj } from '@storybook/angular';
import { SpotlightComponent } from '../app/features/spotlight/spotlight.component';
import { SpotlightService } from '../app/features/spotlight/spotlight.service';
import { signal } from '@angular/core';

// Mock services for Storybook
const mockSpotlightService = {
  open: signal(true),
  toggle: () => {
    // Toggle spotlight visibility
  },
  show: () => {
    // Show spotlight
  },
  hide: () => {
    // Hide spotlight
  },
};

const meta: Meta<SpotlightComponent> = {
  title: 'Components/Spotlight',
  component: SpotlightComponent,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0d1117' },
        { name: 'light', value: '#f6f8fa' },
      ],
    },
  },
  decorators: [
    (storyFn) => {
      return {
        moduleMetadata: {
          providers: [{ provide: SpotlightService, useValue: mockSpotlightService }],
        },
        template: `<div style="padding: 3rem; position: relative; height: 400px;">${storyFn()}</div>`,
      };
    },
  ],
};

export default meta;

type Story = StoryObj<SpotlightComponent>;

export const Open: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Spotlight search overlay in open state with search input and results list.',
      },
    },
  },
};

export const WithQuery: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('.spotlight__input') as HTMLInputElement;
    if (input) {
      input.value = 'settings';
      input.dispatchEvent(new Event('input'));
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Spotlight with a search query entered, showing filtered results.',
      },
    },
  },
};
