import queueService from '../../services/queueService.js';

describe('queue service resilience baseline', () => {
  let originalRedis;
  let originalIsProcessing;
  let originalProcessingInterval;
  let originalScheduledProcessingInterval;
  let originalActiveJobs;

  beforeEach(() => {
    originalRedis = queueService.redis;
    originalIsProcessing = queueService.isProcessing;
    originalProcessingInterval = queueService.processingInterval;
    originalScheduledProcessingInterval = queueService.scheduledProcessingInterval;
    originalActiveJobs = queueService.activeJobs;

    queueService.redis = null;
    queueService.isProcessing = false;
    queueService.processingInterval = null;
    queueService.scheduledProcessingInterval = null;
    queueService.activeJobs = new Map();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    queueService.redis = originalRedis;
    queueService.isProcessing = originalIsProcessing;
    queueService.processingInterval = originalProcessingInterval;
    queueService.scheduledProcessingInterval = originalScheduledProcessingInterval;
    queueService.activeJobs = originalActiveJobs;
  });

  it('does not start processing when redis is unavailable', async () => {
    await queueService.startProcessing();

    expect(queueService.isProcessing).toBe(false);
    expect(queueService.processingInterval).toBeNull();
    expect(queueService.scheduledProcessingInterval).toBeNull();
  });

  it('tracks and clears both queue polling intervals during shutdown', async () => {
    const setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockReturnValueOnce('scheduled-interval')
      .mockReturnValueOnce('processing-interval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {});
    jest.spyOn(queueService, 'processScheduledEvents').mockResolvedValue(undefined);
    jest.spyOn(queueService, 'processEvents').mockResolvedValue(undefined);

    queueService.redis = { isReady: true };

    await queueService.startProcessing();

    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    expect(queueService.isProcessing).toBe(true);
    expect(queueService.scheduledProcessingInterval).toBe('scheduled-interval');
    expect(queueService.processingInterval).toBe('processing-interval');

    await queueService.stopProcessing();

    expect(queueService.isProcessing).toBe(false);
    expect(queueService.scheduledProcessingInterval).toBeNull();
    expect(queueService.processingInterval).toBeNull();
    expect(clearIntervalSpy).toHaveBeenCalledWith('scheduled-interval');
    expect(clearIntervalSpy).toHaveBeenCalledWith('processing-interval');
  });
});
