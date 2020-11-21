import { Injectable, OnDestroy } from '@angular/core';
import { StateManagerFactory, StateManager } from './state-manager/state-manager.service';
import { Observable, of, pipe, interval, Subscription } from 'rxjs';
import { mergeAll, zip, concatAll, switchMap, reduce, tap, take, withLatestFrom, takeUntil, filter, pluck, groupBy } from 'rxjs/operators';
import { Cell } from './models/cell';
import { Grid, Piece, PieceType, Pieces, Rotation } from './models/types';


@Injectable()
export class GridManagerService implements OnDestroy {

  /** Private Members */
  private bigGridRows: number               = 20;
  private bigGridColumns: number            = 11;
  private smallGridRows: number             = 4;
  private smallGridColumns: number          = 3;
  private colors: string[]                  = ['#F7A04A', '#AD6A6C', '#FFC9C9', '#CCADC5', '#4F517D'];
  private gridColor: string                 = 'white';
  private gameOverColor: string             = 'gray' ;
  private previewGridColor: string          = 'transparent';
  private bigGrid: StateManager<Grid>       = this.stateManagerFactory.create<Grid>(null);
  private smallGrid: StateManager<Grid>     = this.stateManagerFactory.create<Grid>(null);
  private pieces: StateManager<Pieces>      = this.stateManagerFactory.create<Pieces>([]);
  private nextPiece: StateManager<Pieces>   = this.stateManagerFactory.create<Pieces>(null);
  private gameOver: StateManager<boolean>   = this.stateManagerFactory.create<boolean>(false);
  private score: StateManager<number>       = this.stateManagerFactory.create<number>(0);
  private speed: StateManager<number>       = this.stateManagerFactory.create<number>(0);
  private subscriptions: Subscription[]     = [];
  
  /** Public Members */
  public grid$: Observable<Grid>            = this.bigGrid.state$;
  public score$: Observable<number>         = this.score.state$;
  public preview$: Observable<Grid>         = this.smallGrid.state$;
  public gameOver$: Observable<boolean>     = this.gameOver.state$;

  
  constructor(private stateManagerFactory: StateManagerFactory) { }


  /**************************************************** 
   * Public Methods
   ****************************************************/

  /** Start the game */
  public startTheGame(): void {
    // make sure we're clearing everything and setting up correctly
    this.resetGame();

    // update the grid with the Pieces  
    this.addSubscription = this.pieces.state$
      .pipe(
        withLatestFrom(this.gameOver.state$, (pieces, gameOver) => ({ pieces, gameOver })),
        filter(({gameOver}) => !gameOver),
        pluck('pieces'),
        this.applyPiecesToGridUsingQueue(),
        tap(() => this.bigGrid.processQueue()),        
        this.checkIfGameOver()
      )
      .subscribe();

    // move the piece
    this.addSubscription = this.speed.state$
      .pipe(
        switchMap((speed: number) => interval(speed)),
        withLatestFrom(this.gameOver.state$),
        filter<[number, boolean]>(([ ,gameOver]) => !gameOver),
        tap(() => this.movePieceDown())
      )
      .subscribe();

    // subscribe to next piece changes
    this.addSubscription = this.nextPiece.state$
      .pipe(
        switchMap(([piece]: Pieces) => of([piece.map((cell: Cell) => {
          const { top, left } = this.offsetsForPreviewPieces(cell.pieceType);
          return { ...cell, rowId: cell.rowId + top, colId: cell.colId + left };
        })])),
        this.applyPiecesToPreviewUsingQueue(),
        tap(() => this.smallGrid.processQueue()), 
      )
      .subscribe();

    // subscribe to the score to update the speed as they go up in score
    this.addSubscription = this.score.state$
      .pipe(
        this.increaseSpeed()
      )
      .subscribe();
  }

  /** Rotate the 'active' piece */
  public rotatePiece(): void {
    this.pieces.state$
      .pipe(
        take(1),
        switchMap((currentPieces: Pieces) => {
          const {
            activePiece,
            updatedPiece,
            willHitBottom,
            willHitLeftSide,
            willHitRightSide,
            allCellsFromPieces,
            willHitAnotherPiece
          } = this.generatePieceAwareness(
            currentPieces,
            (pieces) => this.rotateTranslator(pieces[0])
          );
          
          if (!willHitLeftSide && !willHitAnotherPiece && !willHitRightSide && !willHitBottom) {
            // update the position of the 'active' piece
            this.pieces.addToQueue((pieces: Pieces) => {
              const newPieces = [...pieces];
              newPieces[0] = updatedPiece;
              return newPieces;
            });
          } else
          if (willHitLeftSide || willHitAnotherPiece || willHitRightSide || willHitBottom) {
          } else {
            this.checkIfRowComplete();
            // we hit the bottom or another piece, put a new 'active' piece into the pieces collection
            this.switchToNextPiece();
          }
          return of(currentPieces);
        }),
        this.applyPiecesToGridUsingQueue({color: this.gridColor, occupied: false}), // TODO: possibly move this else where so it handles this in a pipe as part of an update
        tap(() => this.pieces.processQueue()),
      )
      .subscribe();
  }

  /** Move the active piece to the Left */
  public movePieceLeft(): void {
    this.pieces.state$
      .pipe(
        take(1),
        switchMap((currentPieces: Pieces) => {
          const {
            activePiece,
            updatedPiece,
            willHitBottom,
            willHitLeftSide,
            allCellsFromPieces,
            willHitAnotherPiece
          } = this.generatePieceAwareness(
            currentPieces,
            (pieces) => pieces[0].map(cell => ({ ...cell, colId: cell.colId - 1 }))
          );
          
          if (!willHitLeftSide && !willHitAnotherPiece) {
            // update the position of the 'active' piece
            this.pieces.addToQueue((pieces: Pieces) => {
              const newPieces = [...pieces];
              newPieces[0] = updatedPiece;
              return newPieces;
            });
          } else 
          if (willHitLeftSide && !willHitAnotherPiece) {
          } else 
          if (!willHitLeftSide && willHitAnotherPiece) {
          } else {
            this.checkIfRowComplete()
            // we hit the bottom or another piece, put a new 'active' piece into the pieces collection
            this.switchToNextPiece();
          }
          return of(currentPieces);
        }),
        this.applyPiecesToGridUsingQueue({color: this.gridColor, occupied: false}), // TODO: possibly move this else where so it handles this in a pipe as part of an update
        tap(() => this.pieces.processQueue()),
      )
      .subscribe();
  }
  
  /** Move the active Piece to the right  */
  public movePieceRight(): void {
    this.pieces.state$
      .pipe(
        take(1),
        switchMap((currentPieces: Pieces) => {
          const {
            activePiece,
            updatedPiece,
            willHitBottom,
            willHitRightSide,
            allCellsFromPieces,
            willHitAnotherPiece
          } = this.generatePieceAwareness(
            currentPieces,
            (pieces) => pieces[0].map(cell => ({ ...cell, colId: cell.colId + 1 }))
          );
          
          if (!willHitRightSide && !willHitAnotherPiece) {
            // update the position of the 'active' piece
            this.pieces.addToQueue((pieces: Pieces) => {
              const newPieces = [...pieces];
              newPieces[0] = updatedPiece;
              return newPieces;
            });
          } else 
          if (willHitRightSide && !willHitAnotherPiece) {
          } else 
          if (!willHitRightSide && willHitAnotherPiece) {
          } else {
            this.checkIfRowComplete()
            // we hit the bottom or another piece, put a new 'active' piece into the pieces collection
            this.switchToNextPiece();
          }

          return of(currentPieces);
        }),
        tap(() => this.checkIfRowComplete()),
        this.applyPiecesToGridUsingQueue({color: this.gridColor, occupied: false}), // TODO: possibly move this else where so it handles this in a pipe as part of an update
        tap(() => this.pieces.processQueue()),
      )
      .subscribe();
  }

  /** Move the active Piece down the board */
  public movePieceDown(): void {
    this.pieces.state$
      .pipe(
        take(1),
        switchMap((currentPieces: Pieces) => {
          const {
            activePiece,
            updatedPiece,
            willHitBottom,
            allCellsFromPieces,
            willHitAnotherPiece
          } = this.generatePieceAwareness(
            currentPieces,
            (pieces) => pieces[0].map(cell => ({ ...cell, rowId: cell.rowId + 1 }))
          );
          
          if (!willHitBottom && !willHitAnotherPiece) {
            // update the position of the 'active' piece
            this.pieces.addToQueue((pieces: Pieces) => {
              const newPieces = [...pieces];
              newPieces[0] = updatedPiece;
              return newPieces;
            });
          } else {
            this.checkIfRowComplete();
            // we hit the bottom or another piece, put a new 'active' piece into the pieces collection
            this.switchToNextPiece();
          }

          return of(currentPieces);
        }),
        this.applyPiecesToGridUsingQueue({color: this.gridColor, occupied: false}), // TODO: possibly move this else where so it handles this in a pipe as part of an update
        tap(() => this.pieces.processQueue()),
      )
      .subscribe();
  }

  /** Reset the game */
  public resetGame(): void {
    this.bigGrid.update(() => this.initGrid(this.gridColor));
    this.smallGrid.update(() => this.initSmallGrid(this.previewGridColor));
    this.nextPiece.update(() => [this.generatePiece(this.randomPieceType())]);
    this.pieces.update(() => [this.generatePiece(this.randomPieceType())])
    this.score.update(() => 0);
    this.gameOver.update(() => false);
  }

  /** On Destory: clean up the subscriptions */
  public ngOnDestroy(): void {
    this.cleanUpSubscriptions();
  }


  /**************************************************** 
   * Private Methods
   ****************************************************/

  /** Update the score */
  private updateScore(cellCount: number, multiplyer: number = 1) {
    this.score.update((score: number) => score += ((cellCount * 100) * multiplyer));
  }

  /** Return a random Piece */
  private randomPieceType(): PieceType {
    const sizes: PieceType[] = [
      'uppercase-T',
      'uppercase-I',
      'square',
      'uppercase-L',
      'Z',
      'uppercase-T',
      'square',
      'uppercase-L',
      'Z',
      'uppercase-T',
      'uppercase-L',
      'uppercase-T',
      'uppercase-I',
      'square',
      'uppercase-L',
      'Z',
      'uppercase-T',
      'uppercase-L',
      'Z',
      'uppercase-T',
      'uppercase-L'
    ];
    return sizes[ Math.floor( Math.random() * sizes.length ) ];
  }

  public offsetsForPreviewPieces(type: PieceType): { top: number, left: number} {
    switch (type) {
      case 'uppercase-L':
        return { top: 0, left: -5 };
      case 'uppercase-I':
        return { top: 0, left: -5 };
      case 'square':
        return { top: 0, left: -5 };
      case 'uppercase-T':
        return { top: 0, left: -4 };
      case 'Z':
        return { top: 0, left: -5 };
    }
  }

  /** Check if the game should be over */
  private checkIfGameOver() {
    return pipe(
      tap((currentPieces: Pieces) => {
        const {
            updatedPiece: currentPiece,
            willHitAnotherPiece
          } = this.generatePieceAwareness(
            currentPieces,
            (pieces) => pieces[0]
          );
        const topCell: Cell = this.findTopCell(currentPiece);
        if (topCell.rowId === 1 && willHitAnotherPiece) {
          this.gameOver.update(() => true);
          this.renderGameOver();
        }
      })
    );
  }

  /** Check if any rows are complete, so we can remove them and add points */
  private checkIfRowComplete() { // here, make this stand alone like movePieceDown
    this.pieces.state$
      .pipe(
        take(1),
        tap((currentPieces: Pieces) => {
          // flatten all the Cells into a single array
          const allCells = currentPieces.reduce((allCells: Cell[], piece: Piece) => [...allCells, ...piece], []);

          // create an Object that holds counts by rowId so we can tell when a row has been completed
          const cellCountsByRow: { [key: string]: any, rowIdsFlaggedForRemoval: number[] } = allCells
            .reduce((tracker, cell: Cell) => {
              tracker[cell.rowId] ? tracker[cell.rowId] += 1 : tracker[cell.rowId] = 1;
              if (tracker[cell.rowId] === this.bigGridColumns) {
                tracker.rowIdsFlaggedForRemoval.push(cell.rowId);
              }
              return tracker;
            }, { rowIdsFlaggedForRemoval: []});

          // remove the Cells in that rows that qualify, and return a new updated copy of all the pieces
          const updatedPieces = currentPieces
            .map(piece => {
              let updatedPiece = piece
                .reduce((cells, cell) => {
                  const removeThisRow = cellCountsByRow.rowIdsFlaggedForRemoval.includes(cell.rowId);
                  return removeThisRow ? cells : [...cells, cell]; 
                }, []);
              return updatedPiece;
            })
            .map(piece => {
              let updatedPiece = [...piece].map(cell => ({...cell}));
              cellCountsByRow.rowIdsFlaggedForRemoval
                .forEach(rowId => {
                  updatedPiece = updatedPiece.map((cell: Cell) => cell.rowId < rowId ? {...cell, rowId: cell.rowId + 1} : cell);
                });
              return updatedPiece;
            });

          // update the current set of cells
          if (cellCountsByRow.rowIdsFlaggedForRemoval.length > 0) {
            this.updateScore(
              cellCountsByRow.rowIdsFlaggedForRemoval.length * this.bigGridColumns,
              cellCountsByRow.rowIdsFlaggedForRemoval.length
            );
            this.pieces.addToQueue(() => updatedPieces);
          }
        }),
        this.applyPiecesToGridUsingQueue({color: this.gridColor, occupied: false}),
        tap(() => this.pieces.processQueue()),
      )
      .subscribe();
  }

  /** Init the Grid as Nested Maps */
  private initGrid(color: string) {
    const grid: Grid = new Map();
    for (let rowIdx = 1; rowIdx <= this.bigGridRows; rowIdx++) {
      const column: Map<number, Cell> = new Map();
      for (let colIdx = 1; colIdx <= this.bigGridColumns; colIdx++) {
        column.set(colIdx, Cell.create({rowId: rowIdx, colId: colIdx, color}));
      }
      grid.set(rowIdx, column);
    }
    return grid;
  }

  /** Init the preview grid */
  private initSmallGrid(color: string) {
    const grid: Grid = new Map();
    for (let rowIdx = 1; rowIdx <= this.smallGridRows; rowIdx++) {
      const column: Map<number, Cell> = new Map();
      for (let colIdx = 1; colIdx <= this.smallGridColumns; colIdx++) {
        column.set(colIdx, Cell.create({rowId: rowIdx, colId: colIdx, color}));
      }
      grid.set(rowIdx, column);
    }
    return grid;
  }

  /** Generate the Piece (Factory) */
  private generatePiece(type: PieceType) {
    const randomColor = this.colors[ Math.floor( Math.random() * this.colors.length ) ];
    switch (type) {
      case 'uppercase-L':
        return [
          Cell.create({rowId: 1, colId: 6, color: randomColor, pieceType: 'uppercase-L', occupied: true}),
          Cell.create({rowId: 1, colId: 7, color: randomColor, pieceType: 'uppercase-L', occupied: true}),
          Cell.create({rowId: 2, colId: 6, color: randomColor, pieceType: 'uppercase-L', occupied: true}),
          Cell.create({rowId: 3, colId: 6, color: randomColor, pieceType: 'uppercase-L', occupied: true})
        ];
      case 'uppercase-I':
        return [
          Cell.create({rowId: 1, colId: 6, color: randomColor, pieceType: 'uppercase-I', occupied: true}),
          Cell.create({rowId: 2, colId: 6, color: randomColor, pieceType: 'uppercase-I', occupied: true}),
          Cell.create({rowId: 3, colId: 6, color: randomColor, pieceType: 'uppercase-I', occupied: true}),
          Cell.create({rowId: 4, colId: 6, color: randomColor, pieceType: 'uppercase-I', occupied: true})
        ];
      case 'square':
        return [
          Cell.create({rowId: 1, colId: 5, color: randomColor, pieceType: 'square', occupied: true}),
          Cell.create({rowId: 1, colId: 6, color: randomColor, pieceType: 'square', occupied: true}),
          Cell.create({rowId: 2, colId: 5, color: randomColor, pieceType: 'square', occupied: true}),
          Cell.create({rowId: 2, colId: 6, color: randomColor, pieceType: 'square', occupied: true})
        ];
      case 'uppercase-T':
        return [
          Cell.create({rowId: 1, colId: 6, color: randomColor, pieceType: 'uppercase-T', occupied: true}),
          Cell.create({rowId: 2, colId: 5, color: randomColor, pieceType: 'uppercase-T', occupied: true}),
          Cell.create({rowId: 2, colId: 6, color: randomColor, pieceType: 'uppercase-T', occupied: true}),
          Cell.create({rowId: 2, colId: 7, color: randomColor, pieceType: 'uppercase-T', occupied: true})
        ];
      case 'Z':
        return [
          Cell.create({rowId: 1, colId: 6, color: randomColor, pieceType: 'Z', occupied: true}),
          Cell.create({rowId: 1, colId: 7, color: randomColor, pieceType: 'Z', occupied: true}),
          Cell.create({rowId: 2, colId: 7, color: randomColor, pieceType: 'Z', occupied: true}),
          Cell.create({rowId: 2, colId: 8, color: randomColor, pieceType: 'Z', occupied: true})
        ];
    }
  }

  /** Util to rotate the active piece */
  private rotateTranslator(piece: Piece) {
    const color: string = piece[0].color;
    const topCell: Cell = this.findTopCell(piece);
    const nextRotation = topCell.rotation + 90 !== 360 ? topCell.rotation + 90 : 0;
    const translator = new Map();

    translator.set('uppercase-L', new Map());
    translator.get('uppercase-L').set(0, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'uppercase-L', occupied: true, rotation: 0}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 1, color, pieceType: 'uppercase-L', occupied: true, rotation: 0}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId, color, pieceType: 'uppercase-L', occupied: true, rotation: 0}),
      Cell.create({rowId: topCell.rowId + 2, colId: topCell.colId, color, pieceType: 'uppercase-L', occupied: true, rotation: 0}),
    ]);
    translator.get('uppercase-L').set(90, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'uppercase-L', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId, color, pieceType: 'uppercase-L', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 1, color, pieceType: 'uppercase-L', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 2, color, pieceType: 'uppercase-L', occupied: true, rotation: 90}),
    ]);
    translator.get('uppercase-L').set(180, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 1, color, pieceType: 'uppercase-L', occupied: true, rotation: 180}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 1, color, pieceType: 'uppercase-L', occupied: true, rotation: 180}),
      Cell.create({rowId: topCell.rowId + 2, colId: topCell.colId + 1, color, pieceType: 'uppercase-L', occupied: true, rotation: 180}),
      Cell.create({rowId: topCell.rowId + 2, colId: topCell.colId, color, pieceType: 'uppercase-L', occupied: true, rotation: 180})
    ]);
    translator.get('uppercase-L').set(270, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'uppercase-L', occupied: true, rotation: 270}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 1, color, pieceType: 'uppercase-L', occupied: true, rotation: 270}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 2, color, pieceType: 'uppercase-L', occupied: true, rotation: 270}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 2, color, pieceType: 'uppercase-L', occupied: true, rotation: 270})
    ]);

    translator.set('uppercase-I', new Map());
    translator.get('uppercase-I').set(0, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'uppercase-I', occupied: true, rotation: 0}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId, color, pieceType: 'uppercase-I', occupied: true, rotation: 0}),
      Cell.create({rowId: topCell.rowId + 2, colId: topCell.colId, color, pieceType: 'uppercase-I', occupied: true, rotation: 0}),
      Cell.create({rowId: topCell.rowId + 3, colId: topCell.colId, color, pieceType: 'uppercase-I', occupied: true, rotation: 0}),
    ]);
    translator.get('uppercase-I').set(90, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'uppercase-I', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 1, color, pieceType: 'uppercase-I', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 2, color, pieceType: 'uppercase-I', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 3, color, pieceType: 'uppercase-I', occupied: true, rotation: 90}),
    ]);
    translator.get('uppercase-I').set(180, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'uppercase-I', occupied: true, rotation: 180}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId, color, pieceType: 'uppercase-I', occupied: true, rotation: 180}),
      Cell.create({rowId: topCell.rowId + 2, colId: topCell.colId, color, pieceType: 'uppercase-I', occupied: true, rotation: 180}),
      Cell.create({rowId: topCell.rowId + 3, colId: topCell.colId, color, pieceType: 'uppercase-I', occupied: true, rotation: 180}),
    ]);
    translator.get('uppercase-I').set(270, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'uppercase-I', occupied: true, rotation: 270}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 1, color, pieceType: 'uppercase-I', occupied: true, rotation: 270}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 2, color, pieceType: 'uppercase-I', occupied: true, rotation: 270}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 3, color, pieceType: 'uppercase-I', occupied: true, rotation: 270}),
    ]);

    translator.set('square', new Map());
    translator.get('square').set(0, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'square', occupied: true, rotation: 0}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 1, color, pieceType: 'square', occupied: true, rotation: 0}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId, color, pieceType: 'square', occupied: true, rotation: 0}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 1, color, pieceType: 'square', occupied: true, rotation: 0}),
    ]);
    translator.get('square').set(90, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'square', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 1, color, pieceType: 'square', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId, color, pieceType: 'square', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 1, color, pieceType: 'square', occupied: true, rotation: 90}),
    ]);
    translator.get('square').set(180, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'square', occupied: true, rotation: 180}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 1, color, pieceType: 'square', occupied: true, rotation: 180}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId, color, pieceType: 'square', occupied: true, rotation: 180}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 1, color, pieceType: 'square', occupied: true, rotation: 180}),
    ]);
    translator.get('square').set(270, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'square', occupied: true, rotation: 270}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 1, color, pieceType: 'square', occupied: true, rotation: 270}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId, color, pieceType: 'square', occupied: true, rotation: 270}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 1, color, pieceType: 'square', occupied: true, rotation: 270}),
    ]);

    translator.set('uppercase-T', new Map());
    translator.get('uppercase-T').set(0, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'uppercase-T', occupied: true, rotation: 0}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId - 1, color, pieceType: 'uppercase-T', occupied: true, rotation: 0}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId, color, pieceType: 'uppercase-T', occupied: true, rotation: 0}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 1, color, pieceType: 'uppercase-T', occupied: true, rotation: 0})
    ]);
    translator.get('uppercase-T').set(90, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'uppercase-T', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId, color, pieceType: 'uppercase-T', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId + 2, colId: topCell.colId, color, pieceType: 'uppercase-T', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 1, color, pieceType: 'uppercase-T', occupied: true, rotation: 90}),
    ]);
    translator.get('uppercase-T').set(180, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'uppercase-T', occupied: true, rotation: 180}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 1, color, pieceType: 'uppercase-T', occupied: true, rotation: 180}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 2, color, pieceType: 'uppercase-T', occupied: true, rotation: 180}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 1, color, pieceType: 'uppercase-T', occupied: true, rotation: 180}),
    ]);
    translator.get('uppercase-T').set(270, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 2, color, pieceType: 'uppercase-T', occupied: true, rotation: 270}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 2, color, pieceType: 'uppercase-T', occupied: true, rotation: 270}),
      Cell.create({rowId: topCell.rowId + 2, colId: topCell.colId + 2, color, pieceType: 'uppercase-T', occupied: true, rotation: 270}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 1, color, pieceType: 'uppercase-T', occupied: true, rotation: 270}),
    ]);

    translator.set('Z', new Map());
    translator.get('Z').set(0, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId - 1, color, pieceType: 'Z', occupied: true, rotation: 0}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'Z', occupied: true, rotation: 0}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId, color, pieceType: 'Z', occupied: true, rotation: 0}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 1, color, pieceType: 'Z', occupied: true, rotation: 0}),
    ]);
    translator.get('Z').set(90, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 1, color, pieceType: 'Z', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId, color, pieceType: 'Z', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 1, color, pieceType: 'Z', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId + 2, colId: topCell.colId, color, pieceType: 'Z', occupied: true, rotation: 90}),
    ]);
    translator.get('Z').set(180, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId, color, pieceType: 'Z', occupied: true, rotation: 180}),
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 1, color, pieceType: 'Z', occupied: true, rotation: 180}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 1, color, pieceType: 'Z', occupied: true, rotation: 180}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 2, color, pieceType: 'Z', occupied: true, rotation: 180}),
    ]);
    translator.get('Z').set(270, [
      Cell.create({rowId: topCell.rowId, colId: topCell.colId + 1, color, pieceType: 'Z', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId, color, pieceType: 'Z', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId + 1, colId: topCell.colId + 1, color, pieceType: 'Z', occupied: true, rotation: 90}),
      Cell.create({rowId: topCell.rowId + 2, colId: topCell.colId, color, pieceType: 'Z', occupied: true, rotation: 90}),
    ]);

    return translator.get(piece[0].pieceType).get(nextRotation);
  }

  /** Update the grid from all the Pieces */
  private applyPiecesToGridUsingQueue( changes: {color?: string, occupied?: boolean, rotation?: Rotation} = {}) {
    return pipe(
      tap((pieces: Pieces) => {
        pieces
          .reduce((allCells: Cell[], piece: Piece) => [...allCells, ...piece], [])
          .forEach((cell: Cell) => this.bigGrid.addToQueue((grid: Grid) => {
            grid.get(cell.rowId).set(cell.colId, {...cell, ...changes});
            return grid;
          }));
      })
    );
  }

  /** Update the grid from all the Pieces */
  private applyPiecesToPreviewUsingQueue( changes: {color?: string, occupied?: boolean, rotation?: Rotation} = {}) {
    return pipe(
      tap((pieces: Pieces) => {
        pieces
          .reduce((allCells: Cell[], piece: Piece) => [...allCells, ...piece], [])
          .forEach((cell: Cell) => this.smallGrid.addToQueue((grid: Grid) => {
            grid.get(cell.rowId).set(cell.colId, {...cell, ...changes});
            return grid;
          }));
      })
    );
  }

  /** Generate a set of derrived values that help pieces navigate */
  private generatePieceAwareness(pieces: Pieces, updatedPieceFn: (pieces: Pieces) => Piece) {
    const activePiece: Piece = pieces[0],
          updatedPiece: Piece = updatedPieceFn(pieces),
          willHitBottom: boolean = updatedPiece.some((cell: Cell) => cell.rowId === this.bigGridRows + 1),
          willHitLeftSide: boolean = updatedPiece.some((cell: Cell) => cell.colId <= 0),
          willHitRightSide: boolean = updatedPiece.some((cell: Cell) => cell.colId > this.bigGridColumns),
          allCellsFromPieces: Cell[] = pieces.reduce((flatArr, piece, idx) => idx !== 0 ? [...flatArr, ...piece] : flatArr, []),
          willHitAnotherPiece: boolean = updatedPiece
            .some((cell: Cell) => allCellsFromPieces
            .some((testCell: Cell) => testCell.rowId === cell.rowId && testCell.colId === cell.colId));

    return { activePiece, updatedPiece, allCellsFromPieces, willHitAnotherPiece, willHitBottom, willHitLeftSide, willHitRightSide };
  }

  /** Find the top Cell in a piece */
  private findTopCell(piece: Piece): Cell {
    return piece.reduce((topCell: Cell, cell: Cell) => {
      if (topCell.rowId > cell.rowId) {
        topCell.rowId = cell.rowId;
      }
      if (topCell.colId > cell.colId) {
        topCell.colId = cell.colId;
      }
      return topCell;
    }, Cell.create({...piece[0]}));
  }

  /** Render the grid in a special way when the game is over */
  private renderGameOver(): void {
    this.bigGrid.update(() => this.initGrid(this.gameOverColor));
  }

  /** Grab the next piece, update the small grid, add a new next piece */
  private switchToNextPiece() {
    this.nextPiece.state$
      .pipe(
        take(1),
        tap((nextPiece: Pieces) => this.pieces.addToQueue((pieces: Pieces) => [...nextPiece, ...pieces])),
        tap(() => this.smallGrid.update(() => this.initSmallGrid(this.previewGridColor))),
        tap(() => this.nextPiece.update(() => [this.generatePiece(this.randomPieceType())]))
      )
      .subscribe();
  }

  /** Check the score and adjustthe speed to increase difficulty */
  private increaseSpeed() {
    return pipe(
      tap((score) => {
        if (score >= 30000) {
          this.speed.addToQueue(() => 150);
        }
        if (score < 15000) {
          this.speed.addToQueue(() => 250);
        }
        if (score < 10000) {
          this.speed.addToQueue(() => 500);
        }
        if (score < 7500) {
          this.speed.addToQueue(() => 750);
        }
        if (score < 5000) {
          this.speed.addToQueue(() => 1000);
        }
        this.speed.processQueue();
      })
    );
  }

  /** Add an RxJS Subscription */
  private set addSubscription(subscription: Subscription) {
    this.subscriptions.push(subscription);
  }

  /** Iterate over all the Subscriptions, and unsubscribe(clean up) from them */
  private cleanUpSubscriptions() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe())
  }

}
