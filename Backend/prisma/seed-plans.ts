import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPlans() {
  console.log('🌱 Seeding subscription plans...');

  // Create or update Free plan
  const freePlan = await prisma.plan.upsert({
    where: { slug: 'free' },
    create: {
      name: 'Free',
      slug: 'free',
      title: 'Get Started',
      description: 'Perfect for trying out the platform',
      monthlyPrice: '0',
      yearlyPrice: '0',
      feature: [
        'Unlimited business listings',
        'Basic listing photos (5 max)',
        'Standard support',
        'Community access',
        'Chat with buyers/sellers',
      ],
      maxListings: 0,
      maxPhotos: 5,
      maxVideoDuration: 0,
      canUseAnalytics: false,
      prioritySupport: false,
      featuredListing: false,
      canBoostListing: false,
      customBranding: false,
      isActive: true,
      isDefault: true,
      sortOrder: 1,
    },
    update: {
      title: 'Get Started',
      description: 'Perfect for trying out the platform',
      monthlyPrice: '0',
      yearlyPrice: '0',
      feature: [
        'Unlimited business listings',
        'Basic listing photos (5 max)',
        'Standard support',
        'Community access',
        'Chat with buyers/sellers',
      ],
      maxListings: 0,
      maxPhotos: 5,
      isDefault: true,
      sortOrder: 1,
    },
  });
  console.log('✅ Free plan:', freePlan.name);

  // Create or update Pro plan
  const proPlan = await prisma.plan.upsert({
    where: { slug: 'pro' },
    create: {
      name: 'Pro',
      slug: 'pro',
      title: 'Grow Your Sales',
      description: 'Everything you need to sell successfully',
      monthlyPrice: '45',
      yearlyPrice: '450',
      feature: [
        'Unlimited business listings',
        'Unlimited photos & videos',
        'Advanced analytics dashboard',
        'Priority support (24h response)',
        'Featured listing badge',
        'Listing boost/promotion',
        'Early access to new features',
        'Custom branding options',
        'Export analytics data',
      ],
      maxListings: 0, // 0 = unlimited
      maxPhotos: 0, // 0 = unlimited
      maxVideoDuration: 60,
      canUseAnalytics: true,
      prioritySupport: true,
      featuredListing: true,
      canBoostListing: true,
      customBranding: true,
      isActive: true,
      isDefault: false,
      sortOrder: 2,
      // Stripe IDs will be set later
      stripeProductId: null,
      stripeMonthlyPriceId: null,
      stripeYearlyPriceId: null,
    },
    update: {
      title: 'Grow Your Sales',
      description: 'Everything you need to sell successfully',
      monthlyPrice: '45',
      yearlyPrice: '450',
      feature: [
        'Unlimited business listings',
        'Unlimited photos & videos',
        'Advanced analytics dashboard',
        'Priority support (24h response)',
        'Featured listing badge',
        'Listing boost/promotion',
        'Early access to new features',
        'Custom branding options',
        'Export analytics data',
      ],
      maxListings: 0,
      maxPhotos: 0,
      canUseAnalytics: true,
      prioritySupport: true,
      featuredListing: true,
      sortOrder: 2,
    },
  });
  console.log('✅ Pro plan:', proPlan.name);

  console.log('✅ Plans seeded successfully');
}

seedPlans()
  .catch((e) => {
    console.error('❌ Error seeding plans:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
