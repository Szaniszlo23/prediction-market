"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type MarketType = "binary" | "categorical" | "multi";

type CreateMarketFormProps = {
  action: (formData: FormData) => void;
};

export function CreateMarketForm({ action }: CreateMarketFormProps) {
  const [title, setTitle] = useState("");
  const [marketType, setMarketType] = useState<MarketType>("binary");
  const [binaryQuestion, setBinaryQuestion] = useState("");
  const [binaryQuestionTouched, setBinaryQuestionTouched] = useState(false);
  const [categoricalOutcomes, setCategoricalOutcomes] = useState(["", ""]);
  const [multiOutcomes, setMultiOutcomes] = useState([""]);

  function onTitleChange(nextTitle: string) {
    setTitle(nextTitle);
    if (!binaryQuestionTouched) {
      setBinaryQuestion(nextTitle);
    }
  }

  const outcomesJson = useMemo(() => {
    if (marketType === "binary") {
      const label = binaryQuestion.trim() || title.trim() || "Outcome";
      return JSON.stringify([label]);
    }

    if (marketType === "categorical") {
      return JSON.stringify(categoricalOutcomes.map((o) => o.trim()).filter(Boolean));
    }

    return JSON.stringify(multiOutcomes.map((o) => o.trim()).filter(Boolean));
  }, [binaryQuestion, categoricalOutcomes, marketType, multiOutcomes, title]);

  return (
    <Form action={action}>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" onChange={(e) => onTitleChange(e.target.value)} required value={title} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <select
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          defaultValue="Sports"
          id="category"
          name="category"
        >
          <option value="Sports">Sports</option>
          <option value="Politics">Politics</option>
          <option value="Crypto">Crypto</option>
          <option value="Academic">Academic</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="space-y-3">
        <Label>Market Type</Label>
        <div className="flex flex-col gap-2">
          {(
            [
              { value: "binary", label: "Binary", description: "Yes / No question" },
              { value: "categorical", label: "Categorical", description: "Pick one winner" },
              { value: "multi", label: "Multi", description: "Several independent Yes/No questions" },
            ] as const
          ).map(({ value, label, description }) => (
            <button
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                marketType === value
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-input text-muted-foreground hover:border-muted-foreground"
              }`}
              key={value}
              onClick={() => setMarketType(value)}
              type="button"
            >
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  marketType === value ? "border-primary" : "border-muted-foreground"
                }`}
              >
                {marketType === value && (
                  <span className="size-2 rounded-full bg-primary" />
                )}
              </span>
              <span>
                <span className="font-medium text-foreground">{label}</span>
                <span className="ml-2 text-sm text-muted-foreground">{description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {marketType === "binary" ? (
        <div className="space-y-2">
          <Label htmlFor="binary_question">Question</Label>
          <Input
            id="binary_question"
            onChange={(e) => {
              setBinaryQuestionTouched(true);
              setBinaryQuestion(e.target.value);
            }}
            value={binaryQuestion}
          />
          <p className="text-sm text-muted-foreground">
            Users will buy YES or NO shares of this question.
          </p>
        </div>
      ) : null}

      {marketType === "categorical" ? (
        <div className="space-y-2">
          <Label>Outcomes</Label>
          {categoricalOutcomes.map((value, index) => (
            <Input
              key={`cat-${index}`}
              onChange={(e) =>
                setCategoricalOutcomes((prev) =>
                  prev.map((item, i) => (i === index ? e.target.value : item)),
                )
              }
              placeholder={`Option ${index + 1}`}
              value={value}
            />
          ))}
          <Button
            disabled={categoricalOutcomes.length >= 10}
            onClick={() => setCategoricalOutcomes((prev) => [...prev, ""])}
            type="button"
            variant="outline"
          >
            Add option
          </Button>
          <p className="text-sm text-muted-foreground">
            Exactly one outcome will resolve YES; all others will resolve NO automatically.
          </p>
        </div>
      ) : null}

      {marketType === "multi" ? (
        <div className="space-y-2">
          <Label>Sub-questions</Label>
          {multiOutcomes.map((value, index) => (
            <Input
              key={`multi-${index}`}
              onChange={(e) =>
                setMultiOutcomes((prev) =>
                  prev.map((item, i) => (i === index ? e.target.value : item)),
                )
              }
              placeholder={`Question ${index + 1}`}
              value={value}
            />
          ))}
          <Button
            disabled={multiOutcomes.length >= 20}
            onClick={() => setMultiOutcomes((prev) => [...prev, ""])}
            type="button"
            variant="outline"
          >
            Add question
          </Button>
          <p className="text-sm text-muted-foreground">
            Each sub-question can independently resolve YES or NO. Users bet YES/NO on each one separately.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="resolves_at">Resolves at</Label>
        <Input id="resolves_at" name="resolves_at" type="datetime-local" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="liquidity_b">Liquidity b</Label>
        <Input defaultValue={100} id="liquidity_b" min={1} name="liquidity_b" type="number" />
        <p className="text-sm text-muted-foreground">
          Higher = more stable prices, lower = more price movement per trade. For 10-30 users, 50-150 is reasonable.
        </p>
      </div>

      {/* Hidden inputs — Base UI RadioGroup doesn't submit natively, so we sync state manually */}
      <input name="market_type" type="hidden" value={marketType} />
      <input name="outcomes_json" type="hidden" value={outcomesJson} />

      <div className="flex items-center gap-2">
        <Button type="submit">Create market</Button>
      </div>
    </Form>
  );
}
