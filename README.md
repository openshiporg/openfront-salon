![Openfront Salon](https://openship.org/og/openfront-salon.png)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fopenshiporg%2Fopenfront-salon&env=DATABASE_URL%2CSESSION_SECRET)

Openfront Salon is a self-hostable booking and salon-operations application. Clients can explore services and stylists, book appointments, and manage their visits. Salon teams use the dashboard for scheduling, client history, checkout, retail inventory, memberships, packages, and commissions.

## Demo

![Interior image used by the Salon storefront](public/images/salon/interior.webp)

Explore the application locally using the setup instructions below.

| | |
|---|---|
| **Public application** | `/` on your development URL |
| **Dashboard** | `/dashboard` on your development URL |

[Learn more →](https://openship.org/products/openfront-salon)

[Documentation →](https://docs.openship.org/docs/openfront/salon/)

## The Openfront Ecosystem

Openfront is part of an ecosystem of open-source commerce tools:

- **[Openfront E-commerce](https://github.com/openshiporg/openfront)**: Headless e-commerce for retail.
- **[Openfront Restaurant](https://github.com/openshiporg/openfront-restaurant)**: Restaurant ordering, point of sale, and kitchen operations.
- **[Openship](https://github.com/openshiporg/openship)**: Order routing for multi-channel fulfillment.
- **Openfront Salon**: (This repository) a self-hostable booking and salon-operations application.

## Core Features

### Admin Dashboard
Manage commissions, clients, appointments, catalog, resources, store settings, schedules, checkout, engagement, integrations, inventory, benefits through dedicated dashboard workspaces and permission-controlled data screens.

### Storefront
Clients can browse `/services` and `/stylists`, book at `/book`, and view appointments and accounts. Gift-card, gallery, team, and review pages round out the public site.

### Appointments & Scheduling
Coordinate stylist schedules, resources, appointment segments, deposits, and waitlists. Appointment transitions and schedule revisions are handled by dedicated workflow commands.

### Checkout & Client Retention
Complete appointment checkout, record retail sales, redeem packages, and manage memberships, points, referrals, and gift cards. Reversal, gratuity, and commission records preserve financial history.

### Client Care
Maintain client notes, color formulas, and consultation submissions. Consultation review uses a separate care-record permission rather than assuming every salon manager can read it.

## Architecture

### Technology Stack
- **Frontend**: Next.js 16 with App Router and React 19.
- **Backend**: KeystoneJS 6 with a GraphQL API.
- **Database**: PostgreSQL with Prisma ORM.
- **Styling**: Tailwind CSS 4 and shared shadcn/ui components.
- **Authentication**: Password-based user accounts and session-based access with role capabilities.

### Application Structure
```text
openfront-salon/
├── app/                    # Public pages, dashboard routes, and HTTP endpoints
├── features/
│   ├── keystone/           # Backend models, access rules, and GraphQL workflows
│   ├── platform/           # Operator workspaces and onboarding
│   ├── storefront/         # Public application components and screens
│   └── dashboard/          # Authentication and shared dashboard shell
└── components/             # Shared UI components
```

### Data Models
The [model registry](features/keystone/models/index.ts) and [Prisma schema](schema.prisma) cover:

- Services, variants, stylists, schedules, resources, and appointment segments.
- Clients, notes, color formulas, consultation templates, submissions, and reviews.
- Appointment lines, deposits, payment sessions, checkout transactions, and reversals.
- Products, inventory movements, packages, memberships, loyalty, gift cards, and commissions.

## Getting Started

### Prerequisites
- Node.js 22, compatible with the [package requirements](package.json) and Next.js 16.
- A PostgreSQL database you can migrate.
- npm.

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/openshiporg/openfront-salon.git
   cd openfront-salon
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

   Review the [example configuration](.env.example) and replace its placeholders. Keep only the local settings you need; do not copy production-mode or infrastructure examples unchanged.

   ```env
   DATABASE_URL=postgresql://user:password@host/database
   SESSION_SECRET=replace-with-a-new-private-random-secret
   ```

   Generate the session secret with `openssl rand -hex 32`; use the generated value, not the placeholder. Never commit `.env`.

   Review [runtime configuration](features/keystone/index.ts) for additional application settings before building or deploying. Configure enabled integrations separately; the two values above are not a complete production configuration.

3. **Start development server:**
   ```bash
   npm run dev
   ```

   The development script prepares the backend schema, applies checked-in migrations, and starts Next.js.

4. **Access the application:**
   Open the URL `npm run dev` prints, then use these paths:

   - **Public application**: `/`
   - **Admin dashboard**: `/dashboard`
   - **GraphQL API**: `/api/graphql`

5. **Create your first admin user:**
   Visit `/dashboard/init` on an empty database to create the initial administrator, then sign in to the dashboard.

6. **Run application onboarding:**
   Use dashboard onboarding to configure the salon, services, stylists, schedules, resources, and storefront settings. Review payment-provider settings separately.

## Development Commands

- `npm run dev` - Prepare the backend schema, apply migrations, and start Next.js development.
- `npm run build` - Build the backend and Next.js for production; does not apply migrations.
- `npm start` - Start the production Next.js server.
- `npm run migrate:gen` - Prepare the schema and generate/apply development migrations.
- `npm run migrate` - Apply checked-in Prisma migrations.
- `npm run lint` - Run the repository's ESLint script.

Use a disposable development database for migration generation. Review the script before running it against any existing data.

### Payment Integration
Manual and Stripe adapters are registered in [the payment loader](features/integrations/payment/index.ts). Configure provider records before taking payments; manual records do not represent a processor capture.

## Documentation

See the [Openfront Salon documentation](https://docs.openship.org/docs/openfront/salon/) for the application guide. The [backend models](features/keystone/models), [registered business workflows](features/keystone/mutations/index.ts), [access rules](features/keystone/access.ts), and [application routes](app) document the implementation in this repository.

## Security & Permissions

### Role-Based Access Control
- `canAccessDashboard` - Access dashboard.
- `canManageAppointments` - Manage appointments.
- `canManageCatalog` - Manage catalog.
- `canManageClients` - Manage clients.
- `canManageCareRecords` - Manage care records.
- `canManagePayments` - Manage payments.
- `canIssueRefunds` - Issue refunds.

### Security Features
- Session-based authentication for signed-in users.
- Backend list access and workflow authorization, rather than dashboard visibility alone.
- Client and appointment read rules distinguish staff capabilities from records owned by the signed-in client. Care-record access and onboarding require explicit permissions.

Review the [access implementation](features/keystone/access.ts) and individual workflow checks before extending permissions.

## Platform Components

### Admin Platform (`/dashboard`)
- **Commissions**: `/dashboard/platform/commissions`.
- **Clients**: `/dashboard/platform/clients`.
- **Appointments**: `/dashboard/platform/appointments`.
- **Catalog**: `/dashboard/platform/catalog`.
- **Resources**: `/dashboard/platform/resources`.
- **Store Settings**: `/dashboard/platform/store-settings`.
- **Schedules**: `/dashboard/platform/schedules`.
- **Checkout**: `/dashboard/platform/checkout`.
- **Engagement**: `/dashboard/platform/engagement`.
- **Integrations**: `/dashboard/platform/integrations`.
- **Inventory**: `/dashboard/platform/inventory`.
- **Benefits**: `/dashboard/platform/benefits`.

### Storefront Experience
Clients can browse `/services` and `/stylists`, book at `/book`, and view appointments and accounts. Gift-card, gallery, team, and review pages round out the public site.

Coordinate stylist schedules, resources, appointment segments, deposits, and waitlists. Appointment transitions and schedule revisions are handled by dedicated workflow commands.

## Deployment

### Production Deployment
The Vercel button imports this application's own repository. Provision PostgreSQL and configure the application's complete runtime requirements, storage, mail, and enabled providers before building. Importing the source does not configure these services.

Build the application and apply checked-in migrations as a release step before starting the server. Back up existing data before migration.

```bash
npm run build
npm run migrate
npm start
```

The included [Railway configuration](railway.toml) defines this app's build and startup lifecycle. Provision services and secrets separately.

### Scaling Considerations
Keep the shared PostgreSQL database, session secrets, and configured object storage consistent across application processes. Review background delivery and integration requirements before choosing a serverless runtime; a source import does not supply persistent workers.

## Contributing

Use the development commands above when preparing changes. Keep model changes and their migrations together, and describe workflow and permission changes in pull requests.

## License

No top-level license file or package license declaration is included in this repository.

## Support

- **Documentation**: [Openfront Salon guide](https://docs.openship.org/docs/openfront/salon/).
- **Issues**: [Report bugs and feature requests](https://github.com/openshiporg/openfront-salon/issues).
- **Product**: [Learn more about Openfront Salon](https://openship.org/products/openfront-salon).

---

Built with [Next.js](https://nextjs.org) and [KeystoneJS](https://keystonejs.com).
