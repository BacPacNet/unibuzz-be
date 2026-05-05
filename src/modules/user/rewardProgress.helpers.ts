export type RewardProgress = {
  reward: number;
  leftoverInvites: number;
  rewardedInvites: number;
};

export const startOfUtcMonthAfter = (rewardMonth: Date): Date => {
  return new Date(Date.UTC(rewardMonth.getUTCFullYear(), rewardMonth.getUTCMonth() + 1, 1));
};

export const calculateRewardProgress = (totalInvites: number): RewardProgress => {
  if (totalInvites < 10) {
    return {
      reward: 0,
      leftoverInvites: totalInvites,
      rewardedInvites: 0,
    };
  }

  if (totalInvites < 15) {
    return {
      reward: 100,
      leftoverInvites: totalInvites - 10,
      rewardedInvites: 10,
    };
  }

  if (totalInvites < 20) {
    return {
      reward: 200,
      leftoverInvites: totalInvites - 15,
      rewardedInvites: 15,
    };
  }

  const extraInvites = totalInvites - 20;
  const extraBlocks = Math.floor(extraInvites / 5);
  const rewardedInvites = 20 + extraBlocks * 5;

  return {
    reward: 400 + extraBlocks * 100,
    leftoverInvites: totalInvites - rewardedInvites,
    rewardedInvites,
  };
};

export const parseAllowedCommunityIds = (rawValue: string | undefined): string[] => {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean);
    }
  } catch (_err) {
    // Fallback to comma-separated values when env is not JSON.
  }

  return rawValue
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
};

export const getUtcMonthBoundaries = (baseDate: Date) => {
  const startOfThisMonth = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1));
  const startOfNextMonth = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 1));
  const startOfPreviousMonth = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() - 1, 1));

  return {
    startOfThisMonth,
    startOfNextMonth,
    startOfPreviousMonth,
  };
};
