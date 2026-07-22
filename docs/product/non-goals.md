# Non-goals

## Deferred customer segments and requirements

Not optimized for large enterprises in the MVP. Explicitly deferred:

- SAML or enterprise SSO
- Complex RBAC
- Audit-log products
- On-premises deployment
- Custom contracts / procurement workflows
- Organization-wide analytics
- Jira, Slack, Notion, and similar integrations
- Arbitrary plugin ecosystems
- User-created analysis rules
- Support for every language
- Fine-grained billing plans
- AI chat as the principal experience

## Deferred from the first vertical slice

- Private repositories
- Payments
- Multiple organizations / team invitations
- AI-generated explanations
- Pull-request analysis / architectural diffs
- GitHub webhooks / real-time updates
- Multiple programming languages
- Manual documentation editing
- Arbitrary diagram customization
- Advanced dead-code analysis
- Semantic business-domain reconstruction
- Commit and PR history mining
- Distributed worker fleets, microservices, Kubernetes, event sourcing
- Custom design systems
- A generalized static-analysis framework for hypothetical future languages
- Type-checked (as opposed to syntactic) analysis — see ADR-0003
- Graph visualization — plain tables/lists until user feedback says otherwise

Extension seams are left only where they are cheap and clearly justified by the architecture already chosen for the first slice — not built speculatively ahead of need.
