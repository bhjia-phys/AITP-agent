import type { RemoteFailure } from '@deepseek-ai/dsh-typert-protocol'
import type { WorkspaceError } from '@deepseek-ai/dsh-research-memory/types'
import type { BackendText } from './locales.ts'

/**
 * Map invocation failures without presenting a lost save acknowledgement as a rejected write.
 * @param error - marked Remote failure; domain Result errors bypass this transport mapping.
 * @param t - localized diagnostics for cancellation and uncertain save acknowledgements.
 * @param operationId - save identity retained when transport failure leaves application uncertain; absent for reads.
 * @returns a typed rejection for known pre-dispatch failures, otherwise an unknown save outcome or retryable read unavailability.
 */
export function invocationFailure(error: RemoteFailure, t: BackendText, operationId?: string): WorkspaceError {
  const code: string = error.code
  switch (code) {
    case 'remote-access/denied':
    case 'research/root-not-configured':
      return { code: 'permission-denied', message: error.message, retryable: false }
    case 'gateway/bad-request':
    case 'gateway/arguments-invalid':
    case 'gateway/input-invalid':
      return { code: 'invalid-request', message: error.message, retryable: false }
    case 'gateway/method-unavailable':
    case 'gateway/definition-unavailable':
    case 'gateway/service-unavailable':
      return { code: 'unsupported', message: error.message, retryable: false }
    case 'research/workspace-missing':
    case 'gateway/context-not-found':
    case 'gateway/lookup-not-found':
      return { code: 'not-found', message: error.message, retryable: false }
    default:
      if (operationId !== undefined) return { code: 'outcome-unknown', message: t('unknownWrite'), operationId }
      if (code === 'gateway/cancelled') return { code: 'cancelled', message: t('cancelled'), retryable: false }
      return { code: 'unavailable', message: error.message, retryable: true }
  }
}
