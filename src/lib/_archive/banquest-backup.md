# Banquest Payment Integration Backup

This file contains the complete Banquest/NMI payment integration code that was replaced with Square.
When you're ready to switch back to Banquest, tell Claude to restore these files.

## Status
- **Archived Date:** February 2026
- **Reason:** Switching to Square temporarily while Banquest integration issues are resolved
- **Banquest is cheaper** - switch back when ready

## Environment Variables Needed for Banquest
```env
BANQUEST_SOURCE_KEY=your-security-key
NEXT_PUBLIC_BANQUEST_TOKENIZATION_KEY=your-tokenization-key
```

## Files to Restore

### 1. src/lib/banquest.ts (KEEP AS-IS - not deleted)
The banquest.ts file is still in place. No changes needed.

### 2. src/components/payment/CollectJsPayment.tsx (KEEP AS-IS - not deleted)
The CollectJsPayment.tsx component is still in place. No changes needed.

### 3. API Routes - Switch back to Banquest

In each API route, change the import from:
```typescript
import { processSquarePayment } from "@/lib/square";
```

Back to:
```typescript
import { processPayment } from "@/lib/banquest";
```

And change the payment processing call from:
```typescript
const paymentResult = await processSquarePayment({
  sourceId: paymentToken,
  amount: numericAmount,
  email,
  // ...
});
```

Back to:
```typescript
const paymentResult = await processPayment({
  amount: numericAmount,
  paymentToken,
  cardName,
  email,
  description: "...",
});
```

### 4. Frontend Components - Switch back to CollectJsPayment

In donation page and event registration pages, change:
```typescript
import SquarePayment, { useSquarePayment } from "@/components/payment/SquarePayment";
```

Back to:
```typescript
import CollectJsPayment, { useCollectJs } from "@/components/payment/CollectJsPayment";
```

And change the hook usage from:
```typescript
const { requestToken } = useSquarePayment();
```

Back to:
```typescript
const { requestToken } = useCollectJs();
```

## Quick Restoration Commands

Tell Claude:
> "Switch payments back to Banquest. Restore from the archive at src/lib/_archive/banquest-backup.md"

Claude will:
1. Update API routes to import from banquest.ts
2. Update frontend pages to use CollectJsPayment
3. Remove Square environment variables from .env.local

## Original Banquest Files (Preserved)
- `src/lib/banquest.ts` - Main payment processing library
- `src/components/payment/CollectJsPayment.tsx` - Frontend payment component

These files are NOT deleted and remain in the codebase for easy switching.
