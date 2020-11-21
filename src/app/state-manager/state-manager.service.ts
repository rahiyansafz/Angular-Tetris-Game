import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, of, Observable } from 'rxjs';
import { scan, withLatestFrom, switchMap, tap, take, mergeAll, debounceTime } from 'rxjs/operators';

export type Action<T> = (state: T) => T;

class Manager<T> {

  /** Private Members */
  private _state$: BehaviorSubject<T> = new BehaviorSubject<T>(null);
  private _updates$: Subject<Action<T> | Action<T>[]> = new Subject<Action<T> | Action<T>[]>();
  private _actionsQueue$: BehaviorSubject<Action<T>[]> = new BehaviorSubject<Action<T>[]>([]);

  /** Public Members */
  public state$: Observable<T> = this._state$ as Observable<T>;

  constructor(model?: T) {
    this._updates$
      .pipe(
        withLatestFrom(this._state$),
        switchMap(([action, model]: [Action<T>[], T]) =>
          of(action.reduce((inProgressModel, subAction) => subAction(inProgressModel), model))
        )
      )
      .subscribe(newModel => this._state$.next(newModel));

    // set the initial value
    this.update(() => model);
  }

  // do a one off update, pass it as an array to simplify the reducer above
  public update(action: Action<T>) {
    this._updates$.next([action]);
  }

  // process the queue and update the model observable after they've all run
  public processQueue() {
    this._actionsQueue$
      .pipe(
        take(1),
        tap(() => this._actionsQueue$.next([]))
      )
      .subscribe(val => this._updates$.next(val));
  }

  // add an action to the queue
  public addToQueue(action: Action<T>) {
    this._actionsQueue$.next([...this._actionsQueue$.value, action])
  }

}

// factory service to generate new instances of the state manager
@Injectable()
export class StateManagerFactory {

  public create<T>(initModel: T = null) {
    return new Manager<T>(initModel);
  }

}

// interface to support working with the state manager
export interface StateManager<T> {
  state$: Observable<T>;
  update: (action: Action<T>) => void;
  processQueue: () => void;
  addToQueue: (action: Action<T>) => void;
}
