// Mock data for the school van tracking system

export interface Student {
  id: string;
  name: string;
  class: string;
  pickupPoint: string;
  parentPhone: string;
  vanId: string;
  status: 'waiting' | 'onboard' | 'dropped';
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  licenseNo: string;
  vanId: string;
  avatar?: string;
}

export interface Van {
  id: string;
  vehicleNumber: string;
  routeName: string;
  capacity: number;
  driverId: string;
  status: 'active' | 'inactive' | 'maintenance';
}

export interface RoutePoint {
  name: string;
  lat: number;
  lng: number;
  order: number;
  type: 'school' | 'pickup' | 'drop';
}

export interface TripData {
  vanId: string;
  status: 'active' | 'completed' | 'scheduled';
  startTime: string;
  currentLat: number;
  currentLng: number;
  speed: number;
  heading: number;
}

export const SCHOOL_LOCATION = { lat: 0, lng: 0, name: "School" };

export const students: Student[] = [
  { id: "s1", name: "Aman Kumar", class: "5", pickupPoint: "Tilak Nagar Chowk", parentPhone: "9123456780", vanId: "VAN-01", status: "onboard" },
  { id: "s2", name: "Neha Singh", class: "7", pickupPoint: "Station Road", parentPhone: "9345678120", vanId: "VAN-01", status: "waiting" },
  { id: "s3", name: "Rahul Raj", class: "3", pickupPoint: "Main Market", parentPhone: "9876123450", vanId: "VAN-01", status: "waiting" },
  { id: "s4", name: "Priya Sharma", class: "6", pickupPoint: "Gandhi Chowk", parentPhone: "9012345678", vanId: "VAN-02", status: "onboard" },
  { id: "s5", name: "Vikram Patel", class: "4", pickupPoint: "Bus Stand", parentPhone: "9234567890", vanId: "VAN-02", status: "waiting" },
];

export const drivers: Driver[] = [
  { id: "d1", name: "Rakesh Kumar", phone: "9876543210", licenseNo: "BR01-2022-8899", vanId: "VAN-01" },
  { id: "d2", name: "Suresh Yadav", phone: "9876543211", licenseNo: "BR01-2021-7788", vanId: "VAN-02" },
];

export const vans: Van[] = [
  { id: "VAN-01", vehicleNumber: "BR27PA4589", routeName: "Tilak Nagar Route", capacity: 18, driverId: "d1", status: "active" },
  { id: "VAN-02", vehicleNumber: "BR27PB1234", routeName: "Gandhi Chowk Route", capacity: 15, driverId: "d2", status: "active" },
];

export const routePoints: RoutePoint[] = [
  { name: "Gyanoday Vidyalay", lat: 24.88, lng: 85.53, order: 0, type: "school" },
  { name: "Tilak Nagar Chowk", lat: 24.876, lng: 85.525, order: 1, type: "pickup" },
  { name: "Station Road", lat: 24.872, lng: 85.52, order: 2, type: "pickup" },
  { name: "Main Market", lat: 24.868, lng: 85.515, order: 3, type: "pickup" },
];

export const activeTripData: TripData = {
  vanId: "VAN-01",
  status: "active",
  startTime: new Date(Date.now() - 15 * 60000).toISOString(),
  currentLat: 24.874,
  currentLng: 85.522,
  speed: 28,
  heading: 180,
};

export function getDriverForVan(vanId: string): Driver | undefined {
  const van = vans.find(v => v.id === vanId);
  return drivers.find(d => d.id === van?.driverId);
}

export function getStudentsForVan(vanId: string): Student[] {
  return students.filter(s => s.vanId === vanId);
}
