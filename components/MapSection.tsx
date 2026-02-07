import React, { useEffect, useState } from 'react';
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

interface MapSectionProps {
  locations: LocationPoint[];
  onAddLocation: (lat: number, lng: number) => void;
  isAddingMode: boolean;
}

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

const MapSection: React.FC<MapSectionProps> = ({ locations, onAddLocation, isAddingMode }) => {
  const center = locations.length > 0 
    ? [locations[0].lat, locations[0].lng] as [number, number] 
    : DEFAULT_COORDS;

  return (
    <div className="h-[400px] w-full rounded-2xl overflow-hidden border border-white/50 shadow-inner relative z-0">
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
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