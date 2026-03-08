/**
 * Placeholder for scene state persistence.
 * Will serialize/deserialize all surfaces and routing to JSON for save/load.
 */
export class StateSerializer {
  static serialize(surfaceManager) {
    return JSON.stringify(surfaceManager.serializeAll(), null, 2);
  }

  static deserialize(_json, _surfaceManager) {
    // Will be implemented when save/load is needed
  }
}
