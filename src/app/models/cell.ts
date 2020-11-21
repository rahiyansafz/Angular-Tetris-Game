import { Rotation, PieceType } from './types';

export class Cell {
  public rowId: number;
  public colId: number;
  public color: string;
  public occupied: boolean;
  public rotation: Rotation;
  public pieceType: PieceType;

  static create({
    rowId,
    colId,
    color,
    occupied = false,
    rotation = 0,
    pieceType = null
  }): Cell {
    return { rowId, colId, color, occupied, rotation, pieceType };
  }
}