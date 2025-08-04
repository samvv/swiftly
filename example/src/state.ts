import { useCallback, useEffect, useState } from "react";
import { BehaviorSubject } from "rxjs";

export interface Task {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const tasksSubject = new BehaviorSubject<Task[]>([]);

export function useTasks() {
  const [tasks, setTasks] = useSubjectState(tasksSubject);
  const updateTask = (newTask: Task) => {
    setTasks(tasks.map(t => t.id === newTask.id ? t : t));
  }
  const addTask = (task: Task) => {
    setTasks([...tasks, task]);
  }
  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  }
  return { tasks, addTask, updateTask, deleteTask };
}

function useForceUpdate(): VoidFunction {
  const [, setValue] = useState<Record<string, never>>(() => ({}));
  return useCallback((): void => {
    setValue({});
  }, []);
}

function useSubjectValue<T>(subject: BehaviorSubject<T>): T {
  const forceUpdate = useForceUpdate();
  useEffect(() => {
    const subscription = subject.subscribe(forceUpdate);
    return () => { subscription.unsubscribe(); }
  }, [ subject ]);
  return subject.value;
}

function useSubjectState<T>(subject: BehaviorSubject<T>): [T, (value: T) => void] {
  return [
    useSubjectValue(subject),
    subject.next.bind(subject),
  ]
}

