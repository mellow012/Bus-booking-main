
# BooknPay - Multi-Company Bus Booking Platform

A comprehensive bus booking platform built with Next.js 14, Firebase, and Tailwind CSS that allows users to search, compare, and book bus tickets from multiple companies.

## Features

### 🚌 Core Features
- **Multi-company bus search** - Compare schedules and prices from different bus operators
- **Real-time seat selection** - Interactive seat map with live availability
- **User authentication** - Secure login/registration with Firebase Auth
- **Booking management** - Complete booking flow with passenger details
- **Admin dashboard** - Company admin panel for managing buses, routes, and schedules
- **Responsive design** - Works seamlessly on desktop and mobile devices

### 🎨 UI/UX Features
- Clean, modern design with Tailwind CSS
- Intuitive search and booking flow
- Interactive seat selection interface
- Real-time updates and loading states
- Mobile-responsive layout

### 🔧 Technical Features
- Next.js 14 with App Router
- Firebase Authentication & Firestore
- TypeScript for type safety
- Server-side rendering (SSR)
- Optimized performance

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Authentication + Firestore)
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites
- Node.js 18+ installed
- Firebase project set up
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bus-booking-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Create a new Firebase project at https://console.firebase.google.com
   - Enable Authentication (Email/Password)
   - Create a Firestore database
   - Get your Firebase config from Project Settings

4. **Configure environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

5. **Set up Firestore Security Rules**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Users can read/write their own user document
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       
       // Anyone can read companies, buses, routes, schedules
       match /{document=**} {
         allow read: if true;
       }
       
       // Authenticated users can create bookings
       match /bookings/{bookingId} {
         allow create: if request.auth != null;
         allow read, update: if request.auth != null && resource.data.userId == request.auth.uid;
       }
       
       // Company admins can manage their company data
       match /companies/{companyId} {
         allow write: if request.auth != null;
       }
       
       match /buses/{busId} {
         allow write: if request.auth != null;
       }
       
       match /routes/{routeId} {
         allow write: if request.auth != null;
       }
       
       match /schedules/{scheduleId} {
         allow write: if request.auth != null;
       }
     }
   }
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Seed the database** (Optional)
   - Visit `http://localhost:3000/seed-d
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       
       // Anyone can read companies, buses, routes, schedules
       match /{document=**} {
         allow read: if true;
       }
       
       // Authenticated users can create bookings
       match /bookings/{bookingId} {
         allow create: if request.auth != null;
         allow read, update: if request.auth != null && resource.data.userId == request.auth.uid;
       }
       
       // Company admins can manage their company data
       match /companies/{companyId} {
         allow write: if request.auth != null;
       }
       
       match /buses/{busId} {
         allow write: if request.auth != null;
       }
       
       match /routes/{routeId} {
         allow write: if request.auth != null;
       }
       
       match /schedules/{scheduleId} {
         allow write: if request.auth != null;
       }
     }
   }
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Seed the database** (Optional)
   - Visit `http://localhost:3000/seed-data`
   - Click "Seed Database" to populate with sample data

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/             # Admin dashboard
│   ├── book/              # Booking flow
│   ├── bookings/          # User bookings
│   ├── login/             # Authentication
│   ├── register/          # User registration
│   ├── search/            # Bus search
│   └── seed-data/         # Database seeding
├── components/            # Reusable React components
│   ├── Header.tsx         # Navigation header
│   ├── Footer.tsx         # Site footer
│   ├── SearchForm.tsx     # Bus search form
│   ├── SearchResults.tsx  # Search results display
│   ├── SeatSelection.tsx  # Interactive seat map
│   └── PassengerForm.tsx  # Passenger details form
├── contexts/              # React contexts
│   └── AuthContext.tsx    # Authentication context
├── lib/                   # Utility libraries
│   └── firebaseConfig.ts  # Firebase configuration
├── types/                 # TypeScript type definitions
│   └── index.ts           # Data models
└── utils/                 # Utility functions
    └── seedDatabase.ts    # Database seeding utility
```

## Usage

### For Customers
1. **Search Buses**: Enter departure/destination cities and travel date
2. **Compare Options**: View schedules, prices, and amenities from multiple companies
3. **Select Seats**: Choose your preferred seats using the interactive seat map
4. **Enter Details**: Provide passenger information for all travelers
5. **Complete Booking**: Confirm and pay for your tickets
6. **Manage Bookings**: View and manage your bookings in the dashboard

### For Company Admins
1. **Register**: Create an account with "Company Admin" role
2. **Company Setup**: Contact system admin to associate with a company
3. **Manage Fleet**: Add and manage bus information
4. **Create Routes**: Set up routes between cities
5. **Schedule Trips**: Create schedules with pricing and availability
6. **Monitor Bookings**: Track bookings and revenue

## Demo Accounts

For testing purposes, you can use these demo accounts:

**Customer Account:**
- Email: customer@demo.com
- Password: demo123

**Company Admin:**
- Email: admin@demo.com
- Password: demo123

## Database Schema

### Collections

- **companies**: Bus company information
- **buses**: Fleet management data
- **routes**: Route definitions between cities
- **schedules**: Trip schedules with pricing
- **bookings**: Customer booking records
- **users**: User profiles and authentication data

## Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Other Platforms
The app is built with standard Next.js and can be deployed to any platform that supports Node.js applications.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support or questions, please contact the development team or create an issue in the repository.

---

**Built with ❤️ using Next.js, Firebase, and Tailwind CSS**

=======
# Bus-booking
a multi-purpose bus booking web app
>>>>>>> c4d636767dab44e440be772f9d5c8876f3783c3f
