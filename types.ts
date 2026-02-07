export interface TripItem {
    id: string;
    nombre: string;
    coste: number;
    pagado: boolean;
    pagadoPor: string;
}

export interface ItineraryItem {
    id: string;
    texto: string;
    completado: boolean;
    locationId?: string; // Links to a stored location
}

export interface SocialLink {
    id: string;
    url: string;
    platform: 'tiktok' | 'youtube' | 'instagram' | 'other';
    note: string;
    thumbnail?: string;
}

export interface LocationPoint {
    id: string;
    lat: number;
    lng: number;
    name: string;
    type: 'restaurant' | 'activity' | 'interest';
}

export interface Trip {
    id: number;
    nombre: string;
    fechaInicio: string;
    fechaFin: string;
    fechaCreacion: string;
    familias: string[];
    compensaciones: { deudor: string; acreedor: string; cantidad: number; fecha: string }[];
    itinerario: Record<string, ItineraryItem[]>;
    conceptos: Record<string, TripItem[]>;
    socialLinks: SocialLink[];
    locations: LocationPoint[];
}

export const CATEGORIES = ['Casa', 'Transporte', 'Comida', 'Entradas', 'Actividades'] as const;
export type Category = typeof CATEGORIES[number];