import { ArrowLeftIcon } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { FoodPurchaseForm } from "../components/FoodPurchaseForm";
import { useCreateFoodPurchase } from "../hooks/useCreateFoodPurchase";
import { useFoodTypes } from "../hooks/useFoodTypes";

export function CreateFoodPurchasePage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: foodTypes = [] } = useFoodTypes();
  const createPurchase = useCreateFoodPurchase(farmId);

  const stockPath = ROUTES.FOOD_STOCK.replace(":farmId", farmId);
  const defaultFoodTypeId = searchParams.get("food_type_id") ?? "";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Volver a stock"
          onClick={() => navigate(stockPath)}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-xl font-bold">Registrar Compra de Alimento</h1>
      </div>

      <FoodPurchaseForm
        foodTypes={foodTypes}
        defaultFoodTypeId={defaultFoodTypeId}
        isLoading={createPurchase.isPending}
        onSubmit={(input) => {
          createPurchase.mutate(input, {
            onSuccess: () => {
              toast.success("Compra registrada exitosamente");
              navigate(stockPath);
            },
            onError: (err) => {
              toast.error(
                err instanceof Error ? err.message : "Error al registrar la compra"
              );
            },
          });
        }}
      />
    </div>
  );
}
