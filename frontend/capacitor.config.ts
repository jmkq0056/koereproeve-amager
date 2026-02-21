import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dk.koereproeve.amager',
  appName: 'Køreprøve Amager',
  webDir: 'dist',
  server: {
    allowNavigation: ['backend-production-4931.up.railway.app'],
  },
};

export default config;
