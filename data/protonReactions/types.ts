export interface ProtonCrossSectionRecord {
  z: number;
  a: number;
  reactions: {
    [reaction: string]: number[];
  };
}
