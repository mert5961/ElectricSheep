import { App } from './App.js';
import { StateBridge } from './comms/StateBridge.js';
import { APP_ROLE_OUTPUT } from './core/AppModes.js';

const bridge = new StateBridge();
const app = new App({
  bridge,
  role: APP_ROLE_OUTPUT,
});

app.start();
window.addEventListener('beforeunload', () => {
  app.dispose();
});
