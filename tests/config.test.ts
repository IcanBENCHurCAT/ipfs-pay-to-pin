import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { config, validateConfig } from '../src/config.js';

describe('Config Validation', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let originalConfig: typeof config;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    originalConfig = { ...config };
  });

  afterEach(() => {
    Object.assign(config, originalConfig);
    vi.restoreAllMocks();
  });

  it('logs basic configuration info upon validation', () => {
    config.algorandNetwork = 'mainnet';
    config.escrowAddress = 'MOCK_ESCROW_ADDRESS';
    config.allowLocalFallback = false;

    validateConfig();

    expect(logSpy).toHaveBeenCalledWith('[Config] Operating Network: mainnet');
    expect(logSpy).toHaveBeenCalledWith('[Config] Escrow Recipient Address: MOCK_ESCROW_ADDRESS');
    expect(logSpy).toHaveBeenCalledWith('[Config] Synchronous Pinning Default Mode: ENABLED (Direct Pinata Pinning)');
  });

  it('logs synchronous pinning as DISABLED when allowLocalFallback is true', () => {
    config.allowLocalFallback = true;

    validateConfig();

    expect(logSpy).toHaveBeenCalledWith('[Config] Synchronous Pinning Default Mode: DISABLED (Async Disk Buffer Fallback)');
  });

  it('warns when PINATA_JWT is not set and allowLocalFallback is false', () => {
    config.allowLocalFallback = false;
    config.pinataJwt = '';

    validateConfig();

    expect(warnSpy).toHaveBeenCalledWith(
      '[Config Warning] PINATA_JWT is not set while ALLOW_LOCAL_FALLBACK=false. File uploads will fail unless PINATA_JWT is configured.'
    );
  });

  it('does not warn about PINATA_JWT when PINATA_JWT is provided even if allowLocalFallback is false', () => {
    config.allowLocalFallback = false;
    config.pinataJwt = 'mock-jwt-token';

    validateConfig();

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('PINATA_JWT is not set')
    );
  });

  it('does not warn about PINATA_JWT when allowLocalFallback is true even if PINATA_JWT is empty', () => {
    config.allowLocalFallback = true;
    config.pinataJwt = '';

    validateConfig();

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('PINATA_JWT is not set')
    );
  });

  it('warns when ENABLE_AUTOMATIC_REFUNDS is true but ALGORAND_WALLET_MNEMONIC is missing', () => {
    config.enableAutomaticRefunds = true;
    config.algorandMnemonic = '';

    validateConfig();

    expect(warnSpy).toHaveBeenCalledWith(
      '[Config Warning] ENABLE_AUTOMATIC_REFUNDS is true but ALGORAND_WALLET_MNEMONIC is missing. Automatic refunds cannot execute on-chain.'
    );
  });

  it('does not warn about missing mnemonic when ENABLE_AUTOMATIC_REFUNDS is true and mnemonic is set', () => {
    config.enableAutomaticRefunds = true;
    config.algorandMnemonic = 'mock 25 word secret mnemonic phrase test value';

    validateConfig();

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('ENABLE_AUTOMATIC_REFUNDS is true but ALGORAND_WALLET_MNEMONIC is missing')
    );
  });

  it('does not warn about missing mnemonic when ENABLE_AUTOMATIC_REFUNDS is false', () => {
    config.enableAutomaticRefunds = false;
    config.algorandMnemonic = '';

    validateConfig();

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('ENABLE_AUTOMATIC_REFUNDS is true but ALGORAND_WALLET_MNEMONIC is missing')
    );
  });
});
