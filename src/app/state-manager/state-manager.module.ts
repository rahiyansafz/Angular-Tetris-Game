import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateManagerFactory } from './state-manager.service';

@NgModule({
  imports: [ CommonModule ],
  providers: [ StateManagerFactory ],
  declarations: []
})
export class StateMangerModule {}
