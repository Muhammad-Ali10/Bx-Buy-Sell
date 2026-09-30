import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'common/decorator/roles.decorator';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import { BillingService } from './billing.service';
import { invoiceAddressSchema, InvoiceAddressInput } from './billing.dto';

/**
 * Account Details → Billing. Everyone works on their own account; the team may
 * read someone's cards, invoices and invoice address, and nothing more.
 */
@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Get('payment-methods')
  @ApiOperation({ summary: 'Saved cards, and which one renewals are charged to' })
  listPaymentMethods(@Req() req: any) {
    return this.billing.listPaymentMethods(req.user.id);
  }

  /**
   * Someone else's saved cards, for the Billing tab on their account page.
   * Read-only: the team never adds, removes or reorders a member's cards —
   * only brand, last four and expiry ever leave Stripe.
   */
  @Roles(['ADMIN', 'MONITER'])
  @Get('payment-methods/:userId')
  @ApiOperation({ summary: "A member's saved cards (staff, read-only)" })
  listPaymentMethodsFor(@Param('userId') userId: string) {
    return this.billing.listPaymentMethods(userId);
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Post('payment-methods/setup')
  @ApiOperation({ summary: "Open Stripe's page for adding a card" })
  startAddPaymentMethod(@Req() req: any) {
    return this.billing.startAddPaymentMethod(req.user.id);
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Post('payment-methods/confirm')
  @ApiOperation({ summary: 'Confirm a card added on Stripe' })
  confirmAddPaymentMethod(@Req() req: any, @Body() body: { sessionId: string }) {
    return this.billing.confirmAddPaymentMethod(req.user.id, body?.sessionId);
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Post('payment-methods/:id/default')
  @ApiOperation({ summary: 'Make a card the one renewals are charged to' })
  setDefaultPaymentMethod(@Req() req: any, @Param('id') id: string) {
    return this.billing.setDefaultPaymentMethod(req.user.id, id);
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Delete('payment-methods/:id')
  @ApiOperation({ summary: 'Remove a card that nothing renews on' })
  removePaymentMethod(@Req() req: any, @Param('id') id: string) {
    return this.billing.removePaymentMethod(req.user.id, id);
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Get('invoices')
  @ApiOperation({ summary: 'Every invoice, from Stripe' })
  listInvoices(@Req() req: any) {
    return this.billing.listInvoices(req.user.id);
  }

  /** Someone else's invoices, for the Billing tab on their account page. */
  @Roles(['ADMIN', 'MONITER'])
  @Get('invoices/:userId')
  @ApiOperation({ summary: "A member's invoices (staff, read-only)" })
  listInvoicesFor(@Param('userId') userId: string) {
    return this.billing.listInvoices(userId);
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Get('address')
  @ApiOperation({ summary: 'The invoice address, or the profile to start from' })
  getInvoiceAddress(@Req() req: any) {
    return this.billing.getInvoiceAddress(req.user.id);
  }

  /**
   * Someone else's invoice address, as they saved it (staff, read-only).
   *
   * Only what was saved. The member's own form starts from their profile when
   * nothing is saved, but shown to the team that guess would read as the
   * address their invoices go to — and it is not.
   */
  @Roles(['ADMIN', 'MONITER'])
  @Get('address/:userId')
  @ApiOperation({ summary: "A member's saved invoice address (staff, read-only)" })
  async getInvoiceAddressFor(@Param('userId') userId: string) {
    const { saved } = await this.billing.getInvoiceAddress(userId);
    return { saved };
  }

  @Roles(['USER', 'SELLER', 'ADMIN'])
  @Put('address')
  @ApiOperation({ summary: 'Save the invoice address, and give it to Stripe' })
  saveInvoiceAddress(
    @Req() req: any,
    @Body(new ZodValidationPipe(invoiceAddressSchema)) body: InvoiceAddressInput,
  ) {
    return this.billing.saveInvoiceAddress(req.user.id, body);
  }
}
