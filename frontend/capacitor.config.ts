import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dk.koereproeve.amager',
  appName: 'Køreprøve Amager',
  webDir: 'dist',
  server: {
    url: 'https://frontend-production-22c6.up.railway.app',
    cleartext: true,
  },
};

export default config;
