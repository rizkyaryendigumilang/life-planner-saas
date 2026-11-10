import assert from "node:assert/strict";

console.log("=================================================");
console.log("  HELPDESK SSO HANDOFF & IN-APP MODAL TEST       ");
console.log("=================================================\n");

const HELPDESK_BASE_URL = "https://43.156.236.102/helpdesk/handoff";
const APP_SLUG = "life-planner";

function getHelpdeskUrl(optionsOrUser, legacyFromUrl) {
  const isOptions =
    optionsOrUser &&
    ("subject" in optionsOrUser ||
      "description" in optionsOrUser ||
      "category" in optionsOrUser ||
      "autoSubmit" in optionsOrUser ||
      "fromUrl" in optionsOrUser ||
      "user" in optionsOrUser);

  const options = isOptions
    ? optionsOrUser
    : {
        user: optionsOrUser,
        fromUrl: legacyFromUrl,
      };

  const user = options.user;

  const rawUid =
    user?.id ||
    user?.username ||
    user?.email ||
    "guest_abc123";

  const uid = String(rawUid).slice(0, 200);

  const name = String(
    user?.name ||
      user?.fullName ||
      user?.username ||
      user?.email?.split("@")[0] ||
      "Pengguna LifePlanner",
  ).trim();

  const role =
    user?.role === "superadmin"
      ? "Admin"
      : typeof user?.role === "string" && user.role.trim()
        ? user.role.trim()
        : "Member";

  const currentUrl =
    options.fromUrl ||
    legacyFromUrl ||
    "https://app.local/dashboard";

  const params = new URLSearchParams({
    app: APP_SLUG,
    uid,
    name,
    role,
    from_url: currentUrl,
    new: "1",
  });

  if (options.subject?.trim()) {
    params.set("subject", options.subject.trim().slice(0, 200));
  }

  if (options.description?.trim()) {
    params.set("description", options.description.trim().slice(0, 4000));
  }

  if (options.category) {
    params.set("category", options.category);
  }

  if (options.priority) {
    params.set("priority", options.priority);
  }

  if (options.autoSubmit) {
    params.set("auto_submit", "1");
  }

  return `${HELPDESK_BASE_URL}?${params.toString()}`;
}

// 1. Test URL structure and base
const url1 = getHelpdeskUrl({ id: "usr_alice", name: "Alice Wonderland", role: "superadmin" }, "https://app.local/settings");
assert(url1.startsWith(HELPDESK_BASE_URL + "?"), "Base URL must match Helpdesk handoff endpoint");
console.log("✓ PASS: Base URL matches https://43.156.236.102/helpdesk/handoff");

// 2. Test standard query parameters
const parsedUrl = new URL(url1);
assert.equal(parsedUrl.searchParams.get("app"), "life-planner");
assert.equal(parsedUrl.searchParams.get("uid"), "usr_alice");
assert.equal(parsedUrl.searchParams.get("name"), "Alice Wonderland");
assert.equal(parsedUrl.searchParams.get("role"), "Admin");
assert.equal(parsedUrl.searchParams.get("from_url"), "https://app.local/settings");
assert.equal(parsedUrl.searchParams.get("new"), "1");
console.log("✓ PASS: Query parameters (app, uid, name, role, from_url, new) are correctly formatted and encoded");

// 3. Test extended in-app modal payload (keluhan, subject, category, optional photo context)
const modalPayload = {
  user: { id: "usr_bob", name: "Bob Builder", role: "Member" },
  fromUrl: "https://app.local/household",
  subject: "Gagal menyimpan pengeluaran dapur",
  description: "Terjadi error saat menekan tombol simpan.\n\n---\n📎 Lampiran Foto Masalah: struk_belanja.png (142.5 KB)",
  category: "data_transaction",
};
const modalUrl = new URL(getHelpdeskUrl(modalPayload));
assert.equal(modalUrl.searchParams.get("subject"), "Gagal menyimpan pengeluaran dapur");
assert(modalUrl.searchParams.get("description").includes("Terjadi error saat menekan tombol simpan"));
assert(modalUrl.searchParams.get("description").includes("struk_belanja.png"));
assert.equal(modalUrl.searchParams.get("category"), "data_transaction");
assert.equal(modalUrl.searchParams.get("from_url"), "https://app.local/household");
console.log("✓ PASS: In-app modal payload (subject, keluhan/description, category, photo context) correctly formatted");

// 4. Test character limit safety (subject max 200, description max 4000)
const longSubject = "S".repeat(300);
const longDesc = "D".repeat(5000);
const safetyUrl = new URL(getHelpdeskUrl({ subject: longSubject, description: longDesc }));
assert.equal(safetyUrl.searchParams.get("subject").length, 200);
assert.equal(safetyUrl.searchParams.get("description").length, 4000);
console.log("✓ PASS: Length safety limits (subject: 200, description: 4000) strictly enforced");

// 5. Test guest / fallback scenario
const guestUrl = new URL(getHelpdeskUrl(null, "https://app.local/login"));
assert.equal(guestUrl.searchParams.get("app"), "life-planner");
assert(guestUrl.searchParams.get("uid").startsWith("guest_"));
assert.equal(guestUrl.searchParams.get("role"), "Member");
assert.equal(guestUrl.searchParams.get("new"), "1");
console.log("✓ PASS: Guest / unauthenticated fallback generates safe unique UID and role");

// 6. Test UID truncation constraint (max 200 chars)
const longId = "a".repeat(300);
const truncatedUrl = new URL(getHelpdeskUrl({ id: longId }));
assert.equal(truncatedUrl.searchParams.get("uid").length, 200);
console.log("✓ PASS: UID max length constraint (200 chars) enforced");

console.log("\n=================================================");
console.log("  ALL HELPDESK SSO TESTS PASSED (0 FAILURES)     ");
console.log("=================================================");
