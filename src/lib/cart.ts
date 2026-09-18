export type CartItem = { productId: string; name: string; price: number; unit: string; qty: number };

const KEY = "dispatch_shop_cart";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(cart: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("cart-updated"));
}

export function addToCart(item: Omit<CartItem, "qty">) {
  const cart = getCart();
  const existing = cart.find((c) => c.productId === item.productId);
  if (existing) existing.qty += 1;
  else cart.push({ ...item, qty: 1 });
  save(cart);
}

export function setQty(productId: string, qty: number) {
  let cart = getCart();
  if (qty <= 0) cart = cart.filter((c) => c.productId !== productId);
  else {
    const existing = cart.find((c) => c.productId === productId);
    if (existing) existing.qty = qty;
  }
  save(cart);
}

export function clearCart() {
  save([]);
}

export function cartCount(cart: CartItem[]) {
  return cart.reduce((sum, c) => sum + c.qty, 0);
}

export function cartSubtotal(cart: CartItem[]) {
  return cart.reduce((sum, c) => sum + c.price * c.qty, 0);
}
