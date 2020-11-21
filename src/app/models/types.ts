import { Cell } from './cell';

type Grid = Map<number, Map<number, Cell>>;
type Piece = Cell[];
type Pieces = Piece[];
type PieceType = 'uppercase-L' | 'uppercase-I' | 'square' | 'uppercase-T' | 'Z';
type Rotation = 0 | 90 | 180 | 270;

export { Grid, Piece, Pieces, PieceType, Rotation };