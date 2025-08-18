import React, { useState, useEffect } from 'react';
import { MapPin, Loader, AlertCircle, Calendar, Clock } from 'lucide-react';
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

interface Washerman {
  _id: string;
  name: string;
  contact: string;
  range?: number;
  location: {
    lat: number;
    lng: number;
  };
  availableSlots?: Array<{
    timeRange: string;
    period: string;
    available: number;
    maxCapacity: number;
  }>;
  totalAvailableSlots?: number;
}

const NearbyWashermenWithSlots: React.FC = () => {
  const [customerLocation, setCustomerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [washermen, setWashermen] = useState<Washerman[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noWashermenFound, setNoWashermenFound] = useState(false);
  const [selectedWasherman, setSelectedWasherman] = useState<Washerman | null>(null);

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

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    // You can add logic here to fetch available slots for the selected date
  };

  const handleWashermanSelect = (washerman: Washerman) => {
    setSelectedWasherman(washerman);
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Nearby Washermen with Available Slots</h3>
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map Section */}
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
                eventHandlers={{
                  click: () => handleWashermanSelect(washerman)
                }}
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

        {/* Washermen List Section */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Available Washermen</h4>
          {washermen.map((washerman, index) => (
            <div
              key={washerman._id || index}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedWasherman?._id === washerman._id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleWashermanSelect(washerman)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-medium text-gray-900">{washerman.name}</h5>
                  <p className="text-sm text-gray-600">Contact: {washerman.contact}</p>
                  <p className="text-sm text-gray-600">Range: {washerman.range || 500}m</p>
                </div>
                <div className="text-right">
                  {washerman.totalAvailableSlots ? (
                    <div className="text-green-600 text-sm">
                      <Clock className="w-4 h-4 inline mr-1" />
                      {washerman.totalAvailableSlots} slots available
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm">No slots available</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Washerman Details */}
      {selectedWasherman && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Selected Washerman: {selectedWasherman.name}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p><strong>Contact:</strong> {selectedWasherman.contact}</p>
              <p><strong>Service Range:</strong> {selectedWasherman.range || 500}m</p>
            </div>
            <div>
              <p><strong>Available Slots:</strong> {selectedWasherman.totalAvailableSlots || 0}</p>
              {selectedDate && (
                <p><strong>Selected Date:</strong> {new Date(selectedDate).toLocaleDateString()}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NearbyWashermenWithSlots; 