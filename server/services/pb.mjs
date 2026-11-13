import PocketBase from "pocketbase";

export const PB_URL = process.env.PB_URL || "http://127.0.0.1:8090";
export const SUPERUSER_EMAIL = process.env.PB_SUPERUSER_EMAIL;
export const SUPERUSER_PASSWORD = process.env.PB_SUPERUSER_PASSWORD;

if (!SUPERUSER_EMAIL || !SUPERUSER_PASSWORD) {
  throw new Error("Set PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD in .env");
}

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

let superuserAuthPromise = null;

export async function authenticatePocketBase() {
  if (pb.authStore.isValid) {
    return;
  }

  if (superuserAuthPromise) {
    return superuserAuthPromise;
  }

  superuserAuthPromise = (async () => {
    try {
      await pb.collection("_superusers").authWithPassword(
        SUPERUSER_EMAIL,
        SUPERUSER_PASSWORD,
      );
    } finally {
      superuserAuthPromise = null;
    }
  })();

  return superuserAuthPromise;
}

export function escapeFilterValue(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"');
}

export function getPocketBaseError(error) {
  return (
    error?.response?.data ||
    error?.response ||
    error?.message ||
    String(error)
  );
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role: user.role,
    status: user.status,
    verified: user.verified,
    emailVisibility: user.emailVisibility,
    is_password_temp: user.is_password_temp,
    created: user.created,
    updated: user.updated,
  };
}
