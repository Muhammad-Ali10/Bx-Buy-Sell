import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Your user ID from the console logs
const userId = 'e5658c25-7ba9-463b-b2a8-de76c3c70882';

async function activatePro() {
  console.log('🔄 Manually activating Pro subscription for user:', userId);

  try {
    // Get Pro plan
    const proPlan = await prisma.plan.findUnique({
      where: { slug: 'pro' },
    });

    if (!proPlan) {
      throw new Error('Pro plan not found');
    }

    console.log('✅ Found Pro plan:', proPlan.id);

    // Delete existing subscription if any
    const existing = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (existing) {
      console.log('🗑️ Deleting existing subscription');
      await prisma.userSubscription.delete({
        where: { userId },
      });
    }

    // Create Pro subscription
    const subscription = await prisma.userSubscription.create({
      data: {
        userId,
        planId: proPlan.id,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        startDate: new Date(),
        stripeCurrentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
    });

    console.log('✅ Pro subscription created:', subscription.id);
    console.log('🎉 User is now on Pro plan!');
    console.log('\nRefresh your browser to see changes.');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

activatePro()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
