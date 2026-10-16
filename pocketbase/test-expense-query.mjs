import PocketBase from "pocketbase";

const pb = new PocketBase("http://127.0.0.1:8090");

await pb
  .collection("_superusers")
  .authWithPassword(
    process.env.PB_SUPERUSER_EMAIL,
    process.env.PB_SUPERUSER_PASSWORD
  );

const result = await pb.collection("expense_ingestions").getList(1, 50, {
  filter: 'status = "pending"',
});

console.log(
  result.items.map((item) => ({
    id: item.id,
    merchant: item.merchant,
    status: item.status,
  }))
);