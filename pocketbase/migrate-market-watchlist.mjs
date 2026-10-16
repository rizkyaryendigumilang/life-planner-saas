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
| MARKET WATCHLIST
|--------------------------------------------------------------------------
*/

let marketWatchlist;

try {
  marketWatchlist = await pb.collections.getOne(
    "market_watchlist",
  );

  console.log(
    "market_watchlist collection already exists.",
  );

  add(
    marketWatchlist.fields,
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
    marketWatchlist.fields,
    "asset_type",
    "select",
    {
      required: true,
      values: [
        "Stock",
        "Crypto",
        "Gold",
        "Currency",
      ],
      maxSelect: 1,
    },
  );

  add(
    marketWatchlist.fields,
    "symbol",
    "text",
    {
      required: true,
      min: 1,
      max: 50,
    },
  );

  add(
    marketWatchlist.fields,
    "name",
    "text",
    {
      required: true,
      min: 1,
      max: 200,
    },
  );

  add(
    marketWatchlist.fields,
    "exchange",
    "text",
    {
      max: 50,
    },
  );

  add(
    marketWatchlist.fields,
    "currency",
    "text",
    {
      required: true,
      min: 1,
      max: 10,
    },
  );

  add(
    marketWatchlist.fields,
    "sort_order",
    "number",
    {
      required: true,
      min: 0,
      noDecimal: true,
    },
  );

  add(
    marketWatchlist.fields,
    "is_active",
    "bool",
    {
      required: true,
    },
  );

  marketWatchlist.listRule =
    "user = @request.auth.id";

  marketWatchlist.viewRule =
    "user = @request.auth.id";

  marketWatchlist.createRule =
    '@request.auth.id != "" && user = @request.auth.id';

  marketWatchlist.updateRule =
    "user = @request.auth.id";

  marketWatchlist.deleteRule =
    "user = @request.auth.id";

  await pb.collections.update(
    marketWatchlist.id,
    marketWatchlist,
  );

  console.log("updated market_watchlist");
} catch {
  marketWatchlist = await pb.collections.create({
    name: "market_watchlist",
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
        name: "asset_type",
        type: "select",
        required: true,
        values: [
          "Stock",
          "Crypto",
          "Gold",
          "Currency",
        ],
        maxSelect: 1,
      },

      {
        name: "symbol",
        type: "text",
        required: true,
        min: 1,
        max: 50,
      },

      {
        name: "name",
        type: "text",
        required: true,
        min: 1,
        max: 200,
      },

      {
        name: "exchange",
        type: "text",
        max: 50,
      },

      {
        name: "currency",
        type: "text",
        required: true,
        min: 1,
        max: 10,
      },

      {
        name: "sort_order",
        type: "number",
        required: true,
        min: 0,
        noDecimal: true,
      },

      {
        name: "is_active",
        type: "bool",
        required: true,
      },
    ],
  });

  console.log("created market_watchlist");
}

console.log("");

console.log("================================");
console.log("Market Watchlist migration complete.");
console.log("================================");

console.log("");

console.log("Created/updated:");
console.log("- market_watchlist");