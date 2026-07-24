export type PerfTimings = {
  bootstrapStartMs?: number;
  nestCreateMs?: number;
  appListenMs?: number;
  totalBootstrapMs?: number;
  firstHttpResponseMs?: number;
  prismaConnectMs?: number;
  redisConnectMs?: number;
  rabbitMqConnectMs?: number;
};

class PerfStore {
  timings: PerfTimings = {};
  firstResponseRecorded = false;
}

export const perfStore = new PerfStore();
