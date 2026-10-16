import PocketBase from "pocketbase";

const pb = new PocketBase(
  process.env.PB_URL || "http://127.0.0.1:8090",
);

if (
  !process.env.PB_SUPERUSER_EMAIL ||
  !process.env.PB_SUPERUSER_PASSWORD
) {
  throw new Error(
    "Set PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD.",
  );
}

await pb
  .collection("_superusers")
  .authWithPassword(
    process.env.PB_SUPERUSER_EMAIL,
    process.env.PB_SUPERUSER_PASSWORD,
  );

const users = await pb.collections.getOne("users");

const add = (
  fields,
  name,
  type = "text",
  extra = {},
) => {
  if (!fields.some((field) => field.name === name)) {
    fields.push({
      name,
      type,
      ...extra,
    });
  }
};

/*
|--------------------------------------------------------------------------
| GOALS
|--------------------------------------------------------------------------
*/

let goals;

try {
  goals = await pb.collections.getOne("goals");

  console.log("goals collection already exists.");

  add(goals.fields, "user", "relation", {
    required: true,
    collectionId: users.id,
    maxSelect: 1,
    cascadeDelete: true,
  });

  add(goals.fields, "name", "text", {
    required: true,
    min: 1,
    max: 200,
  });

  add(goals.fields, "category", "select", {
    required: true,
    values: [
      "Financial",
      "Family",
      "Vehicle",
      "Travel",
      "Lifestyle",
      "Property",
      "Education",
      "Technology",
      "Personal",
      "Other",
    ],
    maxSelect: 1,
  });

  add(goals.fields, "target_amount", "number", {
    required: true,
    min: 0,
    noDecimal: true,
  });

  add(goals.fields, "current_amount", "number", {
    required: true,
    min: 0,
    noDecimal: true,
  });

  add(goals.fields, "target_date", "date", {
    required: true,
  });

  add(goals.fields, "priority", "select", {
    required: true,
    values: ["Low", "Medium", "High"],
    maxSelect: 1,
  });

  add(goals.fields, "status", "select", {
    required: true,
    values: [
      "Active",
      "Upcoming",
      "Completed",
      "Paused",
    ],
    maxSelect: 1,
  });

  add(goals.fields, "notes", "text", {
    max: 5000,
  });

  goals.listRule = "user = @request.auth.id";
  goals.viewRule = "user = @request.auth.id";

  goals.createRule =
    '@request.auth.id != "" && user = @request.auth.id';

  goals.updateRule = "user = @request.auth.id";
  goals.deleteRule = "user = @request.auth.id";

  await pb.collections.update(goals.id, goals);

  console.log("updated goals");
} catch {
  goals = await pb.collections.create({
    name: "goals",
    type: "base",

    listRule: "user = @request.auth.id",

    viewRule: "user = @request.auth.id",

    createRule:
      '@request.auth.id != "" && user = @request.auth.id',

    updateRule: "user = @request.auth.id",

    deleteRule: "user = @request.auth.id",

    fields: [
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: true,
      },

      {
        name: "name",
        type: "text",
        required: true,
        min: 1,
        max: 200,
      },

      {
        name: "category",
        type: "select",
        required: true,
        values: [
          "Financial",
          "Family",
          "Vehicle",
          "Travel",
          "Lifestyle",
          "Property",
          "Education",
          "Technology",
          "Personal",
          "Other",
        ],
        maxSelect: 1,
      },

      {
        name: "target_amount",
        type: "number",
        required: true,
        min: 0,
        noDecimal: true,
      },

      {
        name: "current_amount",
        type: "number",
        required: true,
        min: 0,
        noDecimal: true,
      },

      {
        name: "target_date",
        type: "date",
        required: true,
      },

      {
        name: "priority",
        type: "select",
        required: true,
        values: ["Low", "Medium", "High"],
        maxSelect: 1,
      },

      {
        name: "status",
        type: "select",
        required: true,
        values: [
          "Active",
          "Upcoming",
          "Completed",
          "Paused",
        ],
        maxSelect: 1,
      },

      {
        name: "notes",
        type: "text",
        max: 5000,
      },
    ],
  });

  console.log("created goals");
}

/*
|--------------------------------------------------------------------------
| GOAL CONTRIBUTIONS
|--------------------------------------------------------------------------
*/

let contributions;

try {
  contributions = await pb.collections.getOne(
    "goal_contributions",
  );

  console.log(
    "goal_contributions collection already exists.",
  );

  add(contributions.fields, "goal", "relation", {
    required: true,
    collectionId: goals.id,
    maxSelect: 1,
    cascadeDelete: true,
  });

  add(contributions.fields, "amount", "number", {
    required: true,
    min: 1,
    noDecimal: true,
  });

  add(contributions.fields, "date", "date", {
    required: true,
  });

  add(contributions.fields, "note", "text", {
    max: 1000,
  });

  contributions.listRule =
    "goal.user = @request.auth.id";

  contributions.viewRule =
    "goal.user = @request.auth.id";

  contributions.createRule =
    '@request.auth.id != "" && goal.user = @request.auth.id';

  contributions.updateRule =
    "goal.user = @request.auth.id";

  contributions.deleteRule =
    "goal.user = @request.auth.id";

  await pb.collections.update(
    contributions.id,
    contributions,
  );

  console.log("updated goal_contributions");
} catch {
  contributions = await pb.collections.create({
    name: "goal_contributions",
    type: "base",

    listRule:
      "goal.user = @request.auth.id",

    viewRule:
      "goal.user = @request.auth.id",

    createRule:
      '@request.auth.id != "" && goal.user = @request.auth.id',

    updateRule:
      "goal.user = @request.auth.id",

    deleteRule:
      "goal.user = @request.auth.id",

    fields: [
      {
        name: "goal",
        type: "relation",
        required: true,
        collectionId: goals.id,
        maxSelect: 1,
        cascadeDelete: true,
      },

      {
        name: "amount",
        type: "number",
        required: true,
        min: 1,
        noDecimal: true,
      },

      {
        name: "date",
        type: "date",
        required: true,
      },

      {
        name: "note",
        type: "text",
        max: 1000,
      },
    ],
  });

  console.log("created goal_contributions");
}

console.log("");
console.log("================================");
console.log("Goals migration complete.");
console.log("================================");
console.log("");
console.log("Created/updated:");
console.log("- goals");
console.log("- goal_contributions");