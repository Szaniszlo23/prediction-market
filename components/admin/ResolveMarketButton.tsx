"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ResolveMarketButtonProps = {
  marketTitle: string;
};

export function ResolveMarketButton({ marketTitle }: ResolveMarketButtonProps) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Resolve</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Market</DialogTitle>
          <DialogDescription>
            Resolution workflow for &quot;{marketTitle}&quot; is coming in a later phase.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
