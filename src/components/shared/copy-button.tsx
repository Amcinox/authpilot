import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/utils";
import { useToastStore } from "@/stores/toast-store";

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  value,
  label,
  className,
  variant = "ghost",
  size = "icon",
}) => {
  const [copied, setCopied] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const handleCopy = async () => {
    await copyToClipboard(value);
    setCopied(true);
    addToast({ type: "success", message: label ? `${label} copied!` : "Copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant={variant} size={size} onClick={handleCopy} className={className} title="Copy">
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      {size !== "icon" && (copied ? "Copied" : label || "Copy")}
    </Button>
  );
};
