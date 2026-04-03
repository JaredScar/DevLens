import type { Session } from 'electron';

export type NetworkLogPayload = {
  partition: string;
  method: string;
  url: string;
  statusCode: number;
  t: number;
  resourceType: string;
};

/** Log completed HTTP(S) requests for the Network devtools panel (partition-scoped). */
export function attachNetworkSpy(
  ses: Session,
  partition: string,
  emit: (payload: NetworkLogPayload) => void,
): void {
  ses.webRequest.onCompleted({ urls: ['http://*/*', 'https://*/*'] }, (details) => {
    if (details.statusCode === undefined) return;
    emit({
      partition,
      method: details.method,
      url: details.url,
      statusCode: details.statusCode,
      t: Date.now(),
      resourceType: details.resourceType ?? 'other',
    });
  });
}
