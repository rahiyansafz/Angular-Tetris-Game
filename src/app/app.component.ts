import { Component, HostListener } from '@angular/core';
import { GridManagerService } from './grid-manager.service';

export enum KEY_CODE {
  RIGHT_ARROW = 39,
  LEFT_ARROW = 37,
  UP_ARROW = 38,
  DOWN_ARROW = 40
}

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.css' ]
})
export class AppComponent  {

  constructor(
    public gridManagerService: GridManagerService
  ) {
    this.gridManagerService.startTheGame();
  }

  @HostListener('window:keydown', ['$event'])
  public keyEvent(event: KeyboardEvent) {
    if (event.keyCode === KEY_CODE.UP_ARROW) {
      this.gridManagerService.rotatePiece();
    }
    if (event.keyCode === KEY_CODE.DOWN_ARROW) {
      this.gridManagerService.movePieceDown();
    }
    if (event.keyCode === KEY_CODE.LEFT_ARROW) {
      this.gridManagerService.movePieceLeft();
    }
    if (event.keyCode === KEY_CODE.RIGHT_ARROW) {
      this.gridManagerService.movePieceRight();
    }
  }

}
