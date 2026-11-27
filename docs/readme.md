# Documentation

Guides for people who build and operate work360. The [README](../readme.md)
covers setup. Each guide below owns one subject.

## Start here

- [Architecture](architecture.md): how the web application, engine, pipeline and
  extension fit together, and where the code is.
- [Contracts](contracts.md): the JSON contracts and the files generated from
  them.
- [Deployment](deployment.md): the application and engine Compose stacks.
- [Contributing](../.github/contributing.md): checks and documentation
  ownership.

## Web application

- [Web application](../apps/web/readme.md): how to run it and where the code is.
- [Web configuration](web-configuration.md): environment variables and which are
  required.
- [Database development](database.md): initialize, reset and change the current
  disposable schema.
- [Preview](preview.md): an authenticated local session for checking the UI.
- [Action runtime](action-runtime.md): how a server action parses,
  authenticates, authorizes and reports errors.
- [Cookies](cookies.md): which cookie API to use in each context.
- [Realtime](realtime.md): WebSockets, reconnects and recovery.
- [Diagnostics](diagnostics.md): request tracing output.
- [End-to-end testing](e2e-testing.md): Playwright, isolated databases and
  fixtures.
- [Web benchmarks](web-benchmarks.md): CPU benchmarks for the web application.

## Product

- [Campaigns](campaigns.md): campaign imports and the batches executives draw
  from them.
- [Activities](activities.md): calls and visits, their subjects and outcomes,
  and the extension handoff.
- [Cases](cases.md): case types, stages, gates and fields, and the rules for
  writing a stage.
- [Meetings](meetings.md): scheduling work meetings and the calendar invitations
  they email.
- [Reports](reports.md): production by holder and the activity log, their reach
  and exports.
- [Companies](companies.md): company search, the company page and who may open
  it.
- [Imports](cutover.md): the one-time imports of safeapp, CRM Entel and the old
  culqi360 deploy, and what each left behind.
- [Merchant statistics](merchant-stats.md): GPV imports, attribution, targets
  and access.
- [Terminology](terminology.md): the Spanish terms the interface uses.

## Other components

- [Engine](../crates/engine/readme.md): signed endpoints, configuration and
  startup.
- [Pipeline](../crates/pipeline/readme.md): source files, commands, rebuild and
  promotion.
- [Browser extension](../apps/extension/readme.md): call state, web handoff and
  sync.
- [Search benchmarks](../ops/bench/readme.md): smoke and full engine benchmarks.
- [TypeScript configuration](../packages/tsconfig/readme.md): the shared base
  configurations and the `typecheck` command.
