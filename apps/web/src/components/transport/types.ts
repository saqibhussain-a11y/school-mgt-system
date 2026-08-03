export interface Vehicle {
  id: string;
  registrationNo: string;
  capacity: number;
  driverName: string;
  driverPhone: string;
}

export interface Route {
  id: string;
  name: string;
  vehicleId: string;
  vehicle: { id: string; registrationNo: string; capacity: number; driverName: string; driverPhone: string };
  _count: { studentRoutes: number };
}

export interface StudentRoute {
  id: string;
  studentId: string;
  routeId: string;
  pickupStop: string | null;
  student: { id: string; admissionNo: string; user: { firstName: string; lastName: string } };
  route: {
    id: string;
    name: string;
    vehicle: { registrationNo: string; driverName: string; driverPhone: string };
  };
}
