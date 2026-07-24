import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
});

async function setupStripeProducts() {
  console.log('🚀 Setting up Stripe products and prices...');

  try {
    // Get Pro plan from database
    const proPlan = await prisma.plan.findUnique({
      where: { slug: 'pro' },
    });

    if (!proPlan) {
      throw new Error('Pro plan not found in database. Run seed-plans.ts first.');
    }

    console.log('✅ Found Pro plan:', proPlan.name);

    // Create Stripe product
    console.log('📦 Creating Stripe product...');
    const product = await stripe.products.create({
      name: 'BX Pro Subscription',
      description: 'Unlimited listings, analytics, priority support, and premium features',
      metadata: {
        planId: proPlan.id,
        planSlug: 'pro',
      },
    });
    console.log('✅ Product created:', product.id);

    // Create monthly price
    console.log('💵 Creating monthly price ($45)...');
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 4500, // $45 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        planId: proPlan.id,
        billingCycle: 'MONTHLY',
      },
    });
    console.log('✅ Monthly price created:', monthlyPrice.id);

    // Create yearly price
    console.log('💵 Creating yearly price ($450)...');
    const yearlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 45000, // $450 in cents
      currency: 'usd',
      recurring: {
        interval: 'year',
      },
      metadata: {
        planId: proPlan.id,
        billingCycle: 'YEARLY',
      },
    });
    console.log('✅ Yearly price created:', yearlyPrice.id);

    // Update Plan in database with Stripe IDs
    console.log('💾 Updating Plan model with Stripe IDs...');
    await prisma.plan.update({
      where: { id: proPlan.id },
      data: {
        stripeProductId: product.id,
        stripeMonthlyPriceId: monthlyPrice.id,
        stripeYearlyPriceId: yearlyPrice.id,
      },
    });

    console.log('✅ Plan updated successfully!');
    console.log('\n📋 Summary:');
    console.log('  Product ID:', product.id);
    console.log('  Monthly Price ID:', monthlyPrice.id);
    console.log('  Yearly Price ID:', yearlyPrice.id);
    console.log('\n🎉 Stripe setup complete! You can now accept subscriptions.');
  } catch (error) {
    console.error('❌ Error setting up Stripe:', error);
    throw error;
  }
}

setupStripeProducts()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
