import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { StateMangerModule } from './state-manager/state-manager.module';
import { AppComponent } from './app.component';
import { GridManagerService } from './grid-manager.service';

@NgModule({
  imports:      [ BrowserModule, FormsModule, StateMangerModule ],
  declarations: [ AppComponent ],
  bootstrap:    [ AppComponent ],
  providers: [GridManagerService]
})
export class AppModule { }
