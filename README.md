# Talview Proctor Portal - React

A modern, refactored React application for managing proctors throughout their lifecycle.

## 🚀 Technology Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Zustand** for state management
- **TanStack Query** (React Query) for data fetching
- **Supabase** for backend (database + storage + auth)

## 📦 Installation

```bash
# Install dependencies
npm install
```

## 🏃 Running the Application

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The app will be available at `http://localhost:3000`

## 🔑 Demo Credentials

- **Admin**: `admin` / `admin123`
- **Vendor (Sai)**: `sai` / `sai123`
- **Coordinator**: `coord1` / `coord123`

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   └── layout/         # Layout components (Sidebar, Topbar)
├── pages/              # Page components (routes)
├── services/           # API services (Supabase, auth, proctor)
├── stores/             # Zustand state stores
├── types/              # TypeScript type definitions
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── App.tsx             # Main app component with routing
├── main.tsx            # Application entry point
└── index.css           # Global styles
```

## 🎨 Features Implemented

### ✅ Core Functionality
- User authentication (admin, vendor, coordinator roles)
- Dashboard with statistics
- Protected routes based on user roles
- Responsive sidebar navigation
- Modern dark-themed UI matching original design

### 🚧 To Be Implemented
The following features are ready to be built on top of this foundation:

1. **Proctor Management**
   - All Proctors table with search/filters
   - Individual proctor details view
   - Bulk operations (CSV import/export)
   - Status tracking (In Progress → Verified → Active → Offboarded)

2. **Onboarding Workflow**
   - BGV tracking
   - Demo & Assessment scheduling
   - NDA signing integration
   - Document upload tracking

3. **Evaluation System**
   - Demo assignment and results
   - Assessment scheduling
   - Coordinator workspace

4. **Public Forms**
   - Interview select form
   - NDA signing page
   - Document upload page

## 🔌 API Integration

All API calls go through the service layer:

- `services/auth.ts` - Authentication
- `services/proctor.ts` - Proctor CRUD operations
- `services/supabase.ts` - Supabase client configuration

## 🎯 Next Steps

1. **Implement Data Tables**
   - Add a table component library (e.g., TanStack Table)
   - Build reusable Table component
   - Implement sorting, filtering, pagination

2. **Build Forms**
   - Add form library (e.g., React Hook Form)
   - Create form components
   - Add validation

3. **Complete All Pages**
   - Implement Proctors page with full CRUD
   - Build Onboarding workflow
   - Create Evaluation system
   - Add Coordinator workspace

4. **Add Features**
   - CSV import/export
   - File uploads
   - PDF generation for NDA
   - Email notifications integration

5. **Testing & Polish**
   - Add unit tests
   - Add integration tests
   - Error handling
   - Loading states
   - Notifications/toasts

## 🔒 Environment Variables

Create a `.env` file (optional - currently hardcoded):

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📝 Notes

- The original HTML application had ~6,000 lines in a single file
- This React version provides a scalable, maintainable foundation
- All business logic is preserved and can be migrated incrementally
- TypeScript provides type safety throughout the application
- State management is centralized with Zustand
- Data fetching is handled by React Query with caching

## 🤝 Contributing

This is a refactored version of the original Proctor Portal. To add features:

1. Check the original HTML for business logic
2. Create components in `src/components/`
3. Add services in `src/services/`
4. Update types in `src/types/`
5. Build pages in `src/pages/`

## 📄 License

Proprietary - Talview
