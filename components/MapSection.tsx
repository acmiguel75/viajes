import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LocationPoint } from '../types';
import { DEFAULT_COORDS } from '../constants';

// Fix for default Leaflet markers in React
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// User location icon (Blue Dot)
const userIcon = L.divIcon({
  className: 'custom-user-icon',
  html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

interface MapSectionProps {
  locations: LocationPoint[];
  onAddLocation: (lat: number, lng: number) => void;
  isAddingMode: boolean;
  userCoords: GeolocationCoordinates | null;
}

// Component to handle auto-centering
const RecenterMap = ({ center, zoom }: { center: [number, number], zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

const LocationMarker = ({ onAddLocation, isAddingMode }: { onAddLocation: (lat: number, lng: number) => void, isAddingMode: boolean }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;
    
    const handleClick = (e: L.LeafletMouseEvent) => {
      if (isAddingMode) {
        onAddLocation(e.latlng.lat, e.latlng.lng);
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, isAddingMode, onAddLocation]);

  return null;
};

const MapSection: React.FC<MapSectionProps> = ({ locations, onAddLocation, isAddingMode, userCoords }) => {
  // Logic: 
  // 1. If locations exist, center on the first one.
  // 2. If no locations but userCoords exist, center on user.
  // 3. Fallback to default.
  
  let center: [number, number] = DEFAULT_COORDS;
  let zoom = 6; // Default zoom (country level)

  if (locations.length > 0) {
    center = [locations[0].lat, locations[0].lng];
    zoom = 13; // City level
  } else if (userCoords) {
    center = [userCoords.latitude, userCoords.longitude];
    zoom = 13; // City level (User location)
  }

  return (
    <div className="h-[400px] w-full rounded-2xl overflow-hidden border border-white/50 shadow-inner relative z-0">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <RecenterMap center={center} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Render Saved Locations */}
        {locations.map((loc) => (
          <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={icon}>
            <Popup>
              <div className="text-slate-800">
                <strong className="block text-sm mb-1">{loc.name}</strong>
                <span className="text-xs capitalize bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{loc.type}</span>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Render User Location */}
        {userCoords && (
           <Marker position={[userCoords.latitude, userCoords.longitude]} icon={userIcon}>
              <Popup>¡Estás aquí!</Popup>
           </Marker>
        )}

        <LocationMarker onAddLocation={onAddLocation} isAddingMode={isAddingMode} />
      </MapContainer>
      
      {isAddingMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg animate-bounce text-sm font-bold">
          📍 Haz click en el mapa para añadir
        </div>
      )}
    </div>
  );
};

export default MapSection;