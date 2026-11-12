export interface LeaseGuardOptions {
  heartbeatIntervalSec?: number;
  leaseTimeoutSeconds?: number;
  onLost?: (reason: string) => void;
}

export class LeaseGuard {
  private timer: any = null;
  private isReleased = false;

  constructor(
    public readonly flowId: string,
    private readonly client: {
      updateFlowStatus: (id: string, status: string) => Promise<any>;
      touchFlow: (id: string) => Promise<any>;
    },
    private readonly options: LeaseGuardOptions = {},
  ) {
    const heartbeatSec = options.heartbeatIntervalSec ?? 15;
    this.timer = setInterval(() => {
      this.heartbeat().catch((err) => {
        if (!this.isReleased && this.options.onLost) {
          this.options.onLost(err.message);
        }
      });
    }, heartbeatSec * 1000);
  }

  async heartbeat(): Promise<void> {
    if (this.isReleased) return;
    await this.client.touchFlow(this.flowId);
  }

  async release(closedBy = 'worker'): Promise<void> {
    if (this.isReleased) return;
    this.isReleased = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.client.updateFlowStatus(this.flowId, 'INACTIVE');
  }
}
