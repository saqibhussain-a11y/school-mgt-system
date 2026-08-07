export interface Room {
  id: string;
  name: string;
  type: "GENERAL" | "LAB";
  capacity: number | null;
}

export interface Period {
  id: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
}
