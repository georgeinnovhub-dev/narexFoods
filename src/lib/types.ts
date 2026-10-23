import type { SiteSettings } from "@/lib/settings";

/** Shared API contract types — client & server. */

export interface ProductVariantDTO {
  id: string;
  name: string;
  price: number; // pesewas
  available: boolean;
}

export interface ProductAddOnDTO {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

export interface ProductDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  images: string[];
  altText: string;
  prepMinutes: number;
  featured: boolean;
  bestSeller: boolean;
  available: boolean;
  soldOut: boolean;
  archived: boolean;
  prep: number;
  sortOrder: number;
  variants: ProductVariantDTO[];
  addons: ProductAddOnDTO[];
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
}

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface CampaignDTO {
  id: string;
  title: string;
  message: string;
  image: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  placement: "popup" | "banner";
  showOnce: boolean;
}

export interface BootstrapResponse {
  settings: SiteSettings; // public-safe view (no provider secrets)
  categories: CategoryDTO[];
  products: ProductDTO[];
  campaigns: CampaignDTO[];
  serverTime: string;
}

export interface CartLineItem {
  productId: string;
  variantId: string;
  quantity: number;
  addonIds: string[];
}

export interface CheckoutPayload {
  idempotencyKey: string;
  items: CartLineItem[];
  fulfillmentType: "pickup" | "delivery";
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  address?: string;
  note?: string;
  couponCode?: string;
}

export interface OrderItemDTO {
  id: string;
  productName: string;
  variantName: string;
  unitPrice: number;
  quantity: number;
  addons: { name: string; price: number }[];
  lineTotal: number;
}

export interface OrderEventDTO {
  id: string;
  type: string;
  message: string;
  actor: string;
  createdAt: string;
}

export interface PaymentDTO {
  id: string;
  provider: string;
  method: string;
  status: string;
  amount: number;
  reference: string;
  evidenceName: string | null;
  hasEvidence: boolean;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface OrderDTO {
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  fulfillmentType: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  address: string | null;
  note: string | null;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  couponCode: string | null;
  whatsappSent: boolean;
  createdAt: string;
  updatedAt: string;
  items: OrderItemDTO[];
  events: OrderEventDTO[];
  payments: PaymentDTO[];
  assignment?: {
    id: string;
    status: string;
    dispatcherName: string | null;
    fee: number;
  } | null;
}

export interface CreateOrderResponse {
  order: OrderDTO;
  whatsappUrl: string;
  existing?: boolean;
}

export interface CouponValidateResponse {
  valid: boolean;
  code?: string;
  discount: number;
  message: string;
}

// ---------- Admin ----------

export interface AdminOrderQuery {
  q?: string;
  status?: string;
  paymentStatus?: string;
  fulfillmentType?: string;
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
}

export interface AdminOrderListResponse {
  orders: OrderDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OverviewStats {
  totalOrders: number;
  newOrders: number;
  pendingVerification: number;
  paidOrders: number;
  revenueCollected: number; // paid orders total (pesewas)
  outstandingAmount: number; // unpaid+pending of non-cancelled
  averageOrderValue: number; // paid orders
  ordersToday: number;
  statusDistribution: { status: string; count: number }[];
  bestSellers: { productName: string; variantName: string; qty: number; revenue: number }[];
  salesTrend: { date: string; orders: number; revenue: number }[]; // last 14 days
  alerts: string[];
}

export interface StaffDTO {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  status: string;
  department: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface RoleDTO {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  staffCount: number;
}

export interface DispatchAssignmentDTO {
  id: string;
  orderId: string;
  orderReference: string;
  customerName: string;
  address: string | null;
  customerPhone: string;
  status: string;
  fee: number;
  note: string | null;
  failureReason: string | null;
  dispatcherId: string | null;
  dispatcherName: string | null;
  assignedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  orderStatus: string;
  orderTotal: number;
}

export interface DispatcherDTO {
  id: string;
  staffId: string;
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  availability: string;
  status: string;
  activeAssignments: number;
  completedCount: number;
}

export interface CouponDTO {
  id: string;
  code: string;
  type: string;
  value: number;
  minSubtotal: number;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  active: boolean;
  createdAt: string;
}

export interface CampaignAdminDTO extends CampaignDTO {
  status: string;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  audience: string;
  pageTarget: string;
  device: string;
  impressions: number;
  clicks: number;
  dismissals: number;
}

export interface BlogPostDTO {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  altText: string;
  tags: string[];
  status: string;
  author: string;
  publishedAt: string | null;
  createdAt: string;
}

export interface AuditDTO {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface OutboxDTO {
  id: string;
  type: string;
  subject: string;
  recipient: string | null;
  status: string;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
}

export interface ReportsResponse {
  range: { from: string; to: string };
  ordersByDay: { date: string; orders: number; revenue: number; collected: number }[];
  totals: {
    orders: number;
    grossValue: number;
    collected: number;
    discounts: number;
    unpaid: number;
    averageOrderValue: number;
  };
  byProduct: { productName: string; variantName: string; qty: number; revenue: number }[];
  byStatus: { status: string; count: number }[];
  couponUsage: { code: string; redemptions: number; discount: number }[];
  dispatchPerformance: { delivered: number; failed: number; averageMinutes: number | null };
  paymentMethods: { provider: string; count: number; amount: number }[];
}
