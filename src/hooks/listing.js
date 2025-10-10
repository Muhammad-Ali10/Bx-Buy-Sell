import {getListing }  from "@/services/listingService";
import { useQuery } from "@tanstack/react-query";

export const useListing = () => {
  return useQuery({
    queryKey: ["listing"],
    queryFn: getListing,
  });
};
