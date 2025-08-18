# 🚀 Production Deployment Guide for DhobiXpress

## 🌐 Deploying to Render

### 1. Backend Deployment (Node.js)

#### Environment Variables Required:
```bash
# Database
MONGODB_URI=your_mongodb_atlas_connection_string

# JWT Secret
JWT_SECRET=your_jwt_secret_key_here

# Frontend URL (for CORS)
FRONTEND_URL=https://your-frontend-name.onrender.com

# Port (Render sets this automatically)
PORT=10000

# Node Environment
NODE_ENV=production
```

#### Build Commands:
```bash
# Install dependencies
npm install

# Start the server
npm start
```

#### Important Notes:
- Render automatically sets `PORT` environment variable
- Ensure MongoDB Atlas is accessible from Render's IP addresses
- Add your frontend URL to the CORS allowed origins in `Backend/index.js`

### 2. Frontend Deployment (React/Vite)

#### Environment Variables Required:
```bash
# API Configuration
VITE_API_URL=https://your-backend-name.onrender.com

# Google Maps API
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Geocoding API (OpenCage Data)
VITE_OPENCAGE_API_KEY=your_opencage_api_key_here
```

#### Build Commands:
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start preview (optional)
npm run preview
```

#### Build Output:
- The build output will be in the `dist/` folder
- Upload this folder to your hosting service

## 🔧 Fixing Production Issues

### Issue 1: "Cannot read properties of undefined (reading 'servicesAvailable')"

**Cause:** API response structure mismatch or network errors

**Solution:**
1. Check if backend is accessible from frontend
2. Verify API endpoint URLs match
3. Add error handling for undefined responses

**Code Fix:**
```typescript
// In LocationBasedServiceFilter.tsx
const checkServiceAvailability = async (location: Location) => {
  try {
    const response = await axios.post('/api/check-availability', {
      lat: location.lat,
      lng: location.lng,
      address: location.address
    }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data: ServiceAvailabilityResponse = response.data;
    
    // ✅ Add null check before accessing properties
    if (!data || !data.availability) {
      console.error('Invalid API response:', data);
      setError('Invalid response from server');
      onNoServices();
      return;
    }

    setAvailabilityData(data);

    if (data.availability.servicesAvailable) {
      onServicesFound(data.services);
    } else {
      onNoServices();
    }

  } catch (err: any) {
    console.error('Error checking service availability:', err);
    setError(err.response?.data?.message || 'Failed to check service availability');
    onNoServices();
  }
};
```

### Issue 2: Google Maps API Errors

**Causes:**
1. Invalid API key
2. API not enabled in Google Cloud Console
3. Billing not set up
4. Domain restrictions

**Solutions:**

#### 1. Verify Google Cloud Console Setup:
```bash
# Enable these APIs:
- Maps JavaScript API
- Geocoding API
- Places API
```

#### 2. Check API Key Restrictions:
- Ensure domain restrictions include your Render URL
- Check if billing is enabled
- Verify API quotas

#### 3. Update Environment Variables:
```bash
# In your Render environment variables
VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

### Issue 3: CORS Errors

**Solution:** Update backend CORS configuration

```javascript
// In Backend/index.js
const allowedOrigins = [
  "http://localhost:5173", // dev
  "https://your-frontend-name.onrender.com", // your actual frontend URL
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚫 CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
```

### Issue 4: Environment Variables Not Loading

**Solution:** Ensure proper environment variable setup

```bash
# Frontend (.env file)
VITE_API_URL=https://your-backend-name.onrender.com
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Backend (.env file)
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
FRONTEND_URL=https://your-frontend-name.onrender.com
```

## 📋 Deployment Checklist

### Backend:
- [ ] MongoDB Atlas connection string configured
- [ ] JWT secret set
- [ ] Frontend URL added to CORS
- [ ] All environment variables set in Render
- [ ] Build command: `npm start`
- [ ] Port: `10000` (Render default)

### Frontend:
- [ ] Backend API URL configured
- [ ] Google Maps API key set
- [ ] OpenCage API key set (if using)
- [ ] Build command: `npm run build`
- [ ] Build output uploaded to hosting

### Testing:
- [ ] Backend API endpoints accessible
- [ ] Frontend loads without console errors
- [ ] Location detection works
- [ ] Service availability checking works
- [ ] Google Maps loads correctly

## 🚨 Common Production Issues

### 1. Network Timeouts
- Increase timeout values in axios calls
- Add retry logic for failed requests

### 2. Memory Issues
- Monitor memory usage in Render dashboard
- Optimize database queries
- Implement pagination for large datasets

### 3. Database Connection Issues
- Check MongoDB Atlas network access
- Verify connection string format
- Monitor connection pool size

### 4. File Upload Issues
- Ensure proper file size limits
- Check storage configuration
- Implement proper error handling

## 📞 Support

If you encounter issues:

1. **Check Render Logs**: View backend and frontend logs in Render dashboard
2. **Browser Console**: Check for JavaScript errors
3. **Network Tab**: Verify API calls are successful
4. **Environment Variables**: Ensure all required variables are set
5. **CORS**: Verify frontend URL is in allowed origins

## 🔄 Update Process

### Backend Updates:
1. Push code to Git repository
2. Render automatically redeploys
3. Check logs for any errors
4. Verify API endpoints work

### Frontend Updates:
1. Update environment variables if needed
2. Rebuild and redeploy
3. Clear browser cache
4. Test all functionality

---

**Last Updated:** January 2025  
**Version:** 1.0.0
