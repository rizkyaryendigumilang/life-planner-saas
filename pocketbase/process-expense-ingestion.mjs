import "dotenv/config";
import PocketBase from "pocketbase";

const PB_URL =
  process.env.PB_URL ||
  "http://127.0.0.1:8090";

const pb = new PocketBase(
  PB_URL,
);

const email =
  process.env.PB_SUPERUSER_EMAIL;

const password =
  process.env.PB_SUPERUSER_PASSWORD;

if (!email || !password) {
  throw new Error(
    "Set PB_SUPERUSER_EMAIL dan PB_SUPERUSER_PASSWORD di file .env.",
  );
}

console.log(
  "Connecting to PocketBase...",
);

await pb
  .collection("_superusers")
  .authWithPassword(
    email,
    password,
  );

console.log(
  "PocketBase authentication successful.",
);

const ingestions =
  await pb
    .collection(
      "expense_ingestions",
    )
    .getList(1, 50, {
      filter:
        'status = "pending"',
    });

console.log(
  `Found ${ingestions.items.length} pending ingestion(s).`,
);

for (const ingestion of ingestions.items) {
  console.log(
    `\nProcessing ${ingestion.id} - ${
      ingestion.merchant ||
      "Unknown merchant"
    }`,
  );

  try {
    const raw =
      ingestion.raw_data &&
      typeof ingestion.raw_data ===
        "object"
        ? ingestion.raw_data
        : {};

    const transactionType =
      raw.type === "Income"
        ? "Income"
        : "Expense";

    const transactionNotes =
      typeof raw.notes ===
      "string"
        ? raw.notes.trim()
        : "";

    /*
     * Resolve account.
     *
     * The account is optional.
     * If it is not supplied, the
     * expense is still created.
     */
    let accountId = null;

    if (
      typeof ingestion.account ===
        "string" &&
      ingestion.account.trim()
    ) {
      accountId =
        ingestion.account.trim();
    } else if (
      typeof raw.account ===
        "string" &&
      raw.account.trim()
    ) {
      accountId =
        raw.account.trim();
    }

    /*
     * Validate account ownership.
     *
     * This is important because the
     * processor uses superuser access.
     *
     * A customer must never be able
     * to associate another user's
     * bank account.
     */
    if (accountId) {
      try {
        const account =
          await pb
            .collection(
              "bank_accounts",
            )
            .getOne(
              accountId,
            );

        if (
          account.user !==
          ingestion.user
        ) {
          throw new Error(
            "Bank account does not belong to ingestion user.",
          );
        }
      } catch (accountError) {
        console.error(
          `Invalid account ${accountId}:`,
          accountError?.response
            ?.data ||
            accountError?.message ||
            accountError,
        );

        accountId = null;
      }
    }

    /*
     * Resolve pet.
     *
     * Pet is optional.
     *
     * The processor validates
     * ownership because it runs
     * with superuser privileges.
     */
    let petId = null;

    if (
      typeof raw.pet ===
        "string" &&
      raw.pet.trim()
    ) {
      petId =
        raw.pet.trim();

      try {
        const pet =
          await pb
            .collection("pets")
            .getOne(petId);

        if (
          pet.user !==
          ingestion.user
        ) {
          throw new Error(
            "Pet does not belong to ingestion user.",
          );
        }
      } catch (petError) {
        console.error(
          `Invalid pet ${petId}:`,
          petError?.response
            ?.data ||
            petError?.message ||
            petError,
        );

        petId = null;
      }
    }

    /*
     * Check whether this ingestion
     * was already converted into
     * an expense.
     */
    const duplicate =
      await pb
        .collection("expenses")
        .getList(1, 1, {
          filter: `notes ~ "Ingestion: ${ingestion.id}"`,
        });

    if (
      duplicate.items.length >
      0
    ) {
      console.log(
        "Duplicate expense found.",
      );

      await pb
        .collection(
          "expense_ingestions",
        )
        .update(
          ingestion.id,
          {
            status:
              "processed",
          },
        );

      console.log(
        "Ingestion marked as processed.",
      );

      continue;
    }

    /*
     * Build final expense record.
     */
    const expenseData = {
      user: ingestion.user,

      date:
        ingestion.transaction_date,

      amount:
        Number(
          ingestion.amount,
        ),

      category:
        ingestion.category ||
        "Uncategorized",

      type:
        transactionType,

      notes: [
        ingestion.merchant ||
          "",
        transactionNotes,
        `Source: ${
          ingestion.source ||
          "unknown"
        }`,
        `Ingestion: ${ingestion.id}`,
      ]
        .filter(Boolean)
        .join(" | "),

      paid: true,
    };

    /*
     * Attach bank account only
     * when valid.
     *
     * IMPORTANT:
     * This does NOT update the
     * bank_accounts.balance.
     */
    if (accountId) {
      expenseData.account =
        accountId;
    }

    /*
     * Preserve pet relation when
     * supplied and valid.
     */
    if (petId) {
      expenseData.pet =
        petId;
    }

    console.log(
      "Creating expense...",
    );

    const expense =
      await pb
        .collection(
          "expenses",
        )
        .create(
          expenseData,
        );

    console.log(
      `Expense created successfully: ${expense.id}`,
    );

    /*
     * Mark ingestion as processed.
     */
    await pb
      .collection(
        "expense_ingestions",
      )
      .update(
        ingestion.id,
        {
          status:
            "processed",
        },
      );

    console.log(
      "Ingestion marked as processed.",
    );
  } catch (error) {
    console.error(
      `Failed to process ${ingestion.id}:`,
      error?.response
        ?.data ||
        error?.message ||
        error,
    );

    try {
      await pb
        .collection(
          "expense_ingestions",
        )
        .update(
          ingestion.id,
          {
            status:
              "failed",
          },
        );

      console.log(
        "Ingestion marked as failed.",
      );
    } catch (
      updateError
    ) {
      console.error(
        "Could not mark ingestion as failed:",
        updateError?.response
          ?.data ||
          updateError?.message ||
          updateError,
      );
    }
  }
}

console.log(
  "\nExpense ingestion processing complete.",
);