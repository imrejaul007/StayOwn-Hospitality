// -----------------------------------------------------------------------------
// POS (Point of Sale) types - mirrors backend/src/models/POSOrder.js,
// backend/src/models/POSMenu.js, and backend/src/models/POSOutlet.js
// -----------------------------------------------------------------------------

// -- POS Outlet ---------------------------------------------------------------

export type POSOutletType =
  | 'restaurant'
  | 'bar'
  | 'spa'
  | 'gym'
  | 'shop'
  | 'room_service'
  | 'minibar'
  | 'banquet'
  | 'parking';

export type POSPaymentMethod = 'cash' | 'card' | 'room_charge' | 'voucher' | 'comp';

export interface OperatingHoursDay {
  open?: string;
  close?: string;
  closed?: boolean;
}

export interface POSOutletSettings {
  allowRoomCharges?: boolean;
  requireSignature?: boolean;
  printReceipts?: boolean;
  allowDiscounts?: boolean;
  maxDiscountPercent?: number;
}

export interface POSTaxSettings {
  defaultTaxRate?: number;
  serviceTaxRate?: number;
  gstRate?: number;
}

export interface POSOutlet {
  _id: string;
  id?: string;
  outletId: string;
  name: string;
  type: POSOutletType;
  location: string;
  isActive: boolean;
  operatingHours?: {
    monday?: OperatingHoursDay;
    tuesday?: OperatingHoursDay;
    wednesday?: OperatingHoursDay;
    thursday?: OperatingHoursDay;
    friday?: OperatingHoursDay;
    saturday?: OperatingHoursDay;
    sunday?: OperatingHoursDay;
  };
  taxSettings?: POSTaxSettings;
  paymentMethods?: POSPaymentMethod[];
  manager?: string;
  staff?: string[];
  settings?: POSOutletSettings;
  createdAt: string;
  updatedAt: string;
}

// -- POS Menu Item & Menu -----------------------------------------------------

export type DietaryInfo =
  | 'vegetarian'
  | 'vegan'
  | 'gluten-free'
  | 'dairy-free'
  | 'nut-free'
  | 'halal'
  | 'kosher';

export type MenuType =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'all_day'
  | 'beverages'
  | 'room_service'
  | 'spa'
  | 'retail'
  | 'services';

export type TaxGroup =
  | 'FOOD'
  | 'BEVERAGE'
  | 'SERVICE'
  | 'PRODUCT'
  | 'ALCOHOL'
  | 'TOBACCO'
  | 'LUXURY'
  | 'GENERAL';

export interface MenuItemModifier {
  name: string;
  options: {
    name: string;
    price: number;
  }[];
}

export interface MenuItemOutlet {
  outletId: string;
  price?: number;
  isAvailable?: boolean;
}

export interface POSMenuItem {
  _id?: string;
  itemId: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  price: number;
  costPrice?: number;
  isActive: boolean;
  isAvailable: boolean;
  preparationTime?: number;
  allergens?: string[];
  dietaryInfo?: DietaryInfo[];
  ingredients?: string[];
  image?: string;
  outlets?: MenuItemOutlet[];
  modifiers?: MenuItemModifier[];
  taxGroup?: TaxGroup;
  taxGroupId?: string;
  measurementUnit?: {
    unitId?: string;
    quantity?: number;
    unitDisplay?: string;
  };
  taxes?: {
    taxable?: boolean;
    taxRate?: number;
  };
}

export interface MenuCategory {
  name: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface POSMenu {
  _id: string;
  id?: string;
  menuId: string;
  name: string;
  outlet: string;
  type: MenuType;
  isActive: boolean;
  availableHours?: {
    start?: string;
    end?: string;
  };
  items: POSMenuItem[];
  categories?: MenuCategory[];
  createdAt: string;
  updatedAt: string;
}

// -- POS Order ----------------------------------------------------------------

export type POSOrderType = 'dine_in' | 'takeaway' | 'room_service' | 'delivery';

export type POSOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled';

export type POSOrderItemStatus = 'pending' | 'preparing' | 'ready' | 'served';

export type POSOrderPaymentStatus = 'pending' | 'paid' | 'partial' | 'refunded';

export interface OrderItemModifier {
  name: string;
  option: string;
  price: number;
}

export interface POSOrderItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers?: OrderItemModifier[];
  specialInstructions?: string;
  status?: POSOrderItemStatus;
}

export interface OrderDiscount {
  type?: string;
  description?: string;
  amount?: number;
  percentage?: number;
}

export interface OrderTaxBreakdown {
  taxId?: string;
  taxName?: string;
  taxType?: string;
  taxGroup?: string;
  amount?: number;
  rate?: number;
  exemptionApplied?: boolean;
  exemptionPercentage?: number;
}

export interface OrderTaxes {
  serviceTax?: number;
  gst?: number;
  otherTaxes?: number;
  totalTax?: number;
  breakdown?: OrderTaxBreakdown[];
  exemptedAmount?: number;
  taxableAmount?: number;
  calculationTimestamp?: string;
}

export interface OrderPayment {
  method: POSPaymentMethod;
  status: POSOrderPaymentStatus;
  paidAmount?: number;
  changeGiven?: number;
  paymentDetails?: {
    transactionId?: string;
    cardLast4?: string;
    authCode?: string;
    roomChargeReference?: string;
  };
}

export interface POSOrder {
  _id: string;
  id?: string;
  hotelId: string;
  orderId: string;
  orderNumber: string;
  outlet: string;
  type: POSOrderType;
  status: POSOrderStatus;
  customer?: {
    guest?: string;
    roomNumber?: string;
    walkIn?: {
      name?: string;
      phone?: string;
      email?: string;
    };
  };
  items: POSOrderItem[];
  subtotal: number;
  discounts?: OrderDiscount[];
  taxes?: OrderTaxes;
  totalAmount: number;
  payment: OrderPayment;
  staff?: {
    server?: string;
    cashier?: string;
  };
  tableNumber?: string;
  deliveryDetails?: {
    address?: string;
    deliveryTime?: string;
    deliveryFee?: number;
  };
  specialRequests?: string;
  orderTime: string;
  preparedTime?: string;
  servedTime?: string;
  completedTime?: string;
  createdAt: string;
  updatedAt: string;
}
