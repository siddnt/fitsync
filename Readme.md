# FitSync - Gym Management System

## Quick Start - Admin Login
To log in as an admin user:
1. Run `./create-admin.sh` to create admin credentials
2. Login with:
   - Email: admin@fitsync.com
   - Password: admin123
3. Visit http://localhost:4000/auth/login to log in

## Overview
FitSync is a comprehensive gym management system that facilitates interaction between gym members, trainers, and administrators. It allows users to browse and enroll in fitness plans, book sessions with trainers, and manage their fitness journey, all in one place.

## Features
- **User Management**: Registration, login, profile management for members and trainers
- **Plan Management**: Create, update, and enroll in fitness plans
- **Booking System**: Schedule and manage training sessions
- **Admin Dashboard**: Monitor and manage users, plans, and bookings
- **Responsive UI**: Works on both desktop and mobile devices

## Tech Stack
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Frontend**: EJS templates, HTML, CSS, JavaScript
- **Authentication**: JWT and Session-based authentication

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB Compass (local installation)

### Installation
1. Clone the repository
   ```
   git clone https://github.com/yourusername/fitsync.git
   cd fitsync
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Configure environment variables
   ```
   cp sample.env .env
   ```
   Edit the `.env` file with your own values.

4. Start MongoDB locally
   Ensure MongoDB is running on your local machine.

5. Start the application
   ```
   npm run dev
   ```

6. Access the application
   Open your browser and navigate to `http://localhost:4000`

### Creating Admin User
To create an admin user for accessing the admin dashboard:

1. Run the admin creation script:
   ```
   ./create-admin.sh
   ```
   or
   ```
   node src/scripts/createAdminUser.js
   ```

2. The script will create an admin user with the following credentials:
   - Email: admin@fitsync.com
   - Password: admin123

3. Login at http://localhost:4000/auth/login with these credentials

### Legacy Data Cleanup
- Run `npm run migrate:cleanup:legacy` after deploying to remove deprecated course-era fields from existing user documents. The script is idempotent but you should back up the `users` collection before executing it in production.

## Project Structure
```
src/
├── controllers/     # Request handlers
├── db/              # Database connection
├── middlewares/     # Express middlewares
├── models/          # Mongoose schemas
├── routes/          # API routes
├── scripts/         # Utility scripts
├── storage/         # File uploads storage
├── utils/           # Utility functions
├── app.js           # Express app setup
└── index.js         # Entry point
public/              # Static assets
views/               # EJS templates
```

## License
ISC


