# Setup: Multi-Outcome Migration

This migration is **destructive**.

- It drops and recreates legacy trading tables (`trades`, `positions`).
- It also drops the legacy `place_trade` RPC if present.
- Run this only if you are intentionally resetting the trading schema.

## Run in Supabase SQL Editor

1. Open your Supabase project.
2. Go to **SQL Editor**.
3. Open `supabase/migrations/0002_multi_outcome.sql`.
4. Copy the full SQL content and paste it into SQL Editor.
5. Run it.

## Verify after running

In **Table Editor**, confirm:

- Tables exist:
  - `outcomes`
  - `trades`
  - `positions`
- `markets` has new columns:
  - `market_type`
  - `fees_collected`

## Next steps

- `place_trade` and `resolve_market` RPCs are intentionally not included yet.
- They will be added in subsequent prompts.
