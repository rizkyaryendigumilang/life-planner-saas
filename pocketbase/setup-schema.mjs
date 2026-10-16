import PocketBase from "pocketbase";

const url = process.env.PB_URL || "http://127.0.0.1:8090";
const email = process.env.PB_SUPERUSER_EMAIL;
const password = process.env.PB_SUPERUSER_PASSWORD;

if (!email || !password) {
  throw new Error(
    "Set PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD."
  );
}

const pb = new PocketBase(url);

await pb.collection("_superusers").authWithPassword(
  email,
  password
);

console.log(`Connected to PocketBase: ${url}`);

/* =========================================================
   HELPERS
   ========================================================= */

async function getCollection(name) {
  try {
    return await pb.collections.getOne(name);
  } catch {
    return null;
  }
}

async function createCollection(name, config) {
  const existing = await getCollection(name);

  if (existing) {
    console.log(`skip ${name}: already exists`);
    return existing;
  }

  const created = await pb.collections.create({
    name,
    ...config,
  });

  console.log(`created ${name}`);

  return created;
}

/* =========================================================
   USERS
   ========================================================= */

let users = await getCollection("users");

if (!users) {
  users = await pb.collections.create({
    name: "users",
    type: "auth",

    listRule: '@request.auth.role = "superadmin"',
    viewRule:
      'id = @request.auth.id || @request.auth.role = "superadmin"',
    createRule:
      '@request.auth.role = "superadmin"',
    updateRule:
      'id = @request.auth.id || @request.auth.role = "superadmin"',
    deleteRule:
      '@request.auth.role = "superadmin"',
    manageRule:
      '@request.auth.role = "superadmin"',

    passwordAuth: {
      enabled: true,
      identityFields: ["username"],
    },

    fields: [
      {
        name: "username",
        type: "text",
        required: true,
        min: 3,
        max: 15,
        pattern: "^[a-zA-Z0-9._-]+$",
      },
      {
        name: "role",
        type: "select",
        required: true,
        values: ["superadmin", "customer"],
        maxSelect: 1,
      },
      {
        name: "is_password_temp",
        type: "bool",
      },
    ],

    indexes: [
      "CREATE UNIQUE INDEX idx_users_username ON users (username)",
    ],
  });

  console.log("created users");
} else {
  console.log(`users exists: ${users.id}`);

  /*
   * Existing users collection.
   *
   * We update authentication configuration without
   * recreating the collection.
   */

  const currentFields = users.fields || [];

  const hasUsername = currentFields.some(
    (field) => field.name === "username"
  );

  const hasRole = currentFields.some(
    (field) => field.name === "role"
  );

  const hasTempPassword = currentFields.some(
    (field) => field.name === "is_password_temp"
  );

  const fields = [...currentFields];

  if (!hasUsername) {
    fields.push({
      name: "username",
      type: "text",
      required: true,
      min: 3,
      max: 15,
      pattern: "^[a-zA-Z0-9._-]+$",
    });

    console.log("added users.username");
  }

  if (!hasRole) {
    fields.push({
      name: "role",
      type: "select",
      required: true,
      values: ["superadmin", "customer"],
      maxSelect: 1,
    });

    console.log("added users.role");
  }

  if (!hasTempPassword) {
    fields.push({
      name: "is_password_temp",
      type: "bool",
    });

    console.log("added users.is_password_temp");
  }

  const updated = await pb.collections.update(users.id, {
    passwordAuth: {
      enabled: true,
      identityFields: ["username"],
    },

    fields,

    indexes: [
      ...(users.indexes || []).filter(
        (index) =>
          !index.includes("idx_users_username")
      ),
      "CREATE UNIQUE INDEX idx_users_username ON users (username)",
    ],
  });

  users = updated;

  console.log(
    "updated users authentication: username + password"
  );
}

/* =========================================================
   OWNER RULES
   ========================================================= */

const ownerRules = {
  listRule: "user = @request.auth.id",
  viewRule: "user = @request.auth.id",
  createRule:
    '@request.auth.id != "" && user = @request.auth.id',
  updateRule: "user = @request.auth.id",
  deleteRule: "user = @request.auth.id",
};

/* =========================================================
   RELATION HELPER
   ========================================================= */

function relation(name, collectionId) {
  return {
    name,
    type: "relation",
    required: true,
    collectionId,
    maxSelect: 1,
    cascadeDelete: true,
  };
}

/* =========================================================
   PETS
   ========================================================= */

const petsCollection = await createCollection("pets", {
  type: "base",

  ...ownerRules,

  fields: [
    relation("user", users.id),

    {
      name: "name",
      type: "text",
      required: true,
      max: 80,
    },

    {
      name: "species",
      type: "select",
      required: true,
      values: [
        "Dog",
        "Cat",
        "Bird",
        "Fish",
        "Rabbit",
        "Other",
      ],
      maxSelect: 1,
    },

    {
      name: "breed",
      type: "text",
    },

    {
      name: "sex",
      type: "select",
      values: [
        "Unknown",
        "Male",
        "Female",
      ],
      maxSelect: 1,
    },

    {
      name: "birth_date",
      type: "date",
    },

    {
      name: "photo",
      type: "file",
      maxSelect: 1,
      maxSize: 5242880,
      mimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
      ],
    },

    {
      name: "notes",
      type: "text",
    },
  ],
});

/* =========================================================
   EXPENSES
   ========================================================= */

await createCollection("expenses", {
  type: "base",

  ...ownerRules,

  fields: [
    relation("user", users.id),

    {
      name: "date",
      type: "date",
      required: true,
    },

    {
      name: "amount",
      type: "number",
      required: true,
      min: 0,
    },

    {
      name: "category",
      type: "text",
      required: true,
    },

    {
      name: "type",
      type: "select",
      required: true,
      values: ["Income", "Expense"],
      maxSelect: 1,
    },

    {
      name: "notes",
      type: "text",
    },

    {
      name: "due_date",
      type: "date",
    },

    {
      name: "paid",
      type: "bool",
    },

    {
      name: "pet",
      type: "relation",
      collectionId: petsCollection.id,
      maxSelect: 1,
    },
  ],
});

/* =========================================================
   LIFE PLANNER
   ========================================================= */

await createCollection("life_planner", {
  type: "base",

  ...ownerRules,

  fields: [
    relation("user", users.id),

    {
      name: "title",
      type: "text",
      required: true,
      max: 240,
    },

    {
      name: "description",
      type: "text",
    },

    {
      name: "due_date",
      type: "date",
    },

    {
      name: "status",
      type: "select",
      required: true,
      values: [
        "Inbox",
        "To-Do",
        "In Progress",
        "Done",
      ],
      maxSelect: 1,
    },

    {
      name: "priority",
      type: "select",
      required: true,
      values: [
        "Low",
        "Medium",
        "High",
      ],
      maxSelect: 1,
    },

    {
      name: "category",
      type: "text",
    },

    {
      name: "order",
      type: "number",
    },

    {
      name: "list",
      type: "text",
    },

    {
      name: "tags",
      type: "text",
    },

    {
      name: "recurrence",
      type: "text",
    },

    {
      name: "remind_at",
      type: "date",
    },

    {
      name: "parent_task",
      type: "text",
    },
  ],
});

/* =========================================================
   GOALS
   ========================================================= */

await createCollection("goals", {
  type: "base",

  ...ownerRules,

  fields: [
    relation("user", users.id),

    {
      name: "title",
      type: "text",
      required: true,
    },

    {
      name: "why",
      type: "text",
    },

    {
      name: "progress",
      type: "number",
      min: 0,
      max: 100,
    },

    {
      name: "due_date",
      type: "date",
    },
  ],
});

/* =========================================================
   TRAVEL TRIPS
   ========================================================= */

const trips = await createCollection("travel_trips", {
  type: "base",

  ...ownerRules,

  fields: [
    relation("user", users.id),

    {
      name: "name",
      type: "text",
      required: true,
    },

    {
      name: "destination",
      type: "text",
      required: true,
    },

    {
      name: "start_date",
      type: "date",
      required: true,
    },

    {
      name: "end_date",
      type: "date",
      required: true,
    },

    {
      name: "budget",
      type: "number",
      min: 0,
    },

    {
      name: "actual",
      type: "number",
      min: 0,
    },

    {
      name: "notes",
      type: "text",
    },
  ],
});

/* =========================================================
   ITINERARIES
   ========================================================= */

await createCollection("itineraries", {
  type: "base",

  listRule: "user = @request.auth.id",
  viewRule: "user = @request.auth.id",
  createRule:
    '@request.auth.id != "" && user = @request.auth.id',
  updateRule: "user = @request.auth.id",
  deleteRule: "user = @request.auth.id",

  fields: [
    relation("user", users.id),

    {
      name: "trip",
      type: "relation",
      required: true,
      collectionId: trips.id,
      maxSelect: 1,
      cascadeDelete: true,
    },

    {
      name: "date",
      type: "date",
      required: true,
    },

    {
      name: "start_time",
      type: "text",
      required: true,
    },

    {
      name: "end_time",
      type: "text",
    },

    {
      name: "title",
      type: "text",
      required: true,
    },

    {
      name: "location",
      type: "text",
    },

    {
      name: "notes",
      type: "text",
    },
  ],
});

/* =========================================================
   DONE
   ========================================================= */

console.log("");
console.log("==========================================");
console.log("PocketBase schema setup completed.");
console.log("==========================================");
console.log("");
console.log("Authentication:");
console.log("  Identity : username");
console.log("  Password : enabled");
console.log("  Username : 3-15 characters");
console.log("");
console.log("Collections:");
console.log("  users");
console.log("  pets");
console.log("  expenses");
console.log("  life_planner");
console.log("  goals");
console.log("  travel_trips");
console.log("  itineraries");
console.log("");
