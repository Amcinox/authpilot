import React, { useState, useEffect } from "react";
import { Eye, EyeOff, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/shared/copy-button";
import { maskSecret } from "@/lib/utils";

interface SecretFieldProps {
  value: string;
  label: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  placeholder?: string;
  initiallyHidden?: boolean;
}

export const SecretField: React.FC<SecretFieldProps> = ({
  value,
  label,
  onChange,
  editable = false,
  placeholder,
  initiallyHidden = true,
}) => {
  const [revealed, setRevealed] = useState(!initiallyHidden);
  const [draft, setDraft] = useState(value);
  const isDirty = draft !== value;

  // Sync draft when external value changes
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleSave = () => {
    if (isDirty && onChange) {
      onChange(draft);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        {editable ? (
          <Input
            type={revealed ? "text" : "password"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            placeholder={placeholder || `Enter ${label}...`}
            className={`font-mono text-sm ${isDirty ? "border-amber-500 ring-1 ring-amber-500/30" : ""}`}
          />
        ) : (
          <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 font-mono text-sm">
            {revealed ? value : maskSecret(value)}
          </div>
        )}
      </div>
      {editable && isDirty && (
        <Button
          variant="default"
          size="icon"
          onClick={handleSave}
          title="Save"
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Save className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setRevealed(!revealed)}
        title={revealed ? "Hide" : "Reveal"}
      >
        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      <CopyButton value={value} label={label} />
    </div>
  );
};
