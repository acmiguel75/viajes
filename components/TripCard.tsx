import React, { useState, useMemo } from 'react';
import { Trip, CATEGORIES, TripItem, LocationPoint, ItineraryItem } from '../types';
import { formatCurrency, calculateDistance, getDatesInRange, getMonthDifference, getDaysDifference, generateUUID } from '../utils/geo';
import SocialImporter from './SocialImporter';
import MapSection from './MapSection';

interface TripCardProps {
  trip: Trip;
  onUpdate: (updatedTrip: Trip) => void;
  onDelete: () => void;
  userCoords: GeolocationCoordinates | null;
  incomingShare?: { url: string; text: string } | null;
  onClearShare?: () => void;
}

const TripCard: React.FC<TripCardProps> = ({ trip, onUpdate, onDelete, userCoords, incomingShare, onClearShare }) => {
  const [activeTab, setActiveTab] = useState<'gastos' | 'itinerario' | 'mapa' | 'social'>('itinerario');
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [isManagingFamilies, setIsManagingFamilies] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');

  // --- Derived State & Calculations ---
  const tripDates = useMemo(() => getDatesInRange(trip.fechaInicio, trip.fechaFin), [trip.fechaInicio, trip.fechaFin]);
  
  const financialData = useMemo(() => {
    const allItems = (Object.values(trip.conceptos) as TripItem[][]).flat();
    const total = allItems.reduce((sum, i) => sum + (Number(i.coste) || 0), 0);
    const paid = allItems.reduce((sum, i) => sum + (i.pagado ? (Number(i.coste) || 0) : 0), 0);
    
    // 1. Calculate contributions (Expenses + Compensations Given - Compensations Received)
    const contribution: Record<string, number> = {};
    trip.familias.forEach(f => contribution[f] = 0);
    
    // Add Expenses
    allItems.forEach(item => {
        if (item.pagado && item.pagadoPor && contribution[item.pagadoPor] !== undefined) {
            contribution[item.pagadoPor] += Number(item.coste);
        }
    });

    // Adjust with Compensations (Settlements)
    // If A pays B 50€: A's contribution increases (debt decreases), B's contribution decreases (credit decreases/reimbursed)
    (trip.compensaciones || []).forEach(comp => {
        if (contribution[comp.deudor] !== undefined) contribution[comp.deudor] += comp.cantidad;
        if (contribution[comp.acreedor] !== undefined) contribution[comp.acreedor] -= comp.cantidad;
    });

    const numFamilies = trip.familias.length || 1;
    const fairShare = total / numFamilies;
    
    const balances = trip.familias.map(f => ({
        family: f,
        contribution: contribution[f] || 0,
        balance: (contribution[f] || 0) - fairShare // + means creditor, - means debtor
    }));

    // 2. Savings Plan (Ahorro)
    const today = new Date();
    const startObj = new Date(trip.fechaInicio);
    const monthsUntilTrip = Math.max(1, getMonthDifference(today, startObj));
    const monthlySavingNeeded = fairShare / monthsUntilTrip;

    // 3. Settlement (Liquidación - Greedy Algorithm)
    // Only consider balances > 0.01 or < -0.01 to avoid float errors
    const debtors = balances.filter(b => b.balance < -0.01).sort((a, b) => a.balance - b.balance); // Most negative first
    const creditors = balances.filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance); // Most positive first
    
    const settlements: { deudor: string; acreedor: string; cantidad: number }[] = [];
    let i = 0; // debtor index
    let j = 0; // creditor index

    // Working copies of balances for calculation
    const currentDebtors = debtors.map(d => ({ ...d }));
    const currentCreditors = creditors.map(c => ({ ...c }));

    while (i < currentDebtors.length && j < currentCreditors.length) {
        const debtor = currentDebtors[i];
        const creditor = currentCreditors[j];
        
        const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
        
        if (amount > 0.01) {
            settlements.push({ deudor: debtor.family, acreedor: creditor.family, cantidad: amount });
        }

        debtor.balance += amount;
        creditor.balance -= amount;

        if (Math.abs(debtor.balance) < 0.01) i++;
        if (creditor.balance < 0.01) j++;
    }

    return { total, paid, fairShare, balances, settlements, monthsUntilTrip, monthlySavingNeeded };
  }, [trip.conceptos, trip.familias, trip.fechaInicio, trip.compensaciones]);

  const { total, paid, balances, settlements, monthsUntilTrip, monthlySavingNeeded, fairShare } = financialData;
  const progress = total > 0 ? Math.round((paid / total) * 100) : 0;

  // --- Handlers: Families ---
  const handleAddFamily = () => {
    if (newFamilyName && !trip.familias.includes(newFamilyName)) {
        onUpdate({ ...trip, familias: [...trip.familias, newFamilyName] });
        setNewFamilyName('');
    }
  };

  const handleRemoveFamily = (name: string) => {
    if (window.confirm(`¿Eliminar a ${name} del viaje?`)) {
        onUpdate({ ...trip, familias: trip.familias.filter(f => f !== name) });
    }
  };

  // --- Handlers: Expenses ---
  const handleAddItem = (category: string) => {
    const newItem: TripItem = {
      id: generateUUID(),
      nombre: '',
      coste: 0,
      pagado: false,
      pagadoPor: ''
    };
    const newConceptos = { ...trip.conceptos };
    newConceptos[category] = [...newConceptos[category], newItem];
    onUpdate({ ...trip, conceptos: newConceptos });
  };

  const handleUpdateItem = (category: string, index: number, field: keyof TripItem, value: any) => {
    const newItems = [...trip.conceptos[category]];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'pagadoPor' && value) newItems[index].pagado = true;
    onUpdate({ ...trip, conceptos: { ...trip.conceptos, [category]: newItems } });
  };

  const handleDeleteItem = (category: string, index: number) => {
    const newItems = trip.conceptos[category].filter((_, i) => i !== index);
    onUpdate({ ...trip, conceptos: { ...trip.conceptos, [category]: newItems } });
  };

  // --- Handlers: Settlements ---
  const handleSettleDebt = (deudor: string, acreedor: string, cantidad: number) => {
      if (window.confirm(`¿Confirmar que ${deudor} ha pagado ${formatCurrency(cantidad)} a ${acreedor}?`)) {
          const newComp = {
              deudor,
              acreedor,
              cantidad,
              fecha: new Date().toISOString()
          };
          onUpdate({ ...trip, compensaciones: [...(trip.compensaciones || []), newComp] });
      }
  };

  const handleDeleteSettlement = (idx: number) => {
      if (window.confirm("¿Borrar este registro de pago?")) {
          const newComps = [...(trip.compensaciones || [])];
          newComps.splice(idx, 1);
          onUpdate({ ...trip, compensaciones: newComps });
      }
  };

  // --- Handlers: Itinerary ---
  const handleAddItineraryItem = (date: string) => {
      const newItem: ItineraryItem = { id: generateUUID(), texto: '', completado: false };
      const current = trip.itinerario[date] || [];
      onUpdate({ ...trip, itinerario: { ...trip.itinerario, [date]: [...current, newItem] } });
  };

  const handleUpdateItinerary = (date: string, id: string, field: keyof ItineraryItem, val: any) => {
      const current = trip.itinerario[date] || [];
      const updated = current.map(i => i.id === id ? { ...i, [field]: val } : i);
      onUpdate({ ...trip, itinerario: { ...trip.itinerario, [date]: updated } });
  };

  const handleDeleteItinerary = (date: string, id: string) => {
      const current = trip.itinerario[date] || [];
      onUpdate({ ...trip, itinerario: { ...trip.itinerario, [date]: current.filter(i => i.id !== id) } });
  };

  // --- Handlers: Map ---
  const handleAddLocation = (lat: number, lng: number) => {
    const name = prompt("Nombre del lugar:", "Nuevo Punto");
    if (!name) return;
    const newLoc: LocationPoint = { id: generateUUID(), lat, lng, name, type: 'interest' };
    onUpdate({ ...trip, locations: [...trip.locations, newLoc] });
    setIsAddingLocation(false);
  };

  return (
    <div className="glass-panel rounded-[2rem] p-4 md:p-8 relative group border border-white/50 mb-12 shadow-xl">
      
      {/* Top Actions */}
      <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
        <button onClick={onDelete} className="text-slate-400 hover:text-red-500 transition p-2.5 bg-white/50 hover:bg-white rounded-full">
          <i className="ph ph-trash text-xl"></i>
        </button>
      </div>

      {/* Title & Dates */}
      <div className="mb-8 pr-16">
           <input 
              type="text" 
              value={trip.nombre}
              onChange={(e) => onUpdate({...trip, nombre: e.target.value})}
              className="text-3xl md:text-4xl font-bold w-full bg-transparent focus:outline-none border-b-2 border-transparent focus:border-blue-500 rounded-none px-0 text-slate-800 placeholder-slate-300"
              placeholder="Nombre del Viaje"
            />
           <div className="mt-2 text-slate-500 font-medium flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-full">
                  <i className="ph-bold ph-calendar text-blue-500"></i>
                  <input type="date" value={trip.fechaInicio} onChange={(e) => onUpdate({...trip, fechaInicio: e.target.value})} className="bg-transparent outline-none w-28" />
                  <span>➜</span>
                  <input type="date" value={trip.fechaFin} onChange={(e) => onUpdate({...trip, fechaFin: e.target.value})} className="bg-transparent outline-none w-28" />
              </div>
              
              {/* Families Section */}
              <div className="relative group/families">
                 <button 
                    onClick={() => setIsManagingFamilies(!isManagingFamilies)}
                    className="flex items-center gap-2 bg-white/50 hover:bg-white px-3 py-1 rounded-full cursor-pointer transition"
                 >
                    <i className="ph-bold ph-users text-purple-500"></i>
                    <span>{trip.familias.join(', ')}</span>
                    <i className="ph-bold ph-pencil-simple text-slate-400 text-xs"></i>
                 </button>

                 {/* Family Management Popover */}
                 {isManagingFamilies && (
                    <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 p-4 z-50 w-64 animate-in fade-in slide-in-from-top-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Gestionar Familias</h4>
                        <div className="flex gap-2 mb-3">
                            <input 
                                className="flex-grow bg-slate-100 rounded-lg px-2 py-1 text-sm outline-none" 
                                placeholder="Nombre Familia..." 
                                value={newFamilyName}
                                onChange={(e) => setNewFamilyName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddFamily()}
                            />
                            <button onClick={handleAddFamily} className="text-white bg-purple-500 p-1.5 rounded-lg hover:bg-purple-600">
                                <i className="ph-bold ph-plus"></i>
                            </button>
                        </div>
                        <ul className="space-y-1">
                            {trip.familias.map(f => (
                                <li key={f} className="flex justify-between items-center text-sm p-1 hover:bg-slate-50 rounded">
                                    <span className="text-slate-700">{f}</span>
                                    <button onClick={() => handleRemoveFamily(f)} className="text-slate-300 hover:text-red-500"><i className="ph-bold ph-x"></i></button>
                                </li>
                            ))}
                        </ul>
                    </div>
                 )}
              </div>
           </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 border-b border-slate-200/50 pb-1">
          {[
              { id: 'itinerario', icon: 'ph-calendar-check', label: 'Itinerario' },
              { id: 'social', icon: 'ph-share-network', label: 'Videos & Info' },
              { id: 'mapa', icon: 'ph-map-trifold', label: 'Mapa' },
              { id: 'gastos', icon: 'ph-wallet', label: 'Gastos y Deudas' },
          ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-800 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                  <i className={`ph-fill ${tab.icon}`}></i> {tab.label}
              </button>
          ))}
      </div>

      {/* --- CONTENT: ITINERARY --- */}
      {activeTab === 'itinerario' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {tripDates.map((date, idx) => {
                      const dayItems = trip.itinerario[date] || [];
                      const displayDate = new Date(date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
                      return (
                          <div key={date} className="bg-white/60 rounded-2xl p-4 border border-white shadow-sm flex flex-col h-full min-h-[200px]">
                              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                                  <h4 className="font-bold text-slate-700 capitalize">
                                      <span className="text-blue-500 mr-2">Día {idx + 1}</span> 
                                      <span className="text-xs font-normal text-slate-500">{displayDate}</span>
                                  </h4>
                                  <button onClick={() => handleAddItineraryItem(date)} className="text-blue-500 hover:bg-blue-50 p-1 rounded-full"><i className="ph-bold ph-plus"></i></button>
                              </div>
                              <div className="flex-grow space-y-2">
                                  {dayItems.map(item => (
                                      <div key={item.id} className="flex gap-2 items-start group">
                                          <input 
                                            type="checkbox" 
                                            checked={item.completado}
                                            onChange={(e) => handleUpdateItinerary(date, item.id, 'completado', e.target.checked)}
                                            className="mt-1.5 accent-blue-500 cursor-pointer" 
                                          />
                                          <textarea 
                                            value={item.texto}
                                            onChange={(e) => handleUpdateItinerary(date, item.id, 'texto', e.target.value)}
                                            placeholder="Actividad..."
                                            rows={1}
                                            className={`bg-transparent w-full text-sm resize-none outline-none border-b border-transparent focus:border-blue-300 transition ${item.completado ? 'line-through text-slate-400' : 'text-slate-700'}`}
                                            onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                          />
                                          <button onClick={() => handleDeleteItinerary(date, item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><i className="ph-bold ph-x"></i></button>
                                      </div>
                                  ))}
                                  {dayItems.length === 0 && <p className="text-xs text-slate-300 italic text-center mt-4">Sin actividades</p>}
                              </div>
                          </div>
                      )
                  })}
              </div>
          </div>
      )}

      {/* --- CONTENT: SOCIAL --- */}
      {activeTab === 'social' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <SocialImporter 
                trip={trip} 
                onUpdate={onUpdate} 
                incomingShare={incomingShare} 
                onClearShare={onClearShare} 
             />
          </div>
      )}

      {/* --- CONTENT: MAPA --- */}
      {activeTab === 'mapa' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-slate-500">Haz clic en "Añadir Punto" y luego en el mapa para guardar lugares.</p>
                <button 
                  onClick={() => setIsAddingLocation(!isAddingLocation)}
                  className={`text-xs font-bold px-4 py-2 rounded-full transition border shadow-sm ${isAddingLocation ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-white text-slate-700 border-slate-200'}`}
                >
                  {isAddingLocation ? 'Cancelar' : '+ Añadir Punto'}
                </button>
             </div>
             
             <MapSection locations={trip.locations} onAddLocation={handleAddLocation} isAddingMode={isAddingLocation} userCoords={userCoords} />
             
             <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {trip.locations.map(loc => {
                   const dist = userCoords ? calculateDistance(userCoords.latitude, userCoords.longitude, loc.lat, loc.lng) : null;
                   return (
                     <div key={loc.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2">
                           <i className={`ph-fill text-lg ${loc.type === 'restaurant' ? 'ph-fork-knife text-orange-400' : 'ph-map-pin text-blue-400'}`}></i>
                           <div>
                               <span className="text-sm font-bold text-slate-700 block">{loc.name}</span>
                               <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{loc.type}</span>
                           </div>
                        </div>
                        {dist !== null && (
                          <span className={`text-xs font-mono font-bold ${dist < 200 ? 'text-green-600 animate-pulse' : 'text-slate-400'}`}>
                            {(dist / 1000).toFixed(2)} km
                          </span>
                        )}
                     </div>
                   );
                })}
             </div>
          </div>
      )}

      {/* --- CONTENT: GASTOS & LIQUIDACIÓN --- */}
      {activeTab === 'gastos' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Savings Plan */}
              <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-lg mb-8 relative overflow-hidden">
                  <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div>
                          <h3 className="text-lg font-bold flex items-center gap-2"><i className="ph-fill ph-piggy-bank text-2xl"></i> Plan de Ahorro Familiar</h3>
                          <p className="text-indigo-100 text-sm mt-1">Para cubrir los <strong>{formatCurrency(fairShare)}</strong> por familia antes del viaje.</p>
                      </div>
                      <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 min-w-[200px] border border-white/20">
                          <p className="text-xs uppercase font-bold text-indigo-100 tracking-wider">Cuota Mensual Sugerida</p>
                          <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-extrabold">{formatCurrency(monthlySavingNeeded)}</span>
                              <span className="text-xs font-medium">/ mes</span>
                          </div>
                          <p className="text-[10px] text-indigo-200 mt-1">Durante {monthsUntilTrip} meses restantes</p>
                      </div>
                  </div>
                  <i className="ph-duotone ph-coins absolute -right-4 -bottom-8 text-9xl text-white/10 rotate-12"></i>
              </div>

              {/* Balances Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <div className="bg-slate-800 text-white p-4 rounded-xl shadow-lg">
                      <p className="text-xs text-slate-400 uppercase font-bold">Total Gastado</p>
                      <p className="text-2xl font-bold">{formatCurrency(total)}</p>
                      <div className="w-full bg-white/20 h-1 mt-2 rounded-full"><div className="bg-green-400 h-full rounded-full" style={{width: `${progress}%`}}></div></div>
                  </div>
                  {balances.map(b => (
                      <div key={b.family} className={`p-4 rounded-xl border shadow-sm ${b.balance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          <div className="flex justify-between items-start">
                             <div>
                                <p className="text-xs text-slate-500 uppercase font-bold">{b.family}</p>
                                <p className={`text-xl font-bold ${b.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    {b.balance >= 0 ? '+' : ''}{formatCurrency(b.balance)}
                                </p>
                             </div>
                             {b.balance < -1 ? <i className="ph-fill ph-trend-down text-red-300 text-2xl"></i> : <i className="ph-fill ph-trend-up text-green-300 text-2xl"></i>}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2">Contribución Neta: {formatCurrency(b.contribution)}</p>
                      </div>
                  ))}
              </div>

              {/* Settlement / Liquidación */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* Pending Debts */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                       <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                           <i className="ph-fill ph-handshake text-xl"></i> Deudas Pendientes
                       </h3>
                       {settlements.length > 0 ? (
                           <div className="grid gap-2">
                               {settlements.map((s, idx) => (
                                   <div key={idx} className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3 text-emerald-900 font-medium">
                                       <span className="flex items-center gap-2 text-sm">
                                            <strong className="text-red-500">{s.deudor}</strong>
                                            <i className="ph-bold ph-arrow-right text-emerald-300"></i>
                                            <strong className="text-green-600">{s.acreedor}</strong>
                                            <span>{formatCurrency(s.cantidad)}</span>
                                       </span>
                                       <button 
                                            onClick={() => handleSettleDebt(s.deudor, s.acreedor, s.cantidad)}
                                            className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-full font-bold shadow-sm transition"
                                       >
                                           Saldar Deuda
                                       </button>
                                   </div>
                               ))}
                           </div>
                       ) : (
                           <div className="text-emerald-400 text-center py-4 italic text-sm">
                               ¡Todo saldado! No hay deudas pendientes.
                           </div>
                       )}
                  </div>

                  {/* Payment History */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                       <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                           <i className="ph-fill ph-clock-counter-clockwise text-xl"></i> Historial de Pagos
                       </h3>
                       <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                           {(trip.compensaciones || []).length > 0 ? (
                               (trip.compensaciones || []).map((comp, idx) => (
                                   <div key={idx} className="flex justify-between items-center text-xs text-slate-500 p-2 bg-white rounded border border-slate-100">
                                       <span>{comp.deudor} pagó {formatCurrency(comp.cantidad)} a {comp.acreedor}</span>
                                       <button onClick={() => handleDeleteSettlement(idx)} className="text-slate-300 hover:text-red-500"><i className="ph-bold ph-trash"></i></button>
                                   </div>
                               ))
                           ) : (
                               <div className="text-slate-400 text-center py-4 italic text-xs">Sin historial</div>
                           )}
                       </div>
                  </div>
              </div>

              {/* Categorized List */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
                {CATEGORIES.map(category => (
                  <div key={category} className="flex flex-col h-full">
                    <div className="bg-white/80 rounded-t-2xl p-3 border-b border-white flex justify-between items-center backdrop-blur-md shadow-sm sticky top-0 z-10">
                      <span className="font-bold text-slate-700 text-sm">{category}</span>
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                        {formatCurrency(trip.conceptos[category].reduce((sum, i) => sum + (Number(i.coste) || 0), 0))}
                      </span>
                    </div>
                    <div className="bg-white/30 border border-white rounded-b-2xl p-2 flex-grow flex flex-col gap-2 shadow-inner min-h-[150px]">
                      {trip.conceptos[category].map((item, idx) => (
                        <div key={item.id} className={`bg-white p-3 rounded-xl shadow-sm border border-transparent relative group ${item.pagado ? 'opacity-90 bg-slate-50' : ''}`}>
                           {item.pagado && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400 rounded-l-xl"></div>}
                           <div className="flex justify-between gap-1 mb-1">
                              <input 
                                className="w-full text-xs font-semibold text-slate-700 bg-transparent outline-none" 
                                placeholder="Concepto" 
                                value={item.nombre}
                                onChange={(e) => handleUpdateItem(category, idx, 'nombre', e.target.value)}
                              />
                              <button onClick={() => handleDeleteItem(category, idx)} className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"><i className="ph-bold ph-x"></i></button>
                           </div>
                           <div className="flex items-center gap-1 border-t border-slate-100 pt-2">
                              <span className="text-[10px] text-slate-400">€</span>
                              <input 
                                type="number" 
                                className="w-16 text-sm font-bold text-slate-600 bg-transparent outline-none" 
                                placeholder="0" 
                                value={item.coste || ''}
                                onChange={(e) => handleUpdateItem(category, idx, 'coste', parseFloat(e.target.value))}
                              />
                              <select 
                                className="ml-auto text-[10px] bg-transparent text-slate-500 font-bold outline-none text-right cursor-pointer"
                                value={item.pagadoPor}
                                onChange={(e) => handleUpdateItem(category, idx, 'pagadoPor', e.target.value)}
                              >
                                 <option value="">Pendiente</option>
                                 {trip.familias.map(f => <option key={f} value={f}>{f}</option>)}
                              </select>
                           </div>
                        </div>
                      ))}
                      <button 
                        onClick={() => handleAddItem(category)}
                        className="mt-auto w-full py-3 border border-dashed border-slate-300 rounded-xl text-slate-400 text-xs font-semibold hover:bg-white hover:text-blue-600 transition flex justify-center items-center gap-2"
                      >
                        <i className="ph-bold ph-plus"></i> Añadir Gasto
                      </button>
                    </div>
                  </div>
                ))}
              </div>
          </div>
      )}
    </div>
  );
};

export default TripCard;