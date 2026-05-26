"use client"

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  label?: string;
  href?: string;
  onClick?: () => void;
  iconOnly?: boolean;
  className?: string;
  hideOnMobile?: boolean; // hide when the mobile bottom nav is visible
}

export default function BackButton({ label = "Back", href, onClick, iconOnly = false, className, hideOnMobile = true }: BackButtonProps) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
      return;
    }

    if (href) {
      router.push(href);
      return;
    }

    const canGoBack = typeof window !== "undefined" && window.history.state && typeof window.history.state.idx === "number" && window.history.state.idx > 0;
    if (canGoBack) {
      router.back();
    } else {
      router.push("/");
    }
  }, [href, onClick, router]);

  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? "icon" : "sm"}
      aria-label={label}
      onClick={handleClick}
      className={`border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 shadow-sm bg-white/95 ${hideOnMobile ? 'hidden md:inline-flex' : ''} ${iconOnly ? "rounded-full p-2" : ""} ${className ?? ""}`}
    >
      <ArrowLeft className="w-4 h-4" />
      {!iconOnly && <span>{label}</span>}
    </Button>
  );
}
