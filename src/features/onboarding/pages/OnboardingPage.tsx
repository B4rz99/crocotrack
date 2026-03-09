import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";
import { FarmSetupStep } from "../components/FarmSetupStep";
import { FoodTypeSetupStep } from "../components/FoodTypeSetupStep";
import { IncubatorSetupStep } from "../components/IncubatorSetupStep";
import { InviteWorkerStep } from "../components/InviteWorkerStep";
import { OrgSetupStep } from "../components/OrgSetupStep";
import { PoolSetupStep } from "../components/PoolSetupStep";
import { useOnboardingWizard } from "../hooks/useOnboardingWizard";

const TOTAL_STEPS = 6;

const STEP_KEYS = [
  "steps.org",
  "steps.farm",
  "steps.food_types",
  "steps.pools",
  "steps.incubators",
  "steps.invite",
] as const;

export function OnboardingPage() {
  const { t } = useTranslation("onboarding");
  const {
    currentStep,
    isSubmitting,
    error,
    handleOrgNext,
    handleFarmNext,
    handleFoodTypesNext,
    handlePoolsNext,
    handleIncubatorsNext,
    handleComplete,
    prevStep,
  } = useOnboardingWizard();

  const progressValue = ((currentStep + 1) / TOTAL_STEPS) * 100;
  const stepKey = STEP_KEYS[currentStep];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{t("welcome.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("welcome.subtitle")}</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{stepKey ? t(stepKey) : ""}</span>
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
          <CardTitle>{stepKey ? t(stepKey) : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          {currentStep === 0 && <OrgSetupStep onNext={handleOrgNext} />}
          {currentStep === 1 && <FarmSetupStep onNext={handleFarmNext} onBack={prevStep} />}
          {currentStep === 2 && (
            <FoodTypeSetupStep onNext={handleFoodTypesNext} onBack={prevStep} />
          )}
          {currentStep === 3 && <PoolSetupStep onNext={handlePoolsNext} onBack={prevStep} />}
          {currentStep === 4 && (
            <IncubatorSetupStep onNext={handleIncubatorsNext} onBack={prevStep} />
          )}
          {currentStep === 5 && <InviteWorkerStep onComplete={handleComplete} onBack={prevStep} />}
          {isSubmitting && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {t("complete.subtitle")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
