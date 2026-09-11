import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'common/decorator/roles.decorator';
import { ZodValidationPipe } from 'common/validator/zod.validator';
import { BillingService } from './billing.service';
import { invoiceAddressSchema, InvoiceAddressInput } from './billing.dto';

/**
 * Account Details → Billing. Everyone works on their own account; the team may
 * read someone's invoices, and nothing more.
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
