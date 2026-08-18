import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPlans() {
  console.log('🌱 Seeding subscription plans...');

  // Create or update Free plan
  const freePlan = await prisma.plan.upsert({
    where: { slug: 'free' },
    create: {
      name: 'Minimum',
      slug: 'free',
      title: 'Minimum',
      description: 'Everything you need to get started — with no upfront costs.',
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
      title: 'Minimum',
      description: 'Everything you need to get started — with no upfront costs.',
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

  /**
   * The middle tier the client's design adds between Minimum and Premium.
   *
   * Its buyer-facing perk is the advanced search filter — the client's own
   * wording: "This advanced filter should only be available to paid members
   * which have a (Starter or Premium) package". Early access stays with
   * Premium alone, so the top tier keeps something of its own.
   */
  const starterPlan = await prisma.plan.upsert({
    where: { slug: 'starter' },
    create: {
      name: 'Starter',
      slug: 'starter',
      title: 'Starter',
      description: 'For a solid mid-tier solution, choose our Basic Plan.',
      monthlyPrice: '49',
      yearlyPrice: '490',
      feature: [
        'Everything in Minimum',
        'Advanced search filters',
        'Standard reach for your listing',
        'Manually approve buyers',
        'Success fee is paid after the business is sold',
      ],
      maxListings: 0,
      maxPhotos: 0,
      maxVideoDuration: 60,
      canUseAnalytics: false,
      prioritySupport: false,
      featuredListing: false,
      canBoostListing: false,
      customBranding: false,
      isActive: true,
      isDefault: false,
      sortOrder: 2,
      stripeProductId: null,
      stripeMonthlyPriceId: null,
      stripeYearlyPriceId: null,
    },
    update: {
      name: 'Starter',
      title: 'Starter',
      description: 'For a solid mid-tier solution, choose our Basic Plan.',
      monthlyPrice: '49',
      yearlyPrice: '490',
      isActive: true,
      sortOrder: 2,
    },
  });
  console.log('✅ Starter plan:', starterPlan.name);

  // Create or update Pro plan
  const proPlan = await prisma.plan.upsert({
    where: { slug: 'pro' },
    create: {
      name: 'Premium',
      slug: 'pro',
      title: 'Premium',
      description: 'Ready to sell seriously? Choose our premium package.',
      monthlyPrice: '99',
      yearlyPrice: '990',
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
      sortOrder: 3,
      // Stripe IDs will be set later
      stripeProductId: null,
      stripeMonthlyPriceId: null,
      stripeYearlyPriceId: null,
    },
    update: {
      title: 'Premium',
      description: 'Ready to sell seriously? Choose our premium package.',
      monthlyPrice: '99',
      yearlyPrice: '990',
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
      sortOrder: 3,
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
