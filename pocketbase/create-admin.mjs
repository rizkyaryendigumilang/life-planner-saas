import PocketBase from "pocketbase";

const pb = new PocketBase(
  process.env.PB_URL || "http://127.0.0.1:8090"
);

await pb.collection("_superusers").authWithPassword(
  process.env.PB_SUPERUSER_EMAIL,
  process.env.PB_SUPERUSER_PASSWORD
);

const email = "admin@lifeplanner.local";
const username = "admin";
const password = "Admin12345!";

try {
  const user = await pb.collection("users").getFirstListItem(
    `email = "${email}"`
  );

  console.log("Existing user found:", user.id);

  const updated = await pb.collection("users").update(user.id, {
    username,
    email,
    password,
    passwordConfirm: password,
    role: "superadmin",
    is_password_temp: false,
    verified: true,
  });

  console.log("==========================================");
  console.log("Admin user updated successfully!");
  console.log("Username :", updated.username);
  console.log("Email    :", updated.email);
  console.log("Role     :", updated.role);
  console.log("==========================================");
} catch (err) {
  console.error("Failed to update admin user:");
  console.error(err.response || err);
  process.exit(1);
}