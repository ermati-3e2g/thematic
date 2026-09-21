import { useEffect, useRef } from "react";

/**
 * Debounced, unmount-safe writer for editor drafts held in component state.
 *
 * The latest value is written once the user pauses, and again if the editor
 * unmounts mid-edit (for example when another panel is opened), so a
 * half-finished form is never dropped. Editors that are opened and closed
 * without changes write nothing.
 */
export function useDraftSaver<T>(value: T | undefined, delay: number, save: (value: T) => void) {
  const saveRef = useRef<(value: T) => void>(save);
  saveRef.current = save;
  const valueRef = useRef<T | undefined>(value);
  valueRef.current = value;
  const timer = useRef<number | undefined>(undefined);
  const signature = value === undefined ? undefined : JSON.stringify(value);
  const initialSignature = useRef<string | undefined>(signature);

  useEffect(() => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
    if (signature === undefined || signature === initialSignature.current) return;
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      if (valueRef.current !== undefined) saveRef.current(valueRef.current);
    }, delay);
  }, [delay, signature]);

  useEffect(
    () => () => {
      if (timer.current !== undefined) {
        window.clearTimeout(timer.current);
        timer.current = undefined;
      }
      const current = valueRef.current;
      if (current === undefined) return;
      if (JSON.stringify(current) === initialSignature.current) return;
      saveRef.current(current);
    },
    [],
  );
}