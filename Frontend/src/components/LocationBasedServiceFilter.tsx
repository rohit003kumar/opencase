import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Search, AlertCircle, CheckCircle, Loader, Map } from 'lucide-react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, useMapEvents, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface Service {
  _id: string;
  title: string;
  name: string;
  category: string;
  description: string;
  image: string;
  options: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  washerman: {
    _id: string;
    name: string;
    contact: string;
    range: number;
    distance: number;
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface ServiceAvailabilityResponse {
  success: boolean;
  customerLocation: Location;
  availability: {
    servicesAvailable: boolean;
    totalServices: number;
    totalWashermen: number;
    inRangeWashermen: number;
    outOfRangeWashermen: number;
  };
  services: Service[];
  message: string;
  suggestion?: string;
}

interface LocationBasedServiceFilterProps {
  onServicesFound: (services: Service[]) => void;
  onNoServices: () => void;
  onLocationSet: (location: Location) => void;
  startInMap?: boolean; // If true, open directly in map selection mode
}

interface AddressDetails {
  houseNumber?: string;
  street?: string;
  landmark?: string;
  city?: string;
  state?: string;
  zip?: string;
}

const LocationBasedServiceFilter: React.FC<LocationBasedServiceFilterProps> = ({
  onServicesFound,
  onNoServices,
  onLocationSet,
  startInMap = false
}) => {
  const [customerLocation, setCustomerLocation] = useState<Location | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityData, setAvailabilityData] = useState<ServiceAvailabilityResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [manualAddress, setManualAddress] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [showMap, setShowMap] = useState(startInMap);
  const [mapCenter, setMapCenter] = useState({ lat: 20.5937, lng: 78.9629 }); // Default to India center
  const [selectedMapLocation, setSelectedMapLocation] = useState<Location | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  const [addressDetails, setAddressDetails] = useState<AddressDetails>({});
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});

  const deriveAddressDetails = (addr: any): AddressDetails => {
    if (!addr) return {};
    const streetParts = [addr.road, addr.suburb, addr.neighbourhood].filter(Boolean);
    return {
      houseNumber: addr.house_number || '',
      street: streetParts.join(', '),
      landmark: addr.landmark || addr.public_building || '',
      city: addr.city || addr.town || addr.village || addr.county || '',
      state: addr.state || '',
      zip: addr.postcode || ''
    };
  };

  const validateAddressDetails = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!addressDetails.houseNumber?.trim()) {
      newErrors.houseNumber = 'House/Flat/Block No. is required';
    }

    if (!addressDetails.street?.trim()) {
      newErrors.street = 'Street/Area is required';
    }

    if (!addressDetails.city?.trim()) {
      newErrors.city = 'City is required';
    }

    if (!addressDetails.state?.trim()) {
      newErrors.state = 'State is required';
    }

    if (!addressDetails.zip?.trim() || addressDetails.zip?.length !== 6) {
      newErrors.zip = 'Valid 6-digit pincode is required';
    }

    setAddressErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check for saved location on component mount
  useEffect(() => {
    const savedLocation = localStorage.getItem('customerLocation');
    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation);
        setCustomerLocation(parsed);
        setMapCenter({ lat: parsed.lat, lng: parsed.lng });
      } catch (error) {
        console.error('Error parsing saved location:', error);
      }
    }
  }, []);

  const resetLocation = () => {
    setCustomerLocation(null);
    setSelectedMapLocation(null);
    setShowAddressForm(false);
    setAddressDetails({});
    setAddressErrors({});
    localStorage.removeItem('customerLocation');
  };

  const handleMapClick = async (event: any) => {
    console.log('🗺️ Map clicked!', event.latlng);
    const { lat, lng } = event.latlng;
    
    try {
      // Get address from coordinates using reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      
      const location: Location = {
        lat: lat,
        lng: lng,
        address: data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      };

      console.log('📍 Location selected:', location);
      setSelectedMapLocation(location);
      setAddressDetails(deriveAddressDetails(data.address));
      
      // Show success message
      setError('');
    } catch (err) {
      console.error('Error getting address:', err);
      const location: Location = {
        lat: lat,
        lng: lng,
        address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      };
      setSelectedMapLocation(location);
      setAddressDetails({});
      
      // Show fallback message
      setError('Location selected, but could not get address details');
    }
  };

  const confirmMapLocation = () => {
    if (selectedMapLocation) {
      setCustomerLocation(selectedMapLocation);
      onLocationSet(selectedMapLocation);
      setShowAddressForm(true);
    }
  };

  // Leaflet map click handler component
  const MapClickHandler = () => {
    useMapEvents({
      click: handleMapClick,
    });
    return null;
  };

  const checkServiceAvailability = async (location: Location) => {
    setIsCheckingAvailability(true);
    setError('');

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in to check service availability');
      setIsCheckingAvailability(false);
      return;
    }

    try {
      // Match backend mount: app.use('/api', require('./routes/location.route'))
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
      
      // ✅ Add null checks to prevent undefined errors
      if (!data) {
        console.error('❌ No response data received');
        setError('No response from server');
        onNoServices();
        return;
      }

      if (!data.availability) {
        console.error('❌ Invalid response structure - missing availability:', data);
        setError('Invalid response from server');
        onNoServices();
        return;
      }

      setAvailabilityData(data);

      if (data.availability.servicesAvailable) {
        onServicesFound(data.services || []);
      } else {
        onNoServices();
      }

    } catch (err: any) {
      console.error('Error checking service availability:', err);
      
      // ✅ Better error handling
      let errorMessage = 'Failed to check service availability';
      
      if (err.response) {
        // Server responded with error status
        errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;
      } else if (err.request) {
        // Request made but no response received
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        // Something else happened
        errorMessage = err.message || 'Unknown error occurred';
      }
      
      setError(errorMessage);
      onNoServices();
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const handleManualAddressSubmit = async () => {
    if (!manualAddress.trim()) {
      setError('Please enter an address');
      return;
    }

    setIsDetectingLocation(true);
    setError('');

    try {
      // Use OpenStreetMap Nominatim for geocoding (free)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualAddress)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        const location: Location = {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          address: result.display_name
        };

        setCustomerLocation(location);
        setMapCenter({ lat: location.lat, lng: location.lng });
        onLocationSet(location);
        setShowAddressForm(true);
        setAddressDetails(deriveAddressDetails(result.address));
      } else {
        setError('Address not found. Please try a different address.');
      }
    } catch (err) {
      console.error('Error geocoding address:', err);
      setError('Failed to process address. Please try again.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setIsDetectingLocation(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        
        try {
          // Get address from coordinates using reverse geocoding
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
          );
          const data = await response.json();
          
          const location: Location = {
            lat: lat,
            lng: lng,
            address: data.display_name || `Current Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
          };

          setCustomerLocation(location);
          setMapCenter({ lat: lat, lng: lng });
          onLocationSet(location);
          setShowAddressForm(true);
          setAddressDetails(deriveAddressDetails(data.address));
        } catch (err) {
          console.error('Error getting address:', err);
          const location: Location = {
            lat: lat,
            lng: lng,
            address: `Current Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
          };
          setCustomerLocation(location);
          setMapCenter({ lat: lat, lng: lng });
          onLocationSet(location);
          setShowAddressForm(true);
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        let errorMessage = 'Failed to get your location';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please allow location access in your browser settings.';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable. Please check your GPS settings.';
            break;
          case err.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            break;
          default:
            errorMessage = 'Unable to get your location. Please try again.';
        }
        setError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      }
    );
  };

  const saveLocationToBackend = async (detailedAddress: any) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token found, skipping backend save');
        return;
      }

      // Save detailed address to backend
      await axios.post('/api/user/location', {
        lat: customerLocation?.lat,
        lng: customerLocation?.lng,
        address: customerLocation?.address,
        deliveryAddress: detailedAddress
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('✅ Location saved to backend');
    } catch (error) {
      console.error('❌ Error saving to backend:', error);
    }
  };

  const handleAddressSave = async () => {
    if (!validateAddressDetails()) {
      return;
    }

    if (!customerLocation) {
      setError('No location selected');
      return;
    }

    try {
      const detailedAddress = {
        houseNo: addressDetails.houseNumber,
        street: addressDetails.street,
        landmark: addressDetails.landmark,
        city: addressDetails.city,
        state: addressDetails.state,
        pincode: addressDetails.zip,
        fullAddress: `${addressDetails.houseNumber}, ${addressDetails.street}, ${addressDetails.landmark}, ${addressDetails.city}, ${addressDetails.state} - ${addressDetails.zip}`,
        coordinates: {
          lat: customerLocation.lat,
          lng: customerLocation.lng
        }
      };

      // Save to localStorage
      localStorage.setItem('deliveryAddress', JSON.stringify(detailedAddress));
      
      // Save to backend
      await saveLocationToBackend(detailedAddress);

      // Check service availability
      await checkServiceAvailability(customerLocation);
      
      setShowAddressForm(false);
      setShowMap(false);
    } catch (error) {
      console.error('Error saving address:', error);
      setError('Failed to save address. Please try again.');
    }
  };

  const handleSkipAddress = () => {
    if (customerLocation) {
      checkServiceAvailability(customerLocation);
      setShowAddressForm(false);
      setShowMap(false);
    }
  };

  // If showing address form, render that
  if (showAddressForm) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Add Delivery Address</h3>
          <button
            onClick={() => setShowAddressForm(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">Complete address is required for delivery</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              House/Flat/Block No. *
            </label>
            <input
              type="text"
              value={addressDetails.houseNumber || ''}
              onChange={(e) => setAddressDetails(prev => ({ ...prev, houseNumber: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                addressErrors.houseNumber ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter house/flat number *"
            />
            {addressErrors.houseNumber && (
              <p className="text-red-500 text-xs mt-1">{addressErrors.houseNumber}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Street / Area *
            </label>
            <input
              type="text"
              value={addressDetails.street || ''}
              onChange={(e) => setAddressDetails(prev => ({ ...prev, street: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                addressErrors.street ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter street/area *"
            />
            {addressErrors.street && (
              <p className="text-red-500 text-xs mt-1">{addressErrors.street}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Landmark (optional)
            </label>
            <input
              type="text"
              value={addressDetails.landmark || ''}
              onChange={(e) => setAddressDetails(prev => ({ ...prev, landmark: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Near hospital, school, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City *
            </label>
            <input
              type="text"
              value={addressDetails.city || ''}
              onChange={(e) => setAddressDetails(prev => ({ ...prev, city: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                addressErrors.city ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter city *"
            />
            {addressErrors.city && (
              <p className="text-red-500 text-xs mt-1">{addressErrors.city}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State *
            </label>
            <input
              type="text"
              value={addressDetails.state || ''}
              onChange={(e) => setAddressDetails(prev => ({ ...prev, state: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                addressErrors.state ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter state *"
            />
            {addressErrors.state && (
              <p className="text-red-500 text-xs mt-1">{addressErrors.state}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pincode *
            </label>
            <input
              type="text"
              value={addressDetails.zip || ''}
              onChange={(e) => setAddressDetails(prev => ({ ...prev, zip: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                addressErrors.zip ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter 6-digit pincode *"
              maxLength={6}
            />
            {addressErrors.zip && (
              <p className="text-red-500 text-xs mt-1">{addressErrors.zip}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleAddressSave}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Save and Continue
          </button>
          <button
            onClick={handleSkipAddress}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  // If showing map, render map interface
  if (showMap) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Select Location on Map</h3>
          <button
            onClick={() => setShowMap(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">📍 Current Location</h4>
              {customerLocation ? (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-700">{customerLocation.address}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Coordinates: {customerLocation.lat.toFixed(6)}, {customerLocation.lng.toFixed(6)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No location set</p>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isDetectingLocation ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Detecting Location...
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4" />
                    Use Current Location
                  </>
                )}
              </button>

              <button
                onClick={() => setShowManualInput(true)}
                className="w-full flex items-center justify-center gap-2 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
              >
                <Search className="w-4 h-4" />
                Enter Address Manually
              </button>
            </div>

            {selectedMapLocation && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h5 className="font-medium text-blue-900 mb-2">📍 Selected Map Location</h5>
                <p className="text-sm text-blue-800">{selectedMapLocation.address}</p>
                <p className="text-xs text-blue-600 mt-1">
                  Coordinates: {selectedMapLocation.lat.toFixed(6)}, {selectedMapLocation.lng.toFixed(6)}
                </p>
                <button
                  onClick={confirmMapLocation}
                  className="mt-2 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Confirm This Location
                </button>
              </div>
            )}
          </div>

          <div className="h-96 rounded-lg overflow-hidden border border-gray-200">
            <MapContainer
              center={[mapCenter.lat, mapCenter.lng]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <MapClickHandler />
              
              {customerLocation && (
                <Marker position={[customerLocation.lat, customerLocation.lng]}>
                  <Popup>
                    <div>
                      <strong>Your Location</strong><br />
                      {customerLocation.address}
                    </div>
                  </Popup>
                </Marker>
              )}
              
              {selectedMapLocation && (
                <Marker position={[selectedMapLocation.lat, selectedMapLocation.lng]}>
                  <Popup>
                    <div>
                      <strong>Selected Location</strong><br />
                      {selectedMapLocation.address}
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        </div>
      </div>
    );
  }

  // Main interface
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="text-center mb-6">
        <MapPin className="w-12 h-12 text-blue-600 mx-auto mb-3" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Choose Your Delivery Location</h3>
        <p className="text-gray-600">Set your location to find nearby laundry services</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {customerLocation && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">
              <strong>Location Set:</strong> {customerLocation.address}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={handleDetectLocation}
          disabled={isDetectingLocation}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isDetectingLocation ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Detecting Location...
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              Use Current Location
            </>
          )}
        </button>

        <button
          onClick={() => setShowMap(true)}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
        >
          <Map className="w-4 h-4" />
          Pick on Map
        </button>

        <button
          onClick={() => setShowManualInput(true)}
          className="w-full flex items-center justify-center gap-2 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
        >
          <Search className="w-4 h-4" />
          Enter Address Manually
        </button>

        {customerLocation && (
          <button
            onClick={() => checkServiceAvailability(customerLocation)}
            disabled={isCheckingAvailability}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isCheckingAvailability ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Checking Services...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Check Service Availability
              </>
            )}
          </button>
        )}
      </div>

      {showManualInput && (
        <div className="mt-6 p-4 bg-gray-50 rounded-md">
          <h4 className="font-medium text-gray-900 mb-3">Enter Address Manually</h4>
          <div className="space-y-3">
            <input
              type="text"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              placeholder="Enter your full address"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleManualAddressSubmit}
                disabled={isDetectingLocation}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isDetectingLocation ? 'Processing...' : 'Submit'}
              </button>
              <button
                onClick={() => setShowManualInput(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {customerLocation && (
        <div className="mt-4 text-center">
          <button
            onClick={resetLocation}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Reset Location
          </button>
        </div>
      )}
    </div>
  );
};

export default LocationBasedServiceFilter;

