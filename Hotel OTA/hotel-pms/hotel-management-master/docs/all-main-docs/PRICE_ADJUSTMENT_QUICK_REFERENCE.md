# Price Adjustment Visual Indicators - Quick Reference

## 🚀 Quick Start

### Files Changed
1. `frontend/src/types/booking.ts` - Added TypeScript interfaces
2. `frontend/src/pages/guest/GuestBookings.tsx` - Added visual indicators

### Visual Indicators at a Glance

| Indicator | Discount | Surcharge | None |
|-----------|----------|-----------|------|
| **Border** | Green (left, 4px) | Red (left, 4px) | None |
| **Badge** | Green with ↓ | Red with ↑ | - |
| **Text** | "X% OFF" | "+X%" | - |
| **Savings** | Green "You Save ₹X" | Red "Additional ₹X" | - |
| **Shadow** | Enhanced (lg→xl) | Enhanced (lg→xl) | Normal |

---

## 📊 Code Snippets

### Helper Functions

```typescript
// Check if booking has adjustments
const hasPriceAdjustments = (booking) =>
  booking.priceAdjustments?.length > 0 &&
  booking.priceAdjustments.some(adj => !adj.isReversed);

// Calculate net adjustment amount
const calculateAdjustmentAmount = (booking) =>
  (booking.discountAmount || 0) - (booking.surchargeAmount || 0);

// Calculate savings percentage
const calculateSavingsPercentage = (booking) => {
  const original = booking.originalAmount || booking.totalAmount;
  const adjustment = calculateAdjustmentAmount(booking);
  return original === 0 ? 0 : Math.round((adjustment / original) * 100);
};
```

### Usage in Component

```tsx
// In the map function
{filteredBookings.map((booking) => {
  const hasDiscount = hasPriceAdjustments(booking) &&
                     calculateAdjustmentAmount(booking) > 0;
  const hasSurcharge = hasPriceAdjustments(booking) &&
                      calculateAdjustmentAmount(booking) < 0;

  return (
    <Card className={hasDiscount ? 'border-l-green-500' :
                     hasSurcharge ? 'border-l-red-500' : ''}>
      {/* Content */}
    </Card>
  );
})}
```

---

## 🎨 Color Reference

### Discount (Green)
```css
border-l-green-500    /* #22c55e - Border */
bg-green-100          /* #dcfce7 - Badge BG */
text-green-800        /* #166534 - Badge Text */
text-green-600        /* #16a34a - Amount */
bg-green-50           /* #f0fdf4 - Detail Card */
```

### Surcharge (Red)
```css
border-l-red-500      /* #ef4444 - Border */
bg-red-100            /* #fee2e2 - Badge BG */
text-red-800          /* #991b1b - Badge Text */
text-red-600          /* #dc2626 - Amount */
bg-red-50             /* #fef2f2 - Detail Card */
```

---

## 🔍 Data Structure

### Backend Response Expected
```json
{
  "totalAmount": 4000,
  "originalAmount": 5000,
  "discountAmount": 1000,
  "surchargeAmount": 0,
  "priceAdjustments": [
    {
      "_id": "adj123",
      "amount": -500,         // Negative = discount
      "reason": "Early Bird",
      "type": "discount",
      "adjustedBy": "admin",
      "adjustedAt": "2025-01-15T10:30:00Z",
      "isReversed": false
    }
  ]
}
```

### TypeScript Interface
```typescript
interface Booking {
  // ... existing fields
  originalAmount?: number;
  discountAmount?: number;
  surchargeAmount?: number;
  priceAdjustments?: Array<{
    _id: string;
    amount: number;
    reason: string;
    type: 'discount' | 'surcharge';
    adjustedBy: string;
    adjustedAt: string;
    isReversed?: boolean;
  }>;
}
```

---

## 🎯 Key Features

### 1. Card Border
```tsx
className={`border-l-4 ${
  hasDiscount ? 'border-l-green-500' :
  hasSurcharge ? 'border-l-red-500' : ''
}`}
```

### 2. Percentage Badge
```tsx
{calculateAdjustmentAmount(booking) > 0 ? (
  <span className="bg-green-100 text-green-800">
    <TrendingDown className="w-3 h-3" />
    {calculateSavingsPercentage(booking)}% OFF
  </span>
) : (
  <span className="bg-red-100 text-red-800">
    <TrendingUp className="w-3 h-3" />
    +{Math.abs(calculateSavingsPercentage(booking))}%
  </span>
)}
```

### 3. Savings Amount
```tsx
{booking.discountAmount > 0 && (
  <div className="text-green-600">
    <Percent className="w-3 h-3" />
    You Save {formatCurrency(booking.discountAmount)}
  </div>
)}
```

### 4. Adjustment Details
```tsx
{hasPriceAdjustments(booking) && (
  <div>
    <h4>Price Adjustments</h4>
    {booking.priceAdjustments
      .filter(adj => !adj.isReversed)
      .map(adjustment => (
        <div className={adjustment.amount < 0 ? 'bg-green-50' : 'bg-red-50'}>
          {adjustment.reason}
          {formatCurrency(Math.abs(adjustment.amount))}
        </div>
      ))}
  </div>
)}
```

---

## 🐛 Common Issues & Solutions

### Issue 1: TypeScript Error on priceAdjustments
```typescript
// ❌ Wrong
booking.priceAdjustments.map(...)

// ✅ Correct
booking.priceAdjustments?.map(...) || []
```

### Issue 2: Division by Zero
```typescript
// ❌ Wrong
const percent = (adjustment / original) * 100;

// ✅ Correct
const percent = original === 0 ? 0 : (adjustment / original) * 100;
```

### Issue 3: Negative Percentage Display
```typescript
// ❌ Wrong
{calculateSavingsPercentage(booking)}% OFF

// ✅ Correct (for surcharge)
+{Math.abs(calculateSavingsPercentage(booking))}%
```

### Issue 4: Missing originalAmount
```typescript
// ❌ Wrong
booking.originalAmount

// ✅ Correct
booking.originalAmount || booking.totalAmount
```

---

## ✅ Testing Checklist

```markdown
### Visual Tests
- [ ] Green border shows for discounts
- [ ] Red border shows for surcharges
- [ ] No border shows for normal bookings
- [ ] Badge displays correct percentage
- [ ] Savings amount is accurate
- [ ] Original price has strikethrough

### Functional Tests
- [ ] No errors when priceAdjustments is undefined
- [ ] No errors when originalAmount is missing
- [ ] Percentage calculation is correct
- [ ] Multiple adjustments sum correctly
- [ ] Reversed adjustments are filtered out

### Responsive Tests
- [ ] Mobile layout stacks properly
- [ ] Desktop layout aligns correctly
- [ ] Icons scale appropriately
- [ ] Touch targets are adequate

### Edge Cases
- [ ] Zero amount handled
- [ ] Empty adjustments array handled
- [ ] Very large numbers display properly
- [ ] Very small percentages display properly
```

---

## 📱 Responsive Breakpoints

```css
/* Mobile First */
sm:  640px  /* Tablet */
md:  768px  /* Desktop */
lg:  1024px /* Large Desktop */
xl:  1280px /* Extra Large */
```

### Key Responsive Changes
```tsx
// Flex direction
className="flex-col sm:flex-row"

// Text alignment
className="text-left sm:text-right"

// Gap spacing
className="gap-2 sm:gap-3"

// Padding
className="p-4 sm:p-6"
```

---

## 🎭 Animation & Transitions

```css
/* Card Hover */
transition-all duration-200
hover:shadow-md → hover:shadow-xl

/* Badge Appearance */
No animation (instant display)

/* Price Change */
No animation (instant display)
```

---

## 🔧 Customization Options

### Change Border Width
```tsx
// Default: 4px
border-l-4

// Options
border-l-2  // Thinner
border-l-8  // Thicker
```

### Change Badge Size
```tsx
// Default
px-2 py-1 text-xs

// Larger
px-3 py-1.5 text-sm
```

### Change Icon Size
```tsx
// Default
w-3 h-3  // 12px

// Options
w-4 h-4  // 16px
w-5 h-5  // 20px
```

---

## 📚 Related Components

### Icons Used
- `TrendingDown` - Discount indicator
- `TrendingUp` - Surcharge indicator
- `Percent` - Savings icon
- `CreditCard` - Payment status

### Utilities Used
- `formatCurrency()` - Price formatting
- `formatDate()` - Date formatting

---

## 🚨 Important Notes

1. **Amount Sign Convention:**
   - Negative amount = Discount (e.g., -500)
   - Positive amount = Surcharge (e.g., +500)

2. **Reversed Adjustments:**
   - Always filter with `.filter(adj => !adj.isReversed)`
   - Reversed adjustments should not display

3. **originalAmount Fallback:**
   - Always use: `booking.originalAmount || booking.totalAmount`

4. **Optional Chaining:**
   - Always use `?.` for priceAdjustments
   - Arrays: Use `|| []` after optional chaining

5. **Performance:**
   - Helper functions are called on each render
   - Consider memoization for large lists

---

## 📞 Support

### For Questions:
- Check main documentation: `PRICE_ADJUSTMENT_VISUAL_INDICATORS_SUMMARY.md`
- Visual comparison: `PRICE_ADJUSTMENT_VISUAL_COMPARISON.md`

### Modified Files:
1. `frontend/src/types/booking.ts`
2. `frontend/src/pages/guest/GuestBookings.tsx`

### Backend Integration:
- Ensure API returns `originalAmount`, `discountAmount`, `surchargeAmount`
- Ensure `priceAdjustments` array is populated
- Use negative amounts for discounts

---

## 🎯 Quick Commands

```bash
# Run frontend with changes
cd frontend && npm run dev

# Type check
npm run type-check

# Build for production
npm run build

# Run tests
npm run test
```

---

## ⚡ Performance Tips

1. **Memoize calculations** for large lists:
```typescript
const adjustmentInfo = useMemo(() => ({
  hasAdjustments: hasPriceAdjustments(booking),
  amount: calculateAdjustmentAmount(booking),
  percentage: calculateSavingsPercentage(booking)
}), [booking]);
```

2. **Lazy load** adjustment details:
```typescript
const [showDetails, setShowDetails] = useState(false);
```

3. **Virtual scrolling** for many bookings:
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
```

---

## 🎨 Theme Customization

### To change colors globally:

```tsx
// In your theme config or constants
const ADJUSTMENT_COLORS = {
  discount: {
    border: 'border-l-green-500',
    badge: 'bg-green-100 text-green-800',
    amount: 'text-green-600',
    card: 'bg-green-50'
  },
  surcharge: {
    border: 'border-l-red-500',
    badge: 'bg-red-100 text-red-800',
    amount: 'text-red-600',
    card: 'bg-red-50'
  }
};
```

---

## 📊 Analytics Integration

Track user interactions:

```typescript
// When user views adjusted booking
analytics.track('Booking_Adjustment_Viewed', {
  bookingId: booking._id,
  adjustmentType: hasDiscount ? 'discount' : 'surcharge',
  adjustmentAmount: Math.abs(calculateAdjustmentAmount(booking)),
  adjustmentPercentage: calculateSavingsPercentage(booking)
});
```

---

**Last Updated:** January 2025
**Version:** 1.0.0
**Status:** Production Ready ✅
