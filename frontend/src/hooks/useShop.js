/**
 * useShop — reads the current Shopify shop domain from URL search params.
 * All pages that need the shop identifier import this hook.
 */
import { useSearchParams } from "react-router-dom";

export function useShop() {
  const [searchParams] = useSearchParams();
  return searchParams.get("shop") || "";
}
