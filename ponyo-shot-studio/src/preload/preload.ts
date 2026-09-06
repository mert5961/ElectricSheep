import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { PonyoApi } from "../shared/types";

const api: PonyoApi = {
  project: {
    getCurrent: () => ipcRenderer.invoke("project:get-current"),
    create: (input) => ipcRenderer.invoke("project:create", input),
    addCharacter: (name) => ipcRenderer.invoke("project:add-character", name),
    updateCharacter: (input) => ipcRenderer.invoke("project:update-character", input),
  },
  assets: {
    import: (input) => ipcRenderer.invoke("asset:import", input),
    getDataUrl: (localPath) => ipcRenderer.invoke("asset:data-url", localPath),
  },
  shots: {
    create: () => ipcRenderer.invoke("shot:create"),
    update: (shot) => ipcRenderer.invoke("shot:update", shot),
    delete: (shotId) => ipcRenderer.invoke("shot:delete", shotId),
    approve: (shotId, generationId) => ipcRenderer.invoke("shot:approve", shotId, generationId),
  },
  generation: {
    generate: (input) => ipcRenderer.invoke("generation:generate", input),
    getConfig: () => ipcRenderer.invoke("generation:config"),
  },
  files: { getPath: (file) => webUtils.getPathForFile(file) },
};

contextBridge.exposeInMainWorld("ponyo", api);
