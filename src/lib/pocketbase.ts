import PocketBase from "pocketbase";

import { POCKETBASE_BASE } from "./hosts";

export const pb = new PocketBase(POCKETBASE_BASE);

pb.autoCancellation(false);

// Automatically clear invalid/revoked sessions on 401 Unauthorized
pb.afterSend = (response, data) => {
  if (response.status === 401 && pb.authStore.isValid) {
    pb.authStore.clear();
  }
  return data;
};

export const isPocketBaseConfigured = Boolean(import.meta.env.VITE_POCKETBASE_URL);
