/** Bind the shared discussion controller once; readers contribute navigation and study admission independently. */
import type { Context } from '@deepseek-ai/cordis'
import type { DiscussionReaderNavigation } from './discussion-contract.ts'
import { ResearchDiscussionController, type DiscussionFace } from './discussion-controller.ts'
import { discussionEn, discussionZh } from './discussion-locales.ts'
import { DiscussionConversation, ResearchDiscussion, TopicDiscussions } from './ResearchDiscussion.tsx'
import type { ResearchWorkspaceRegistry } from './workspace-service.ts'
import { registerResearchChangeNotice } from './research-change-registration.ts'

/**
 * Register the shared discussion controller, presentation factories and change feedback.
 * @param ctx - browser plugin owner.
 * @param workspaces - existing async workspace adapter registry.
 * @param navigation - Research-owned centre reader fallback.
 * @returns shared discussions controller.
 */
export function registerResearchDiscussions(ctx: Context, workspaces: ResearchWorkspaceRegistry,
  navigation: DiscussionReaderNavigation): ResearchDiscussionController {
  const namespace = 'aitp.research.discussion'
  registerResearchChangeNotice(ctx)
  ctx.effect(() => ctx.locale.register(namespace, { en: discussionEn, zh: discussionZh }), 'research: discussion dictionaries')
  const controller = new ResearchDiscussionController(ctx, workspaces, navigation, ctx.locale.bind(namespace))
  const release = ctx.reflect.provide('researchDiscussions', controller)
  ctx.effect(() => () => { controller.dispose(); void release() }, 'research: discussions')
  const face: DiscussionFace = {
    hooks: { discussionViews: controller.views },
    selectDiscussion: (scope, sessionId) => controller.select(scope, sessionId),
    openDiscussion: scope => controller.open(scope),
    newDiscussion: scope => controller.newDiscussion(scope),
    renameDiscussion: (scope, sessionId, title) => controller.renameDiscussion(scope, sessionId, title),
    collapseDiscussion: (scope) => { controller.collapse(scope) },
    expandDiscussion: (scope) => { controller.expand(scope) },
    clearDiscussionSource: (scope) => { controller.setSource(scope, {}) },
    mountDiscussion: (scope, open, returnTo) => controller.mount(scope, open, returnTo),
  }
  ctx.slots.registerFactory({ name: 'aitp.research.discussion', scope: 'root', locale: namespace,
    inject: () => face, children: { 'aitp.research.discussion.conversation': { kind: 'single', scope: 'session' } },
  }, ResearchDiscussion)
  ctx.slots.registerFactory({ name: 'aitp.research.topic-discussions', scope: 'root', locale: namespace, inject: () => face }, TopicDiscussions)
  ctx.slots.inject('aitp.research.discussion.conversation', () => ctx.slots.register({ name: 'aitp.research.discussion.conversation' }, DiscussionConversation))
  return controller
}
