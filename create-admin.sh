#!/bin/bash
echo "Creating admin user..."
node src/scripts/createAdminUser.js

echo "Admin user created with these credentials:"
echo "Email: admin@fitsync.com"
echo "Password: admin123"
echo "Visit http://localhost:4000/auth/login to log in"
