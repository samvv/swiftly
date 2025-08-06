import { type Task, useTasks } from "../state"
import reactLogo from '../assets/react.svg'
import viteLogo from '/vite.svg'
import './index.css'
import { Link } from "@swiftly/app";

type TaskProps = {
  value: Task;
  onUpdate: (task: Task) => void;
};

function TaskEdit({ value, onUpdate }: TaskProps) {
  return (
    <>
      <input
        type='text'
        value={value.title}
        onInput={e => {
          onUpdate({ ...value, title: e.currentTarget.value, updatedAt: new Date(), })
        }}
      />
    </>
  );
}

export default function TaskList() {
  const { tasks, updateTask } = useTasks();
  return (
    <>
      <Link to="/about">About Us</Link>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Todo Example App</h1>
      {tasks.map(task => <TaskEdit value={task} onUpdate={updateTask} />)}
      <Link to="/new">Add Task</Link>
    </>
  )
}
