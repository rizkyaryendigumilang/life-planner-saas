import PocketBase from "pocketbase";

import { POCKETBASE_BASE } from "./hosts";

export const pb = new PocketBase(POCKETBASE_BASE);

pb.autoCancellation(false);

export const isPocketBaseConfigured = Boolean(import.meta.env.VITE_POCKETBASE_URL);
