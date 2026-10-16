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
| EXPERIENCES
|--------------------------------------------------------------------------
*/

const experienceTypes = [
  "Concert",
  "Cinema",
  "Running Event",
  "Travel",
  "Show & Event",
  "Dining",
  "Gaming",
  "Other",
];

const experienceStatuses = [
  "Planned",
  "Booked",
  "Completed",
  "Cancelled",
];

let experiences;

try {
  experiences = await pb.collections.getOne("experiences");

  console.log("experiences collection already exists.");

  add(experiences.fields, "user", "relation", {
    required: true,
    collectionId: users.id,
    maxSelect: 1,
    cascadeDelete: true,
  });

  add(experiences.fields, "type", "select", {
    required: true,
    values: experienceTypes,
    maxSelect: 1,
  });

  add(experiences.fields, "name", "text", {
    required: true,
    min: 1,
    max: 200,
  });

  add(experiences.fields, "start_date", "date", {
    required: true,
  });

  add(experiences.fields, "end_date", "date");

  add(experiences.fields, "location", "text", {
    max: 300,
  });

  add(experiences.fields, "estimated_cost", "number", {
    required: true,
    min: 0,
    noDecimal: true,
  });

  add(experiences.fields, "status", "select", {
    required: true,
    values: experienceStatuses,
    maxSelect: 1,
  });

  add(experiences.fields, "notes", "text", {
    max: 5000,
  });

  add(experiences.fields, "track_expenses", "bool");

  experiences.listRule =
    "user = @request.auth.id";

  experiences.viewRule =
    "user = @request.auth.id";

  experiences.createRule =
    '@request.auth.id != "" && user = @request.auth.id';

  experiences.updateRule =
    "user = @request.auth.id";

  experiences.deleteRule =
    "user = @request.auth.id";

  await pb.collections.update(
    experiences.id,
    experiences,
  );

  console.log("updated experiences");
} catch {
  experiences = await pb.collections.create({
    name: "experiences",
    type: "base",

    listRule:
      "user = @request.auth.id",

    viewRule:
      "user = @request.auth.id",

    createRule:
      '@request.auth.id != "" && user = @request.auth.id',

    updateRule:
      "user = @request.auth.id",

    deleteRule:
      "user = @request.auth.id",

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
        name: "type",
        type: "select",
        required: true,
        values: experienceTypes,
        maxSelect: 1,
      },

      {
        name: "name",
        type: "text",
        required: true,
        min: 1,
        max: 200,
      },

      {
        name: "start_date",
        type: "date",
        required: true,
      },

      {
        name: "end_date",
        type: "date",
      },

      {
        name: "location",
        type: "text",
        max: 300,
      },

      {
        name: "estimated_cost",
        type: "number",
        required: true,
        min: 0,
        noDecimal: true,
      },

      {
        name: "status",
        type: "select",
        required: true,
        values: experienceStatuses,
        maxSelect: 1,
      },

      {
        name: "notes",
        type: "text",
        max: 5000,
      },

      {
        name: "track_expenses",
        type: "bool",
      },
    ],
  });

  console.log("created experiences");
}

/*
|--------------------------------------------------------------------------
| ITINERARY ITEMS
|--------------------------------------------------------------------------
*/

let itineraryItems;

try {
  itineraryItems =
    await pb.collections.getOne(
      "itinerary_items",
    );

  console.log(
    "itinerary_items collection already exists.",
  );

  add(itineraryItems.fields, "experience", "relation", {
    required: true,
    collectionId: experiences.id,
    maxSelect: 1,
    cascadeDelete: true,
  });

  add(itineraryItems.fields, "date", "date", {
    required: true,
  });

  add(itineraryItems.fields, "time", "text", {
    max: 20,
  });

  add(itineraryItems.fields, "title", "text", {
    required: true,
    min: 1,
    max: 200,
  });

  add(itineraryItems.fields, "location", "text", {
    max: 300,
  });

  add(itineraryItems.fields, "notes", "text", {
    max: 2000,
  });

  itineraryItems.listRule =
    "experience.user = @request.auth.id";

  itineraryItems.viewRule =
    "experience.user = @request.auth.id";

  itineraryItems.createRule =
    '@request.auth.id != "" && experience.user = @request.auth.id';

  itineraryItems.updateRule =
    "experience.user = @request.auth.id";

  itineraryItems.deleteRule =
    "experience.user = @request.auth.id";

  await pb.collections.update(
    itineraryItems.id,
    itineraryItems,
  );

  console.log("updated itinerary_items");
} catch {
  itineraryItems =
    await pb.collections.create({
      name: "itinerary_items",
      type: "base",

      listRule:
        "experience.user = @request.auth.id",

      viewRule:
        "experience.user = @request.auth.id",

      createRule:
        '@request.auth.id != "" && experience.user = @request.auth.id',

      updateRule:
        "experience.user = @request.auth.id",

      deleteRule:
        "experience.user = @request.auth.id",

      fields: [
        {
          name: "experience",
          type: "relation",
          required: true,
          collectionId: experiences.id,
          maxSelect: 1,
          cascadeDelete: true,
        },

        {
          name: "date",
          type: "date",
          required: true,
        },

        {
          name: "time",
          type: "text",
          max: 20,
        },

        {
          name: "title",
          type: "text",
          required: true,
          min: 1,
          max: 200,
        },

        {
          name: "location",
          type: "text",
          max: 300,
        },

        {
          name: "notes",
          type: "text",
          max: 2000,
        },
      ],
    });

  console.log("created itinerary_items");
}

/*
|--------------------------------------------------------------------------
| EXPERIENCE EXPENSES
|--------------------------------------------------------------------------
*/

let experienceExpenses;

try {
  experienceExpenses =
    await pb.collections.getOne(
      "experience_expenses",
    );

  console.log(
    "experience_expenses collection already exists.",
  );

  add(
    experienceExpenses.fields,
    "experience",
    "relation",
    {
      required: true,
      collectionId: experiences.id,
      maxSelect: 1,
      cascadeDelete: true,
    },
  );

  add(
    experienceExpenses.fields,
    "amount",
    "number",
    {
      required: true,
      min: 1,
      noDecimal: true,
    },
  );

  add(
    experienceExpenses.fields,
    "date",
    "date",
    {
      required: true,
    },
  );

  add(
    experienceExpenses.fields,
    "category",
    "text",
    {
      max: 100,
    },
  );

  add(
    experienceExpenses.fields,
    "description",
    "text",
    {
      max: 500,
    },
  );

  experienceExpenses.listRule =
    "experience.user = @request.auth.id";

  experienceExpenses.viewRule =
    "experience.user = @request.auth.id";

  experienceExpenses.createRule =
    '@request.auth.id != "" && experience.user = @request.auth.id';

  experienceExpenses.updateRule =
    "experience.user = @request.auth.id";

  experienceExpenses.deleteRule =
    "experience.user = @request.auth.id";

  await pb.collections.update(
    experienceExpenses.id,
    experienceExpenses,
  );

  console.log(
    "updated experience_expenses",
  );
} catch {
  experienceExpenses =
    await pb.collections.create({
      name: "experience_expenses",
      type: "base",

      listRule:
        "experience.user = @request.auth.id",

      viewRule:
        "experience.user = @request.auth.id",

      createRule:
        '@request.auth.id != "" && experience.user = @request.auth.id',

      updateRule:
        "experience.user = @request.auth.id",

      deleteRule:
        "experience.user = @request.auth.id",

      fields: [
        {
          name: "experience",
          type: "relation",
          required: true,
          collectionId: experiences.id,
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
          name: "category",
          type: "text",
          max: 100,
        },

        {
          name: "description",
          type: "text",
          max: 500,
        },
      ],
    });

  console.log(
    "created experience_expenses",
  );
}

console.log("");
console.log("================================");
console.log("Entertainment migration complete.");
console.log("================================");
console.log("");
console.log("Created/updated:");
console.log("- experiences");
console.log("- itinerary_items");
console.log("- experience_expenses");