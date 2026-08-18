import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'common/decorator/roles.decorator';
import { AcquisitionCapacityService } from './acquisition-capacity.service';

@ApiTags('Acquisition Capacity')
@Controller('acquisition-capacity')
export class AcquisitionCapacityController {
  constructor(private readonly service: AcquisitionCapacityService) {}

  @Get('me')
  @Roles(['USER', 'SELLER', 'ADMIN', 'MONITER'])
  @ApiOperation({ summary: "The signed-in buyer's own verification status" })
  findMine(@Req() req: any) {
    return this.service.findForBuyer(req.user.id);
  }

  @Post('me/documents')
  @Roles(['USER', 'SELLER', 'ADMIN', 'MONITER'])
  @ApiOperation({ summary: 'Buyer uploads proof of funds for review' })
  submit(
    @Req() req: any,
    // Accepts bare urls as well as `{ url, name }`, so an older client keeps
    // working; the file's own name is recovered from the url when missing.
    @Body() body: { documents: Array<string | { url: string; name?: string }> },
  ) {
    return this.service.submitDocuments(req.user.id, body?.documents || []);
  }

  @Get('buyer/:buyerId')
  @Roles(['USER', 'SELLER', 'ADMIN', 'MONITER'])
  @ApiOperation({
    summary: "A buyer's verified capital, for a seller already in touch with them",
  })
  findForBuyer(@Req() req: any, @Param('buyerId') buyerId: string) {
    return this.service.findForCounterparty(buyerId, req.user.id, req.user.role);
  }

  @Get()
  @Roles(['ADMIN', 'MONITER'])
  @ApiOperation({ summary: 'Review queue with filters and the verified total' })
  findAll(
    @Query('status') status?: 'UNASSIGNED' | 'IN_REVIEW' | 'COMPLETED',
    @Query('reviewerId') reviewerId?: string,
    @Query('minFunds') minFunds?: string,
    @Query('maxFunds') maxFunds?: string,
  ) {
    return this.service.findAll({
      status,
      reviewerId,
      minFunds: minFunds ? Number(minFunds) : undefined,
      maxFunds: maxFunds ? Number(maxFunds) : undefined,
    });
  }

  // Above `@Patch(':id')` — Nest matches in order, and the wildcard would
  // otherwise read "documents" as a case id.
  @Patch('documents/:documentId')
  @Roles(['ADMIN', 'MONITER'])
  @ApiOperation({ summary: "Moderator's verdict on a single uploaded document" })
  reviewDocument(
    @Param('documentId') documentId: string,
    @Body()
    body: {
      status: 'IN_REVIEW' | 'VERIFIED' | 'DECLINED';
      note?: string | null;
      verifiedCapital?: number | null;
    },
  ) {
    return this.service.reviewDocument(documentId, body);
  }

  /**
   * Hand a case to a team member, or clear it with a null id. Picking one up
   * moves an untouched case into review — a case with a name against it is
   * never still "Unassigned".
   */
  @Patch(':id/responsible')
  @Roles(['ADMIN', 'MONITER'])
  @ApiOperation({ summary: 'Assign the moderator responsible for a case' })
  assignReviewer(
    @Param('id') id: string,
    @Body() body: { reviewerId?: string | null },
  ) {
    return this.service.assignReviewer(id, body?.reviewerId ?? null);
  }

  @Patch(':id')
  @Roles(['ADMIN', 'MONITER'])
  @ApiOperation({ summary: 'Moderator records verified capital, status and notes' })
  review(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      status?: 'UNASSIGNED' | 'IN_REVIEW' | 'COMPLETED';
      notes?: string | null;
    },
  ) {
    return this.service.review(id, req.user.id, body);
  }
}
