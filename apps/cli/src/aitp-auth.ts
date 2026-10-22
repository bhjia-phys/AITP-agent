/** Interactive provider authorization, launched by the AITP auth profile overlay. */

import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { Command } from 'commander'
import type { Context } from '@deepseek-ai/cordis'
import { parseCmdline } from '@deepseek-ai/dsh-cmdline'
import { AuthorizationDeclinedError, AuthorizationError } from '@deepseek-ai/dsh-authorization'
import type { AuthorizationInteraction, AuthorizationPrompt } from '@deepseek-ai/dsh-authorization'
import { credentialKey } from '@deepseek-ai/dsh-credentials'

/** Cordis plugin name. */
export const name = 'aitp-auth'
/** Services supplied by the normal profile and credential provider. */
export const inject = ['cmdlineArgs', 'authorization', 'credentials']

/** A validated terminal command; no credential value is accepted on argv. */
export type AuthCommand = { action: 'list' } | { action: 'login'; provider: string; method?: string }

/**
 * Run one authorization command through the public service, retaining no grants.
 * @param ctx - the mounted authorization and credential services.
 * @param command - parsed command; login defaults to the provider's preferred method.
 * @param interaction - notices and prompts owned by this invocation.
 * @param output - text output, which receives status and method labels only.
 * @param signal - cancels this invocation without changing an existing grant.
 * @returns zero on success, 130 when the researcher cancels.
 */
export async function runAuthCommand(
  ctx: Context,
  command: AuthCommand,
  interaction: AuthorizationInteraction,
  output: (text: string) => void,
  signal: AbortSignal,
): Promise<number> {
  if (command.action === 'list') {
    for (const flow of ctx.authorization.list().filter(flow => flow.key.startsWith('llm-pi-ai/')).sort((a, b) => a.key.localeCompare(b.key))) {
      const status = await ctx.credentials.describeRecord(flow.key)
      output(`${flow.key.slice('llm-pi-ai/'.length)}: ${flow.methods.map(method => method.id).join(', ')}; ${status.configured ? 'credential stored' : 'not signed in'}\n`)
    }
    return 0
  }
  const result = await ctx.authorization.begin({
    key: credentialKey('llm-pi-ai', command.provider),
    ...command.method === undefined ? {} : { method: command.method },
    interaction,
    signal,
  })
  output(result.status === 'authorized' ? `Signed in to ${command.provider}.\n` : 'Sign-in cancelled.\n')
  return result.status === 'authorized' ? 0 : 130
}

/** Terminal output suppresses all input echo while answering a secret prompt. */
class PromptOutput extends Writable {
  muted = false
  override _write(chunk: Uint8Array, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    if (!this.muted) process.stdout.write(chunk)
    callback()
  }
}

/**
 * Build a terminal interaction; the returned closer releases its input handle.
 * @param controller - invocation lifetime, also cancelled by Ctrl-C or EOF.
 * @returns the interaction and its disposer.
 */
export function terminalInteraction(controller: AbortController): AuthorizationInteraction & { close(): void } {
  const output = new PromptOutput()
  let reader: ReturnType<typeof createInterface> | undefined
  const getReader = (): ReturnType<typeof createInterface> => {
    if (reader !== undefined) return reader
    // Later text prompts must never recall credentials entered at secret prompts.
    reader = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY === true, historySize: 0 })
    reader.on('SIGINT', () => { controller.abort() })
    reader.on('close', () => { controller.abort() })
    return reader
  }
  const ask = async (prompt: AuthorizationPrompt): Promise<string> => {
    const signal = prompt.signal === undefined
      ? controller.signal : AbortSignal.any([controller.signal, prompt.signal])
    signal.throwIfAborted()
    const input = getReader()
    process.stdout.write(`${prompt.message}\n`)
    if (prompt.kind === 'select') {
      prompt.options.forEach((option, index) => { process.stdout.write(`${index + 1}. ${option.label}\n`) })
    }
    process.stdout.write('> ')
    output.muted = prompt.kind === 'secret'
    try {
      const answer = await input.question('', { signal })
      if (prompt.kind !== 'select') return answer
      const selected = prompt.options[Number(answer) - 1] ?? prompt.options.find(option => option.id === answer)
      if (selected === undefined) throw new AuthorizationDeclinedError('no offered option selected')
      return selected.id
    } finally {
      if (output.muted) process.stdout.write('\n')
      output.muted = false
    }
  }
  return {
    notify(notice) {
      process.stdout.write(`${notice.message}\n`)
      if (notice.url !== undefined) process.stdout.write(`${notice.url}\n`)
      if (notice.code !== undefined) process.stdout.write(`Code: ${notice.code}\n`)
    },
    prompt: ask,
    close() {
      reader?.close()
      output.destroy()
    },
  }
}

/**
 * Parse the AITP auth invocation and start it after successful profile startup.
 * @param ctx - a profile launched with cmdline and app-ready services.
 */
export function apply(ctx: Context): void {
  let command: AuthCommand | undefined
  const program = new Command().name('aitp-agent auth').description('Sign in to a model provider; credentials stay in the local AITP store.')
  program.command('list').description('list provider login methods and stored credential presence')
    .action(() => { command = { action: 'list' } })
  program.command('login <provider>').description('sign in interactively; Ctrl-C cancels')
    .option('--method <id>', 'use a listed method instead of the provider default')
    .action((provider: string, options: { method?: string }) => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(provider)) program.error('provider must be a lowercase hyphenated identifier')
      command = { action: 'login', provider, ...options.method === undefined ? {} : { method: options.method } }
    })
  program.action(() => { program.help() })
  parseCmdline(ctx, program)
  if (command === undefined) return
  const request = command
  const ready = ctx.get('appReady')
  const exit = ctx.get('appExit')
  if (ready === undefined || exit === undefined) throw new Error('aitp-auth requires the dsh profile launcher')
  const controller = new AbortController()
  const interaction = terminalInteraction(controller)
  const cancel = (): void => { controller.abort() }
  ctx.effect(() => {
    process.on('SIGINT', cancel)
    const stopReady = ready.onReady(() => {
      void runAuthCommand(ctx, request, interaction, (text) => { process.stdout.write(text) }, controller.signal)
        .then((code) => { exit(code) }, (error: unknown) => {
          if (controller.signal.aborted) {
            process.stdout.write('Sign-in cancelled.\n')
            exit(130)
            return
          }
          const code = error instanceof AuthorizationError && /^[A-Z0-9_]{1,80}$/.test(error.code) ? ` (${error.code})` : ''
          process.stderr.write(`Provider authorization failed${code}; no successful sign-in was confirmed. Check the provider and method with \`aitp-agent auth list\`, then retry.\n`)
          exit(1)
        })
    })
    return () => {
      stopReady()
      controller.abort()
      interaction.close()
      process.off('SIGINT', cancel)
    }
  }, 'AITP provider authorization')
}
