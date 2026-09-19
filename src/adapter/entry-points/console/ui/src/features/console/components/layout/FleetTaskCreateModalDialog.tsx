import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type FleetTaskCreateModalDialogProps = {
	onSubmit: (title: string) => Promise<void>;
	onClose: () => void;
};

export const FleetTaskCreateModalDialog = ({
	onSubmit,
	onClose,
}: FleetTaskCreateModalDialogProps) => {
	const [titleValue, setTitleValue] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const titleRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		titleRef.current?.focus();
	}, []);

	const handleSubmit = async (): Promise<void> => {
		const trimmedTitle = titleValue.trim();
		if (trimmedTitle.length === 0) {
			setSubmitError("Title is required.");
			return;
		}
		setSubmitting(true);
		setSubmitError(null);
		try {
			await onSubmit(trimmedTitle);
			onClose();
		} catch (err) {
			setSubmitError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	return createPortal(
		<div className="console-fleet-task-create-dialog-container">
			<button
				type="button"
				className="console-fleet-task-create-dialog-overlay"
				aria-label="Close dialog"
				disabled={submitting}
				onClick={onClose}
			/>
			<div
				className="console-fleet-task-create-dialog"
				role="dialog"
				aria-modal="true"
				aria-label="Create fleet task"
			>
				<div className="console-fleet-task-create-dialog-bar">
					<span className="console-fleet-task-create-dialog-title">
						Create fleet task
					</span>
					<button
						type="button"
						className="console-fleet-task-create-dialog-close"
						aria-label="Close"
						onClick={onClose}
						disabled={submitting}
					>
						✕
					</button>
				</div>
				<div className="console-fleet-task-create-dialog-body">
					<label
						className="console-fleet-task-create-dialog-label"
						htmlFor="fleet-task-title"
					>
						Title
					</label>
					<input
						ref={titleRef}
						id="fleet-task-title"
						type="text"
						className="console-fleet-task-create-dialog-input"
						aria-label="Title"
						value={titleValue}
						onChange={(e) => setTitleValue(e.target.value)}
						disabled={submitting}
					/>
					{submitError !== null && (
						<p role="alert" className="console-list-error">
							{submitError}
						</p>
					)}
					<div className="console-fleet-task-create-dialog-actions">
						<button
							type="button"
							className="console-fleet-task-create-dialog-cancel"
							disabled={submitting}
							onClick={onClose}
						>
							Cancel
						</button>
						<button
							type="button"
							className="console-fleet-task-create-dialog-submit"
							disabled={submitting}
							onClick={() => void handleSubmit()}
						>
							{submitting ? "Creating…" : "Create"}
						</button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
};
