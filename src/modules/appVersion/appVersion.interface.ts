export type AppPlatform = 'android' | 'ios' | null;

export interface IAppVersionPolicy {
  platform: AppPlatform;
  enabled: boolean;
  /**
   * Soft block = allow API calls, but client should show update alert.
   * Example: app < 1.0.14 => show alert.
   */
  softBlock: string;
  softMessage: string;
  /**
   * Hard block = reject API calls (force update).
   * Use for very old apps that don't have alert logic.
   */
  hardBlock: string;
  hardMessage: string;
  updateUrl?: string;
  /**
   * If true, requests identified as "mobile app" but missing `x-app-version`
   * will be rejected (useful to force very old apps without version header).
   */
  blockIfMissingVersion: boolean;
}

