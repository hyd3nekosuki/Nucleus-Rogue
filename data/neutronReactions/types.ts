export interface CrossSectionRecord {
  z: number;
  a: number;
  reactions: {
    [reaction: string]: number[];
  };
}
