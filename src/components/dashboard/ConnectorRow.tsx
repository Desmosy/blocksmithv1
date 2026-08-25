"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ConnectorRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: "connected" | "needs_review" | "not_connected";
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function ConnectorRow({
  icon,
  title,
  description,
  status,
  children,
  defaultOpen = false,
}: ConnectorRowProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group border-b border-[var(--dash-border)] last:border-0 transition-colors hover:bg-[var(--dash-muted)]/10"
    >
      <div className="flex items-center justify-between p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--dash-muted)] border border-[var(--dash-border)] shadow-sm">
            {icon}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-[var(--dash-foreground)]">{title}</span>
            <span className="text-[13px] text-[var(--dash-muted-fg)]">{description}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {status === "connected" && (
            <div className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              <span className="size-1.5 rounded-full bg-green-500" />
              Connected
            </div>
          )}
          {status === "needs_review" && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              <span className="size-1.5 rounded-full bg-amber-500" />
              Needs review
            </div>
          )}
          {status === "not_connected" && (
            <div className="flex items-center gap-1.5 rounded-full border border-[var(--dash-border)] bg-[var(--dash-muted)]/50 px-2 py-0.5 text-xs font-medium text-[var(--dash-muted-fg)]">
              <span className="size-1.5 rounded-full bg-[var(--dash-border-strong)]" />
              Not connected
            </div>
          )}

          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs font-medium">
              {open ? "Close" : "Connect"}
            </Button>
          </CollapsibleTrigger>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-xl">
              <DropdownMenuItem>View Documentation</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="px-5 pb-5 pt-1">
          <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5 shadow-sm">
            {children}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
