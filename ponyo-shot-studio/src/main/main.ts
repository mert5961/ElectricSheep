import { resolve } from "node:path";
import { app, BrowserWindow } from "electron";
import dotenv from "dotenv";
import { join } from "node:path";
import { registerHandlers } from "./ipc/registerHandlers";
import { OpenAIImageProvider } from "./providers/image/OpenAIImageProvider";
import { AssetService } from "./services/assetService";
import { ImageGenerationService } from "./services/imageGenerationService";
import { ProjectService } from "./services/projectService";

dotenv.config({ path: resolve(process.cwd(), ".env") });
app.setName("Ponyo Shot Studio");

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1680,
    height: 1000,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: "#111315",
    title: "Ponyo Shot Studio",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  if (process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(async () => {
  const projects = new ProjectService(join(app.getPath("appData"), "Ponyo Shot Studio", "data"));
  await projects.initialize();
  const assets = new AssetService(projects);
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
  const generations = new ImageGenerationService(projects, () => new OpenAIImageProvider(process.env.OPENAI_API_KEY?.trim() || "", model));
  registerHandlers(projects, assets, generations, () => ({ model, hasApiKey: Boolean(process.env.OPENAI_API_KEY?.trim()) }));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error) => {
  console.error(`[Ponyo Shot Studio] startup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
