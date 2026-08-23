import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { config, validateConfig } from '../src/config.js';

describe('Config Module', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('should export valid config object defaults', () => {
    expect(config).toBeDefined();
    expect(typeof config.port).toBe('number');
    expect(typeof config.algorandNetwork).toBe('string');
    expect(typeof config.algorandServer).toBe('string');
    expect(typeof config.escrowAddress).toBe('string');
    expect(typeof config.allowLocalFallback).toBe('boolean');
    expect(typeof config.enableAutomaticRefunds).toBe('boolean');
  });

  it('should log system configuration settings in validateConfig', () => {
    validateConfig();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Config] Operating Network:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Config] Escrow Recipient Address:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Config] Synchronous Pinning Default Mode:'));
  });

  it('should issue warning when ALLOW_LOCAL_FALLBACK=false and PINATA_JWT is missing', () => {
    const originalAllowLocalFallback = config.allowLocalFallback;
    const originalPinataJwt = config.pinataJwt;

    config.allowLocalFallback = false;
    config.pinataJwt = '';

    validateConfig();

    expect(warnSpy).toHaveBeenCalledWith(
      '[Config Warning] PINATA_JWT is not set while ALLOW_LOCAL_FALLBACK=false. File uploads will fail unless PINATA_JWT is configured.'
    );

    config.allowLocalFallback = originalAllowLocalFallback;
    config.pinataJwt = originalPinataJwt;
  });

  it('should issue warning when ENABLE_AUTOMATIC_REFUNDS=true and ALGORAND_WALLET_MNEMONIC is missing', () => {
    const originalEnableAutomaticRefunds = config.enableAutomaticRefunds;
    const originalAlgorandMnemonic = config.algorandMnemonic;

    config.enableAutomaticRefunds = true;
    config.algorandMnemonic = '';

    validateConfig();

    expect(warnSpy).toHaveBeenCalledWith(
      '[Config Warning] ENABLE_AUTOMATIC_REFUNDS is true but ALGORAND_WALLET_MNEMONIC is missing. Automatic refunds cannot execute on-chain.'
    );

    config.enableAutomaticRefunds = originalEnableAutomaticRefunds;
    config.algorandMnemonic = originalAlgorandMnemonic;
  });

  it('should not issue warnings when configuration is valid', () => {
    const originalAllowLocalFallback = config.allowLocalFallback;
    const originalPinataJwt = config.pinataJwt;
    const originalEnableAutomaticRefunds = config.enableAutomaticRefunds;

    config.allowLocalFallback = true;
    config.pinataJwt = '';
    config.enableAutomaticRefunds = false;

    validateConfig();

    expect(warnSpy).not.toHaveBeenCalled();

    config.allowLocalFallback = originalAllowLocalFallback;
    config.pinataJwt = originalPinataJwt;
    config.enableAutomaticRefunds = originalEnableAutomaticRefunds;
  });
});
