import { useState } from "react";
import { useTasks } from "../../src/state";
import { v4 as uuid4 } from "uuid";
import { useRedirect } from "@swiftly/app";

export default function NewTask() {
  const { addTask } = useTasks();
  const [title, setTitle] = useState('');
  const redirect = useRedirect();
  return (
    <form onSubmit={e => {
      e.preventDefault();
      const now = new Date();
      addTask({
          id: uuid4(),
          title,
          createdAt: now,
          updatedAt: now,
      });
      redirect('/');
    }}>
      <input type="text" name='title' value={title} onInput={e => setTitle(e.currentTarget.value)} />
      <button type="submit">Add Task</button>
    </form>
  );
}
