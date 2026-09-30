import { ROLES_KEY } from 'common/decorator/roles.decorator';
import { BillingController } from './billing.controller';

/**
 * The Billing tab on a member's page in the admin area: the team reads the
 * member's cards and invoice address, and cannot change either.
 */
describe("the team's read-only view of a member's billing", () => {
  const billing = {
    listPaymentMethods: jest.fn(async (userId: string) => [{ id: 'pm_1', userId }]),
    getInvoiceAddress: jest.fn(async () => ({
      saved: { company: 'Acme GmbH', city: 'Berlin' },
      profile: { company: 'From the profile', city: 'Somewhere' },
    })),
  };
  const controller = new BillingController(billing as any);
  const rolesOf = (handler: keyof BillingController) =>
    Reflect.getMetadata(ROLES_KEY, BillingController.prototype[handler]);

  it("reads the member's cards, not the admin's own", async () => {
    await expect(controller.listPaymentMethodsFor('member-1')).resolves.toEqual([
      { id: 'pm_1', userId: 'member-1' },
    ]);
  });

  it('gives only the saved address, never the profile guess', async () => {
    await expect(controller.getInvoiceAddressFor('member-1')).resolves.toEqual({
      saved: { company: 'Acme GmbH', city: 'Berlin' },
    });
  });

  it('is open to the team only', () => {
    expect(rolesOf('listPaymentMethodsFor')).toEqual(['ADMIN', 'MONITER']);
    expect(rolesOf('getInvoiceAddressFor')).toEqual(['ADMIN', 'MONITER']);
  });
});
