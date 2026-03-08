/**
 * Placeholder for Shader Master phase.
 * Will map visual shader sources to surfaces via assignedOutputId.
 */
export class OutputRouter {
  constructor() {
    this._routes = new Map();
  }

  assign(surfaceId, outputId) {
    this._routes.set(surfaceId, outputId);
  }

  unassign(surfaceId) {
    this._routes.delete(surfaceId);
  }

  getOutputId(surfaceId) {
    return this._routes.get(surfaceId) || null;
  }

  dispose() {
    this._routes.clear();
  }
}
