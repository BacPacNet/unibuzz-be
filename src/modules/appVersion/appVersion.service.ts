import semver from 'semver';
import httpStatus from 'http-status';
import ApiError from '../errors/ApiError';
import { AppPlatform, IAppVersionPolicy } from './appVersion.interface';
import { AppVersionPolicy } from './appVersion.model';

function normalizeSemver(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = String(raw).trim();
  const coerced = semver.coerce(cleaned);
  return coerced?.version ?? null;
}

export async function getPolicy(platform: AppPlatform): Promise<IAppVersionPolicy | null> {
  const doc = await AppVersionPolicy.findOne({ platform }).lean<IAppVersionPolicy>();
  return doc ?? null;
}

export async function evaluateVersion(params: {
  platform: AppPlatform;
  currentVersionRaw: string | null;
  treatMissingAsBlocked: boolean;
  hasJwt?: boolean;
}): Promise<{
  policy: IAppVersionPolicy;
  currentVersion: string | null;
  softBlock: string | null;
  hardBlock: string | null;
  shouldSoftBlock: boolean;
  shouldHardBlock: boolean;
}> {
  const policy = await getPolicy(params.platform);
  if (!policy || !policy.enabled) {
    return {
      policy:
        (policy ??
          ({
            platform: params.platform,
            enabled: false,
            softBlock: '0.0.0',
            softMessage: '',
            hardBlock: '0.0.0',
            hardMessage: '',
            blockIfMissingVersion: false,
          } as IAppVersionPolicy)),
      currentVersion: null,
      softBlock: null,
      hardBlock: null,
      shouldSoftBlock: false,
      shouldHardBlock: false,
    };
  }

  const currentVersion = normalizeSemver(params.currentVersionRaw);
  const softBlock = normalizeSemver(policy.softBlock);
  const hardBlock = normalizeSemver(policy.hardBlock);

  if (!currentVersion) {
    if (policy.blockIfMissingVersion && params.treatMissingAsBlocked) {
      if (params.hasJwt) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'jwt expired');
      }
      const status = (httpStatus as any).UPGRADE_REQUIRED ?? 426;
      throw new ApiError(status, policy.hardMessage || 'Please update your app to continue.');
    }
    return {
      policy,
      currentVersion: null,
      softBlock,
      hardBlock,
      shouldSoftBlock: false,
      shouldHardBlock: false,
    };
  }

  // Misconfigured policy in DB; fail open to avoid accidental outage.
  if (!hardBlock && !softBlock) {
    return {
      policy,
      currentVersion,
      softBlock: null,
      hardBlock: null,
      shouldSoftBlock: false,
      shouldHardBlock: false,
    };
  }

  const shouldHardBlock = hardBlock ? semver.lt(currentVersion, hardBlock) : false;
  const shouldSoftBlock = softBlock ? semver.lt(currentVersion, softBlock) : false;

  if (shouldHardBlock) {
    if (params.hasJwt) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'jwt expired');
    }
    const status = (httpStatus as any).UPGRADE_REQUIRED ?? 426;
    throw new ApiError(status, policy.hardMessage || 'Please update your app to continue.');
  }

  return {
    policy,
    currentVersion,
    softBlock,
    hardBlock,
    shouldSoftBlock,
    shouldHardBlock: false,
  };
}

export async function checkAllowedOrThrow(params: {
  platform: AppPlatform;
  currentVersionRaw: string | null;
  treatMissingAsBlocked: boolean;
  hasJwt?: boolean;
}): Promise<ReturnType<typeof evaluateVersion>> {
  return evaluateVersion(params);
}

