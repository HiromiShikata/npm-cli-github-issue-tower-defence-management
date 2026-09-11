import { useCallback, useEffect, useRef, useState } from "react";
import {
	fetchProjectReadmeConfig,
	postProjectMaxPreparingUpdate,
} from "../lib/consoleApi";
import { SETTINGS_HASH } from "./useConsoleNavigation";

export type ConsoleProjectSettingsState = {
	isOpen: boolean;
	isLoading: boolean;
	isSaving: boolean;
	error: string | null;
	inputValues: Record<string, string>;
	open: () => void;
	close: () => void;
	changeInput: (pjcode: string, value: string) => void;
	save: () => Promise<void>;
};

const isSettingsHash = (): boolean =>
	typeof window !== "undefined" && window.location.hash === SETTINGS_HASH;

export const useConsoleProjectSettings = (
	pjcodes: string[],
): ConsoleProjectSettingsState => {
	const [isOpen, setIsOpen] = useState(isSettingsHash);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [inputValues, setInputValues] = useState<Record<string, string>>({});
	const prevHashRef = useRef<string>("");
	const pjcodesRef = useRef<string[]>(pjcodes);
	pjcodesRef.current = pjcodes;

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		let cancelled = false;
		setInputValues({});
		setIsLoading(true);
		setError(null);
		Promise.all(
			pjcodesRef.current.map((pjcode) =>
				fetchProjectReadmeConfig(pjcode).then((config) => ({
					pjcode,
					value:
						config.maximumPreparingIssuesCount !== null
							? String(config.maximumPreparingIssuesCount)
							: "",
				})),
			),
		)
			.then((results) => {
				if (!cancelled) {
					const values: Record<string, string> = {};
					for (const { pjcode, value } of results) {
						values[pjcode] = value;
					}
					setInputValues(values);
				}
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					setError(
						err instanceof Error ? err.message : "Failed to load settings",
					);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [isOpen]);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		const sync = (): void => {
			const nowSettings = window.location.hash === SETTINGS_HASH;
			if (!nowSettings) {
				setError(null);
			}
			setIsOpen(nowSettings);
		};
		window.addEventListener("popstate", sync);
		window.addEventListener("hashchange", sync);
		return () => {
			window.removeEventListener("popstate", sync);
			window.removeEventListener("hashchange", sync);
		};
	}, []);

	const open = useCallback(() => {
		if (typeof window !== "undefined") {
			prevHashRef.current = window.location.hash;
			window.history.pushState({}, "", SETTINGS_HASH);
		}
		setIsOpen(true);
	}, []);

	const close = useCallback(() => {
		if (typeof window !== "undefined") {
			const restoredHash = prevHashRef.current;
			const url = `${window.location.pathname}${window.location.search}${restoredHash}`;
			window.history.replaceState({}, "", url);
		}
		setIsOpen(false);
		setError(null);
	}, []);

	const changeInput = useCallback((pjcode: string, value: string) => {
		setInputValues((prev) => ({ ...prev, [pjcode]: value }));
	}, []);

	const save = useCallback(async () => {
		setIsSaving(true);
		setError(null);
		try {
			await Promise.all(
				Object.entries(inputValues)
					.filter(([, value]) => {
						const parsed = parseInt(value, 10);
						return !Number.isNaN(parsed) && parsed >= 1;
					})
					.map(([pjcode, value]) =>
						postProjectMaxPreparingUpdate({
							pjcode,
							maximumPreparingIssuesCount: parseInt(value, 10),
						}),
					),
			);
			if (typeof window !== "undefined") {
				const restoredHash = prevHashRef.current;
				const url = `${window.location.pathname}${window.location.search}${restoredHash}`;
				window.history.replaceState({}, "", url);
			}
			setIsOpen(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save settings");
		} finally {
			setIsSaving(false);
		}
	}, [inputValues]);

	useEffect(() => {
		if (!isOpen) return;
		const handleEscape = (e: KeyboardEvent): void => {
			if (e.key === "Escape") close();
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isOpen, close]);

	return {
		isOpen,
		isLoading,
		isSaving,
		error,
		inputValues,
		open,
		close,
		changeInput,
		save,
	};
};
