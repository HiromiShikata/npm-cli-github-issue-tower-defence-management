export type ConsoleProjectSettingsModalScreenProps = {
	pjcodes: string[];
	inputValues: Record<string, string>;
	onChangeInput: (pjcode: string, value: string) => void;
	isLoading: boolean;
	isSaving: boolean;
	error: string | null;
	onSave: () => void;
	onClose: () => void;
};

export const ConsoleProjectSettingsModalScreen = ({
	pjcodes,
	inputValues,
	onChangeInput,
	isLoading,
	isSaving,
	error,
	onSave,
	onClose,
}: ConsoleProjectSettingsModalScreenProps) => {
	const isSaveDisabled =
		isSaving ||
		pjcodes.every((pjcode) => {
			const v = inputValues[pjcode] ?? "";
			const parsed = parseInt(v, 10);
			return v === "" || Number.isNaN(parsed) || parsed < 1;
		});

	return (
		<div
			className="console-settings-modal"
			role="dialog"
			aria-modal="true"
			aria-label="Max settings"
		>
			<div className="console-settings-modal-bar">
				<span className="console-settings-modal-title">Max settings</span>
				<button
					type="button"
					className="console-settings-modal-close"
					aria-label="Close max settings"
					onClick={onClose}
				>
					✕
				</button>
			</div>
			<div className="console-settings-modal-body">
				{isLoading ? (
					<p className="console-settings-modal-loading">Loading…</p>
				) : (
					<ul className="console-settings-modal-project-list">
						{pjcodes.map((pjcode) => (
							<li key={pjcode} className="console-settings-modal-project-row">
								<label
									htmlFor={`max-preparing-count-${pjcode}`}
									className="console-settings-modal-label"
								>
									{pjcode}
								</label>
								<input
									id={`max-preparing-count-${pjcode}`}
									type="number"
									min={1}
									step={1}
									className="console-settings-modal-input"
									value={inputValues[pjcode] ?? ""}
									onChange={(e) => onChangeInput(pjcode, e.target.value)}
									disabled={isSaving}
									aria-label={`Maximum preparing issues count for ${pjcode}`}
								/>
							</li>
						))}
					</ul>
				)}
				{error !== null && (
					<p className="console-settings-modal-error" role="alert">
						{error}
					</p>
				)}
				{!isLoading && (
					<div className="console-settings-modal-actions">
						<button
							type="button"
							className="console-settings-modal-save"
							onClick={onSave}
							disabled={isSaveDisabled}
							aria-label="Save max settings"
						>
							{isSaving ? "Saving…" : "Save"}
						</button>
					</div>
				)}
			</div>
		</div>
	);
};
