"use client";

import { useState } from "react";
import { CreateMarketForm } from "@/components/admin/CreateMarketForm";
import { MarketRequestsQueue } from "@/components/admin/MarketRequestsQueue";
import Link from "next/link";

type AdminTabsProps = {
  createMarket: (formData: FormData) => void;
  adminId: string;
  initialTab?: string;
  errorMessage?: string | null;
};

export function AdminTabs({ createMarket, adminId, initialTab, errorMessage }: AdminTabsProps) {
  const [activeTab, setActiveTab] = useState<"create" | "requests">(
    initialTab === "requests" ? "requests" : "create",
  );

  // Pre-fill state from approved request
  const [prefillTitle, setPrefillTitle] = useState("");
  const [prefillDescription, setPrefillDescription] = useState("");
  const [prefillCategory, setPrefillCategory] = useState("");

  function handleApprove(title: string, category: string, description: string) {
    setPrefillTitle(title);
    setPrefillCategory(category);
    setPrefillDescription(description);
    setActiveTab("create");
  }

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab("create")}
          className={`rounded-md px-3 py-1 text-sm transition-colors ${
            activeTab === "create"
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Create Market
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`rounded-md px-3 py-1 text-sm transition-colors ${
            activeTab === "requests"
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Market Requests
        </button>
      </div>

      {activeTab === "create" ? (
        <div className="space-y-4">
          {errorMessage && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <strong>Market creation failed:</strong> {errorMessage}
            </div>
          )}
          <CreateMarketForm
            action={createMarket}
            prefillTitle={prefillTitle}
            prefillDescription={prefillDescription}
            prefillCategory={prefillCategory}
          />
          <Link className="text-sm underline" href={`/admin/markets?admin=${adminId}`}>
            View all markets
          </Link>
        </div>
      ) : (
        <MarketRequestsQueue onApprove={handleApprove} />
      )}
    </div>
  );
}
