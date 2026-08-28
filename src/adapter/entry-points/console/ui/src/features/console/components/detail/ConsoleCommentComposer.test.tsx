import { fireEvent, render, waitFor } from "@testing-library/react";
import type { ConsoleComment } from "../../logic/types";
import {
	appendAttachmentMarkdown,
	ConsoleCommentComposer,
	insertUploadPlaceholder,
	removePlaceholder,
	replacePlaceholderWithMarkdown,
} from "./ConsoleCommentComposer";

jest.mock("../../lib/mermaidLoader", () => ({
	renderMermaidToSvg: jest.fn(async () => "<svg></svg>"),
}));

const stubSubmit = async (body: string): Promise<ConsoleComment> => ({
	author: "HiromiShikata",
	body,
	createdAt: "2026-06-19T11:58:00.000Z",
});

describe("ConsoleCommentComposer", () => {
	it("shows the form when it starts open", () => {
		const { getByPlaceholderText } = render(
			<ConsoleCommentComposer initiallyOpen onSubmit={stubSubmit} />,
		);
		expect(getByPlaceholderText("Leave a comment…")).toBeInTheDocument();
	});

	it("initializes the textarea with initialDraft when provided", () => {
		const { getByPlaceholderText } = render(
			<ConsoleCommentComposer
				initiallyOpen
				initialDraft="Previously typed text"
				onSubmit={stubSubmit}
			/>,
		);
		expect(getByPlaceholderText("Leave a comment…")).toHaveValue(
			"Previously typed text",
		);
	});

	it("calls onDraftChange with every keystroke", () => {
		const onDraftChange = jest.fn();
		const { getByPlaceholderText } = render(
			<ConsoleCommentComposer
				initiallyOpen
				onSubmit={stubSubmit}
				onDraftChange={onDraftChange}
			/>,
		);
		fireEvent.change(getByPlaceholderText("Leave a comment…"), {
			target: { value: "hello" },
		});
		expect(onDraftChange).toHaveBeenCalledWith("hello");
	});

	it("calls onDraftChange with empty string after successful submission", async () => {
		const onDraftChange = jest.fn();
		const { getByPlaceholderText, getByText } = render(
			<ConsoleCommentComposer
				initiallyOpen
				onSubmit={stubSubmit}
				onDraftChange={onDraftChange}
			/>,
		);
		fireEvent.change(getByPlaceholderText("Leave a comment…"), {
			target: { value: "My comment" },
		});
		fireEvent.click(getByText("Comment"));
		await waitFor(() => {
			expect(getByPlaceholderText("Leave a comment…")).toHaveValue("");
		});
		expect(onDraftChange).toHaveBeenCalledWith("");
	});

	it("offers the opening control and hides the form when it starts closed", () => {
		const { queryByPlaceholderText, getByText } = render(
			<ConsoleCommentComposer initiallyOpen={false} onSubmit={stubSubmit} />,
		);
		expect(queryByPlaceholderText("Leave a comment…")).toBeNull();
		expect(getByText("💬 Add a comment")).toBeInTheDocument();
	});

	it("opens the form on the control and closes it again so the body regains the height", () => {
		const { getByText, getByPlaceholderText, queryByPlaceholderText } = render(
			<ConsoleCommentComposer initiallyOpen={false} onSubmit={stubSubmit} />,
		);
		fireEvent.click(getByText("💬 Add a comment"));
		expect(getByPlaceholderText("Leave a comment…")).toBeInTheDocument();
		fireEvent.click(getByText("✕ Close"));
		expect(queryByPlaceholderText("Leave a comment…")).toBeNull();
	});

	it("submits the comment, empties the draft and renders no comment of its own", async () => {
		const onSubmit = jest.fn(
			async (body: string): Promise<ConsoleComment> => ({
				author: "HiromiShikata",
				body,
				createdAt: "2026-06-19T11:58:00.000Z",
			}),
		);
		const { container, getByPlaceholderText, getByText, queryByText } = render(
			<ConsoleCommentComposer initiallyOpen onSubmit={onSubmit} />,
		);
		fireEvent.change(getByPlaceholderText("Leave a comment…"), {
			target: { value: "Looks good after the rebase." },
		});
		fireEvent.click(getByText("Comment"));
		await waitFor(() => {
			expect(getByPlaceholderText("Leave a comment…")).toHaveValue("");
		});
		expect(onSubmit).toHaveBeenCalledWith("Looks good after the rebase.");
		expect(queryByText("Looks good after the rebase.")).toBeNull();
		expect(container.querySelectorAll(".console-comment").length).toBe(0);
	});

	it("shows a failure message when the submission rejects", async () => {
		const { getByPlaceholderText, getByText, findByRole } = render(
			<ConsoleCommentComposer
				initiallyOpen
				onSubmit={async () => {
					throw new Error("HTTP 500");
				}}
			/>,
		);
		fireEvent.change(getByPlaceholderText("Leave a comment…"), {
			target: { value: "This should fail to post." },
		});
		fireEvent.click(getByText("Comment"));
		const alert = await findByRole("alert");
		expect(alert.textContent).toContain("HTTP 500");
	});

	it("does not render the attach control when no upload handler is given", () => {
		const { queryByText } = render(
			<ConsoleCommentComposer initiallyOpen onSubmit={stubSubmit} />,
		);
		expect(queryByText("📎 Attach files")).toBeNull();
	});

	it("inserts a placeholder when a file upload starts and replaces it on success", async () => {
		let resolveUpload!: (markdown: string) => void;
		const onUploadFile = jest.fn(
			() =>
				new Promise<string>((resolve) => {
					resolveUpload = resolve;
				}),
		);
		const { getByPlaceholderText, getByLabelText } = render(
			<ConsoleCommentComposer
				initiallyOpen
				onSubmit={stubSubmit}
				onUploadFile={onUploadFile}
			/>,
		);
		const textarea = getByPlaceholderText(
			"Leave a comment…",
		) as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: "See the screen:" } });
		const file = new File(["binary"], "shot.png", { type: "image/png" });
		fireEvent.change(getByLabelText("Attach files"), {
			target: { files: [file] },
		});
		await waitFor(() => {
			expect(textarea.value).toBe(
				"See the screen:\n\n\n\n![uploading shot.png]()\n",
			);
		});
		resolveUpload("![shot](https://github.com/user-attachments/assets/abc)");
		await waitFor(() => {
			expect(textarea.value).toBe(
				"See the screen:\n\n\n\n![shot](https://github.com/user-attachments/assets/abc)\n",
			);
		});
		expect(onUploadFile).toHaveBeenCalledWith(file);
	});

	it("removes the placeholder and the three empty lines when an upload fails", async () => {
		let rejectUpload!: (error: Error) => void;
		const onUploadFile = jest.fn(
			() =>
				new Promise<string>((_, reject) => {
					rejectUpload = reject;
				}),
		);
		const { getByPlaceholderText, getByLabelText, findByRole } = render(
			<ConsoleCommentComposer
				initiallyOpen
				onSubmit={stubSubmit}
				onUploadFile={onUploadFile}
			/>,
		);
		const textarea = getByPlaceholderText(
			"Leave a comment…",
		) as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: "See the screen:" } });
		const file = new File(["binary"], "shot.png", { type: "image/png" });
		fireEvent.change(getByLabelText("Attach files"), {
			target: { files: [file] },
		});
		await waitFor(() => {
			expect(textarea.value).toContain("![uploading shot.png]()");
		});
		rejectUpload(new Error("No GitHub web session is available"));
		await waitFor(() => {
			expect(textarea.value).toBe("See the screen:\n");
		});
		const alert = await findByRole("alert");
		expect(alert.textContent).toContain("No GitHub web session is available");
	});

	it("preserves text typed in the draft while an upload is in flight", async () => {
		let resolveUpload!: (markdown: string) => void;
		const onUploadFile = jest.fn(
			() =>
				new Promise<string>((resolve) => {
					resolveUpload = resolve;
				}),
		);
		const { getByPlaceholderText, getByLabelText } = render(
			<ConsoleCommentComposer
				initiallyOpen
				onSubmit={stubSubmit}
				onUploadFile={onUploadFile}
			/>,
		);
		const textarea = getByPlaceholderText(
			"Leave a comment…",
		) as HTMLTextAreaElement;
		const file = new File(["binary"], "shot.png", { type: "image/png" });
		fireEvent.change(getByLabelText("Attach files"), {
			target: { files: [file] },
		});
		await waitFor(() => {
			expect(textarea.value).toContain("![uploading shot.png]()");
		});
		fireEvent.change(textarea, {
			target: {
				value: "The fix works:\n\n\n\n![uploading shot.png]()\n",
			},
		});
		resolveUpload("![shot](https://github.com/user-attachments/assets/abc)");
		await waitFor(() => {
			expect(textarea.value).toBe(
				"The fix works:\n\n\n\n![shot](https://github.com/user-attachments/assets/abc)\n",
			);
		});
	});

	it("uploads a pasted file and reserves position with a placeholder", async () => {
		const onUploadFile = jest.fn(
			async () => "![pasted](https://github.com/user-attachments/assets/def)",
		);
		const { getByPlaceholderText } = render(
			<ConsoleCommentComposer
				initiallyOpen
				onSubmit={stubSubmit}
				onUploadFile={onUploadFile}
			/>,
		);
		const textarea = getByPlaceholderText(
			"Leave a comment…",
		) as HTMLTextAreaElement;
		const file = new File(["binary"], "pasted.png", { type: "image/png" });
		fireEvent.paste(textarea, { clipboardData: { files: [file] } });
		await waitFor(() => {
			expect(textarea.value).toBe(
				"\n\n\n![pasted](https://github.com/user-attachments/assets/def)\n",
			);
		});
		expect(onUploadFile).toHaveBeenCalledWith(file);
	});

	it("uploads a dropped file and reserves position with a placeholder", async () => {
		const onUploadFile = jest.fn(
			async () => "![dropped](https://github.com/user-attachments/assets/ghi)",
		);
		const { getByPlaceholderText } = render(
			<ConsoleCommentComposer
				initiallyOpen
				onSubmit={stubSubmit}
				onUploadFile={onUploadFile}
			/>,
		);
		const textarea = getByPlaceholderText(
			"Leave a comment…",
		) as HTMLTextAreaElement;
		const file = new File(["binary"], "dropped.png", { type: "image/png" });
		fireEvent.drop(textarea, { dataTransfer: { files: [file] } });
		await waitFor(() => {
			expect(textarea.value).toBe(
				"\n\n\n![dropped](https://github.com/user-attachments/assets/ghi)\n",
			);
		});
		expect(onUploadFile).toHaveBeenCalledWith(file);
	});

	it("removes the placeholder when text was typed into a reserved empty line and the upload fails", async () => {
		let rejectUpload!: (error: Error) => void;
		const onUploadFile = jest.fn(
			() =>
				new Promise<string>((_, reject) => {
					rejectUpload = reject;
				}),
		);
		const { getByPlaceholderText, getByLabelText } = render(
			<ConsoleCommentComposer
				initiallyOpen
				onSubmit={stubSubmit}
				onUploadFile={onUploadFile}
			/>,
		);
		const textarea = getByPlaceholderText(
			"Leave a comment…",
		) as HTMLTextAreaElement;
		const file = new File(["binary"], "shot.png", { type: "image/png" });
		fireEvent.change(getByLabelText("Attach files"), {
			target: { files: [file] },
		});
		await waitFor(() => {
			expect(textarea.value).toContain("![uploading shot.png]()");
		});
		fireEvent.change(textarea, {
			target: { value: "\n見てください\n\n![uploading shot.png]()\n" },
		});
		rejectUpload(new Error("network error"));
		await waitFor(() => {
			expect(textarea.value).not.toContain("![uploading shot.png]()");
		});
	});

	it("shows the upload failure reason when the upload rejects", async () => {
		const { getByLabelText, findByRole } = render(
			<ConsoleCommentComposer
				initiallyOpen
				onSubmit={stubSubmit}
				onUploadFile={async () => {
					throw new Error("No GitHub web session is available");
				}}
			/>,
		);
		fireEvent.change(getByLabelText("Attach files"), {
			target: { files: [new File(["x"], "shot.png", { type: "image/png" })] },
		});
		const alert = await findByRole("alert");
		expect(alert.textContent).toContain("No GitHub web session is available");
	});

	it("does not render the ok-and-awaiting-workspace button when prop is absent", () => {
		const { queryByRole } = render(
			<ConsoleCommentComposer initiallyOpen onSubmit={stubSubmit} />,
		);
		expect(
			queryByRole("button", { name: "Ok & MOVE to Awaiting Workspace" }),
		).toBeNull();
	});

	it("renders and calls onOkAndAwaitingWorkspace when the button is clicked", () => {
		const onOkAndAwaitingWorkspace = jest.fn();
		const { getByRole } = render(
			<ConsoleCommentComposer
				initiallyOpen
				onSubmit={stubSubmit}
				onOkAndAwaitingWorkspace={onOkAndAwaitingWorkspace}
			/>,
		);
		fireEvent.click(
			getByRole("button", { name: "Ok & MOVE to Awaiting Workspace" }),
		);
		expect(onOkAndAwaitingWorkspace).toHaveBeenCalledTimes(1);
	});

	it("does not render the comment-and-awaiting-workspace button when prop is absent", () => {
		const { queryByRole } = render(
			<ConsoleCommentComposer initiallyOpen onSubmit={stubSubmit} />,
		);
		expect(
			queryByRole("button", { name: "Comment & MOVE to Awaiting Workspace" }),
		).toBeNull();
	});

	it("posts the comment then calls onCommentAndAwaitingWorkspace on success", async () => {
		const onSubmit = jest.fn(stubSubmit);
		const onCommentAndAwaitingWorkspace = jest.fn();
		const { getByPlaceholderText, getByRole } = render(
			<ConsoleCommentComposer
				initiallyOpen
				onSubmit={onSubmit}
				onCommentAndAwaitingWorkspace={onCommentAndAwaitingWorkspace}
			/>,
		);
		fireEvent.change(getByPlaceholderText("Leave a comment…"), {
			target: { value: "Looks good." },
		});
		fireEvent.click(
			getByRole("button", { name: "Comment & MOVE to Awaiting Workspace" }),
		);
		await waitFor(() => {
			expect(onCommentAndAwaitingWorkspace).toHaveBeenCalledTimes(1);
		});
		expect(onSubmit).toHaveBeenCalledWith("Looks good.");
	});

	it("does not call onCommentAndAwaitingWorkspace when the submission fails", async () => {
		const onCommentAndAwaitingWorkspace = jest.fn();
		const { getByPlaceholderText, getByRole, findByRole } = render(
			<ConsoleCommentComposer
				initiallyOpen
				onSubmit={async () => {
					throw new Error("network error");
				}}
				onCommentAndAwaitingWorkspace={onCommentAndAwaitingWorkspace}
			/>,
		);
		fireEvent.change(getByPlaceholderText("Leave a comment…"), {
			target: { value: "This will fail." },
		});
		fireEvent.click(
			getByRole("button", { name: "Comment & MOVE to Awaiting Workspace" }),
		);
		await findByRole("alert");
		expect(onCommentAndAwaitingWorkspace).not.toHaveBeenCalled();
	});

	it("does nothing when comment-and-awaiting-workspace is clicked with an empty draft", () => {
		const onSubmit = jest.fn(stubSubmit);
		const onCommentAndAwaitingWorkspace = jest.fn();
		const { getByRole } = render(
			<ConsoleCommentComposer
				initiallyOpen
				onSubmit={onSubmit}
				onCommentAndAwaitingWorkspace={onCommentAndAwaitingWorkspace}
			/>,
		);
		fireEvent.click(
			getByRole("button", { name: "Comment & MOVE to Awaiting Workspace" }),
		);
		expect(onSubmit).not.toHaveBeenCalled();
		expect(onCommentAndAwaitingWorkspace).not.toHaveBeenCalled();
	});

	it("disables all three buttons while posting", async () => {
		let resolveSubmit!: () => void;
		const { getByPlaceholderText, getByRole } = render(
			<ConsoleCommentComposer
				initiallyOpen
				onSubmit={() =>
					new Promise<ConsoleComment>((resolve) => {
						resolveSubmit = () =>
							resolve({
								author: "HiromiShikata",
								body: "done",
								createdAt: "2026-06-19T11:58:00.000Z",
							});
					})
				}
				onOkAndAwaitingWorkspace={() => {}}
				onCommentAndAwaitingWorkspace={() => {}}
			/>,
		);
		fireEvent.change(getByPlaceholderText("Leave a comment…"), {
			target: { value: "test" },
		});
		fireEvent.click(getByRole("button", { name: "Comment" }));
		await waitFor(() => {
			expect(
				getByRole("button", { name: "Ok & MOVE to Awaiting Workspace" }),
			).toBeDisabled();
			expect(
				getByRole("button", { name: "Comment & MOVE to Awaiting Workspace" }),
			).toBeDisabled();
			expect(getByRole("button", { name: "Comment" })).toBeDisabled();
		});
		resolveSubmit();
	});
});

describe("insertUploadPlaceholder", () => {
	it("writes the placeholder with three empty lines when the draft is empty", () => {
		expect(insertUploadPlaceholder("", "shot.png")).toBe(
			"\n\n\n![uploading shot.png]()\n",
		);
	});

	it("normalizes the draft to end with one newline then adds three empty lines before the placeholder", () => {
		expect(insertUploadPlaceholder("See the screen:", "shot.png")).toBe(
			"See the screen:\n\n\n\n![uploading shot.png]()\n",
		);
	});

	it("does not double the trailing newline when the draft already ends with one", () => {
		expect(insertUploadPlaceholder("See the screen:\n", "shot.png")).toBe(
			"See the screen:\n\n\n\n![uploading shot.png]()\n",
		);
	});

	it("strips multiple trailing newlines before normalizing", () => {
		expect(insertUploadPlaceholder("See the screen:\n\n", "shot.png")).toBe(
			"See the screen:\n\n\n\n![uploading shot.png]()\n",
		);
	});
});

describe("replacePlaceholderWithMarkdown", () => {
	it("replaces the placeholder line with the returned markdown", () => {
		const draft = "See the screen:\n\n\n\n![uploading shot.png]()\n";
		expect(
			replacePlaceholderWithMarkdown(
				draft,
				"shot.png",
				"![shot](https://github.com/user-attachments/assets/abc)",
			),
		).toBe(
			"See the screen:\n\n\n\n![shot](https://github.com/user-attachments/assets/abc)\n",
		);
	});

	it("replaces only the first occurrence when two uploads share the same file name", () => {
		const draft =
			"text\n\n\n\n![uploading file.png]()\n\n\n\n![uploading file.png]()\n";
		expect(
			replacePlaceholderWithMarkdown(draft, "file.png", "![img](url)"),
		).toBe("text\n\n\n\n![img](url)\n\n\n\n![uploading file.png]()\n");
	});

	it("falls back to appending when the placeholder is absent", () => {
		expect(
			replacePlaceholderWithMarkdown("text\n", "shot.png", "![shot](url)"),
		).toBe("text\n![shot](url)\n");
	});
});

describe("removePlaceholder", () => {
	it("removes the placeholder and the three empty lines added with it", () => {
		const draft = "See the screen:\n\n\n\n![uploading shot.png]()\n";
		expect(removePlaceholder(draft, "shot.png")).toBe("See the screen:\n");
	});

	it("leaves the draft empty when the placeholder was inserted into an empty draft", () => {
		const draft = "\n\n\n![uploading shot.png]()\n";
		expect(removePlaceholder(draft, "shot.png")).toBe("");
	});

	it("returns the draft unchanged when the placeholder is absent", () => {
		expect(removePlaceholder("text\n", "shot.png")).toBe("text\n");
	});

	it("removes the placeholder when text was typed into the second reserved empty line", () => {
		const draft = "\n見てください\n\n![uploading shot.png]()\n";
		expect(removePlaceholder(draft, "shot.png")).not.toContain(
			"![uploading shot.png]()",
		);
	});

	it("removes the placeholder when text was typed into the third reserved empty line", () => {
		const draft = "\n\n見てください\n![uploading shot.png]()\n";
		expect(removePlaceholder(draft, "shot.png")).not.toContain(
			"![uploading shot.png]()",
		);
	});
});

describe("appendAttachmentMarkdown", () => {
	it("returns the markdown alone when the draft is empty", () => {
		expect(appendAttachmentMarkdown("", "![a](b)")).toBe("![a](b)\n");
	});

	it("adds a separating newline when the draft does not end with one", () => {
		expect(appendAttachmentMarkdown("hello", "![a](b)")).toBe(
			"hello\n![a](b)\n",
		);
	});

	it("does not add a second newline when the draft already ends with one", () => {
		expect(appendAttachmentMarkdown("hello\n", "![a](b)")).toBe(
			"hello\n![a](b)\n",
		);
	});
});
