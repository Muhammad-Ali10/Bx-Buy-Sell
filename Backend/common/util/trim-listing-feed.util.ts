/** Drop embedded base64 / huge strings that break HTTP responses behind proxies. */
const MAX_PAYLOAD_STRING = 48_000;

function clampHeavyString(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value.length <= MAX_PAYLOAD_STRING && !/^data:/i.test(value)) return value;
  if (/^https?:\/\//i.test(value) && value.length <= MAX_PAYLOAD_STRING) return value;
  return null;
}

function trimQuestionItems(items: Record<string, unknown>[] | undefined): Record<string, unknown>[] | undefined {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const row = item as Record<string, unknown>;
    const option = row.option;
    const answerType = typeof row.answer_type === 'string' ? row.answer_type.toUpperCase() : '';
    const isPhotoAnswer = answerType === 'PHOTO';
    const answerValue = row.answer;
    return {
      ...row,
      question: clampHeavyString(row.question),
      answer_for: clampHeavyString(row.answer_for),
      // Never trim image payload fields; listing images must stay publicly visible.
      answer: isPhotoAnswer
        ? answerValue
        : Array.isArray(answerValue)
          ? answerValue.map((entry) => clampHeavyString(entry))
          : clampHeavyString(answerValue),
      option: Array.isArray(option)
        ? option.map((o) => clampHeavyString(o))
        : option,
    };
  });
}

function trimFinancialItems(items: Record<string, unknown>[] | undefined): Record<string, unknown>[] | undefined {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const row = item as Record<string, unknown>;
    return {
      ...row,
      name: clampHeavyString(row.name),
      revenue_amount: clampHeavyString(row.revenue_amount),
      annual_cost: clampHeavyString(row.annual_cost),
      net_profit: clampHeavyString(row.net_profit),
    };
  });
}

function trimListingUser(user: Record<string, unknown> | null | undefined) {
  if (!user || typeof user !== 'object') return user;
  return {
    ...user,
    profile_pic: clampHeavyString(user.profile_pic),
    background: clampHeavyString(user.background),
  };
}

export function trimListingFeedRecord(listing: Record<string, unknown>): Record<string, unknown> {
  if (!listing || typeof listing !== 'object') {
    return listing;
  }

  const user = listing.user;
  const out: Record<string, unknown> = {
    ...listing,
    portfolioLink: clampHeavyString(listing.portfolioLink),
    user:
      user && typeof user === 'object'
        ? trimListingUser(user as Record<string, unknown>)
        : user,
    brand: trimQuestionItems(listing.brand as Record<string, unknown>[] | undefined),
    statistics: trimQuestionItems(listing.statistics as Record<string, unknown>[] | undefined),
    productQuestion: trimQuestionItems(
      listing.productQuestion as Record<string, unknown>[] | undefined,
    ),
    managementQuestion: trimQuestionItems(
      listing.managementQuestion as Record<string, unknown>[] | undefined,
    ),
    handover: trimQuestionItems(listing.handover as Record<string, unknown>[] | undefined),
    social_account: trimQuestionItems(
      listing.social_account as Record<string, unknown>[] | undefined,
    ),
    advertisement: trimQuestionItems(
      listing.advertisement as Record<string, unknown>[] | undefined,
    ),
    financials: trimFinancialItems(listing.financials as Record<string, unknown>[] | undefined),
  };

  return out;
}
