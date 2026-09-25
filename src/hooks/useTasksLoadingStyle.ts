import { useEffect, useState } from "react";
import {
  loadTasksLoadingStyle,
  TASKS_LOADING_STYLE_CHANGE_EVENT,
  type TasksLoadingStyle,
} from "../lib/appearance";

/** Tasks loading style picked in Settings > Chat: classic spinner or square trace. */
export function useTasksLoadingStyle(): TasksLoadingStyle {
  const [style, setStyle] = useState(loadTasksLoadingStyle);
  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<TasksLoadingStyle>).detail;
      setStyle(detail ?? loadTasksLoadingStyle());
    };
    window.addEventListener(TASKS_LOADING_STYLE_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener(TASKS_LOADING_STYLE_CHANGE_EVENT, onChange);
    };
  }, []);
  return style;
}
