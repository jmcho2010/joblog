export interface Clock {
  now(): Date;
}

// The only place in the codebase allowed to read the real time.
// `override` is the demo-mode clock (docs/design/RUNBOOK.md §5); env.ts rejects it in production.
export class SystemClock implements Clock {
  constructor(private readonly override?: Date) {}

  now(): Date {
    return this.override ? new Date(this.override.getTime()) : new Date();
  }
}

export class FixedClock implements Clock {
  constructor(private readonly instant: Date) {}

  now(): Date {
    return new Date(this.instant.getTime());
  }
}
