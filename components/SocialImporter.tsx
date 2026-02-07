import React, { useState, useEffect } from 'react';
import { SocialLink, Trip } from '../types';
import { getPlatformFromUrl, getYoutubeId, generateUUID } from '../utils/geo';

interface SocialImporterProps {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
  incomingShare?: { url: string; text: string } | null;
  onClearShare?: () => void;
}

const SocialImporter: React.FC<SocialImporterProps> = ({ trip, onUpdate, incomingShare, onClearShare }) => {
  const [urlInput, setUrlInput] = useState('');
  const [noteInput, setNoteInput] = useState('');

  // Auto-fill from incoming share
  useEffect(() => {
    if (incomingShare) {
      // Find URL within text if URL param is empty but text has one
      let finalUrl = incomingShare.url;
      if (!finalUrl && incomingShare.text) {
        const urlMatch = incomingShare.text.match(/(https?:\/\/[^\s]+)/g);
        if (urlMatch) finalUrl = urlMatch[0];
      }
      
      if (finalUrl) {
        setUrlInput(finalUrl);
        setNoteInput(incomingShare.text?.replace(finalUrl, '').trim().substring(0, 50) || 'Contenido compartido');
      }
    }
  }, [incomingShare]);

  const handleImport = () => {
    if (!urlInput) return;

    const platform = getPlatformFromUrl(urlInput);
    let thumbnail = undefined;
    
    // Auto-fetch YT thumbnail
    if (platform === 'youtube') {
      const ytId = getYoutubeId(urlInput);
      if (ytId) thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }

    const newLink: SocialLink = {
      id: generateUUID(),
      url: urlInput,
      platform: platform,
      note: noteInput || 'Interés turístico',
      thumbnail: thumbnail
    };

    const updatedTrip = { ...trip, socialLinks: [newLink, ...trip.socialLinks] };
    onUpdate(updatedTrip);
    
    setUrlInput('');
    setNoteInput('');
    if (onClearShare) onClearShare();
  };

  const deleteLink = (id: string) => {
    const updatedTrip = { ...trip, socialLinks: trip.socialLinks.filter(l => l.id !== id) };
    onUpdate(updatedTrip);
  };

  const getPlatformIcon = (platform: string) => {
    switch(platform) {
      case 'tiktok': return 'ph-tiktok-logo';
      case 'instagram': return 'ph-instagram-logo';
      case 'youtube': return 'ph-youtube-logo';
      default: return 'ph-link';
    }
  };

  const getPlatformColor = (platform: string) => {
    switch(platform) {
      case 'tiktok': return 'text-black bg-teal-200';
      case 'instagram': return 'text-pink-600 bg-pink-100';
      case 'youtube': return 'text-red-600 bg-red-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  return (
    <div className="bg-white/40 rounded-2xl p-6 border border-white/60 shadow-inner mb-8">
      <h3 className="text-sm font-bold text-pink-500 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-pink-100 pb-2">
        <i className="ph-fill ph-share-network text-xl text-pink-500"></i> Importar de Redes (TikTok, IG, Youtube)
      </h3>

      <div className={`flex flex-col gap-3 mb-6 p-4 rounded-xl transition-all ${incomingShare ? 'bg-pink-50 border-2 border-pink-200 animate-pulse' : 'bg-transparent'}`}>
        {incomingShare && <div className="text-xs font-bold text-pink-600 mb-1">✨ Detectado contenido compartido:</div>}
        <div className="flex flex-col md:flex-row gap-3">
            <input 
            type="text" 
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Pega enlace de TikTok, Instagram o YouTube..."
            className="flex-grow bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition"
            />
            <input 
            type="text" 
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Nota (ej: Restaurante chulo)"
            className="md:w-1/3 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-400 transition"
            />
            <button 
            onClick={handleImport}
            className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg shadow-pink-200 flex items-center justify-center gap-2 whitespace-nowrap"
            >
            <i className="ph-bold ph-plus"></i> Guardar
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {trip.socialLinks.map(link => {
            const ytId = link.platform === 'youtube' ? getYoutubeId(link.url) : null;
            
            return (
                <div key={link.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-lg transition flex flex-col">
                    {/* Thumbnail Area */}
                    <div className="relative aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
                        {link.thumbnail ? (
                            <img src={link.thumbnail} alt="preview" className="w-full h-full object-cover" />
                        ) : (
                             ytId ? (
                                <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} className="w-full h-full object-cover" />
                             ) : (
                                <div className={`text-5xl ${getPlatformColor(link.platform).split(' ')[0]}`}>
                                    <i className={`ph-fill ${getPlatformIcon(link.platform)}`}></i>
                                </div>
                             )
                        )}
                        <div className="absolute top-2 right-2 flex gap-2">
                             <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase shadow-sm ${getPlatformColor(link.platform)}`}>
                                {link.platform}
                             </span>
                        </div>
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition backdrop-blur-sm">
                            <i className="ph-fill ph-play-circle text-white text-5xl drop-shadow-lg"></i>
                        </a>
                    </div>
                    
                    {/* Content */}
                    <div className="p-3 flex justify-between items-start gap-2 flex-grow">
                        <div>
                            <p className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">{link.note}</p>
                            <p className="text-[10px] text-slate-400 mt-1 truncate max-w-[150px]">{link.url}</p>
                        </div>
                        <button 
                            onClick={() => deleteLink(link.id)}
                            className="text-slate-300 hover:text-red-500 transition p-1"
                        >
                            <i className="ph-bold ph-trash"></i>
                        </button>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default SocialImporter;