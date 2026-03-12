export interface CrossSectionRecord {
  z: number;
  a: number;
  reactions: {
    [mode: string]: [number, number]; // [maxwell, high]
  };
}
