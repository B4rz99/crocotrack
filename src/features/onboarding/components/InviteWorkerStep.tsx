import { Trash2 } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

interface KeyedEmail {
  readonly key: string;
  readonly email: string;
}

interface InviteWorkerStepProps {
  readonly onComplete: (emails: readonly string[]) => void;
  readonly onBack: () => void;
}

export function InviteWorkerStep({ onComplete, onBack }: InviteWorkerStepProps) {
  const { t } = useTranslation("onboarding");
  const { t: tc } = useTranslation("common");
  const [emails, setEmails] = useState<readonly KeyedEmail[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const keyCounter = useRef(0);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;

    keyCounter.current += 1;
    setEmails((prev) => [...prev, { key: `email-${keyCounter.current}`, email: newEmail.trim() }]);
    setNewEmail("");
  }

  function handleRemove(key: string) {
    setEmails((prev) => prev.filter((item) => item.key !== key));
  }

  const emailValues = emails.map((item) => item.email);

  return (
    <div className="space-y-4">
      {emails.length > 0 && (
        <ul className="space-y-2">
          {emails.map((item) => (
            <li key={item.key} className="flex items-center justify-between rounded-lg border p-3">
              <span>{item.email}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRemove(item.key)}
                aria-label={tc("actions.remove")}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="invite-email">{t("invite.email")}</Label>
          <Input
            id="invite-email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" className="self-end">
          {tc("actions.add")}
        </Button>
      </form>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          {tc("actions.back")}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => onComplete([])}>
            {t("invite.skip")}
          </Button>
          <Button type="button" onClick={() => onComplete(emailValues)}>
            {tc("actions.complete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
