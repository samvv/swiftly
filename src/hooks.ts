import { useCallback, useEffect, useRef, useState } from "react";
import { BehaviorSubject } from "rxjs";

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

export function useSubjectState<T>(subject: BehaviorSubject<T>): [T, (value: T) => void] {
  return [
    useSubjectValue(subject),
    subject.next.bind(subject),
  ]
}

const enum FetchState {
  Pending,
  Errored,
  Success,
}

export type UsePromiseResult<T> = {
  isSuccess: boolean;
  isError: boolean;
  isPending: boolean;
  data?: T;
};

export function usePromise<T>(callback: () => Promise<T>, deps: any[]): T | undefined {
  const forceUpdate = useForceUpdate();
  const result = useRef<T>(undefined);
  useEffect(() => {
    (async () => {
      result.current = await callback();
      forceUpdate()
    })();
  }, deps);
  return result.current
}
