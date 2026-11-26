export interface IntakeSaved {
  intakeEditsFrozen?: boolean;
  id: number;
  workOrderNo: string;
  storeName: string;
  title: string;
  customerName: string;
  customerMobile: string;
  plateNumber: string;
  vehicleModel: string;
  missing: string[];
  financialEffect?: boolean;
  wagesAvailable?: boolean;
  pricingStatus?: string;
  details?: {
    revision: number;
    vin: string | null;
    odometerKm: number | null;
    requestedService: string | null;
    verificationStatus: 'pending';
  };
}
