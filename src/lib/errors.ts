export class ClockifyError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null,
    message: string
  ) {
    super(message);
    this.name = "ClockifyError";
  }
}

export function toMcpErrorMessage(err: ClockifyError): string {
  if (err.status === 401 || err.status === 403) {
    return `Clockify auth failed — check CLOCKIFY_API_KEY (${err.status}: ${err.message})`;
  }
  if (err.code) return `Clockify ${err.status} ${err.code}: ${err.message}`;
  return `Clockify ${err.status}: ${err.message}`;
}
