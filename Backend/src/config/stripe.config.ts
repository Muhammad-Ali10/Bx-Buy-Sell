export const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder',
  apiVersion: '2026-01-28.clover' as const,
};

export const subscriptionConfig = {
  trialDays: parseInt(process.env.SUBSCRIPTION_TRIAL_DAYS || '14', 10),
  gracePeriodDays: parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS || '3', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',
};
