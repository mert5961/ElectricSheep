import { StateBridge } from './comms/StateBridge.js';
import { ControlUI } from './ui/ControlUI.js';

const bridge = new StateBridge();
const rootEl = document.getElementById('control-root');
const controlUI = new ControlUI(rootEl, bridge);

console.log('[ElectricSheep] Control screen started');
