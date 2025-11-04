#!/bin/bash
echo "Creating admin user..."
node src/scripts/createAdminUser.js

echo "Admin user created with these credentials:"
echo "Email: admin@fitsync.com"
echo "Password: admin123"
echo "Visit http://localhost:3000/auth/login to log in"
