import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { getFarms } from "../api/farms.api";

export function useFarms() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  return useQuery({
    queryKey: ["farms", orgId],
    queryFn: () => getFarms(orgId as string),
    enabled: !!orgId,
  });
}
