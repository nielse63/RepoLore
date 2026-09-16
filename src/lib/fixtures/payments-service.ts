/**
 * Static example content for the not-yet-implemented Lore views (Architecture,
 * Systems, Dependencies, Data flow, History, Search — see docs/designs/).
 * Mirrors the "acme/payments-service" example repository shown in the
 * mockups. Not derived from any real analysis — every page that renders
 * this data shows a `PreviewBanner` saying so.
 */

export type TileVariant = "core" | "supporting" | "data" | "alert";

export interface SystemSummary {
  slug: string;
  name: string;
  kind: "Core" | "Supporting" | "Data";
  variant: TileVariant;
  icon: "box" | "lock" | "gear" | "bell" | "database" | "layers";
  description: string;
  technology: string;
  ownedPaths: string;
  relationships: number;
  evidence: number;
}

export const SYSTEMS: SystemSummary[] = [
  {
    slug: "payment-service",
    name: "Payment Service",
    kind: "Core",
    variant: "core",
    icon: "box",
    description:
      "Orchestrates checkout, manages payments, and persists transaction state.",
    technology: "Python, FastAPI",
    ownedPaths: "service/payment/",
    relationships: 5,
    evidence: 12,
  },
  {
    slug: "auth-service",
    name: "Auth Service",
    kind: "Core",
    variant: "core",
    icon: "lock",
    description: "Handles authentication, issues JWTs, and manages identities.",
    technology: "Python, FastAPI",
    ownedPaths: "service/auth/",
    relationships: 3,
    evidence: 8,
  },
  {
    slug: "worker",
    name: "Worker",
    kind: "Supporting",
    variant: "supporting",
    icon: "gear",
    description: "Background jobs for payouts, retries, and cleanup tasks.",
    technology: "Python, Celery",
    ownedPaths: "workers/",
    relationships: 3,
    evidence: 7,
  },
  {
    slug: "notification-service",
    name: "Notification Service",
    kind: "Supporting",
    variant: "supporting",
    icon: "bell",
    description: "Sends email and SMS notifications and templates.",
    technology: "Python",
    ownedPaths: "service/notification/",
    relationships: 2,
    evidence: 5,
  },
  {
    slug: "postgresql",
    name: "PostgreSQL",
    kind: "Data",
    variant: "data",
    icon: "database",
    description: "Primary relational database for transactional data.",
    technology: "PostgreSQL",
    ownedPaths: "infra/database/",
    relationships: 3,
    evidence: 4,
  },
  {
    slug: "redis",
    name: "Redis",
    kind: "Data",
    variant: "data",
    icon: "database",
    description: "Caching layer and queue backend for Celery.",
    technology: "Redis",
    ownedPaths: "infra/cache/",
    relationships: 2,
    evidence: 2,
  },
];

export const ARCHITECTURE_LAYERS = [
  {
    label: "Entry points",
    icon: "globe" as const,
    nodes: ["API Gateway · FastAPI", "Auth Service · FastAPI"],
  },
  {
    label: "Core services",
    icon: "hexagon" as const,
    nodes: ["Payment Service · Python", "Notification Service · Python"],
  },
  {
    label: "Background processing",
    icon: "clock" as const,
    nodes: ["Worker · Celery"],
  },
  {
    label: "Data stores",
    icon: "database" as const,
    nodes: ["PostgreSQL · Primary DB", "Redis · Cache & Queue"],
  },
];

export const ARCHITECTURAL_BOUNDARIES = [
  {
    title: "The API layer owns request validation.",
    description:
      "All incoming requests are validated at the API layer before reaching core services.",
    referenceCount: 14,
    icon: "shield" as const,
  },
  {
    title: "Payment state changes are centralized in the service layer.",
    description:
      "All mutations to payment state occur within the Payment Service.",
    referenceCount: 18,
    icon: "layers" as const,
  },
  {
    title: "Long-running work is handled asynchronously.",
    description:
      "Retries, notifications, and other long-running tasks are delegated to background workers via the queue.",
    referenceCount: 10,
    icon: "clock" as const,
  },
];

export interface DependencyRow {
  name: string;
  purpose: string;
  usedBy: string[];
  version: string;
  evidenceCount: number;
  scope: "Direct" | "Transitive";
  icon: "zap" | "database" | "circle" | "layers" | "braces" | "package";
}

export const DEPENDENCIES: DependencyRow[] = [
  {
    name: "FastAPI",
    purpose: "Web framework for API and request handling.",
    usedBy: ["Payment Service", "Auth Service"],
    version: "0.110.0",
    evidenceCount: 4,
    scope: "Direct",
    icon: "zap",
  },
  {
    name: "SQLAlchemy",
    purpose: "ORM for database access and modeling.",
    usedBy: ["Payment Service", "Auth Service"],
    version: "2.0.29",
    evidenceCount: 3,
    scope: "Direct",
    icon: "database",
  },
  {
    name: "Celery",
    purpose: "Distributed task queue for asynchronous work.",
    usedBy: ["Worker", "Payment Service"],
    version: "5.3.6",
    evidenceCount: 3,
    scope: "Direct",
    icon: "circle",
  },
  {
    name: "Redis",
    purpose: "Cache and message broker for Celery.",
    usedBy: ["Worker", "Payment Service"],
    version: "7.2.4",
    evidenceCount: 3,
    scope: "Direct",
    icon: "layers",
  },
  {
    name: "Pydantic",
    purpose: "Data validation and settings management.",
    usedBy: ["Payment Service", "Auth Service"],
    version: "2.7.1",
    evidenceCount: 2,
    scope: "Direct",
    icon: "braces",
  },
  {
    name: "Stripe SDK",
    purpose: "Payment processing via Stripe API.",
    usedBy: ["Payment Service"],
    version: "9.4.0",
    evidenceCount: 2,
    scope: "Transitive",
    icon: "package",
  },
];

export interface DataFlowStep {
  title: string;
  description: string;
  system: string;
  referenceCount: number;
  icon: string;
  inputs?: string[];
  outputs?: string[];
  stateChange?: string;
  evidence?: { location: string; lines: string; description: string }[];
}

export const DATA_FLOW_STEPS: DataFlowStep[] = [
  {
    title: "Client request",
    description: "The client sends a payment request to the API.",
    system: "External Client",
    referenceCount: 3,
    icon: "globe" as const,
  },
  {
    title: "API Gateway validates input",
    description: "The API Gateway validates the request and routes it.",
    system: "API Gateway",
    referenceCount: 4,
    icon: "route" as const,
  },
  {
    title: "Auth Service verifies identity",
    description: "Auth Service validates the JWT and checks permissions.",
    system: "Auth Service",
    referenceCount: 3,
    icon: "lock" as const,
  },
  {
    title: "Payment Service creates transaction",
    description:
      "Payment Service creates the transaction and enqueues follow-up work.",
    system: "Payment Service",
    referenceCount: 7,
    icon: "creditCard" as const,
    inputs: ["Validated payment request from API Gateway"],
    outputs: ["Transaction record created", "Job enqueued on Redis queue"],
    stateChange: "New transaction persisted to database",
    evidence: [
      {
        location: "service/payment/checkout.py",
        lines: "L120-L172",
        description: "Creates transaction and enqueues follow-up job.",
      },
      {
        location: "service/payment/models.py",
        lines: "L45-L98",
        description: "Defines Transaction model and state transitions.",
      },
      {
        location: "infra/database.py",
        lines: "L33-L64",
        description: "Database session and transaction configuration.",
      },
    ],
  },
  {
    title: "PostgreSQL persists state",
    description: "The transaction is persisted in PostgreSQL.",
    system: "PostgreSQL",
    referenceCount: 3,
    icon: "database" as const,
  },
  {
    title: "Worker processes queued job",
    description: "The worker picks up the job and performs post-processing.",
    system: "Worker",
    referenceCount: 2,
    icon: "gear" as const,
  },
  {
    title: "Notification Service sends confirmation",
    description: "Notification Service sends a confirmation to the user.",
    system: "Notification Service",
    referenceCount: 2,
    icon: "bell" as const,
  },
];

export interface SystemDetail {
  responsibilities: string[];
  owns: { path: string; description: string }[];
  relationships: { name: string; label: string; icon: string }[];
  entryPoints: {
    endpoint: string;
    method: string;
    description: string;
    definedIn: string;
  }[];
  flows: { name: string; description: string }[];
}

const PAYMENT_SERVICE_DETAIL: SystemDetail = {
  responsibilities: [
    "Orchestrates the checkout workflow and manages payment state transitions.",
    "Validates payment requests and coordinates downstream services for processing.",
    "Persists payment and transaction data and publishes notifications on state changes.",
  ],
  owns: [
    { path: "service/payment/", description: "Payment aggregate and state." },
    {
      path: "service/payment/transaction/",
      description: "Transaction records and metadata.",
    },
  ],
  relationships: [
    { name: "Auth Service", label: "Validates JWT", icon: "lock" },
    { name: "Worker", label: "Enqueues jobs", icon: "gear" },
    { name: "Notification Service", label: "Sends events", icon: "bell" },
    { name: "PostgreSQL", label: "Reads / writes", icon: "database" },
    { name: "Redis", label: "Caches / locks", icon: "layers" },
  ],
  entryPoints: [
    {
      endpoint: "create_payment()",
      method: "POST",
      description: "Creates a payment and returns initial state.",
      definedIn: "service/api/routes/payments.py:32-78",
    },
    {
      endpoint: "retry_payment()",
      method: "POST",
      description: "Retries a failed payment.",
      definedIn: "service/api/routes/payments.py:112-156",
    },
    {
      endpoint: "get_payment_status()",
      method: "GET",
      description: "Returns the current status of a payment.",
      definedIn: "service/api/routes/payments.py:158-194",
    },
  ],
  flows: [
    {
      name: "Create payment",
      description: "Creates a payment and initiates downstream processing.",
    },
    {
      name: "Process retry",
      description: "Retries a failed payment and updates state.",
    },
  ],
};

function genericDetail(system: SystemSummary): SystemDetail {
  return {
    responsibilities: [system.description],
    owns: [
      {
        path: system.ownedPaths,
        description: `Files owned by ${system.name}.`,
      },
    ],
    relationships: SYSTEMS.filter((s) => s.slug !== system.slug)
      .slice(0, 3)
      .map((s) => ({ name: s.name, label: "Related to", icon: s.icon })),
    entryPoints: [],
    flows: [],
  };
}

export function getSystemDetail(slug: string): SystemDetail | undefined {
  const system = SYSTEMS.find((s) => s.slug === slug);
  if (!system) return undefined;
  return slug === "payment-service"
    ? PAYMENT_SERVICE_DETAIL
    : genericDetail(system);
}

export interface HistoryEntry {
  id: string;
  date: string;
  time: string;
  title: string;
  description: string;
  author: string;
  authorInitials: string;
  commitCount: number;
  systems: string[];
  lineRange: string;
  group: "This week" | "Earlier this month" | "June 2026";
  kind: "Architectural change" | "Dependency change" | "Data flow change";
  whatChanged: string[];
  whyNoticed: string;
  source: string;
}

export const HISTORY_ENTRIES: HistoryEntry[] = [
  {
    id: "retries-moved",
    date: "Jun 20, 2026",
    time: "10:42 AM",
    title: "Payment retries moved to the background worker",
    description:
      "Retry logic for failed payments is now handled asynchronously by Celery workers instead of in the request path.",
    author: "Ava Singh",
    authorInitials: "AS",
    commitCount: 3,
    systems: ["Payment Service", "Worker"],
    lineRange: "L42-L128",
    group: "This week",
    kind: "Architectural change",
    whatChanged: [
      "Retry implementation removed from Payment Service request path",
      "New Celery task processes failed payments",
      "Idempotency keys preserved across retries",
      "Retry state persisted in PostgreSQL",
    ],
    whyNoticed:
      "Detected new task definitions and queue usage in Worker, and removal of retry logic from Payment Service.",
    source: "service/payment/service.py",
  },
  {
    id: "notification-separated",
    date: "Jun 12, 2026",
    time: "3:15 PM",
    title: "Notification delivery separated from payment processing",
    description:
      "Notification sending moved to a dedicated service to decouple side effects from payment processing.",
    author: "Mina Rossi",
    authorInitials: "MR",
    commitCount: 2,
    systems: ["Payment Service", "Notification Service"],
    lineRange: "L18-L94",
    group: "Earlier this month",
    kind: "Architectural change",
    whatChanged: [
      "Notification dispatch removed from Payment Service",
      "Notification Service now owns email and SMS delivery",
    ],
    whyNoticed:
      "Detected a new service boundary and removal of notification calls from Payment Service.",
    source: "service/payment/service.py",
  },
  {
    id: "redis-broker",
    date: "Jun 5, 2026",
    time: "9:07 PM",
    title: "Redis added as the Celery message broker",
    description:
      "Introduced Redis as the Celery broker and result backend for improved reliability and observability.",
    author: "Jordan Tan",
    authorInitials: "JT",
    commitCount: 2,
    systems: ["Worker", "Notification Service"],
    lineRange: "L18-L67",
    group: "Earlier this month",
    kind: "Dependency change",
    whatChanged: [
      "Redis added to docker-compose.yml",
      "Celery broker URL points to Redis",
    ],
    whyNoticed:
      "Detected a new Redis dependency declaration and broker configuration.",
    source: "docker-compose.yml",
  },
  {
    id: "auth-consolidated",
    date: "Jun 1, 2026",
    time: "11:28 AM",
    title: "Authentication middleware consolidated",
    description:
      "Consolidated duplicate auth middleware into a single shared component across services.",
    author: "Kai Lee",
    authorInitials: "KL",
    commitCount: 4,
    systems: ["Auth Service", "Payment Service"],
    lineRange: "L12-L58",
    kind: "Architectural change",
    whatChanged: [
      "Duplicate middleware removed from Payment Service",
      "Shared middleware imported from Auth Service",
    ],
    whyNoticed:
      "Detected identical middleware definitions collapsed into a single shared import.",
    source: "service/auth/middleware.py",
    group: "June 2026",
  },
];
