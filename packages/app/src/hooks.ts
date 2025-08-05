import { useCallback, useEffect, useState } from "react";
import { BehaviorSubject, Subject } from "rxjs";

export function useForceUpdate(): VoidFunction {
  const [, setValue] = useState<Record<string, never>>(() => ({}));
  return useCallback((): void => {
    setValue({});
  }, []);
}

export function useSubjectValue<T>(subject: BehaviorSubject<T>): T {
  const forceUpdate = useForceUpdate();
  useEffect(() => {
    const subscription = subject.subscribe(forceUpdate);
    return () => { subscription.unsubscribe(); }
  }, [ subject ]);
  return subject.value;
}

export function useSubjectValue2<T, U>(subject: Subject<T>, init: U): T | U {
  const [state, setState] = useState<T | U>(init);
  useEffect(() => {
    const sub = subject.subscribe(value => setState(value));
    return () => { sub.unsubscribe() };
  }, [ subject ]);
  return state
}

export function useSubjectState<T>(subject: BehaviorSubject<T>): [T, (value: T) => void] {
  return [
    useSubjectValue(subject),
    subject.next.bind(subject),
  ]
}

export type UsePromiseResult<T> = UsePromiseSuccess<T> | UsePromisePending | UsePromiseError;

type UsePromisePending = {
  isSuccess: false;
  isError: false;
  isPending: true;
};

type UsePromiseSuccess<T> = {
  isSuccess: true;
  isError: false;
  isPending: false;
  data: T;
};

type UsePromiseError = {
  isSuccess: false;
  isError: true;
  isPending: false;
};

export function usePromise<T>(callback: () => Promise<T>, deps: any[]): T | undefined {
  const [state, setState] = useState<T | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await callback();
      if (!cancelled) {
        setState(result);
      }
    })();
    return () => { cancelled = true; };
  }, deps);
  return state;
}
