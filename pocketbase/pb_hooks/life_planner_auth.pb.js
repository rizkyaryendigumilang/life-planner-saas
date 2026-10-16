// Authentication hardening for Life Planner.
// Loaded by PocketBase from pocketbase/pb_hooks (the folder next to the binary).
// Never allow a browser OAuth payload to choose a privileged role or a
// suspended/pending status.
//
// Note: helpers must be declared *inside* each callback. PocketBase runs each
// hook handler in its own scope, so a top-level function in this file is not
// visible to the handlers and would throw a ReferenceError at runtime.

// Enforce safe defaults when a new account is created through OAuth/OIDC
// (Google or GitHub configured as an OAuth2 provider).
onRecordAuthWithOAuth2Request((e) => {
  function oauthUsername(profile, supplied) {
    const preferred = String(supplied || profile.username || profile.email || "user")
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 8);
    const base = preferred || "user";
    const suffix = Math.random().toString(36).slice(2, 7).padEnd(5, "0");
    return (base + "_" + suffix).slice(0, 15);
  }

  if (e.isNewRecord) {
    const profile = e.oauth2User || {};
    if (!e.createData) e.createData = {};

    // These values intentionally overwrite anything supplied by the browser.
    e.createData.role = "customer";
    e.createData.status = "active";
    e.createData.is_password_temp = false;
    e.createData.emailVisibility = false;
    e.createData.username = oauthUsername(profile, e.createData.username);

    // Some providers (for example a generic OIDC bridge) return no email claim.
    // The users collection still requires one, so create a non-routable
    // placeholder. It is NOT a verified mailbox and must never be used for
    // password-reset delivery.
    const suppliedEmail = String(e.createData.email || profile.email || "").trim();
    if (!suppliedEmail && /^oidc(?:2|3)?$/i.test(String(e.providerName || ""))) {
      const raw = profile.rawUser || {};
      const subject = String(raw.sub || raw.id || profile.id || profile.username || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 48);
      if (subject) e.createData.email = "tg_" + subject + "@users.invalid";
    }
  }

  return e.next();
}, "users");

// The same principle applies to direct self-registration: privilege-bearing
// fields are assigned by the server, never trusted from the incoming payload.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    e.record.set("role", "customer");
    e.record.set("status", "active");
    e.record.set("is_password_temp", false);
    e.record.set("emailVisibility", false);

    if (!e.record.getString("username")) {
      const email = e.record.getString("email");
      const preferred = String(email || "user")
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 10);
      const base = preferred || "user";
      const suffix = Math.random().toString(36).slice(2, 6).padEnd(4, "0");
      e.record.set("username", (base + suffix).slice(0, 15));
    }
  }
  return e.next();
}, "users");

// Prevent customers from changing their own role/status/verification. A user
// may still update normal profile fields and complete a password change.
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const original = e.app.findRecordById("users", e.record.id);
    for (const field of ["role", "status", "verified"]) {
      e.record.set(field, original.get(field));
    }

    const requestData = $apis.requestData(e.httpContext);
    const body = requestData && requestData.body ? requestData.body : {};
    const isPasswordChange = Boolean(body.oldPassword && body.password && body.passwordConfirm);
    if (Object.prototype.hasOwnProperty.call(body, "is_password_temp") && !isPasswordChange) {
      e.record.set("is_password_temp", original.get("is_password_temp"));
    }
  }
  return e.next();
}, "users");
