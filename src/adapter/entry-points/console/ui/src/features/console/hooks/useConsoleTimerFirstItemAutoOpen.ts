import { useEffect, useRef } from "react";
import type { ConsoleListItem } from "../logic/types";

export const useConsoleTimerFirstItemAutoOpen = (
	timerMode: boolean,
	pjcode: string | null,
	pendingItems: ConsoleListItem[],
	selectedItemKey: string | null,
	openItem: (key: string) => void,
): void => {
	const prevPjcodeRef = useRef<string | null | undefined>(undefined);
	const shouldAutoOpenRef = useRef(false);

	useEffect(() => {
		if (!timerMode) {
			prevPjcodeRef.current = pjcode;
			shouldAutoOpenRef.current = false;
			return;
		}

		if (prevPjcodeRef.current !== pjcode) {
			prevPjcodeRef.current = pjcode;
			shouldAutoOpenRef.current = pjcode !== null;
		}

		if (!shouldAutoOpenRef.current || selectedItemKey !== null) {
			return;
		}

		if (pendingItems.length === 0) {
			return;
		}

		shouldAutoOpenRef.current = false;
		openItem(pendingItems[0].projectItemId);
	}, [timerMode, pjcode, pendingItems, selectedItemKey, openItem]);
};
