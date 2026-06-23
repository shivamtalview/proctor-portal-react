# 🚀 Quick Start Guide

Get your React Proctor Portal up and running in minutes!

## Prerequisites

- **Node.js 18+** (recommended) or Node.js 16+ (with warnings)
- **npm** or **yarn**
- Modern web browser

## Installation

### Option 1: Automated Setup (Recommended)

```bash
cd proctor-portal-react
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Setup

```bash
cd proctor-portal-react

# Install dependencies (use --legacy-peer-deps if you have Node < 20)
npm install --legacy-peer-deps

# Start development server
npm run dev
```

## Running the Application

After installation, start the development server:

```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

## Login

Use these demo credentials to test different user roles:

| Role | Username | Password |
|------|----------|----------|
| **Admin** (Full access) | `admin` | `admin123` |
| **Vendor** (Limited to Sai) | `sai` | `sai123` |
| **Coordinator** (Evaluations) | `coord1` | `coord123` |

## Project Structure

```
proctor-portal-react/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── layout/     # Sidebar, Topbar, MainLayout
│   │   └── ui/         # Button, Input, Modal, etc.
│   ├── pages/          # Route pages (Dashboard, Proctors, etc.)
│   ├── services/       # API services (Supabase, auth, proctor)
│   ├── stores/         # Zustand state management
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions
├── public/             # Static assets
└── index.html          # HTML entry point
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build optimized production bundle |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint to check code quality |

## Features Currently Implemented

✅ **Authentication System**
- Login/logout functionality
- Role-based access control
- Protected routes

✅ **Dashboard**
- Statistics overview
- Vendor breakdown
- Real-time data from Supabase

✅ **Modern UI**
- Dark theme matching original design
- Responsive sidebar navigation
- Tailwind CSS styling

✅ **Architecture**
- TypeScript for type safety
- Zustand for state management
- React Query for data fetching
- React Router for navigation

## Next Steps for Development

### 1. Implement Proctors Table

The ProctorsPage is a placeholder. Here's what to add:

```typescript
// Use React Query to fetch proctors
const { data: proctors, isLoading } = useQuery({
  queryKey: ['proctors'],
  queryFn: () => proctorService.getAll(),
});

// Display in a table with search/filters
```

### 2. Add Form Validation

Install React Hook Form:
```bash
npm install react-hook-form @hookform/resolvers zod
```

### 3. Add Table Component

Install TanStack Table (optional but recommended):
```bash
npm install @tanstack/react-table
```

### 4. Complete Other Pages

Each page placeholder needs:
- Data fetching with React Query
- Table/list display
- Search and filter functionality
- CRUD operations

## Troubleshooting

### Port Already in Use

If port 3000 is busy, modify `vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    port: 3001, // Change port
  },
})
```

### Supabase Connection Issues

Check these in `src/services/supabase.ts`:
- Supabase URL is correct
- API key is valid
- Database tables exist

### Build Errors

Clear cache and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Node Version Warnings

If you see Supabase engine warnings with Node 18, they're safe to ignore. The app will work fine.

## Development Tips

### 1. Component-First Approach

Build small, reusable components:
```typescript
// Good: Small, focused component
function ProctorCard({ proctor }: { proctor: Proctor }) {
  return <div>...</div>;
}

// Better: With proper types and styling
function ProctorCard({ proctor }: ProctorCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      {/* ... */}
    </div>
  );
}
```

### 2. Use Custom Hooks

Extract reusable logic:
```typescript
// src/hooks/useProctors.ts
export function useProctors(filters?: ProctorFilters) {
  return useQuery({
    queryKey: ['proctors', filters],
    queryFn: () => proctorService.getAll(filters),
  });
}
```

### 3. Leverage TypeScript

Let types guide your development:
```typescript
// Types catch errors at compile time
const proctor: Proctor = {
  // TypeScript will show which fields are required
};
```

## Documentation

- [React Documentation](https://react.dev)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TanStack Query](https://tanstack.com/query/latest)
- [Zustand](https://docs.pmnd.rs/zustand)
- [Vite](https://vitejs.dev/guide/)

## Need Help?

1. Check `MIGRATION_GUIDE.md` for architecture details
2. Review `README.md` for comprehensive information
3. Look at the original HTML in `../proctor-portal/` for business logic

## Contributing

When adding features:
1. Create types in `src/types/`
2. Add services in `src/services/`
3. Build components in `src/components/`
4. Create pages in `src/pages/`
5. Add routes in `src/App.tsx`

## Performance Tips

- Use `React.memo()` for expensive components
- Lazy load routes: `const Page = lazy(() => import('./pages/Page'))`
- Optimize images and assets
- Monitor bundle size with `npm run build`

---

**Happy Coding! 🎉**

For detailed migration information, see `MIGRATION_GUIDE.md`
