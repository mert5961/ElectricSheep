/**
 * Placeholder for scene state persistence.
 * Will serialize/deserialize all surfaces and routing to JSON for save/load.
 */
export class StateSerializer {
  static serialize(surfaceManager) {
    return JSON.stringify(surfaceManager.serializeAll(), null, 2);
  }

  static deserialize(json, surfaceManager) {
    const parsed = JSON.parse(json);
    surfaceManager.loadSerialized(parsed);
    return parsed;
  }
}
