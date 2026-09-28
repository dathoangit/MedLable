import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'MedLabel',
  description:
    'Print medication infusion labels for nursing preparation from HIS patient data.',
  version: '0.1.0',
  action: {
    default_title: 'MedLabel',
    default_icon: {
      '16': 'public/icons/icon-16.png',
      '32': 'public/icons/icon-32.png',
      '48': 'public/icons/icon-48.png',
      '128': 'public/icons/icon-128.png'
    }
  },
  icons: {
    '16': 'public/icons/icon-16.png',
    '32': 'public/icons/icon-32.png',
    '48': 'public/icons/icon-48.png',
    '128': 'public/icons/icon-128.png'
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module'
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html'
  },
  permissions: ['storage', 'sidePanel'],
  host_permissions: ['http://172.16.16.17:2301/*', 'http://172.16.16.17:2382/*']
});
