import React, { useState, useEffect } from 'react';
import { MapPin, Loader, AlertCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from '../utilss/axios';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type Washerman = {
  _id: string;
  name: string;
  contact: string;
  range?: number;
  location: {
    lat: number;
    lng: number;
  };
};

const NearbyWashermenMap: React.FC = () => {
  const [customerLocation, setCustomerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [washermen, setWashermen] = useState<Washerman[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noWashermenFound, setNoWashermenFound] = useState(false);

  useEffect(() => {
    // Get user's current location and save to database
    const getLocationAndSave = async () => {
      try {
        if (!navigator.geolocation) {
          setError("Geolocation is not supported by this browser");
          setLoading(false);
          return;
        }

        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
          });
        });

        const { latitude: lat, longitude: lng } = position.coords;
        const location = { lat, lng };
        setCustomerLocation(location);
        
        // Save customer location to database
        await saveCustomerLocation(lat, lng);
        
        await fetchNearbyWashermen(lat, lng);
        setLoading(false);
      } catch (err: any) {
        console.error('Geolocation error:', err);
        setError(err.message || "📍 Location access denied. Please enable GPS and refresh.");
        setLoading(false);
      }
    };

    getLocationAndSave();
  }, []);

  const saveCustomerLocation = async (lat: number, lng: number) => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await axios.post('/api/user/location', {
          lat,
          lng,
          address: `Current Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
        }, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Error saving customer location:', error);
    }
  };

  const fetchNearbyWashermen = async (lat: number, lng: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to view nearby washermen');
        return;
      }

      const response = await axios.get(`/api/washer/nearby?lat=${lat}&lng=${lng}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const washermenData = response.data;
      if (Array.isArray(washermenData) && washermenData.length > 0) {
        setWashermen(washermenData);
        setNoWashermenFound(false);
      } else {
        setWashermen([]);
        setNoWashermenFound(true);
      }
    } catch (error) {
      console.error('Error fetching nearby washermen:', error);
      setError('Failed to fetch nearby washermen');
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-center space-x-3">
          <Loader className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-700">Loading map...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-semibold text-red-900">Error</h3>
        </div>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!customerLocation) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Location Required</h3>
        <p className="text-gray-600">Please set your location to view nearby washermen</p>
      </div>
    );
  }

  if (noWashermenFound) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <MapPin className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-yellow-900 mb-2">No Washermen Found</h3>
        <p className="text-yellow-700">No washermen are available in your area at the moment.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Nearby Washermen Map</h3>
      <div className="h-96 rounded-lg overflow-hidden border border-gray-200">
        <MapContainer
          center={[customerLocation.lat, customerLocation.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {/* Customer location marker */}
          <Marker position={[customerLocation.lat, customerLocation.lng]}>
            <Popup>
              <div>
                <strong>📍 Your Location</strong><br />
                {customerLocation.lat.toFixed(6)}, {customerLocation.lng.toFixed(6)}
              </div>
            </Popup>
          </Marker>
          
          {/* Washermen markers */}
          {washermen.map((washerman, index) => (
            <Marker
              key={washerman._id || index}
              position={[washerman.location.lat, washerman.location.lng]}
              icon={L.divIcon({
                className: 'washerman-marker',
                html: '<div style="background-color: #3b82f6; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white;"></div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })}
            >
              <Popup>
                <div>
                  <strong>🧺 {washerman.name}</strong><br />
                  Contact: {washerman.contact}<br />
                  Range: {washerman.range || 500}m
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p><strong>📍 Blue marker:</strong> Your location</p>
        <p><strong>🧺 Blue markers:</strong> Nearby washermen ({washermen.length})</p>
      </div>
    </div>
  );
};

export default NearbyWashermenMap; 