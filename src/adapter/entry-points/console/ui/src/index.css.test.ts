import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_DIR = __dirname;
const INDEX_CSS_PATH = join(__dirname, "index.css");

function walkTsxFiles(dir: string): string[] {
	const results: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...walkTsxFiles(fullPath));
		} else if (
			entry.name.endsWith(".tsx") &&
			!entry.name.endsWith(".test.tsx") &&
			!entry.name.endsWith(".stories.tsx")
		) {
			results.push(fullPath);
		}
	}
	return results;
}

function isModalOverlayComponent(content: string): boolean {
	return (
		content.includes("createPortal") &&
		/['"`]console-[a-z][a-z0-9-]*-(overlay|backdrop)['"`]/.test(content)
	);
}

function extractConsoleClassNames(content: string): string[] {
	return [
		...new Set(
			[...content.matchAll(/console-[a-z][a-z0-9-]+/g)].map((m) => m[0]),
		),
	];
}

function loadDefinedCssClasses(cssContent: string): Set<string> {
	return new Set(
		[...cssContent.matchAll(/\.console-[a-z0-9][a-z0-9-]+/g)].map((m) =>
			m[0].slice(1),
		),
	);
}

describe("console CSS class contract", () => {
	it("defines a CSS rule in index.css for every console-* class name used in portal overlay components", () => {
		const definedClasses = loadDefinedCssClasses(
			readFileSync(INDEX_CSS_PATH, "utf-8"),
		);
		const missingEntries: { file: string; className: string }[] = [];

		for (const filePath of walkTsxFiles(SRC_DIR)) {
			const content = readFileSync(filePath, "utf-8");
			if (!isModalOverlayComponent(content)) continue;

			const relPath = relative(SRC_DIR, filePath);
			for (const className of extractConsoleClassNames(content)) {
				if (!definedClasses.has(className)) {
					missingEntries.push({ file: relPath, className });
				}
			}
		}

		expect(missingEntries).toEqual([]);
	});
});
