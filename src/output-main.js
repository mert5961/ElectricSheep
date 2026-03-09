import { App } from './App.js';
import { StateBridge } from './comms/StateBridge.js';

const bridge = new StateBridge();
const app = new App({ bridge });
app.start();
