import { useEffect, useState } from "react";
import { pb } from "../lib/pocketbase";

export function useAuth() {
  const [, force] = useState(0);

  useEffect(() => {
    const handler = () => force((v) => v + 1);
    const unsubscribe = pb.authStore.onChange(handler);
    return unsubscribe;
  }, []);

  return {
    user: pb.authStore.record,
    record: pb.authStore.record,
    token: pb.authStore.token,
    isValid: pb.authStore.isValid,
    role: (pb.authStore.record?.role as "superadmin" | "customer" | undefined) || "customer"
  };
}
