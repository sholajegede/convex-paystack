# Changelog

## 0.0.3

### Patch Changes

Fix `initializeTransaction`, `verifyTransaction`, `cancelSubscription`, `enableSubscription`, `createPlan`, `listBalances`, `syncCustomerSubscriptions`, and `listPlans` being typed as `ctx: GenericActionCtx<GenericDataModel>`, which only type-checks when the calling app's schema is empty. Any real app with its own tables got a compile error on every one of these calls. Each now accepts a minimal structural ctx type matching what it actually touches (a mutation-only type, or `unknown` for the three methods that never call `ctx` at all). The example app's schema was also given a real table, so this class of bug shows up in this repo's own typecheck from now on instead of only in a downstream app.

## 0.0.2

### Patch Changes

- Add demo screenshot to README

## 0.0.1

- Add Balance API currency detection so checkout only offers currencies actually
  enabled on the account
- Add syncCustomerSubscriptions() as a fallback for when the subscription.create
  webhook hasn't arrived yet
- Redesign the example app's live console as a docked sidebar instead of a
  bottom bar
- Polish the example app's UI (buttons, inputs, header) and move test card
  numbers into the top banner

## 0.0.0

- Initial release.
