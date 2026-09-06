import type { PonyoApi } from "../../shared/types";

declare global {
  interface Window { ponyo: PonyoApi }
}

export {};
