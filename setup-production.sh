#!/bin/bash

echo "🚀 DhobiXpress Production Setup Script"
echo "======================================"
echo ""

# Check if .env file exists
if [ -f "Frontend/.env" ]; then
    echo "⚠️  Frontend .env file already exists. Backing up..."
    cp Frontend/.env Frontend/.env.backup
fi

if [ -f "Backend/.env" ]; then
    echo "⚠️  Backend .env file already exists. Backing up..."
    cp Backend/.env Backend/.env.backup
fi

echo ""
echo "📝 Please provide the following information for production deployment:"
echo ""

# Frontend environment variables
read -p "Enter your backend API URL (e.g., https://your-backend.onrender.com): " BACKEND_URL
read -p "Enter your Google Maps API key: " GOOGLE_MAPS_KEY
read -p "Enter your OpenCage API key (optional, press Enter to skip): " OPENCAGE_KEY

# Backend environment variables
read -p "Enter your MongoDB Atlas connection string: " MONGODB_URI
read -p "Enter your JWT secret key: " JWT_SECRET
read -p "Enter your frontend URL (e.g., https://your-frontend.onrender.com): " FRONTEND_URL

echo ""
echo "🔧 Creating Frontend .env file..."

# Create Frontend .env
cat > Frontend/.env << EOF
# Frontend Environment Variables for Production
VITE_API_URL=${BACKEND_URL}
VITE_GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_KEY}
EOF

if [ ! -z "$OPENCAGE_KEY" ]; then
    echo "VITE_OPENCAGE_API_KEY=${OPENCAGE_KEY}" >> Frontend/.env
fi

echo ""
echo "🔧 Creating Backend .env file..."

# Create Backend .env
cat > Backend/.env << EOF
# Backend Environment Variables for Production
MONGODB_URI=${MONGODB_URI}
JWT_SECRET=${JWT_SECRET}
FRONTEND_URL=${FRONTEND_URL}
NODE_ENV=production
EOF

echo ""
echo "✅ Environment files created successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Deploy backend to Render with these environment variables"
echo "2. Deploy frontend to your hosting service"
echo "3. Update CORS settings in Backend/index.js with your frontend URL"
echo "4. Test the application"
echo ""
echo "📁 Files created:"
echo "   - Frontend/.env"
echo "   - Backend/.env"
echo "   - Frontend/.env.backup (if existed)"
echo "   - Backend/.env.backup (if existed)"
echo ""
echo "🔒 Remember to:"
echo "   - Never commit .env files to version control"
echo "   - Keep your API keys secure"
echo "   - Set up proper CORS configuration"
echo "   - Test all functionality after deployment"
