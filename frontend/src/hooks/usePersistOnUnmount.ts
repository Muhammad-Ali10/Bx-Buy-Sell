import { useEffect, useRef } from "react";

/**
 * Flush a wizard step's current input back to the parent when the step unmounts —
 * e.g. the user switches steps via the left sidebar instead of clicking Continue.
 * `buildData` must return the same shape the step passes to its `onNext`, so the
 * parent merges it into the shared form data and the input is restored on return.
 */
export function usePersistOnUnmount(
  onPersist: ((data: any) => void) | undefined,
  buildData: () => any,
) {
  const buildRef = useRef(buildData);
  buildRef.current = buildData;

  useEffect(() => {
    return () => {
      try {
        onPersist?.(buildRef.current());
      } catch {
        /* ignore flush errors */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
