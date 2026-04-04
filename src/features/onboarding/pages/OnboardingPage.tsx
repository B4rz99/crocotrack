import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";
import { CleaningFrequencyStep } from "../components/CleaningFrequencyStep";
import { CleaningProductSetupStep } from "../components/CleaningProductSetupStep";
import { FarmSetupStep } from "../components/FarmSetupStep";
import { FoodTypeSetupStep } from "../components/FoodTypeSetupStep";
import { IncubatorSetupStep } from "../components/IncubatorSetupStep";
import { InviteWorkerStep } from "../components/InviteWorkerStep";
import { OrgSetupStep } from "../components/OrgSetupStep";
import { PoolSetupStep } from "../components/PoolSetupStep";
import { useOnboardingWizard } from "../hooks/useOnboardingWizard";

const STEP_LABELS = [
  "Organización",
  "Granja",
  "Tipos de Alimento",
  "Productos de Limpieza",
  "Frecuencia de Limpieza",
  "Piletas",
  "Incubadoras",
  "Invitar Equipo",
] as const;

const TOTAL_STEPS = STEP_LABELS.length;

export function OnboardingPage() {
  const {
    currentStep,
    isSubmitting,
    error,
    handleOrgNext,
    handleFarmNext,
    handleFoodTypesNext,
    handleCleaningProductsNext,
    handleCleaningFrequencyNext,
    handlePoolsNext,
    handleIncubatorsNext,
    handleComplete,
    prevStep,
  } = useOnboardingWizard();

  const progressValue = ((currentStep + 1) / TOTAL_STEPS) * 100;
  const stepLabel = STEP_LABELS[currentStep] ?? "";

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Bienvenido a CrocoTrack</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configura tu criadero en unos simples pasos
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{stepLabel}</span>
          <span>
            {currentStep + 1} / {TOTAL_STEPS}
          </span>
        </div>
        <Progress value={progressValue} />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{stepLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {currentStep === 0 && <OrgSetupStep onNext={handleOrgNext} />}
          {currentStep === 1 && <FarmSetupStep onNext={handleFarmNext} onBack={prevStep} />}
          {currentStep === 2 && (
            <FoodTypeSetupStep onNext={handleFoodTypesNext} onBack={prevStep} />
          )}
          {currentStep === 3 && (
            <CleaningProductSetupStep onNext={handleCleaningProductsNext} onBack={prevStep} />
          )}
          {currentStep === 4 && (
            <CleaningFrequencyStep onNext={handleCleaningFrequencyNext} onBack={prevStep} />
          )}
          {currentStep === 5 && <PoolSetupStep onNext={handlePoolsNext} onBack={prevStep} />}
          {currentStep === 6 && (
            <IncubatorSetupStep onNext={handleIncubatorsNext} onBack={prevStep} />
          )}
          {currentStep === 7 && <InviteWorkerStep onComplete={handleComplete} onBack={prevStep} />}
          {isSubmitting && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Tu criadero está listo para ser gestionado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
