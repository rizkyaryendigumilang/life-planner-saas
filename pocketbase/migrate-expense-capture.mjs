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
const bankAccounts = await pb.collections.getOne("bank_accounts");

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

/**
 * --------------------------------------------------------------------------
 * EXPENSE INGESTIONS
 * --------------------------------------------------------------------------
 */

let expenseIngestions;

try {
  expenseIngestions = await pb.collections.getOne(
    "expense_ingestions",
  );

  console.log(
    "expense_ingestions collection already exists.",
  );

  add(
    expenseIngestions.fields,
    "user",
    "relation",
    {
      required: true,
      collectionId: users.id,
      maxSelect: 1,
      cascadeDelete: true,
    },
  );

  add(
    expenseIngestions.fields,
    "source",
    "select",
    {
      required: true,
      values: [
        "manual",
        "shortcut",
        "receipt",
      ],
      maxSelect: 1,
    },
  );

  add(
    expenseIngestions.fields,
    "external_id",
    "text",
    {
      max: 500,
    },
  );

  add(
    expenseIngestions.fields,
    "merchant",
    "text",
    {
      max: 200,
    },
  );

  add(
    expenseIngestions.fields,
    "amount",
    "number",
    {
      required: true,
      min: 1,
    },
  );

  add(
    expenseIngestions.fields,
    "transaction_date",
    "date",
    {
      required: true,
    },
  );

  add(
    expenseIngestions.fields,
    "account",
    "relation",
    {
      collectionId: bankAccounts.id,
      maxSelect: 1,
    },
  );

  add(
    expenseIngestions.fields,
    "category",
    "text",
    {
      max: 200,
    },
  );

  add(
    expenseIngestions.fields,
    "notes",
    "text",
    {
      max: 2000,
    },
  );

  add(
    expenseIngestions.fields,
    "raw_data",
    "json",
    {
      maxSize: 200000,
    },
  );

  add(
    expenseIngestions.fields,
    "status",
    "select",
    {
      required: true,
      values: [
        "pending",
        "processed",
        "duplicate",
        "failed",
      ],
      maxSelect: 1,
    },
  );

  expenseIngestions.listRule =
    "user = @request.auth.id";

  expenseIngestions.viewRule =
    "user = @request.auth.id";

  expenseIngestions.createRule =
    '@request.auth.id != "" && user = @request.auth.id';

  expenseIngestions.updateRule =
    "user = @request.auth.id";

  expenseIngestions.deleteRule =
    "user = @request.auth.id";

  await pb.collections.update(
    expenseIngestions.id,
    expenseIngestions,
  );

  console.log(
    "updated expense_ingestions",
  );
} catch {
  expenseIngestions =
    await pb.collections.create({
      name: "expense_ingestions",
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
          name: "source",
          type: "select",
          required: true,
          values: [
            "manual",
            "shortcut",
            "receipt",
          ],
          maxSelect: 1,
        },

        {
          name: "external_id",
          type: "text",
          max: 500,
        },

        {
          name: "merchant",
          type: "text",
          max: 200,
        },

        {
          name: "amount",
          type: "number",
          required: true,
          min: 1,
        },

        {
          name: "transaction_date",
          type: "date",
          required: true,
        },

        {
          name: "account",
          type: "relation",
          collectionId: bankAccounts.id,
          maxSelect: 1,
        },

        {
          name: "category",
          type: "text",
          max: 200,
        },

        {
          name: "notes",
          type: "text",
          max: 2000,
        },

        {
          name: "raw_data",
          type: "json",
          maxSize: 200000,
        },

        {
          name: "status",
          type: "select",
          required: true,
          values: [
            "pending",
            "processed",
            "duplicate",
            "failed",
          ],
          maxSelect: 1,
        },
      ],
    });

  console.log(
    "created expense_ingestions",
  );
}

console.log("");

console.log("================================");
console.log("Expense Capture migration complete.");
console.log("================================");
console.log("");

console.log("Created/updated:");
console.log("- expense_ingestions");