import type { ClaudeLiveSessionRepository } from "../../../domain/usecases/adapter-interfaces/ClaudeLiveSessionRepository";
import {
	type LiveSessionOauthTokenSelectionSettings,
	type LiveSessionOauthTokenSelectResult,
	LiveSessionOauthTokenSelectUseCase,
} from "../../../domain/usecases/LiveSessionOauthTokenSelectUseCase";
import {
	DEFAULT_SELECTION_WEIGHT,
	FIVE_HOUR_MIN_FREE_RATIO,
	type OauthTokenCandidate,
	SEVEN_DAY_MIN_FREE_RATIO,
} from "../../../domain/usecases/OauthTokenSelectUseCase";
import { FABLE_LIMIT_TYPE, readRateLimit } from "../../proxy/RateLimitCache";
import { loadTokenEntries } from "../../proxy/TokenListLoader";
import { ProcClaudeLiveSessionRepository } from "../../repositories/ProcClaudeLiveSessionRepository";
import {
	resolveCacheDirectory,
	resolveTokenListJsonPath,
} from "./OauthTokenSelectHandler";

export type LiveSessionOauthTokenSelectHandlerInput = {
	tokenListJsonPath: string | null;
	cacheDirectory: string | null;
	nowEpochSeconds: number;
	selectionSettings: LiveSessionOauthTokenSelectionSettings;
};

export type LiveSessionOauthTokenSelectHandlerOutput = {
	selectedToken: string | null;
	selectedName: string | null;
	diagnostics: string[];
};

export class LiveSessionOauthTokenSelectHandler {
	constructor(
		private readonly useCase: LiveSessionOauthTokenSelectUseCase = new LiveSessionOauthTokenSelectUseCase(),
		private readonly liveSessionRepository: ClaudeLiveSessionRepository = new ProcClaudeLiveSessionRepository(),
	) {}

	handle = (
		input: LiveSessionOauthTokenSelectHandlerInput,
	): LiveSessionOauthTokenSelectHandlerOutput => {
		const tokenListJsonPath = resolveTokenListJsonPath(input.tokenListJsonPath);
		if (tokenListJsonPath === null) {
			return {
				selectedToken: null,
				selectedName: null,
				diagnostics: [
					"No token list path provided. Pass --tokenListJsonPath or set CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH.",
				],
			};
		}

		const entries = loadTokenEntries(tokenListJsonPath);
		if (entries === null) {
			return {
				selectedToken: null,
				selectedName: null,
				diagnostics: [
					`No usable token entries loaded from ${tokenListJsonPath}.`,
				],
			};
		}

		const cacheDirectory = resolveCacheDirectory(input.cacheDirectory);

		const candidates: OauthTokenCandidate[] = entries.map(
			({ name, token, selectionWeight }) => {
				const snapshot = readRateLimit(token, cacheDirectory);
				const fableLimit = snapshot?.modelWeeklyLimits[FABLE_LIMIT_TYPE];
				const fableRejected =
					fableLimit !== undefined &&
					fableLimit.rejected &&
					input.nowEpochSeconds <= fableLimit.resetsAt;
				return {
					name,
					token,
					snapshot:
						snapshot === null
							? null
							: {
									fiveHourUtilization: snapshot.fiveHourUtilization,
									fiveHourReset: snapshot.fiveHourReset,
									sevenDayUtilization: snapshot.sevenDayUtilization,
									sevenDayReset: snapshot.sevenDayReset,
								},
					subscriptionDisabled: snapshot?.subscriptionDisabled ?? false,
					unifiedRejected: snapshot?.unifiedRejected ?? false,
					fableRejected,
					selectionWeight: selectionWeight ?? DEFAULT_SELECTION_WEIGHT,
				};
			},
		);

		const liveSessions = this.liveSessionRepository.listLiveSessions();

		const result = this.useCase.run(
			candidates,
			liveSessions,
			input.nowEpochSeconds,
			input.selectionSettings,
		);

		return {
			selectedToken: result.selected?.token ?? null,
			selectedName: result.selected?.name ?? null,
			diagnostics: this.formatDiagnostics(result, input.nowEpochSeconds),
		};
	};

	private formatDiagnostics = (
		result: LiveSessionOauthTokenSelectResult,
		nowEpochSeconds: number,
	): string[] => {
		const lines = result.metrics.map((metric) => {
			const secondsUntilSevenDayEnd = Math.round(
				metric.sevenDayEndEpoch - nowEpochSeconds,
			);
			const status = metric.eligible
				? "eligible"
				: `excluded (${metric.exclusionReason})`;
			return `${metric.name}: ${metric.liveSessionCount}/${metric.concurrentSessionLimit} live session(s), 5h ${Math.round(metric.fiveHourFreeRatio * 100)}% free, 7d ${Math.round(metric.sevenDayFreeRatio * 100)}% free, 7d-end in ${secondsUntilSevenDayEnd}s, weight ${metric.selectionWeight} -> ${status}`;
		});

		if (result.selected === null) {
			lines.push(
				`No eligible token: every token is below the 5h >= ${Math.round(FIVE_HOUR_MIN_FREE_RATIO * 100)}% free and 7d >= ${Math.round(SEVEN_DAY_MIN_FREE_RATIO * 100)}% free thresholds required to start a live session.`,
			);
		} else {
			lines.push(
				`Selected ${result.selected.name} (the soonest-resetting 7d window among tokens still under their concurrent session limit, which is set by the free share of the 5h window alone).`,
			);
		}

		return lines;
	};
}
