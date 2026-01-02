import Stripe from 'stripe'

let stripeSingleton: Stripe | null = null

export function getStripe() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim()
  if (!key) return null
  if (stripeSingleton) return stripeSingleton

  // Let the stripe-node SDK pick the default API version for the installed package.
  stripeSingleton = new Stripe(key)
  return stripeSingleton
}


