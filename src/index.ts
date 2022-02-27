import { isLiveQueryOperationDefinitionNode } from '@n1ru4l/graphql-live-query'
import { applyLiveQueryJSONPatch } from '@n1ru4l/graphql-live-query-patch-json-patch'
import { applyAsyncIterableIteratorToSink, makeAsyncIterableIteratorFromSink } from '@n1ru4l/push-pull-async-iterable-iterator'
import { Exchange, ExecutionResult, Operation, subscriptionExchange } from '@urql/core'
import { share, pipe, filter, merge } from 'wonka'

const subscription = subscriptionExchange({
  enableAllOperations: true,
  forwardSubscription: operation => ({
    subscribe: sink => ({
      unsubscribe: applyAsyncIterableIteratorToSink(
        applyLiveQueryJSONPatch(
          makeAsyncIterableIteratorFromSink<ExecutionResult>(sink => {
            let stopped = false
            const url = new URL(operation.context.url)
            url.searchParams.set('query', operation.query)
            url.searchParams.set('variables', JSON.stringify(operation.variables ?? {}))

            const eventSource = new EventSource(url.href, {
              withCredentials: true,
            })

            eventSource.addEventListener('message', event => {
              if (stopped) {
                return
              }

              try {
                const result = JSON.parse(event.data)
                sink.next(result)
              } catch (error) {
                sink.error(error)
              }
            })

            return () => {
              eventSource.close()
              stopped = true
            }
          })
        ),
        sink
      ),
    }),
  }),
})

const isLiveOperation = (operation: Operation) =>
  operation.query.definitions.some(definition => isLiveQueryOperationDefinitionNode(definition, operation.variables))

const isSubscription = (operation: Operation) =>
  operation.query.definitions.every(
    definition => definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
  )

export const sseLiveExchange =
  ({ subscription: includeSubscriptions = true } = {}): Exchange =>
  input => {
    const forwardSubscription = subscription(input)

    const filterOeration = (operation: Operation) =>
      isLiveOperation(operation) || (includeSubscriptions && isSubscription(operation))

    return ops$ => {
      const sharedOps$ = share(ops$)

      const sseResults$ = pipe(sharedOps$, filter(filterOeration), forwardSubscription)
      const forward$ = pipe(
        sharedOps$,
        filter(ops => !filterOeration(ops)),
        input.forward
      )

      return merge([sseResults$, forward$])
    }
  }
