# zynqCloud

A self-hosted file management platform built with Next.js, TypeScript, and Tailwind CSS. zynqCloud provides secure, fast, and completely self-hosted file storage with role-based access control, team collaboration features, and S3-compatible storage integration.

![zynqCloud](https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1200&h=400&fit=crop)

## ✨ Features

- 🔐 **Secure Authentication** - JWT-based auth with HttpOnly cookies
- 👥 **Role-Based Access** - Admin, user, and owner roles with fine-grained permissions
- 📧 **Invite System** - Admin-controlled user invitations with copy-to-clipboard links
- 📁 **File Management** - Upload, organize, share, and delete files with metadata storage
- 🗑️ **Trash System** - Soft delete with restore and permanent delete options
- 🤝 **Team Collaboration** - Share files with read/write permissions
- 🎨 **Dark/Light Theme** - Elegant purple-accented design with theme toggle
- 📊 **Storage Quotas** - Per-user storage limits and usage tracking
- 🔒 **Privacy First** - Optional telemetry with user consent
- 📱 **Responsive Design** - Mobile-friendly interface with collapsible sidebar
- ⚡ **Fast & Modern** - Built on Next.js 15 with App Router

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ or Bun
- Backend API running (see backend setup instructions)
- PostgreSQL database
- S3-compatible storage (AWS S3, MinIO, etc.)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd zynqcloud-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` and set your backend API URL:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   bun dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
zynqcloud-frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── dashboard/          # Protected dashboard routes
│   │   │   ├── files/          # My Files page
│   │   │   ├── shared/         # Shared files page
│   │   │   ├── trash/          # Trash page
│   │   │   ├── profile/        # User profile
│   │   │   ├── settings/       # Settings pages
│   │   │   │   ├── users/      # Admin: User management
│   │   │   │   └── invites/    # Admin: Invite management
│   │   │   └── layout.tsx      # Dashboard layout with auth
│   │   ├── login/              # Login page
│   │   ├── register/           # Registration page
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Landing page
│   │   └── globals.css         # Global styles with purple theme
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── Sidebar.tsx         # Dashboard sidebar
│   │   ├── Header.tsx          # Dashboard header
│   │   └── ThemeProvider.tsx   # Theme context provider
│   ├── lib/
│   │   ├── api.ts              # API client with typed endpoints
│   │   ├── auth.ts             # Auth utilities
│   │   └── utils.ts            # Utility functions
│   └── hooks/
│       └── use-theme.ts        # Theme hook
├── public/                     # Static assets
├── .env.local.example          # Environment variables template
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## 🎨 Design System

### Colors

- **Primary**: Purple (#7c3aed / oklch(0.591 0.210 293.655))
- **Background**: Dynamic based on theme
- **Foreground**: Dynamic based on theme
- **Accent**: Purple tones for interactive elements

### Components

Built with shadcn/ui for consistency and accessibility:
- Buttons, Cards, Badges
- Dropdowns, Dialogs, Sheets
- Tables, Forms, Inputs
- Toasts, Tooltips, Popovers

## 🔌 API Integration

The frontend communicates with the backend via REST API. All endpoints are typed and wrapped in `src/lib/api.ts`:

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/me` - Get current user

### Files
- `GET /files` - List files (paginated)
- `POST /files` - Create file metadata / get upload URL
- `GET /files/:id` - Get file metadata
- `DELETE /files/:id` - Soft delete file
- `POST /files/:id/restore` - Restore from trash
- `DELETE /files/:id/permanent` - Permanently delete
- `POST /files/:id/share` - Share file
- `GET /files/shared` - Get shared files

### Admin
- `GET /admin/users` - List all users
- `PUT /admin/users/:id` - Update user
- `DELETE /admin/users/:id` - Delete user
- `POST /invites` - Create invite
- `GET /invites` - List invites
- `POST /invites/:id/revoke` - Revoke invite

### Settings
- `GET /settings` - Get settings
- `PUT /settings` - Update settings

## 🔒 Authentication Flow

1. **Login**: User enters credentials → Backend validates → JWT stored in HttpOnly cookie
2. **Protected Routes**: Dashboard layout checks auth on mount → Redirects to login if not authenticated
3. **Logout**: Clears cookie → Redirects to login

## 🎭 User Roles

- **User**: Can manage their own files, view shared files
- **Admin**: All user permissions + manage users and invites
- **Owner**: Full system access

## 📧 Invite System

1. Admin creates invite with email and role
2. Backend generates unique token and sends email
3. Frontend provides "Copy Link" button for manual sharing
4. Invitee registers using invite link with token parameter
5. Token validates and assigns role on registration

## 🗑️ File Deletion

- **Soft Delete**: Moves to trash, restorable for 30 days
- **Permanent Delete**: Admin or owner can permanently delete
- **Auto-cleanup**: Backend cron job removes files after 30 days (configurable)

## 🎨 Theming

Toggle between light and dark themes:
- Persisted in localStorage
- Synced with backend settings (optional)
- Purple accent consistent across themes

## 🔧 Development

### Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint
npm run type-check # Run TypeScript type checking
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:4000/api/v1` |

## 📦 Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Set production environment variables**
   ```env
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
   ```

3. **Deploy to your hosting provider**
   - Vercel, Netlify, or any Node.js hosting
   - Ensure API URL is accessible from your domain
   - Configure CORS on backend to allow your domain

4. **SSL/HTTPS**
   - Required for production
   - Ensures secure cookies work properly

## 🛡️ Security Considerations

- JWT stored in HttpOnly cookies (not accessible via JavaScript)
- CSRF protection via SameSite cookie policy
- All API requests include credentials
- Input validation on forms
- Rate limiting (backend responsibility)
- File type and size restrictions

## 🧪 Testing

```bash
# Run unit tests (coming soon)
npm run test

# Run e2e tests (coming soon)
npm run test:e2e
```

## 📝 Backend Integration

This frontend requires the zynqCloud backend. Follow the backend prompt provided in your documentation to set up:

- PostgreSQL database with migrations
- S3/MinIO for file storage
- SMTP for email invitations
- JWT authentication
- API endpoints matching the spec

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Animations with [Framer Motion](https://www.framer.com/motion/)

## 📧 Support

For issues or questions:
- Open an issue on GitHub
- Contact: [your-email@example.com]

---

**zynqCloud** - Self-hosted file management, built for privacy and control.