import { useRef, useState, useEffect, type RefObject } from 'react';

import {
  type MRT_Cell,
  type MRT_RowData,
  type MRT_TableInstance
} from 'material-react-table';

interface EditProps<TData extends MRT_RowData> {
  cell: MRT_Cell<TData>;
  table: MRT_TableInstance<TData>;
}

function useIsFirstRender(): boolean {
  const isFirst = useRef(true);

  if (isFirst.current) {
    isFirst.current = false;

    return true;
  }

  return isFirst.current;
}

function useRendersCount(): number {
  const count = useRef(0);
  count.current = count.current + 1;
  return count.current;
}

function useDebounce(value: string, delay: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function useHandleClickOutside(
  ref: RefObject<HTMLElement | null>,
  cb: () => void,
  disabled: boolean,
  // CSS selector for portalled overlays (e.g. an autocomplete dropdown) that
  // render outside `ref` but should NOT count as an outside click — otherwise a
  // capture-phase click on a dropdown option fires this before the option's own
  // handler, committing/closing the field before the selection applies.
  ignoreSelector?: string
): void {
  useEffect(() => {
    if (disabled) return;
    /**
     * Alert if clicked on outside of element
     */
    function handleClickOutside(event: MouseEvent): void {
      const target = event.target as Element | null;
      if (ignoreSelector && target?.closest?.(ignoreSelector)) return;
      if (ref.current && !ref.current.contains(target as Node)) {
        if (cb) cb();
      }
    }
    // Bind the event listener
    document.addEventListener('click', handleClickOutside, true);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [ref, cb, disabled, ignoreSelector]);
}

export {
  useIsFirstRender,
  useRendersCount,
  useDebounce,
  useHandleClickOutside
};
