import React, { useState, useEffect } from 'react';
import { Trip, CATEGORIES } from './types';
import { INITIAL_FAMILIES, PROXIMITY_THRESHOLD_METERS } from './constants';
import TripCard from './components/TripCard';
import { calculateDistance } from './utils/geo';

const App: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>(() => {
    const saved = localStorage.getItem('viajeros_app_data');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [userCoords, setUserCoords] = useState<GeolocationCoordinates | null>(null);
  const [proximityAlert, setProximityAlert] = useState<string | null>(null);
  const [incomingShare, setIncomingShare] = useState<{url: string, text: string} | null>(null);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('viajeros_app_data', JSON.stringify(trips));
  }, [trips]);

  // --- Handle Share Target (Incoming Data from TikTok/IG/YouTube) ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const title = params.get('title');
    const text = params.get('text');
    const url = params.get('url');

    if (title || text || url) {
        setIncomingShare({
            url: url || '',
            text: text || title || ''
        });
        // Clean URL after capturing
        window.history.replaceState({}, document.title, "/");
    }
  }, []);

  // --- Geolocation & Proximity Alert ---
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        setUserCoords(pos.coords);
        checkProximity(pos.coords);
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, [trips]);

  const checkProximity = (coords: GeolocationCoordinates) => {
    let nearest: string | null = null;
    let minDistance = PROXIMITY_THRESHOLD_METERS;

    trips.forEach(trip => {
      trip.locations.forEach(loc => {
        const dist = calculateDistance(coords.latitude, coords.longitude, loc.lat, loc.lng);
        if (dist < minDistance) {
          nearest = `¡Estás cerca de ${loc.name}! (${Math.round(dist)}m)`;
          minDistance = dist;
        }
      });
    });

    setProximityAlert(nearest);
  };

  // --- Trip Management ---
  const createTrip = () => {
    const today = new Date().toISOString().split('T')[0];
    const newTrip: Trip = {
      id: Date.now(),
      nombre: 'Nuevo Viaje',
      fechaInicio: today,
      fechaFin: today,
      fechaCreacion: today,
      familias: [...INITIAL_FAMILIES],
      compensaciones: [],
      itinerario: {},
      conceptos: CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: [] }), {} as Record<string, any[]>),
      socialLinks: [],
      locations: []
    };
    setTrips([newTrip, ...trips]);
  };

  const updateTrip = (updatedTrip: Trip) => {
    setTrips(trips.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const deleteTrip = (id: number) => {
    if (window.confirm("¿Estás seguro de eliminar este viaje?")) {
      setTrips(trips.filter(t => t.id !== id));
    }
  };

  // --- Import/Export ---
  const exportData = () => {
    const blob = new Blob([JSON.stringify(trips, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viajeros_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data)) {
          if (window.confirm("Esto reemplazará todos los viajes. ¿Continuar?")) {
            setTrips(data);
          }
        }
      } catch (err) {
        alert("Archivo inválido");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8">
      
      {/* Incoming Share Modal / Toast */}
      {incomingShare && (
        <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 animate-in slide-in-from-top-4">
             <div className="bg-pink-600 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-4 border-2 border-pink-400">
                <i className="ph-fill ph-share-network text-2xl animate-pulse"></i>
                <div>
                    <p className="font-bold">¡Contenido recibido!</p>
                    <p className="text-xs text-pink-100 max-w-[200px] truncate">{incomingShare.text || incomingShare.url}</p>
                </div>
                <div className="text-xs bg-white text-pink-600 px-3 py-1 rounded-full font-bold">
                    Abre un viaje para guardarlo
                </div>
             </div>
        </div>
      )}

      {/* Proximity Toast */}
      {proximityAlert && (
        <div className="fixed bottom-4 right-4 z-50 bg-white border-l-4 border-emerald-500 shadow-2xl p-4 rounded-lg flex items-center gap-3 animate-bounce">
           <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
             <i className="ph-fill ph-navigation-arrow text-xl"></i>
           </div>
           <div>
             <p className="font-bold text-slate-800 text-sm">Destino Cercano</p>
             <p className="text-xs text-slate-600">{proximityAlert}</p>
           </div>
           <button onClick={() => setProximityAlert(null)} className="ml-2 text-slate-400 hover:text-slate-600">
             <i className="ph-bold ph-x"></i>
           </button>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col xl:flex-row justify-between items-center mb-10 gap-6">
        <div className="text-center xl:text-left">
          <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tight flex items-center justify-center xl:justify-start gap-3">
            Viajeros Pro <i className="ph-fill ph-airplane-tilt text-blue-500"></i>
          </h1>
          <p className="text-slate-500 font-medium mt-1 ml-1 flex items-center justify-center xl:justify-start gap-2">
            <i className="ph ph-wallet text-slate-400"></i> Planificador Familiar Definitivo
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
           <label className="bg-white hover:bg-slate-50 text-slate-600 px-5 py-3 rounded-full font-semibold shadow-md border border-slate-200 transition flex items-center gap-2 cursor-pointer group">
              <i className="ph-bold ph-upload-simple text-xl group-hover:text-blue-500"></i> 
              <span>Cargar JSON</span>
              <input type="file" className="hidden" accept=".json" onChange={importData} />
           </label>
           
           <button onClick={exportData} className="bg-white hover:bg-slate-50 text-slate-600 px-5 py-3 rounded-full font-semibold shadow-md border border-slate-200 transition flex items-center gap-2 group">
              <i className="ph-bold ph-download-simple text-xl group-hover:text-blue-500"></i> 
              <span>Backup</span>
           </button>

           <div className="h-8 w-px bg-slate-300 mx-1 hidden sm:block"></div>

           <button onClick={createTrip} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-full font-semibold shadow-xl shadow-slate-300/50 transition transform hover:-translate-y-1 active:scale-95 flex items-center gap-2 border border-slate-700">
              <i className="ph ph-plus-circle text-xl text-blue-400"></i> Nuevo Viaje
           </button>
        </div>
      </header>

      {/* Trip List */}
      <div className="flex flex-col gap-12">
        {trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <i className="ph-duotone ph-airplane-tilt text-8xl mb-4 opacity-50 text-blue-300"></i>
            <p className="text-2xl font-light text-slate-500">No hay viajes planeados</p>
            <button onClick={createTrip} className="mt-6 text-white bg-blue-500 px-6 py-2 rounded-full hover:bg-blue-600 transition shadow-lg shadow-blue-200">
              Crear el primero
            </button>
          </div>
        ) : (
          trips.map(trip => (
            <TripCard 
              key={trip.id} 
              trip={trip} 
              onUpdate={updateTrip} 
              onDelete={() => deleteTrip(trip.id)} 
              userCoords={userCoords}
              incomingShare={incomingShare}
              onClearShare={() => setIncomingShare(null)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default App;