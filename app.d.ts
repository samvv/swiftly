import { BehaviorSubject } from "rxjs";

export type RunAppOptions<U> = {
  rootElement?: string | HTMLElement;
  userSubject: BehaviorSubject<U | null>;
};

export type Application = {
  run<U>(opts: RunAppOptions<U>): void;
};

declare const app: Application;

export default app;

