import { Router } from "express";
import { z } from "zod";
import { pb, authenticatePocketBase, escapeFilterValue, getPocketBaseError } from "../services/pb.mjs";
import { authenticateRequest, authenticateShortcutToken } from "../middleware/auth.mjs";

export async function processExpenseIngestion(ingestion) {
  console.log(
    `Processing ingestion ${ingestion.id} - ${
      ingestion.merchant || "Unknown merchant"
    }`,
  );

  const raw =
    ingestion.raw_data && typeof ingestion.raw_data === "object"
      ? ingestion.raw_data
      : {};

  const transactionType =
    raw.type === "Income" ? "Income" : "Expense";

  const transactionNotes =
    typeof raw.notes === "string"
      ? raw.notes.trim()
      : "";

  let accountId = null;

  if (
    typeof ingestion.account === "string" &&
    ingestion.account.trim()
  ) {
    accountId = ingestion.account.trim();
  } else if (
    typeof raw.account === "string" &&
    raw.account.trim()
  ) {
    accountId = raw.account.trim();
  }

  /* -----------------------------------------
     Validate account ownership
  ----------------------------------------- */
  if (accountId) {
    try {
      const account = await pb
        .collection("bank_accounts")
        .getOne(accountId);

      if (account.user !== ingestion.user) {
        throw new Error(
          "Bank account does not belong to ingestion user.",
        );
      }
    } catch (error) {
      console.error(
        `Invalid account ${accountId}:`,
        getPocketBaseError(error),
      );

      accountId = null;
    }
  }

  /* -----------------------------------------
     Validate pet ownership
  ----------------------------------------- */
  let petId = null;

  if (
    typeof raw.pet === "string" &&
    raw.pet.trim()
  ) {
    petId = raw.pet.trim();

    try {
      const pet = await pb
        .collection("pets")
        .getOne(petId);

      if (pet.user !== ingestion.user) {
        throw new Error(
          "Pet does not belong to ingestion user.",
        );
      }
    } catch (error) {
      console.error(
        `Invalid pet ${petId}:`,
        getPocketBaseError(error),
      );

      petId = null;
    }
  }

  /* -----------------------------------------
     Duplicate expense protection
     IMPORTANT: Duplicate is scoped by user.
  ----------------------------------------- */
  const duplicate = await pb
    .collection("expenses")
    .getList(1, 1, {
      filter:
        `user = "${escapeFilterValue(
          ingestion.user,
        )}" && notes ~ "Ingestion: ${escapeFilterValue(
          ingestion.id,
        )}"`,
    });

  if (duplicate.items.length > 0) {
    console.log(
      "Duplicate expense found. Marking ingestion as processed.",
    );

    await pb
      .collection("expense_ingestions")
      .update(ingestion.id, {
        status: "processed",
      });

    return {
      success: true,
      duplicate: true,
      expense: duplicate.items[0],
    };
  }

  /* -----------------------------------------
     Create expense
  ----------------------------------------- */
  const expenseData = {
    user: ingestion.user,
    date: ingestion.transaction_date,
    amount: Number(ingestion.amount),
    category:
      ingestion.category || "Uncategorized",
    type: transactionType,
    notes: [
      ingestion.merchant || "",
      transactionNotes,
      `Source: ${ingestion.source || "unknown"}`,
      `Ingestion: ${ingestion.id}`,
    ]
      .filter(Boolean)
      .join(" | "),
    paid: true,
  };

  if (accountId) {
    expenseData.account = accountId;
  }

  if (petId) {
    expenseData.pet = petId;
  }

  console.log("Creating expense...");

  const expense = await pb
    .collection("expenses")
    .create(expenseData);

  console.log(
    `Expense created successfully: ${expense.id}`,
  );

  /* -----------------------------------------
     Mark ingestion as processed
  ----------------------------------------- */
  await pb
    .collection("expense_ingestions")
    .update(ingestion.id, {
      status: "processed",
    });

  console.log(
    `Ingestion ${ingestion.id} marked as processed.`,
  );

  return {
    success: true,
    duplicate: false,
    expense,
  };
}

const expenseIngestionSchema = z.object({
  external_id: z
    .string()
    .min(1)
    .max(500)
    .optional()
    .nullable(),

  amount: z
    .number()
    .positive(),

  category: z
    .string()
    .min(1)
    .max(200),

  date: z
    .string()
    .min(1),

  type: z
    .enum(["Income", "Expense"])
    .default("Expense"),

  notes: z
    .string()
    .max(2000)
    .optional()
    .nullable(),

  merchant: z
    .string()
    .max(200)
    .optional()
    .nullable(),

  pet: z
    .string()
    .max(100)
    .optional()
    .nullable(),

  account: z
    .string()
    .max(100)
    .optional()
    .nullable(),

  source: z
    .enum(["manual", "shortcut", "receipt"])
    .default("manual"),
});

export function createExpensesRouter() {
  const router = Router();

  router.post(
    "/api/expense-ingestions",
    async (req, res) => {
      try {
        const sessionAuthorized = await authenticateRequest(req);
        const shortcutAuthorized = sessionAuthorized ? false : await authenticateShortcutToken(req);
        if (!sessionAuthorized && !shortcutAuthorized) {
          return res.status(401).json({
            success: false,
            message: "Unauthorized. Use a valid user session or a registered Shortcut device token.",
          });
        }

        const parsed = expenseIngestionSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            message: "Invalid expense ingestion data.",
            errors: parsed.error.flatten(),
          });
        }

        const data = parsed.data;
        await authenticatePocketBase();

        const user = req.authUser;
        if (!user?.id || String(user.status || "").toLowerCase() !== "active") {
          return res.status(403).json({
            success: false,
            message: "An active user session is required.",
          });
        }

        let accountId = null;
        if (data.account && data.account.trim()) {
          try {
            const account = await pb
              .collection("bank_accounts")
              .getOne(data.account.trim());

            if (account.user !== user.id) {
              return res.status(403).json({
                success: false,
                message: "Bank account does not belong to this user.",
              });
            }

            accountId = account.id;
          } catch {
            return res.status(400).json({
              success: false,
              message: "Invalid bank account.",
            });
          }
        }

        let petId = null;
        if (data.pet && data.pet.trim()) {
          try {
            const pet = await pb
              .collection("pets")
              .getOne(data.pet.trim());

            if (pet.user !== user.id) {
              return res.status(403).json({
                success: false,
                message: "Pet does not belong to this user.",
              });
            }

            petId = pet.id;
          } catch {
            return res.status(400).json({
              success: false,
              message: "Invalid pet.",
            });
          }
        }

        if (data.external_id) {
          const escaped = escapeFilterValue(data.external_id);
          const userEscaped = escapeFilterValue(user.id);
          const existing = await pb
            .collection("expense_ingestions")
            .getList(1, 1, {
              filter: `user = "${userEscaped}" && external_id = "${escaped}"`,
            });

          if (existing.items.length > 0) {
            const item = existing.items[0];

            if (item.status === "pending") {
              console.log(`Existing pending ingestion found: ${item.id}`);

              try {
                const processed = await processExpenseIngestion(item);

                return res.status(200).json({
                  success: true,
                  duplicate: true,
                  processed: true,
                  message: "Existing expense ingestion processed.",
                  ingestion: {
                    id: item.id,
                    status: "processed",
                    source: item.source,
                  },
                  expense: processed.expense ? { id: processed.expense.id } : null,
                });
              } catch (processingError) {
                console.error("Existing ingestion processing error:", getPocketBaseError(processingError));

                await pb.collection("expense_ingestions").update(item.id, {
                  status: "failed",
                });

                return res.status(500).json({
                  success: false,
                  message: "Expense ingestion exists but automatic processing failed.",
                  ingestion: {
                    id: item.id,
                    status: "failed",
                  },
                });
              }
            }

            return res.status(200).json({
              success: true,
              duplicate: true,
              message: "Expense ingestion already exists.",
              ingestion: {
                id: item.id,
                status: item.status,
                source: item.source,
              },
            });
          }
        }

        const ingestionData = {
          user: user.id,
          source: req.authMethod === "shortcut" ? "shortcut" : data.source,
          external_id: data.external_id || null,
          merchant: data.merchant || null,
          amount: data.amount,
          transaction_date: data.date,
          category: data.category,
          notes: data.notes || "",
          raw_data: {
            type: data.type,
            notes: data.notes || "",
            pet: petId,
            account: accountId,
            merchant: data.merchant || null,
            source: data.source,
          },
          status: "pending",
        };

        if (accountId) {
          ingestionData.account = accountId;
        }

        const ingestion = await pb.collection("expense_ingestions").create(ingestionData);
        console.log(`Expense ingestion created: ${ingestion.id}`);

        let processed;
        try {
          processed = await processExpenseIngestion(ingestion);
        } catch (processingError) {
          console.error("Automatic expense processing error:", getPocketBaseError(processingError));

          try {
            await pb.collection("expense_ingestions").update(ingestion.id, {
              status: "failed",
            });
          } catch (statusError) {
            console.error("Could not mark ingestion as failed:", getPocketBaseError(statusError));
          }

          return res.status(500).json({
            success: false,
            message: "Expense ingestion was created, but automatic processing failed.",
            ingestion: {
              id: ingestion.id,
              status: "failed",
            },
          });
        }

        return res.status(201).json({
          success: true,
          message: "Expense created successfully.",
          ingestion: {
            id: ingestion.id,
            source: ingestion.source,
            status: "processed",
            amount: ingestion.amount,
            category: ingestion.category,
            transaction_date: ingestion.transaction_date,
            user: ingestion.user,
            account: accountId,
            pet: petId,
          },
          expense: {
            id: processed.expense?.id || null,
            user: processed.expense?.user || user.id,
          },
        });
      } catch (error) {
        console.error("Expense ingestion API error:", getPocketBaseError(error));
        return res.status(500).json({
          success: false,
          message: "Could not create expense ingestion.",
        });
      }
    },
  );

  return router;
}
