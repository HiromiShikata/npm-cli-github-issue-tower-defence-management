# [1.124.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.123.3...v1.124.0) (2026-07-17)


### Features

* **graphql:** add per-query rateLimit cost logging and reduce project item selection sizes ([#1197](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1197)) ([b5d29eb](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b5d29eb1854b7d56f4bab70fd4fb05ee6c74e9a0))

## [1.123.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.123.2...v1.123.3) (2026-07-17)


### Bug Fixes

* **revert-review-queue:** contain archived project item update failures so an archived item does not abort the schedule cycle ([#1193](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1193)) ([6034127](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/6034127c4aeff0cebfc8a4a914eff36781e878f4))

## [1.123.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.123.1...v1.123.2) (2026-07-17)


### Bug Fixes

* **silent-monitor:** treat a pending nested Agent/Task tool_use tail as waiting on an external process ([#1190](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1190)) ([feaf6c0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/feaf6c0b63920f4d36cfa85e4c9a5c88cd131ec2))

## [1.123.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.123.0...v1.123.1) (2026-07-17)


### Bug Fixes

* **deps:** update dependency commander to v15 ([#767](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/767)) ([a3af965](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/a3af96592f255fa22bfbc22110c973025d586019))

# [1.123.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.122.14...v1.123.0) (2026-07-16)


### Features

* gate story-body checkbox task creation behind createTaskFromStoryBodyCheckboxEnabled flag (default false) ([#1184](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1184)) ([bb8990d](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/bb8990d1ad309eb29702b3a040e44095739cf7f2))

## [1.122.14](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.122.13...v1.122.14) (2026-07-16)


### Bug Fixes

* **issue-repository:** contain per-PR mergeability resolution failures in findRelatedOpenPRs so a vanished pull request does not abort the schedule cycle ([#1185](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1185)) ([1a67e18](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/1a67e18101b1f4acea1b72f3ac6566651f98a26e))

## [1.122.13](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.122.12...v1.122.13) (2026-07-16)


### Bug Fixes

* **silent-monitor:** log ISO-8601 UTC timestamp and section types with every notification send ([#1181](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1181)) ([598c97f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/598c97f5b1af1e9705ecbcd145edb168a5d76add))

## [1.122.12](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.122.11...v1.122.12) (2026-07-16)


### Bug Fixes

* **silent-monitor:** gate long-running advisory on output recency and keep in-flight agents in the snapshot ([#1179](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1179)) ([e533043](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/e533043e140d699ee1175c48eb186496d8cad7d0)), closes [#actions](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/actions)

## [1.122.11](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.122.10...v1.122.11) (2026-07-15)


### Bug Fixes

* contain transient getOpenPullRequest errors in IssueRejectionEvaluator ([#1177](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1177)) ([8b0ddba](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/8b0ddbaa303bf24bcbd55c67a56f08111b8239b1))

## [1.122.10](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.122.9...v1.122.10) (2026-07-15)


### Bug Fixes

* **silent-monitor:** skip reminders for sessions whose last turn is a model refusal ([#1175](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1175)) ([8b72e1b](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/8b72e1b7a46ad6ef142cd7c1f46135240c3a31f4))

## [1.122.9](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.122.8...v1.122.9) (2026-07-14)


### Bug Fixes

* suppress silent reminders unconditionally while the latest owner call is unanswered ([#1170](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1170)) ([1fe7432](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/1fe743279896734ad9ed1c291bd697c488c22c64))

## [1.122.8](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.122.7...v1.122.8) (2026-07-14)


### Bug Fixes

* instruct unconditional re-raise in stale-owner-call reminder ([#1168](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1168)) ([f246cd3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/f246cd385befd0f29c51576593a1ecb2fd23bf40))

## [1.122.7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.122.6...v1.122.7) (2026-07-14)


### Bug Fixes

* **silent-monitor:** shorten silent-session reminder defaults to a calm neutral status notice ([#1166](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1166)) ([3f29b69](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/3f29b69065c005b8d41db3e68ead624f9c26ef95))

## [1.122.6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.122.5...v1.122.6) (2026-07-13)


### Bug Fixes

* **silent-monitor:** neutralize imperative reminder wording that trips model safety classifiers ([#1164](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1164)) ([e82e704](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/e82e70438b3e6be00d20d5a3e5037c6bb7ea0325))

## [1.122.5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.122.4...v1.122.5) (2026-07-12)


### Bug Fixes

* **silent-monitor:** bound unanswered-owner-call suppression with an agent-side grace period ([#1162](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1162)) ([d726a1f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d726a1fb76a10fa55866e0b6f046fd73352ba906))

## [1.122.4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.122.3...v1.122.4) (2026-07-12)


### Bug Fixes

* **console:** reset per-tab .done.json on list regeneration to bound optimistic-hide store ([#1157](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1157)) ([d632054](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d632054c3d8b38d30feb09eea62c235b1aaab280))
* **silent-monitor:** judge sub-agent wait state instead of time-window suppression ([#1160](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1160)) ([14cbb6c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/14cbb6cbb31a2424a445f764ac0cee160f2d8ea4))

## [1.122.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.122.2...v1.122.3) (2026-07-11)


### Bug Fixes

* **console:** remove avoidable GitHub GraphQL calls from console operation path ([#1154](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1154)) ([c9aa71c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c9aa71c2c2d31673d05f8b8d04af5fb591666911)), closes [#1153](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1153)

## [1.122.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.122.1...v1.122.2) (2026-07-11)


### Bug Fixes

* **console:** filter processed items from the workflow-blocker view like other tabs ([#1152](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1152)) ([9745e66](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/9745e666526b41e4bd0c318caf7107e50d30d734))

## [1.122.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.122.0...v1.122.1) (2026-07-07)


### Bug Fixes

* publish two-phase time-precise incremental issue fetch ([#1150](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1150)) ([8fd254a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/8fd254a4730046814922c60bd7a38c696403f18c))

# [1.122.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.121.0...v1.122.0) (2026-07-07)


### Features

* **intmux:** add optional newIssueRepo to override the in-tmux newIssueUrl repo segment ([#1143](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1143)) ([50960e1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/50960e1dc063eee0124622fbb61e42978b9b6e1f))

# [1.121.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.120.0...v1.121.0) (2026-07-07)


### Features

* maintain a single latest issue cache refreshed incrementally ([#1142](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1142)) ([09ebe33](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/09ebe3363c8a168bbba324a6423046eb75608a71)), closes [HiromiShikata/umino-corporait-operation#30006](https://github.com/HiromiShikata/umino-corporait-operation/issues/30006)

# [1.120.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.119.4...v1.120.0) (2026-07-07)


### Features

* exclude In Tmux by agent items from console triage tab ([#1141](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1141)) ([bd0b5ee](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/bd0b5ee252587815fb78626f217da37aba09efb1))

## [1.119.4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.119.3...v1.119.4) (2026-07-05)


### Bug Fixes

* **HandleScheduledEventUseCase:** deduplicate workflow incident issues in catch block ([#1136](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1136)) ([636563d](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/636563d2ff4458e26ae8610c27ed6257b5c85fa4))

## [1.119.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.119.2...v1.119.3) (2026-07-02)


### Bug Fixes

* **silent-monitor:** owner-call guidance requires a self-contained message and forbids scroll-back ([#1138](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1138)) ([782f958](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/782f958936a099deb828ed738f7d670a050c318a))

## [1.119.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.119.1...v1.119.2) (2026-07-02)


### Bug Fixes

* **silent-monitor:** idle stall reminder mandates authoritative-signal cause-check and logged result ([#1134](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1134)) ([bf659a9](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/bf659a96256c4d80ea7aa2502c8dab9433e15f56))

## [1.119.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.119.0...v1.119.1) (2026-07-01)


### Bug Fixes

* **console:** resolve related-PR mergeability directly when issue timeline reports UNKNOWN ([#1132](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1132)) ([6bf5509](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/6bf550944a245abef7e72d40a232fa9a372b4baf))

# [1.119.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.118.1...v1.119.0) (2026-07-01)


### Features

* **console:** clickable #N references in markdown and Changed files directory tree ([#1130](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1130)) ([d9f4836](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d9f483668af4b8b09f74468ee7e300ca30b3f6e4)), closes [#N](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/N) [#N](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/N) [#N](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/N) [#1129](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1129)

## [1.118.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.118.0...v1.118.1) (2026-06-30)


### Bug Fixes

* **silent-monitor:** cache hub-task status and suppress resolved-closed fail-opens ([#1128](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1128)) ([c3aa66c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c3aa66ccdf677d3de59b215ff812ea61664c32fb))

# [1.118.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.117.10...v1.118.0) (2026-06-30)


### Features

* split sub-agent stall reminder into distinct idle and long-running messages ([#1124](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1124)) ([78e0be1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/78e0be11e5482b91cbdac1eace1ee3e04749688f)), closes [#1123](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1123)

## [1.117.10](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.117.9...v1.117.10) (2026-06-30)


### Bug Fixes

* **console:** make Reject gate consistent for inline comments on an issue's related PR diff ([#1126](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1126)) ([2177860](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2177860517cb9a34735afbd232dac49fbba01c45)), closes [#1125](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1125)

## [1.117.9](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.117.8...v1.117.9) (2026-06-30)


### Bug Fixes

* debounce silent live-session notifications across two consecutive cycles ([#1121](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1121)) ([6be302a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/6be302ac61b97b2e3758f3811d84674a96c557ee))

## [1.117.8](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.117.7...v1.117.8) (2026-06-30)


### Bug Fixes

* **silent-monitor:** make hub-task-active gate null-safe and actually suppress ([#1117](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1117)) ([dacc841](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/dacc841f2e33bd82365f2ac825374493ea3a14b0)), closes [#1115](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1115)

## [1.117.7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.117.6...v1.117.7) (2026-06-30)


### Bug Fixes

* **console:** require an inline comment to enable Reject and send it as the request-changes review body ([#1116](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1116)) ([633bbfa](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/633bbfac4603cf8bb22e39bf6c1c93e7c910ebae)), closes [#1114](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1114)

## [1.117.6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.117.5...v1.117.6) (2026-06-30)


### Bug Fixes

* **console:** move comment submit button to the far right of the comment area ([#1113](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1113)) ([6f7bc8c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/6f7bc8ce4bd3cc235658757cf7c286d223de23b1))

## [1.117.5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.117.4...v1.117.5) (2026-06-29)


### Bug Fixes

* **silent-monitor:** drop sub-agent recency ceiling and rely on strengthened completion-at-end detection ([#1110](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1110)) ([4de5d72](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4de5d726fa5bb3b15b5901eaebcb5487b7fe4a40)), closes [#1109](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1109)

## [1.117.4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.117.3...v1.117.4) (2026-06-29)


### Bug Fixes

* **silent-notification:** exclude completed sub-agents by inspecting the last transcript entry ([#1104](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1104)) ([2bd9e42](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2bd9e42cfab2ece45c273f987c5bffc2b620368d))

## [1.117.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.117.2...v1.117.3) (2026-06-29)


### Bug Fixes

* disable console detail prefetch to stop GraphQL rate-limit exhaustion ([#1102](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1102)) ([b577193](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b5771933b5a344eec5ed057b03bcf70139e82557))

## [1.117.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.117.1...v1.117.2) (2026-06-29)


### Bug Fixes

* exclude long-dead sub-agents from silent-monitor stall flagging ([#1100](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1100)) ([9cfe761](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/9cfe761f77121a4eb5183d86dbc36ec6095fbcfa))

## [1.117.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.117.0...v1.117.1) (2026-06-29)


### Bug Fixes

* **silent-notification:** match real session-name and on-disk sub-agent transcript forms ([#1096](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1096)) ([b705351](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b705351f4991f525ba52507b64edacdaddd7d3e6)), closes [#1095](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1095)

# [1.117.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.116.9...v1.117.0) (2026-06-29)


### Features

* **console:** prefetch upcoming items, always-visible mergeable badge, taller action buttons ([#1097](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1097)) ([827464c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/827464cd8ad123375b793aa8c5d3f8d944130633)), closes [#1091](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1091)

## [1.116.9](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.116.8...v1.116.9) (2026-06-29)


### Bug Fixes

* **silent-notification:** monitor only github.com issue or pull-request named sessions ([#1094](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1094)) ([e7f0fca](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/e7f0fca786d93a3cb9dc1899ee0c40bd9f371a2a)), closes [#1093](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1093)

## [1.116.8](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.116.7...v1.116.8) (2026-06-29)


### Bug Fixes

* **silent-notification:** resolve the parent transcript by candidate-id priority ([#1092](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1092)) ([d3fcefb](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d3fcefb2ba761e7ae4cf1c1688c970cda5de590d)), closes [#1090](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1090)

## [1.116.7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.116.6...v1.116.7) (2026-06-29)


### Bug Fixes

* **console:** render Close button for pull-request items and close PRs with a valid request ([#1087](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1087)) ([db05eae](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/db05eae1774ca7fb9431086841831edbfe06702b))

## [1.116.6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.116.5...v1.116.6) (2026-06-29)


### Bug Fixes

* **console:** keep action bar bottom-attached on short items and move PR status badges below title ([#1085](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1085)) ([637603b](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/637603b0bf742cdfeb4f1077bfb390e0201fb23a)), closes [#1083](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1083)

## [1.116.5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.116.4...v1.116.5) (2026-06-29)


### Bug Fixes

* **test:** use sessionKey not sessionId on ClaudeLiveSession literals in LiveSessionOauthTokenSelectHandler test ([#1089](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1089)) ([b649c7f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b649c7f9243e09b6c973c3d9d545014c0eb1b7f2))

## [1.116.4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.116.3...v1.116.4) (2026-06-29)


### Bug Fixes

* **console:** retry transient GitHub rate-limit on item operations with bounded backoff and clear error classification ([#1082](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1082)) ([61657ed](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/61657edb588f7ba381009fb15d7a52960dda8ad6))

## [1.116.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.116.1...v1.116.2) (2026-06-29)


### Bug Fixes

* **console:** include GitHub response reason in PR-review operation errors ([#1080](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1080)) ([00a2df7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/00a2df7aa0b699a4081f391a9f8e3ad6f36d622f)), closes [#1079](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1079)

## [1.116.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.116.0...v1.116.1) (2026-06-29)


### Bug Fixes

* **console:** cap triage story-assignment button area at 33vh with internal scroll ([#1078](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1078)) ([cef441a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/cef441ac28c1172e7567cae145ef584a5dacf9ee))

# [1.116.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.115.3...v1.116.0) (2026-06-29)


### Features

* **silent-session:** add when-to-fire guidance to owner-call self-check point ([#1076](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1076)) ([2af11ff](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2af11ffde82ef767b3a4b5062bd7bf399ba43dd0))

## [1.115.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.115.2...v1.115.3) (2026-06-29)


### Bug Fixes

* **schedule:** instruct silent agents on the required owner-call format ([#1074](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1074)) ([45baaaf](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/45baaaf7906509c6827c2c680ea447de678d74fc))

## [1.115.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.115.1...v1.115.2) (2026-06-28)


### Bug Fixes

* **console:** make root font-size viewport-width-relative so PC view matches readable mobile target ([#1072](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1072)) ([d27ae65](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d27ae659e0592a5af3b3df72a514d95b18eb666e)), closes [#1071](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1071)

## [1.115.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.115.0...v1.115.1) (2026-06-28)


### Bug Fixes

* **silent-notify:** assert no cooldown suppression on repeated cycles to publish removal ([#1070](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1070)) ([3c31987](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/3c319873d7d09a4ca58ba89efaaaa7a14aed8e39))

# [1.115.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.114.2...v1.115.0) (2026-06-28)


### Features

* **silent-notify:** skip notification when hub task is no longer active ([#1063](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1063)) ([0a45b7f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/0a45b7fb8e13814422bc2a52f303bfebf10ab102))

## [1.114.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.114.1...v1.114.2) (2026-06-28)


### Bug Fixes

* **silent-notification:** count any transcript entry and resolve non-resume transcripts ([#1061](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1061)) ([dbb8bb4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/dbb8bb4171eb4ccd61a9e702a685ce7f9642e43a))

## [1.114.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.114.0...v1.114.1) (2026-06-28)


### Bug Fixes

* **silent-notification:** resolve live transcripts via rotated id and shared projects dir ([#1065](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1065)) ([95e491a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/95e491ab813e577c795c5a11d59fb1fab1b035e4)), closes [#1064](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1064)

# [1.114.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.113.0...v1.114.0) (2026-06-28)


### Features

* **console:** decorate rendered markdown PR/issue links with state icon and title ([#1066](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1066)) ([9b57d16](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/9b57d16923e766666e9714c1fe209fb842b14013)), closes [#1062](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1062)

# [1.113.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.112.6...v1.113.0) (2026-06-28)


### Features

* **console:** show PR CI status and merge-conflict status in the detail header ([#1059](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1059)) ([4f825d9](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4f825d98fe4be2477788b731cc7608c69f034c4d))

## [1.112.6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.112.5...v1.112.6) (2026-06-28)


### Bug Fixes

* **console:** show inline-comment button on touch and wire related-PR diff ([#1056](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1056)) ([de247f7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/de247f7464330a4f7e0bff49f8f43e51e345830d)), closes [#1054](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1054)

## [1.112.5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.112.4...v1.112.5) (2026-06-28)


### Bug Fixes

* **console:** preserve regular fenced code blocks in markdown splitter ([#1053](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1053)) ([c5cdd72](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c5cdd72c2599f73f8b989e71c51df70cd4f9fbcf))

## [1.112.4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.112.3...v1.112.4) (2026-06-28)


### Bug Fixes

* **console:** halve desktop font, full-box commit expand click, status in header ([#1052](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1052)) ([291d9ba](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/291d9baea2d61273eebebdcc5119f9c7110dcb76)), closes [#1050](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1050)

## [1.112.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.112.2...v1.112.3) (2026-06-28)


### Bug Fixes

* **schedule:** remove owner re-notification path and count only genuine human owner replies ([#1049](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1049)) ([5809680](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/580968033320347badfe3a6f1237f9bbd0f876ad)), closes [#1047](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1047)

## [1.112.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.112.1...v1.112.2) (2026-06-28)


### Bug Fixes

* **console:** make review screen full-width on desktop and mobile ([#1046](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1046)) ([2f7baec](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2f7baec707574df40530778e5c119528544cbc82))

## [1.112.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.112.0...v1.112.1) (2026-06-28)


### Bug Fixes

* **console:** action-bar overlap, comment state leak, markdown styling, scroll reset ([#1041](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1041)) ([c91a050](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c91a050082e561983d0a4d6f77f0324f72dd85da))

# [1.112.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.111.3...v1.112.0) (2026-06-28)


### Features

* **schedule:** re-notify owner instead of staying silent on unanswered owner call ([#1044](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1044)) ([05d83fe](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/05d83fee818548acfaa3fbcc878c8e14528b7e23)), closes [#1042](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1042)

## [1.111.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.111.2...v1.111.3) (2026-06-28)


### Bug Fixes

* **console:** keep the workflow-blocker tab visible regardless of the localStorage done overlay ([#1040](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1040)) ([83213bc](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/83213bc075a02fbcd3cfca894c7e6cbbe503bff1)), closes [#1038](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1038)

## [1.111.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.111.1...v1.111.2) (2026-06-28)


### Bug Fixes

* **schedule:** do not count monitor-injected reminders as owner replies ([#1036](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1036)) ([b1e667c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b1e667c4e8c6a798f86bff3765dfba03246bce1c)), closes [#1035](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1035)

## [1.111.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.111.0...v1.111.1) (2026-06-28)


### Bug Fixes

* **schedule:** treat stop_sequence as a completed sub-agent in stall detection ([#1034](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1034)) ([0318011](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/0318011691871b1d8141eed735de911a15866e92)), closes [#1033](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1033)

# [1.111.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.110.1...v1.111.0) (2026-06-27)


### Features

* **schedule:** monitor all live interactive sessions for silent self-check ([#1025](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1025)) ([4c4b540](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4c4b540c9e38eee1befd3e6d0060f99f997efa8a)), closes [#1024](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1024) [#actions](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/actions)

## [1.110.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.110.0...v1.110.1) (2026-06-27)


### Bug Fixes

* **token-selection:** preserve subscriptionDisabledEpoch across rate-limit cache writes ([#1031](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1031)) ([44d5d0f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/44d5d0feee97305d361fbe6dfd7b733bd6e6c993))

# [1.110.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.109.2...v1.110.0) (2026-06-27)


### Bug Fixes

* aggregate in-tmux-by-human sessions across all projects for token-status counts ([#1028](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1028)) ([e90671c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/e90671c4f1c3dd68bc7c96bd1d3b2680766363b6))


### Features

* add one-click copy button for item URL in console detail header ([#1029](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1029)) ([b16d7bd](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b16d7bd999438d82a85587160a41d34d96c9c384))

## [1.109.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.109.1...v1.109.2) (2026-06-27)


### Bug Fixes

* **dashboard:** use full project code as the per-project file key (display abbreviation is display-only) ([#1019](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1019)) ([65dcef6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/65dcef61fc1a227bad808c5d84856c7a848763b2)), closes [#1015](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1015)

## [1.109.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.109.0...v1.109.1) (2026-06-27)


### Bug Fixes

* **project-repository:** remove project-metadata disk cache, keep immutable project ID cache ([#1018](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1018)) ([c272a5a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c272a5a4dfa831a8ea602bae55eeba60e69082fb))


### Reverts

* **schedule:** restore PAGINATION_DELAY_MS to 5000 to prevent loop overrun ([#1014](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1014)) ([be7de71](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/be7de719f07cb32703aac140178ec8aa8a7c87b9))

# [1.109.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.108.0...v1.109.0) (2026-06-26)


### Features

* **project-repository:** cache static project metadata to disk across processes ([a8ac43f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/a8ac43f67870fe6b96945a555015704f3d4cc78f)), closes [#1003](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1003)

# [1.108.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.107.0...v1.108.0) (2026-06-26)


### Features

* **dashboard:** add disk usage and 2-line host metrics to the CLI composer ([#1004](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1004)) ([13b1ba0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/13b1ba07577300fc88a0e51523c9778d6e9e82bf)), closes [#1002](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1002)

# [1.107.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.106.0...v1.107.0) (2026-06-26)


### Features

* **dashboard:** compose the dashboard from per-project, machine, and token status files at serve time ([#1000](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1000)) ([124b4e6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/124b4e629d7aacf145d9452eb83896dc9c2ec7d7)), closes [#999](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/999)

# [1.106.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.105.0...v1.106.0) (2026-06-26)


### Features

* **schedule:** run stale tmux session cleanup in the scheduled cycle ([#1001](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/1001)) ([d6c9759](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d6c975999c9ccee48fc743149e440d4c2e80e7b3))

# [1.105.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.104.4...v1.105.0) (2026-06-26)


### Features

* **dashboard:** emit per-project row, machine-status, and token-status files in schedule handling ([#998](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/998)) ([be68197](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/be68197fcc1afc7ac72094b84b94afdd83f6c660)), closes [#997](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/997)

## [Unreleased]

### Code Refactoring

- **server:** rename the `serveConsole` subcommand to `serveWeb` and rename the `consoleServer` module to `webServer`, reflecting that the local web server now serves the console tabs, the dashboard, and the in-tmux-by-human session list. `serveConsole` is kept as a deprecated transitional alias that routes to the same handler, so existing invokers keep working during rollout. This is a behavior-preserving rename: every existing route, output, and default port (9981) is unchanged. ([#995](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/995))

## [1.104.4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.104.3...v1.104.4) (2026-06-26)


### Performance Improvements

* **schedule:** replace fetchProjectItems blanket 5s page sleep with reactive rate-limit backoff ([#993](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/993)) ([b8077a6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b8077a606ff0a589a2163e0bb611382c5ccaecca)), closes [#992](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/992)

## [1.104.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.104.2...v1.104.3) (2026-06-26)


### Bug Fixes

* **intmux:** drop /prs and exclude reactivation-triggered items from in-tmux-by-human list ([#994](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/994)) ([4ab59fa](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4ab59fa24fbfc9e38436ba0ea12d6375dea99674))

## [1.104.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.104.1...v1.104.2) (2026-06-26)


### Performance Improvements

* **schedule:** derive review-readiness related open PRs in memory ([#989](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/989)) ([63dba8b](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/63dba8b2ddf0b813873337e0e4292e51493383fb)), closes [#988](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/988)

## [1.104.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.104.0...v1.104.1) (2026-06-26)


### Bug Fixes

* **security:** make auto status-check author authorization fail-closed and require explicit allowlist membership ([#987](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/987)) ([bb7e206](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/bb7e206575da5bc651d386c1c2376fefcac7599c)), closes [#984](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/984)

# [1.104.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.103.1...v1.104.0) (2026-06-26)


### Features

* **schedule:** derive PR-to-issue dependency from PR closing references ([#981](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/981)) ([8ae7965](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/8ae79653a9543ae4bb4d0f85b2808b4230c88c31))

## [1.103.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.103.0...v1.103.1) (2026-06-26)


### Bug Fixes

* **console:** make error toast and all UI copy English ([#980](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/980)) ([b84cbc1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b84cbc1833420dd5e4f1051325fb1c395fde5988)), closes [#979](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/979)

# [1.103.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.102.0...v1.103.0) (2026-06-26)


### Features

* **console:** add line-anchored inline review comments on PR diff ([#978](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/978)) ([a596cf4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/a596cf4f1dc0482595dd201c24f5f495e9823ab7)), closes [#977](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/977)

# [1.102.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.101.8...v1.102.0) (2026-06-26)


### Features

* **console:** render GitHub emoji shortcodes as Unicode glyphs in markdown ([#976](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/976)) ([59788fc](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/59788fc8d565ae1cb641a620bd2d5b95de51d134))

## [1.101.8](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.101.7...v1.101.8) (2026-06-26)


### Bug Fixes

* **console:** surface action errors instead of swallowing them ([#974](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/974)) ([47ae3f5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/47ae3f5b798903ca228eb05ebd12186613c0cc67)), closes [#973](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/973)

## [1.101.7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.101.6...v1.101.7) (2026-06-26)


### Bug Fixes

* **console:** mark snoozed item done on all tabs ([#972](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/972)) ([af23c4c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/af23c4c02035209f2f4929ec4b8369d783b84d35)), closes [#971](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/971)

## [1.101.6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.101.5...v1.101.6) (2026-06-26)


### Bug Fixes

* guard auto status-check automation by author and ownership ([#965](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/965)) ([ffc81c0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/ffc81c0fea001f2ef286e0a57a08b9f53093fc2f)), closes [#962](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/962)

## [1.101.5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.101.4...v1.101.5) (2026-06-25)


### Bug Fixes

* **console:** scroll review content above a fixed footer, reset scroll on item change, and prefetch the next item ([#956](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/956)) ([4dea62e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4dea62e09bd14e1e6ccc038ce8f5c42067187422))

## [1.101.4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.101.3...v1.101.4) (2026-06-25)


### Bug Fixes

* **ApiV3CheerioRestIssueRepository:** compute CI state from latest CheckRun per name to fix Dependabot PR readiness ([#941](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/941)) ([f343310](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/f343310dcdfe99558832dd8b1049b9f876d89355))

## [1.101.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.101.2...v1.101.3) (2026-06-25)


### Bug Fixes

* **intmux:** exclude In Tmux by human issues with a future reactivation trigger ([#952](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/952)) ([2f312d4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2f312d4f5792c591e536d8b24d342deaa7c66f02))

## [1.101.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.101.1...v1.101.2) (2026-06-25)


### Bug Fixes

* **cli:** name 5h/7d free thresholds in selectLiveSessionOauthToken no-eligible error ([#951](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/951)) ([dbfefda](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/dbfefda5a6b80de2bdbc2eb59bce63366cd0b6a2)), closes [#950](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/950)

## [1.101.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.101.0...v1.101.1) (2026-06-25)


### Bug Fixes

* **intmux:** match tmux session name to app and attach-or-create to avoid duplicate sessions ([#949](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/949)) ([cf0208b](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/cf0208b956ba9abad8057e731d52fe917c8f5889))

# [1.101.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.100.0...v1.101.0) (2026-06-25)


### Features

* **console:** show Story and reactivation-trigger fields on each task row ([#946](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/946)) ([b20d75a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b20d75a4c87b836091cd0ed602deb0c50360c9f8))

# [1.100.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.99.1...v1.100.0) (2026-06-25)


### Features

* **console:** default project route lands on the left-most non-empty tab ([#945](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/945)) ([c91f2e1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c91f2e112bddb32f913660dd1ecb40e39b2e6b13))

## [1.99.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.99.0...v1.99.1) (2026-06-25)


### Bug Fixes

* **ci:** skip umino-project jobs for renovate[bot] actor ([#920](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/920)) ([17c4162](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/17c416223b5ef782291ea822bf1936a33111b470)), closes [#900](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/900)

# [1.99.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.98.3...v1.99.0) (2026-06-25)


### Features

* **console:** add Workflow Blocker tab and remove item-count indicator from detail view ([#940](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/940)) ([75f16b2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/75f16b2602783386eb2d8e246e544a96bac8a60e)), closes [#937](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/937)

## [1.98.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.98.2...v1.98.3) (2026-06-25)


### Bug Fixes

* **console:** keep diff line-number cells on one line ([#939](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/939)) ([bb6c7a2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/bb6c7a20f0f949abd9237be973b6e324a3f169ad))

## [1.98.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.98.1...v1.98.2) (2026-06-24)


### Bug Fixes

* **console:** remove the Back to list button from the console detail view ([#936](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/936)) ([d21726c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d21726c1c2ae6ee09bdefec370fa9ba7ad9d6a02))

## [1.98.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.98.0...v1.98.1) (2026-06-24)


### Bug Fixes

* **deps:** update dependency dompurify to v3.4.11 [security] ([#932](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/932)) ([d55959a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d55959a6024fe46c0bb24c0be660b0c8044d8adf))

# [1.98.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.97.4...v1.98.0) (2026-06-24)


### Features

* **cli:** add countInTmuxByHumanSessionsPerToken command ([#931](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/931)) ([01ba558](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/01ba55898365ea1058dab85387b984a6b7f3fbce)), closes [#930](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/930)

## [1.97.4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.97.3...v1.97.4) (2026-06-23)


### Bug Fixes

* **console:** place Close button on the right of the close button group ([#926](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/926)) ([4a0e1e5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4a0e1e56fa91b4be6148d633af966d879511379c))

## [1.97.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.97.2...v1.97.3) (2026-06-23)


### Bug Fixes

* **console:** render markdown tables and lists in console markdown content ([#925](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/925)) ([76410ce](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/76410ce2207bf13e17d2225ea4f00a2408de5ab5)), closes [#912](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/912)

## [1.97.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.97.1...v1.97.2) (2026-06-23)


### Bug Fixes

* convert PINK and ORANGE GitHub project colors instead of defaulting to gray ([#927](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/927)) ([b0fcc19](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b0fcc199cb1e55ee610cb6b217c3f908d9168346))

## [1.97.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.97.0...v1.97.1) (2026-06-23)


### Bug Fixes

* **console:** cap triage story-selection button area at 50vh with scroll ([#922](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/922)) ([7c746c4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/7c746c4df5476cb934f62dc6b72938eb309f5104))

# [1.97.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.96.0...v1.97.0) (2026-06-23)


### Features

* **intmux:** restart missing In Tmux by human sessions each schedule cycle ([#917](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/917)) ([0afe2b1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/0afe2b1bc3a4c2ec76d51c0cd9337ed10bf871ec)), closes [#916](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/916)

# [1.96.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.95.0...v1.96.0) (2026-06-23)


### Features

* **cli:** add selectLiveSessionOauthToken that prefers the least-occupied eligible token ([#915](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/915)) ([fe36f36](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/fe36f36a8c6b3c7626c9b9535692a6174ebdc525)), closes [#914](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/914)

# [1.95.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.94.4...v1.95.0) (2026-06-23)


### Features

* **console:** auto-advance to next non-empty tab when active tab becomes empty ([#872](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/872)) ([414deff](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/414defffeb3893f0a263fae050bcc6a9dccce240))

## [1.94.4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.94.3...v1.94.4) (2026-06-23)


### Bug Fixes

* **console:** proxy GitHub user-attachment images via token-gated /api/img ([#904](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/904)) ([b823927](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b8239276d3010d6702ccefe788a9783545540ac9)), closes [#903](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/903)

## [1.94.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.94.2...v1.94.3) (2026-06-23)


### Bug Fixes

* **console:** regenerate served bin/ui-dist to match fixed src bundle ([#881](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/881)) ([357f6bf](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/357f6bf8351c04eae137a3c7540f9f4bcb9e6962)), closes [#880](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/880)

## [1.94.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.94.1...v1.94.2) (2026-06-23)


### Bug Fixes

* **console:** make tab bar scroll horizontally to stop page overflow on narrow viewports ([#909](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/909)) ([b145320](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b14532008aaf406abdc8638fd74280315906e12a))

## [1.94.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.94.0...v1.94.1) (2026-06-22)


### Bug Fixes

* **console:** right-align operation-bar action buttons to match reference prototype ([#907](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/907)) ([06fa927](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/06fa9271908fe2daa2e71c9f6a21a7e67423d987))

# [1.94.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.93.1...v1.94.0) (2026-06-22)


### Features

* **console:** serveConsole serves the dashboard tdpm.txt unauthenticated at /tdpm.txt ([#897](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/897)) ([f381eb7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/f381eb76059812451d6b114cf2987732b05fb503)), closes [#896](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/896)

## [1.93.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.93.0...v1.93.1) (2026-06-22)


### Bug Fixes

* **console:** regenerate served bin ui-dist bundle and guard against staleness ([#894](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/894)) ([bc7a50b](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/bc7a50bd72756c3264a1a42d85a0a10f9e5730be))

# [1.93.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.92.1...v1.93.0) (2026-06-22)


### Features

* **console:** cancellable action toast, auto-advance, file diff, and swipe navigation for reference parity ([#893](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/893)) ([9f983af](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/9f983af0dfff353ff22c9d126b18aff31bbcb082)), closes [#891](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/891)

## [1.92.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.92.0...v1.92.1) (2026-06-21)


### Bug Fixes

* **console:** send Content-Length for flat in-tmux JSON responses ([#890](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/890)) ([56b8216](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/56b82169140bbf1fdf3c9b664fcd02e283e350d1))

# [1.92.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.91.5...v1.92.0) (2026-06-21)


### Features

* **console:** serve flat /in-tmux-by-human static JSON from serveConsole ([#888](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/888)) ([c01ec22](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c01ec22a83d72b2db8b7f964726dfe064e7a9ca1)), closes [#887](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/887)

## [1.91.5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.91.4...v1.91.5) (2026-06-21)


### Bug Fixes

* **console:** remove header bar and hide zero-count tabs to match reference console ([#886](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/886)) ([1900623](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/1900623fd0a4992c9d544ea4b4c46fe178d716f7)), closes [#884](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/884)

## [1.91.4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.91.3...v1.91.4) (2026-06-21)


### Bug Fixes

* **console:** make React console UI visually and navigationally identical to the reference prototype ([#883](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/883)) ([f2db7dc](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/f2db7dcce985a11a7b09a4a4b641acb08c47f09e)), closes [#882](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/882)

## [1.91.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.91.2...v1.91.3) (2026-06-21)


### Bug Fixes

* **console:** anchor read API paths at server root so per-project routes load detail content ([#879](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/879)) ([789e4a1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/789e4a1da0ec087e061f051de08af7d30e3735ef))

## [1.91.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.91.1...v1.91.2) (2026-06-20)


### Bug Fixes

* **console:** apply processed-item overlay to all tab badges so a zeroed tab stays zero ([#871](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/871)) ([4eda1ab](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4eda1ab29cce54969c5fcc2b8a5ff838013978f7)), closes [#868](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/868)

## [1.91.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.91.0...v1.91.1) (2026-06-20)


### Bug Fixes

* **console:** generate todo-by-human per-tab list data ([#866](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/866)) ([74e74f4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/74e74f408a41b4a48ef132360f5fa41270233295)), closes [#864](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/864)
* **console:** serveConsole serves placeholder HTML instead of built React UI (uiDistDir path mismatch) ([#867](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/867)) ([0ca317f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/0ca317f7f6ef2e71211f4577fdaf691e2cb1eb69))

# [1.91.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.90.0...v1.91.0) (2026-06-20)


### Features

* **console:** rebuild React console UI feature parity with single-artifact dist ([#859](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/859)) ([c78187f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c78187f0ed192b5c241f17b204d449b178511b60))

# [1.90.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.89.0...v1.90.0) (2026-06-20)


### Features

* **console:** serve all projects from one serveConsole instance via per-project URL paths ([#858](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/858)) ([f30a38e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/f30a38e2e920a47c46c84e34c6943cf8d585f5e5)), closes [#856](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/856)

# [1.89.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.88.1...v1.89.0) (2026-06-18)


### Features

* **cli:** add selectOauthToken subcommand printing one rate-limit-aware OAuth token ([#835](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/835)) ([0928646](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/0928646c7b32e9d45d6effc1289dc0460070263b))

## [1.88.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.88.0...v1.88.1) (2026-06-18)


### Bug Fixes

* **core:** prevent self-referential dependedIssueUrl for PR items in NotifyFinishedIssuePreparationUseCase ([#843](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/843)) ([ca2c4ee](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/ca2c4eead62b215bb5f2df1faf37577311f42399)), closes [#842](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/842)

# [1.88.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.87.0...v1.88.0) (2026-06-18)


### Features

* generate in-tmux-by-human per-project and index JSON files in the scheduled daemon cycle ([#841](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/841)) ([704701f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/704701f4bcb33b2963962388889cdd6aa7b88838)), closes [#840](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/840)

# [1.87.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.86.0...v1.87.0) (2026-06-18)


### Features

* **console:** scaffold React console UI with build bundling and minimal tab view ([#849](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/849)) ([2b270d5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2b270d5af8eaaa143135830efbe5089a32bda671))
* **issue:** add IssueRepository read methods for Console read APIs ([#848](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/848)) ([4d93fc7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4d93fc7aab261ca916df230221e2ab70f8ea5cc8))

# [1.86.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.85.0...v1.86.0) (2026-06-18)


### Features

* **console:** add serveConsole CLI subcommand HTTP server skeleton ([#847](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/847)) ([e9442d9](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/e9442d9c1c0f4823c92786a706b30ae30b1d9400)), closes [#844](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/844)

# [1.85.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.84.1...v1.85.0) (2026-06-15)


### Features

* **core:** add "In Tmux by agent" workflow status (yellow), mirroring "In Tmux by human" ([#839](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/839)) ([85c908c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/85c908ce234bde3b23660ccef55c04832d1630b2))

## [1.84.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.84.0...v1.84.1) (2026-06-14)


### Bug Fixes

* **core:** do not exclude a token from rotation solely on the unified/representative rate-limit rejection ([#833](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/833)) ([5b3e999](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/5b3e999d4069c5db1e43a248b448eea4b5b38cf2)), closes [#832](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/832)

# [1.84.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.83.0...v1.84.0) (2026-06-14)


### Features

* **console:** generate per-tab Console list.json files in scheduled cycle ([#831](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/831)) ([0368fb7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/0368fb74d572a5d9b73966440da2c62669d1d4f4))

# [1.83.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.82.1...v1.83.0) (2026-06-14)


### Features

* **core:** route spawn model per token from each token's weekly availability ([#829](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/829)) ([d270a26](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d270a2609ed17fff33e010a236af17d9838928be)), closes [#828](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/828)

## [1.82.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.82.0...v1.82.1) (2026-06-12)


### Bug Fixes

* **core:** make per-spawn token assignment prefer the soonest-reset token, not just the least-loaded one ([ad09404](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/ad09404f2e16afb892075d1715deba5e1e02718f))

# [1.82.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.81.0...v1.82.0) (2026-06-12)


### Bug Fixes

* add changeTargetPathAliases to knownProjectReadmeConfigKeys and parseProjectReadmeConfig ([a8eef68](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/a8eef684ca55a2d0302d243a658cc226e8cdf46e))
* address review comments on changeTargetPathAliases type and port alias tests ([ea9ffed](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/ea9ffedc0c1f92aed84a0caf6831a7a774b9d6cf))
* normalize leading slash in IssueRejectionEvaluator extractChangeTargetMustPaths ([ea0a169](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/ea0a1696df93d24a1d13f2544c8834515f38e5db))
* regenerate index.js.map after rebase onto main ([2e9d660](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2e9d6601d21944b377e0a4a40cfecc43e90e4c3a))


### Features

* normalize leading slash in change-target labels and add path alias support ([27dbdf6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/27dbdf63b188bb78126ed463a965dd5223a30134))

# [1.81.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.80.1...v1.81.0) (2026-06-12)


### Features

* **core:** cooldown a token after a 429 with no rate-limit headers ([f53b5e8](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/f53b5e8ac7bd162f67cced29da878692631eef2b)), closes [#819](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/819)

## [1.80.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.80.0...v1.80.1) (2026-06-12)


### Bug Fixes

* **cli:** lazy-load HandleScheduledEventUseCaseHandler to avoid eager googleapis import ([2907e9e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2907e9ee7b77e8576b030ec81c6223af1077c272))

# [1.80.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.79.0...v1.80.0) (2026-06-12)


### Features

* **domain:** add console use case base directory ([86460ee](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/86460ee145b9b9545ff2445bbc6988ca83eafc75))

# [1.79.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.78.0...v1.79.0) (2026-06-12)


### Features

* **cli:** enhance checkIssueReviewReadiness with comment checks and optional projectUrl ([41c0b6f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/41c0b6f01c24068925638e35a108d33ea5fa202d)), closes [HiromiShikata/secretary#1781](https://github.com/HiromiShikata/secretary/issues/1781)


### Reverts

* restore unrelated build artifacts to origin/main state ([30a7ec1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/30a7ec1424122d562373e79989d6fe2abefaa46d))

# [1.78.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.77.3...v1.78.0) (2026-06-12)


### Features

* **core:** add scheduled use case to move non-review-ready Unread pull requests to Awaiting Workspace ([52220bf](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/52220bfe7b3cc7bb47dc18afcfcc125c83cb1581))
* **usecases:** merge Awaiting Quality Check and Unread PR review queue checks into RevertNotReadyReviewQueueIssueUseCase ([dca1199](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/dca1199c9e46fe29a7e4663273fc1ff815b7a70e)), closes [#757](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/757)

## [1.77.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.77.2...v1.77.3) (2026-06-12)


### Bug Fixes

* **core:** count token in-flight by worker root not per descendant process ([578e256](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/578e25667ea089c9b578aa436bf9cb1f5780d3b1)), closes [#809](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/809)

## [1.77.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.77.1...v1.77.2) (2026-06-12)


### Bug Fixes

* **core:** format dependent issue URLs as Markdown list items ([733a92f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/733a92fb24c45b5686904fa5cdd6f3b0cc3a53f2))

## [1.77.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.77.0...v1.77.1) (2026-06-12)


### Bug Fixes

* **core:** run Story-assignment use cases every slow sweep instead of only at minute 0 ([8832b59](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/8832b5943b76fb89450befa46da6bccae61c9285)), closes [#780](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/780)

# [1.77.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.76.0...v1.77.0) (2026-06-12)


### Features

* enforce per-token global in-flight concurrency limit across projects ([0ca7c71](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/0ca7c7125c7cd811ee9df056437cbd22251c86da))

# [1.76.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.75.0...v1.76.0) (2026-06-12)


### Bug Fixes

* **core:** remove createCommentByUrl from IssueRejectionEvaluator Pick and add combined-label confinement test ([4f9de4a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4f9de4af2c566c06d54d19114d1b593e9e58b909))
* **core:** remove createCommentByUrl from outer use-case Picks and update compiled output ([e92fc6b](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/e92fc6b1daaa749f2c350a110875250d3a4f52e1))
* **core:** replace typia.is with manual type check in isPullRequestFilesResponse ([645cdc2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/645cdc2623b3dcda4186699a1f32dba8170de2ca))
* **core:** use in operator instead of type assertion in isPullRequestFilesResponse ([bb63473](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/bb63473e6f052e4b9c6d3a4a30eb11198037814e))


### Features

* **core:** reject PR with inline review comment when change-target-must path has no changes ([5d9956f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/5d9956f2dbf384047a21a0be8d0a652498159355))

# [1.75.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.74.1...v1.75.0) (2026-06-10)


### Features

* **core:** add DailySecurityScanUseCase for daily OSV-Scanner and CISA KEV monitoring ([ddaa341](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/ddaa34158029bd8cf3116a9268b0f05bcc628d3c)), closes [#665](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/665)

## [1.74.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.74.0...v1.74.1) (2026-06-10)


### Bug Fixes

* **tdpm:** exempt labelsAsLlmAgentName issues from auto status check rejection ([9879678](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/98796788f3bdc2fdd244febd10179f64ea1c78ee)), closes [#784](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/784)

# [1.74.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.73.3...v1.74.0) (2026-06-08)


### Features

* **core:** fall back to Opus when Sonnet 7-day weekly limit is exhausted ([5dfb409](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/5dfb4095733f2615e42fab8fc013cf4c975996c4))

## [1.73.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.73.2...v1.73.3) (2026-06-07)


### Bug Fixes

* **slow-sweep:** add open task PR to current project before setting depended issue url ([6b12f5f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/6b12f5fc163c4b225c19f73eb0d976e2401e8612))

## [1.73.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.73.1...v1.73.2) (2026-06-07)


### Bug Fixes

* **core:** skip PR-existence check for issues designated by labelsAsLlmAgentName label ([653f717](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/653f717fe0072d38ab2f748769ae81ee75880b92))

## [1.73.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.73.0...v1.73.1) (2026-06-06)


### Bug Fixes

* **security:** use global regex replace to fully sanitize URI characters and quote characters ([e06dbd6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/e06dbd69a124101761e1357405e4c72668a37241)), closes [#720](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/720)

# [1.73.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.72.0...v1.73.0) (2026-06-06)


### Features

* **core:** run change-target auto-approve check in periodic awaiting quality check cycle ([bf7f5b3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/bf7f5b307c2d6af2f0377cab6d26e93b4e014e47)), closes [#770](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/770)

# [1.72.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.71.1...v1.72.0) (2026-06-06)


### Features

* **core:** auto-approve PR when issue has change-target labels and changed files are confined ([a8fb98f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/a8fb98f0a05875776fdbe5a393417b6793943901)), closes [#736](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/736)

## [1.71.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.71.0...v1.71.1) (2026-06-06)


### Bug Fixes

* **notify:** query both issue and pullRequest in fetchProjectItemByUrl so PR URLs resolve to project items ([2d9edb4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2d9edb4ce533d05c75ba74bfd57dc1e7373aaf59))

# [1.71.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.70.0...v1.71.0) (2026-06-06)


### Features

* **cli:** add checkIssueReviewReadiness sub-command for read-only review-readiness check ([502ccf7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/502ccf747d65d498bbaac18f8e3a3099d937e55c)), closes [#743](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/743)

# [1.70.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.69.13...v1.70.0) (2026-06-06)


### Features

* **core:** add scheduled use case to set PR Depended Issue URL to linked open task ([8d083d5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/8d083d5c3bb5305c0162508dd69feb30c6285769)), closes [#756](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/756)

## [1.69.13](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.69.12...v1.69.13) (2026-06-06)


### Bug Fixes

* **handle-scheduled-event:** skip LastExecutionDateTime write when targetDateTimes is empty ([d104b8e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d104b8e75ab7f075cdbd33999e0b596269484902))

## [1.69.12](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.69.11...v1.69.12) (2026-06-05)


### Bug Fixes

* **scheduler:** run RevertNotReadyAwaitingQualityCheckUseCase on every scheduled cycle ([9ac12f7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/9ac12f7305f3ec4c5c62b0df50ae5a62689e0073)), closes [#732](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/732)

## [1.69.11](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.69.10...v1.69.11) (2026-06-05)


### Bug Fixes

* **start-preparation:** taper per-token concurrency on 5h and 7d utilization ([498851e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/498851eee4bb91efe3041dc0399dc0a94c5af6dc)), closes [#754](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/754)

## [1.69.10](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.69.9...v1.69.10) (2026-06-05)


### Bug Fixes

* **scheduler:** log per-item assignee update failures instead of aborting the slow sweep cycle ([be7a236](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/be7a23677c02365cb78f47f3b90fffae561c0665))

## [1.69.9](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.69.8...v1.69.9) (2026-06-05)


### Bug Fixes

* **rotation:** drop currentPreparationIssueCount offset so soonest-7d-reset token is always selected first ([98a7ad4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/98a7ad450fcaa84bd0adce2946a2ad1e5bbcdc3f)), closes [#748](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/748)

## [1.69.8](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.69.7...v1.69.8) (2026-06-04)


### Bug Fixes

* **rotation:** bridge snapshot sevenDayReset into modelWeeklyLimits so 7d deadline sort works on proxy path ([b56e46d](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b56e46ddd6b1ec61036ca42ea517a0bec55841b3)), closes [#733](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/733)

## [1.69.7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.69.6...v1.69.7) (2026-06-04)


### Bug Fixes

* **core:** restore story-priority ordering in StartPreparationUseCase candidate set ([3547f47](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/3547f478bd6b7ef083f282b4105d2e4f37599ddc)), closes [#739](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/739)

## [1.69.6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.69.5...v1.69.6) (2026-06-03)


### Bug Fixes

* **rate-limit:** probe tokens hourly to recover from model weekly limit deadlock ([ec82afa](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/ec82afa379914caf49388075a21f611bd65b467a)), closes [#696](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/696)

## [1.69.5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.69.4...v1.69.5) (2026-06-02)


### Bug Fixes

* **core:** warn on unknown keys in project README config section ([9484814](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/9484814b1b50c97a93a88b91a47bec4e47b84eaf)), closes [#646](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/646)

## [1.69.4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.69.3...v1.69.4) (2026-06-02)


### Bug Fixes

* **core:** route repeatedly orphaned Preparation issues to Failed Preparation ([ec781dc](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/ec781dcb116893559b4479984e4b55649e43ac9c)), closes [#683](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/683)

## [1.69.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.69.2...v1.69.3) (2026-06-02)


### Bug Fixes

* **findRelatedOpenPRs:** include issue URL in error messages for timeline fetch failures ([4844bdc](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4844bdc755b8c2a5574fd0a35599c58c5428b280))

## [1.69.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.69.1...v1.69.2) (2026-06-02)


### Bug Fixes

* **core:** include story=null issues in StartPreparationUseCase candidate set ([3df4786](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/3df4786daa2e80afa6010f6b060b390921c3ba24)), closes [#679](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/679)
* **core:** restore fetchProjectItems initial page size to 100 ([fa5cbd6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/fa5cbd6287f6f2b10419e015230b572e854edf21)), closes [#689](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/689) [#687](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/687)

## [1.69.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.69.0...v1.69.1) (2026-05-30)


### Bug Fixes

* **security:** make allowedIssueAuthors optional for backward compatibility ([f8785e7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/f8785e76f7e944fca8de069b9624851240b71e04)), closes [#668](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/668)
* **security:** verify comment author in NotifyFinishedIssuePreparation rejection checks ([4042bdf](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4042bdfe66c8b4f74897f0d8138809f925c82fc7)), closes [#668](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/668)

# [1.69.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.68.0...v1.69.0) (2026-05-30)


### Features

* **config:** add labelToLlmAgent mapping to per-project YAML ([d422213](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d422213a383d9d98443fd259a79b43787c556b49))

# [1.68.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.67.6...v1.68.0) (2026-05-29)


### Features

* **rotation:** prefer tokens with shortest remaining 7d window so weekly quota is not wasted at reset ([ae6dc73](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/ae6dc73f457e2b79a0b2bc29832037379227512c)), closes [#710](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/710)

## [1.67.6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.67.5...v1.67.6) (2026-05-29)


### Bug Fixes

* **core:** skip auto-escalation to Failed Preparation when current check is APPROVED ([3a2e926](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/3a2e9268b8d91eed5a5a668151a4b29fb688d6c6)), closes [#676](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/676)

## [1.67.5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.67.4...v1.67.5) (2026-05-29)


### Bug Fixes

* **proxy:** preserve rate-limit cache when response has no anthropic-ratelimit-* headers ([6c28386](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/6c283868ea769d90b739058dd9b7908dc50c7a5b))
* **scheduled-event:** create error issue on spreadsheet access failure ([fcc6777](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/fcc6777aefe8eff76369abf09b5e71178c4d923c)), closes [#644](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/644)

## [1.67.4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.67.3...v1.67.4) (2026-05-28)


### Reverts

* Revert "Merge pull request [#681](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/681) from HiromiShikata/i645" ([d888023](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d8880234e2c250dbc1daa3218be0623f031a6aa1))
* Revert "Merge pull request [#690](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/690) from HiromiShikata/i646" ([73dd015](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/73dd01574fd9f0b1bb3c2fd0b6c02f9f19938ce0))
* Revert "Merge pull request [#693](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/693) from HiromiShikata/i692" ([2ffa2cd](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2ffa2cdc2c422956eef739f0c32cdbd1b3fd34fb))

## [1.67.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.67.2...v1.67.3) (2026-05-28)


### Bug Fixes

* **core:** log effective config resolution in schedule codepath ([932cd1a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/932cd1a5e701a74bf8579bac0ea6fffaa8873ecf))
* **core:** warn on unknown keys in project README config section ([94968dd](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/94968dd61677dfc3171b557ae6370329d31e170d)), closes [#646](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/646)

## [1.67.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.67.1...v1.67.2) (2026-05-27)


### Bug Fixes

* **core:** surface full GraphQL error payload and add per-page halving fallback in fetchProjectItems ([729138e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/729138e8e4419f85b1a59ca3d2868322c9837c94))

## [1.67.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.67.0...v1.67.1) (2026-05-26)


### Bug Fixes

* **core:** include error details in Failed to fetch project README warning ([27150c0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/27150c0750ff5f00e2d192e39aa60b663b9bddcb))

# [1.67.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.66.0...v1.67.0) (2026-05-26)


### Features

* replace 85% 7d hard cutoff with adaptive per-token concurrent limit ([e3aa2ff](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/e3aa2ff63b76e2278ea4e1b8c0332a49b02c7000))

# [1.66.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.65.0...v1.66.0) (2026-05-26)


### Features

* **core:** remove Awaiting Task Breakdown status and migrate items to Todo by human ([cc38380](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/cc38380bf5ea322c347ed3c3731d4a91eda1fb69)), closes [#642](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/642)

# [1.65.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.64.0...v1.65.0) (2026-05-26)


### Features

* **core:** log skipped issues when allowedIssueAuthors filter is active ([8ab1a29](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/8ab1a29b88b6d0f37fbac596ce4166c1f8d87b5a)), closes [#620](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/620)

# [1.64.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.63.1...v1.64.0) (2026-05-26)


### Features

* **core:** route spawn to a usable model per token using per-model 7d availability ([f3bdf07](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/f3bdf07dea62cf01b62647942cc8175604d6d826)), closes [#672](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/672)

## [1.63.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.63.0...v1.63.1) (2026-05-25)


### Bug Fixes

* **ci:** allow sigstore endpoints in harden-runner allowlist for npm provenance signing ([651727d](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/651727d06c2c6f8e649fe2e16bd17ff72d939391))

## [1.60.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.60.1...v1.60.2) (2026-05-25)


### Bug Fixes

* **core:** include unassigned issues in new story creation by label ([cd106de](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/cd106decee95301089859b472337f74b0a2ba366)), closes [#610](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/610)

## [1.60.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.60.0...v1.60.1) (2026-05-25)


### Bug Fixes

* **core:** set dependedIssueUrl for all open PRs in NotifyFinishedIssuePreparationUseCase ([d151a59](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d151a59bfd071ab30215c19f8ee08052ad70eed2)), closes [#641](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/641)

# [1.60.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.59.0...v1.60.0) (2026-05-25)


### Features

* **core:** introduce ClaudeMessageResponse entity and SQLite persistence in proxy ([41b4452](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/41b44523f3d56d6207dfe3cfc03a56cb107de000)), closes [#651](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/651) [#651](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/651)

# [1.59.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.58.3...v1.59.0) (2026-05-24)


### Bug Fixes

* **core:** resolve eslint errors in UpdateRateLimitCacheUseCase and related tests ([fd90ad6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/fd90ad620ff003b9b222829713db6ba2b46781f8))


### Features

* **core:** persist all rate-limit headers and add UpdateRateLimitCacheUseCase ([47d33b9](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/47d33b9503dcf5d4162ddb32ba57fa43d8ab21ee)), closes [#638](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/638)

## [1.58.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.58.2...v1.58.3) (2026-05-24)


### Bug Fixes

* **core:** exclude tokens whose model-specific weekly limit (seven_day_sonnet) is exhausted ([4d10303](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4d10303646007a3345c2921525d168afccd83d22))
* **core:** expire stale rate-limit observations so reset tokens re-enter rotation ([7a63c1d](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/7a63c1d0c365526833dcd1293430adb5b9b27bba))
* **core:** gate preparation on per-token 5h utilization threshold and remove legacy getUsage() global gate ([cf7cb93](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/cf7cb93b12c6e4e04e6c20a8100805d0cc0abc0e)), closes [#622](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/622)

## [1.58.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.58.1...v1.58.2) (2026-05-24)


### Bug Fixes

* **test:** use unique name per run to prevent concurrent test race condition ([c6aff80](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c6aff80cd075f6abe1ad9c340573e578b63e356b))

## [1.58.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.58.0...v1.58.1) (2026-05-23)


### Bug Fixes

* **core:** read claudeCodeOauthTokenListJsonPath from top-level config in schedule handler ([deb1e35](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/deb1e358261bfec76994387a700ab78a84544687)), closes [#616](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/616) [#617](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/617)

# [1.58.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.57.0...v1.58.0) (2026-05-23)


### Features

* **core:** wire long-term OAuth token rotation into the schedule path ([c5a4fe7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c5a4fe72cfa3dd2a3bc62def6ee127e2b9952fd2)), closes [#615](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/615)

# [1.57.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.56.1...v1.57.0) (2026-05-23)


### Features

* **core:** add item to project when create issue from story issue checkbox ([bf52fa6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/bf52fa6faa39f673745f751cd65c3c85eebde603))

## [1.56.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.56.0...v1.56.1) (2026-05-23)


### Bug Fixes

* **core:** suppress synth-100% when overage-disabled-reason is org_level_disabled* regardless of 7d-status ([20cf8fc](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/20cf8fc25d2ba8a3c5299a9149f06486636de5c7))

# [1.56.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.55.0...v1.56.0) (2026-05-23)


### Features

* **proxy:** rotate long-term OAuth tokens by per-token rate-limit utilization with internal proxy ([f7284e8](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/f7284e8327ea97e6c0671d14b5a9c45678c25006)), closes [#603](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/603)

# [1.55.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.54.0...v1.55.0) (2026-05-23)


### Features

* **core:** assign manager when creating new task from story issue ([325dd60](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/325dd600aa9c31a44eae2699c36edd862efef1ab))

# [1.54.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.53.0...v1.54.0) (2026-05-23)


### Features

* **core:** change status ([b027776](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b0277767b231cca3f5910998e63b1b2fc1166e0e))

# [1.53.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.52.1...v1.53.0) (2026-05-23)


### Bug Fixes

* **core:** update HandleScheduledEventUseCase test to pass new revertNotReadyAwaitingQualityCheckUseCase constructor argument ([25b2eb0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/25b2eb0605bfea1a0a135b92d7fcac706563e79d))


### Features

* **core:** add scheduled use case to revert Awaiting Quality Check issues whose linked PR is no longer review-ready, sharing the rejection-evaluation helper with NotifyFinishedIssuePreparationUseCase ([f11b2aa](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/f11b2aad8fec0747ed8cc96055c78189570da7ee)), closes [#586](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/586)

## [1.52.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.52.0...v1.52.1) (2026-05-22)


### Bug Fixes

* **core:** harden fetchProjectId for user-owned projects, errors-only responses, and memoize project IDs ([4a7d641](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4a7d641ab4c57f335d4f87266a4446b348904030))

# [1.52.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.51.0...v1.52.0) (2026-05-22)


### Bug Fixes

* **core:** always fetch fresh story issue body in ConvertCheckboxToIssueInStoryIssueUseCase and rebuild bin ([1be8818](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/1be881838186edb165f76c9c3174ca8bccfa7ad5))
* **core:** remove stale notifyFinishedPreparation references after rebase on main ([99c2c9b](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/99c2c9b339f1f0ee0ef91364cac2f2fa3a01b948))


### Features

* **core:** split scheduled sweep onto 600s slow loop and default allowIssueCacheMinutes to 10 ([81d185c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/81d185c09d408eca63692d9e22fb6b4c3c049fa3))

# [1.51.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.50.3...v1.51.0) (2026-05-22)


### Features

* **core:** add Failed Preparation status and route escalated issues there instead of Awaiting Quality Check ([bca02c4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/bca02c4de9f7f69b2e706582978ba2340ae3a63d))

## [1.50.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.50.2...v1.50.3) (2026-05-22)


### Bug Fixes

* **core:** populate Issue.author from GitHub API and enforce deny-by-default for allowedIssueAuthors ([9fd44fd](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/9fd44fd437342800c84647ede441c7c0b9964e5f))
* **core:** rebuild bin with correct typia transforms and revert unrelated package-lock.json changes ([836fb7d](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/836fb7d2e6eb96686f86963b5a540761d1f56b21))

## [1.50.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.50.1...v1.50.2) (2026-05-21)


### Bug Fixes

* **core:** guard against undefined response.data in GraphQL repository methods ([6a6718a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/6a6718a07dd390490da0fb47aa68e776cc773991))

## [1.50.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.50.0...v1.50.1) (2026-05-21)


### Bug Fixes

* **src:** resolve format and test CI failures caused by .npmrc settings ([0ce24ea](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/0ce24eaa2e8a6421194e25e2ea7d34ebd9609555)), closes [#cookie](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/cookie)

# [1.50.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.49.2...v1.50.0) (2026-05-21)


### Features

* **core:** drop body from bulk fetchProjectItems and lazy-fetch story-issue body ([29ba658](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/29ba658f4e552f7b68b9c32f7d72915626e4085a))

## [1.49.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.49.1...v1.49.2) (2026-05-21)


### Bug Fixes

* **core:** resolve lint errors in getCommentsFromIssue REST implementation ([e876cdf](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/e876cdfd5830063e0bbed922913c3ddc4a7eff35))

## [1.49.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.49.0...v1.49.1) (2026-05-21)


### Bug Fixes

* **core:** restore awaitingQualityCheckStatus in schedule command revert path ([b2903d6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b2903d6b652b20ec1d6ade2adef58aa5ff424f6f))

# [1.49.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.48.0...v1.49.0) (2026-05-18)


### Features

* **core:** redefine REQUIRED_WORKFLOW_STATUSES to 10 statuses without descriptions ([c147066](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c1470661776a20ee064555b74e067afc7eca07d9))

# [1.48.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.47.0...v1.48.0) (2026-05-17)


### Bug Fixes

* **core:** update test to expect hardcoded workflow status names ([deacb6b](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/deacb6be4b1d7b18c08393973cae80f04d37b2c4))


### Features

* **core:** hardcode workflow status names and add SetupTowerDefenceProjectUseCase ([b99c71a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b99c71adade6671967a65b4b7d26214c1dc65301))

# [1.47.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.46.0...v1.47.0) (2026-05-17)


### Bug Fixes

* **core:** remove startDaemon situation write with empty issue list ([fddc899](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/fddc899523fbd86b67002557c7bef0802a274352))


### Features

* **core:** replace runtimeConfig dump with per-project situation JSON ([29ebdb5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/29ebdb5401eb187142cb3653d336bf8e9748ddde))

# [1.46.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.45.0...v1.46.0) (2026-05-17)


### Features

* **core:** remove gh-cookie dependency ([f0321fd](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/f0321fd2a84624dedafd44be58372d4bb61f5662)), closes [#cookie](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/cookie) [#cookie](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/cookie)
* **core:** replace CheerioProjectRepository.updateStoryList with GraphQL updateProjectV2Field mutation ([91ced75](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/91ced75f8baf118f3ac75a8e4feec24ebbaa1404))

# [1.45.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.44.10...v1.45.0) (2026-05-17)


### Bug Fixes

* **core:** add missing createdAt field to createPassingPr helper in RevertOrphanedPreparationUseCase tests ([7dde738](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/7dde738f385ed3bbd997ee66fc2ec4cf4ad053d4))


### Features

* **core:** auto-resolve multiple-open-PR ambiguity by adopting oldest PR and closing newer ones ([6840f2c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/6840f2c3890ad66e41ea0ac0bfc9deca1804c444)), closes [#561](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/561)

## [1.44.10](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.44.9...v1.44.10) (2026-05-16)


### Bug Fixes

* **deps:** update dependency ky to v2 ([c07ea6f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c07ea6f53b687f66685f0dea5e6c8975428eeead))
* **deps:** update dependency ky to v2 ([#565](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/565)) ([5c5aa7f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/5c5aa7faf02dac9340c25b9e731ec78e4a9d75a3))

## [1.44.9](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.44.8...v1.44.9) (2026-05-16)


### Bug Fixes

* **core:** skip closed issues in evaluateHasRejections and StartPreparation to break infinite cycle ([d29cfd2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d29cfd2f31d992345d13d80802342059ed731f68))

## [1.44.8](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.44.7...v1.44.8) (2026-05-16)


### Bug Fixes

* **src:** gate overage synth on unified-5h-status and unified-7d-status instead of enumerating reason strings ([1748556](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/1748556b2228584e3af1c04f097638d674c4e9d5))

## [1.44.7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.44.6...v1.44.7) (2026-05-16)


### Bug Fixes

* **core:** persist Project V2 Status via updateStatus in NotifyFinishedIssuePreparationUseCase ([93f1da4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/93f1da46d58e89c305bc101a3b0130caf75de329)), closes [#519](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/519)

## [1.44.6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.44.5...v1.44.6) (2026-05-16)


### Bug Fixes

* **RevertOrphanedPreparationUseCase:** reuse completion evaluation instead of unconditionally reverting to awaiting-workspace ([c1d8d5e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c1d8d5e087f70d4ba1f2ca3f5b716b1fd1fec5b6)), closes [#550](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/550)

## [1.44.5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.44.4...v1.44.5) (2026-05-14)


### Bug Fixes

* **core:** propagate allowIssueCacheMinutes through getStoryObjectMap in StartPreparationUseCase ([93a6b57](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/93a6b57fa4fc4cb9ea0e25d6a1aec9f804034d67)), closes [#518](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/518)
* **test:** add allowIssueCacheMinutes to startDaemon CLI test assertions ([3fc7df1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/3fc7df1fb14d8b8ec4652810257a554f49ea50fb))

## [1.44.4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.44.3...v1.44.4) (2026-05-13)


### Bug Fixes

* **core:** skip synthesised 100% entry when overage-disabled-reason indicates plan quota is still available ([b7e5833](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b7e58332953ece15d675430f3b47a37bd04a08c4)), closes [#533](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/533) [#538](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/538)

## [1.44.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.44.2...v1.44.3) (2026-05-13)


### Bug Fixes

* **core:** add awLogDirectoryPath and awLogStaleThresholdMinutes to projectConfig.ts ([a4a5c8b](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/a4a5c8babeaa6435c4142989d90d09985649f396))
* **core:** restore missing fs import in index.ts dropped during rebase ([c14d3c6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c14d3c63d43de8afdc67d85f47cbbb887f9dbf8d))
* **core:** schedule command now applies Project V2 README config overrides ([1e83b71](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/1e83b712a5322be79123abd8e4b12ce75fc9b960))

## [1.44.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.44.1...v1.44.2) (2026-05-13)


### Bug Fixes

* **core:** synthesise hour:168 100% entry when overage-status is rejected in OauthProxyClaudeRepository ([3396f91](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/3396f91be11bdd296b9858b7e78b3eb67869c19f))

# [1.44.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.43.2...v1.44.0) (2026-05-13)


### Bug Fixes

* **core:** use numeric defaults for missing optional runtimeConfig fields ([200ee12](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/200ee124d3900264248e1c2d35cdc8a74a76b79d))


### Features

* **core:** persist resolved runtime numeric config to JSON cache file ([e1f0ea2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/e1f0ea2e10362492d917c25d09637589e1041edd))

## [1.43.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.43.1...v1.43.2) (2026-05-13)


### Bug Fixes

* **core:** upgrade jest-html-reporter to v4.4.0 for TypeScript 6 compatibility ([3966f59](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/3966f59409d5d39dda143affa9c5cf2f800a367e))
* **core:** upgrade TypeScript to v6.0 to support ts-patch v4 ([20c08c9](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/20c08c9f53692b63eccc7f9a7b0060fa715e38d3)), closes [#535](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/535)

## [1.43.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.43.0...v1.43.1) (2026-05-12)


### Bug Fixes

* **core:** replace StubClaudeRepository with OauthAPIProxyClaudeRepository in schedule path ([1d18b80](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/1d18b80b600699f33b51d0ccc3a33ea7c3687313)), closes [#525](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/525)

# [1.43.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.42.4...v1.43.0) (2026-05-11)


### Bug Fixes

* **core:** skip NaN utilization from malformed proxy headers and add bin artifacts ([28cc81a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/28cc81a5cedeb98a0ae054193806c8d414cecfa9))


### Features

* **core:** add OauthProxyClaudeRepository and OauthAPIProxyClaudeRepository ([2f9262e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2f9262e601e3c2f173852ba53bcd2684a5a03c7d)), closes [#511](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/511)

## [1.42.4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.42.3...v1.42.4) (2026-05-11)


### Bug Fixes

* **core:** mock Google Sheets API in tests to prevent quota exceeded CI failures ([12fb71a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/12fb71a696ad3f0b5a5248ec42ae02f677b276b2)), closes [#379](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/379)
* **test:** mock Google Sheets API to prevent quota exceeded flakiness ([94266bf](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/94266bf83792313e3fe2e1be474500adc3f65fd1)), closes [#373](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/373) [#379](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/379)

## [1.42.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.42.2...v1.42.3) (2026-05-11)


### Bug Fixes

* **core:** persist Preparation status via updateStatus in StartPreparationUseCase ([8335c0e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/8335c0e705a9d528e89177edb80c9f4e811bc3f4))

## [1.42.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.42.1...v1.42.2) (2026-05-09)


### Bug Fixes

* **core:** add retry logic to refreshCookie to reduce flaky CI failures ([64643ac](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/64643ac5e09713532aa62bfaaa39d3ced0a978ce))
* **core:** change misleading 'Closed all depended issues' message to clarify bot did not close them ([6e44b2d](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/6e44b2d00b3ce8fef72bf15e92209de854967e2a))

## [1.42.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.42.0...v1.42.1) (2026-05-08)


### Bug Fixes

* **core:** add NODE_OPTIONS=--experimental-vm-modules for Jest ESM compatibility ([068f68c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/068f68cf7ffc48bbb8b696a39321fce65d785d86))
* **core:** use jest setup to provide fetch for gaxios, avoiding node-fetch ESM import ([9ebcf0c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/9ebcf0c411b221de30b00e39cae3df6d83f6512e))
* **deps:** update dependency googleapis to v171 ([269fa28](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/269fa283ecaa9fd49b7ece7464d59a284983e1bc))

# [1.42.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.41.0...v1.42.0) (2026-05-07)


### Features

* **core:** add Codex CODEX_HOME candidate selection to TDPM ([4db5452](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4db545280527abbaf3dbe3227908bed0928e9eb9))

# [1.41.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.40.0...v1.41.0) (2026-05-07)


### Bug Fixes

* **core:** use POSIX positional parameter to prevent shell injection in RevertOrphanedPreparationUseCase ([1d73934](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/1d73934179506ed70865455b4e495efbfbc61ee8))
* **core:** validate branch name before shell execution to satisfy CodeQL uncontrolled-command-line ([c40bace](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c40baced13d98511c7c16681a6a0e59defb415ab))


### Features

* **core:** port StartPreparationUseCase from preparator into TDPM ([1c86aa5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/1c86aa58c7eedeb4a5c6931d62ed4febc8f4a248)), closes [npm-cli-#issue-preparator](https://github.com/npm-cli-/issues/issue-preparator) [#480](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/480)

# [1.40.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.39.0...v1.40.0) (2026-05-07)


### Bug Fixes

* **core:** replace type assertions with type guard functions in ApiV3CheerioRestIssueRepository ([f6c71cb](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/f6c71cbdb52b136ad2ddfda582011e456c67e01d))
* **core:** use typia.is for proper runtime type validation in ApiV3CheerioRestIssueRepository ([2e3b77c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2e3b77cc829ba03be489942ebb38f3e3d91b85e6))


### Features

* **core:** port NotifyFinishedIssuePreparationUseCase from preparator ([2751863](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/275186338a59d7b22fec1d39d4743b552da7975e))

# [1.39.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.38.1...v1.39.0) (2026-05-04)


### Features

* **core:** add progress logs to HandleScheduledEventUseCase story-issue creation loop ([a9f5e37](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/a9f5e3712833da43efc18ee9ff709b074339e52c)), closes [#441](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/441)

## [1.38.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.38.0...v1.38.1) (2026-05-04)


### Bug Fixes

* **core:** skip issues with story: label in SetNoStoryIssueToStoryUseCase ([9e325a3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/9e325a3eaccc1e2c3ea5ca3288b459ed12d4d08e))

# [1.38.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.37.1...v1.38.0) (2026-05-04)


### Features

* **core:** add RevertOrphanedPreparationUseCase + preparationProcessCheckCommand config ([4775bac](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4775baccd359fc51145b261153fda946b5ce3c09)), closes [#434](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/434)

## [1.37.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.37.0...v1.37.1) (2026-05-03)


### Bug Fixes

* **core:** throw on incomplete fetchProjectItems response to prevent duplicate story issues ([934b539](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/934b539e4350e06c8aac6d38de4ef134241081d2))

# [1.37.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.36.3...v1.37.0) (2026-05-03)


### Bug Fixes

* **core:** remove explicit null check in date skip condition ([dc7df7d](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/dc7df7d4d5f69dab16c5bcf410fb92044e5d1c62))


### Features

* **core:** clear nextActionDate when it is before today ([0136f37](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/0136f375e04ce37bf730bc7a121a563aa3e1b679))

## [1.36.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.36.2...v1.36.3) (2026-04-17)


### Bug Fixes

* **core:** make removeLabel idempotent and add error context in UpdateIssueStatusByLabelUseCase ([cee85d1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/cee85d165d59de44d1a7d2f7f36338a1b9b2ca1d)), closes [#403](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/403) [HiromiShikata/secretary#566](https://github.com/HiromiShikata/secretary/issues/566)

## [1.36.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.36.1...v1.36.2) (2026-04-17)


### Bug Fixes

* **core:** map all story:* labels to regular stories and remove label after processing ([9ef50a8](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/9ef50a858660fc80cd775a689775533daf42bc8e))

## [1.36.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.36.0...v1.36.1) (2026-04-09)


### Bug Fixes

* **core:** include issue url in error when updateAssigneeList fails ([2f9358b](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2f9358b8db223466c5fb63c8b175ea720a6d3afc))

# [1.36.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.35.2...v1.36.0) (2026-04-04)


### Bug Fixes

* **core:** prefix unused verbose param with underscore to satisfy lint ([3b630da](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/3b630dab382c3863fef822bface0f76c404c4fd7))
* **core:** update BaseGitHubRepository test to mock ky instead of axios ([ff79941](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/ff7994119980ea2052d8c19795f7786c0736ada5))
* **core:** update GraphqlProjectItemRepository test to mock ky instead of axios ([ad22d19](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/ad22d19ecff71fba251b2d0db82be8c5158c4294))


### Features

* **core:** remove axios completely, replace with ky ([0b924c4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/0b924c4fd00b0db3014a53dfd37c03af9709805b)), closes [#392](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/392)
* **core:** use ky instead of native fetch in adapter repositories ([6aaaa88](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/6aaaa88bc29fb18aa31618f6a6fe44d89c2fa90b))

## [1.35.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.35.1...v1.35.2) (2026-04-04)


### Bug Fixes

* **core:** use profile page URL in refreshCookie to reliably detect login status ([1f594e4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/1f594e4e0220a2870e301d23e3d4cfc1e33880b1)), closes [#397](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/397)
* **core:** use user-login meta tag to detect authenticated GitHub session ([17517f8](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/17517f8c7002e10d14914a2b4e8c72a93ed9fa67))

## [1.35.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.35.0...v1.35.1) (2026-04-03)


### Bug Fixes

* **adapter:** trim whitespace from dependedIssueUrls when parsing project field ([5483215](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/5483215edb7f59d170070533b1233dae00f98883)), closes [#384](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/384)

# [1.35.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.34.3...v1.35.0) (2026-04-02)


### Bug Fixes

* **core:** do not use defaultStatus as fallback for unrecognized status labels ([f3f1343](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/f3f13439cf8958751405776ba36644c78c82b651))


### Features

* **core:** implement defaultStatus in UpdateIssueStatusByLabelUseCase ([157d2ea](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/157d2ea052837dcd5a830ec295f98ceebfea8f1f)), closes [#365](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/365)
* **core:** use defaultStatus as fallback when status label value is unrecognized ([5871499](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/587149914741e60b60a07caf822befe8ce37c15b))

## [1.34.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.34.2...v1.34.3) (2026-04-02)


### Bug Fixes

* **deps:** update axios to v1.14.0 to resolve plain-crypto-js removal ([1d3d7a5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/1d3d7a5f43fb59b37946bd6c408816a8322026f2))

## [1.34.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.34.1...v1.34.2) (2026-03-28)


### Bug Fixes

* **core:** distinguish removed dependencies from closed ones in ClearDependedIssueURLUseCase ([1309d11](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/1309d118e68be33fcafb1e4062a92f0d53bbe17b))

## [1.34.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.34.0...v1.34.1) (2026-03-28)


### Bug Fixes

* **core:** align GetStoryObjectMapUseCaseHandler header redaction with HandleScheduledEventUseCaseHandler ([58ed445](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/58ed445b381d03afdd9f6e12d536c5a4ade3f09b))
* **core:** improve Authorization/cookie header redaction and add tests ([ba57a9e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/ba57a9e1c1afc52c7c301de65cab6fa06aaef160)), closes [#374](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/374)
* **security:** redact Authorization header in verbose error logging ([5551e44](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/5551e449f1c0b1e18169a27ae169583977d34f0e)), closes [#374](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/374)

# [1.34.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.33.0...v1.34.0) (2026-03-22)


### Features

* **cli:** add startDaemon and notifyFinishedIssuePreparation commands ([72fe2c4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/72fe2c43c0423f5760f27640704fc79af1078b5d))

# [1.33.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.32.0...v1.33.0) (2026-03-21)


### Bug Fixes

* **core:** remove non-null assertion in HandleScheduledEventUseCase filter ([b7c8cfd](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b7c8cfd038f84cd7e9c833a9a0caf8abce79adb9))


### Features

* **core:** integrate NotifyFinishedIssuePreparationUseCase into scheduled event handling ([afe84bf](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/afe84bff4984a2503f54c8ceb43e50eafca44931)), closes [npm-cli-#issue-preparator](https://github.com/npm-cli-/issues/issue-preparator) [#339](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/339)
* **core:** migrate NotifyFinishedIssuePreparationUseCase to match preparator ([e19a42d](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/e19a42d3e1853183670488d156286af0394f13d4))

# [1.32.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.31.0...v1.32.0) (2026-03-21)


### Features

* **core:** integrate StartPreparationUseCase into HandleScheduledEventUseCase chain ([d346cfc](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d346cfc65480bd1f8b86b8d915404bc975abe97a))

# [1.31.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.30.2...v1.31.0) (2026-03-16)


### Bug Fixes

* **core:** keep isInProgress field in Issue entity ([b5c756b](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b5c756b662311c2b4a6f3e8bc5b3abcbc94e002d))


### Features

* **core:** remove checkInProgress from AnalyzeProblemByIssueUseCase ([91daf23](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/91daf232d7c6c998a48da2865ba66a4e72abae8b))

## [1.30.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.30.1...v1.30.2) (2026-03-15)


### Bug Fixes

* **deps:** update dependency typia to v12 ([aa8655d](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/aa8655d7a80a4627e15cabc2ececfcb75c548b8b))

## [1.30.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.30.0...v1.30.1) (2026-03-14)


### Bug Fixes

* **deps:** update dependency dotenv to v17 ([648278e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/648278ef003a6b291fe46739e8121fc4ae3272d1))

# [1.30.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.29.0...v1.30.0) (2026-03-09)


### Features

* **core:** upgrade gh-cookie package from 1.3.9 to 1.3.22 ([a53edd0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/a53edd0ecc99bcd519768f43ab5ecaa07171af42)), closes [#cookie](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/cookie)

# [1.29.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.28.0...v1.29.0) (2026-03-08)


### Features

* **core:** add story view link to top of story issue in ConvertCheckboxToIssueInStoryIssueUseCase ([6325145](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/6325145baed3e55783220a32dffcfa9e2d12768e))

# [1.28.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.27.1...v1.28.0) (2026-03-04)


### Features

* **core:** integrate preparator entity and adapter interface types ([b2e2867](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b2e28678e616dfdedf5f2ddf5d611f191de8556a))

## [1.27.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.27.0...v1.27.1) (2026-03-02)


### Bug Fixes

* **core:** pass bot credentials from config to BaseGitHubRepository ([73253ba](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/73253ba086a8491d70a88bda157d573072d49d1d))

# [1.27.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.26.0...v1.27.0) (2026-02-28)


### Features

* **core:** add parent issue link to auto-created child issue description ([f5a26e2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/f5a26e2fb9239aa1f4f54c189de8e03f4f17f6fa))

# [1.26.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.25.0...v1.26.0) (2026-02-26)


### Features

* **adapter:** add sleep between paginated GraphQL requests to avoid 403 ([05d408f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/05d408fd63c14d06a687dffecb2f872ba4afc30a))

# [1.25.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.24.0...v1.25.0) (2026-02-16)


### Features

* **core:** create NotifyFinishedIssuePreparationUseCase from npm-cli-gh-issue-preparator ([2fb3306](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2fb33067734bec51a8d1f0e871478a6bc3ddd22f)), closes [npm-cli-#issue-preparator](https://github.com/npm-cli-/issues/issue-preparator)
* **core:** create StartPreparationUseCase from npm-cli-gh-issue-preparator reference ([6e35aac](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/6e35aac4eb51e724fdd360c615de2bd31a9092bd)), closes [npm-cli-#issue-preparator](https://github.com/npm-cli-/issues/issue-preparator)

# [1.24.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.23.0...v1.24.0) (2026-02-16)


### Features

* **core:** add allowIssueCacheMinutes config parameter to HandleScheduledEventUseCase ([9e7bacc](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/9e7bacc5206ebbeb90b5da065f0726180c62498e))

# [1.23.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.22.0...v1.23.0) (2026-02-16)


### Features

* **core:** add disabled option to config.yml ([d76ca22](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d76ca22e38dd55c725102d2d45d14588eabb728e))

# [1.22.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.21.2...v1.22.0) (2026-02-16)


### Features

* **core:** add allowCacheMinutes to exported getStoryObjectMap function ([6385541](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/6385541dd1862fa1cc0e05ebfcc18f8a6f04d4b7))

## [1.21.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.21.1...v1.21.2) (2026-02-15)


### Bug Fixes

* **core:** reduce API calls by fetching labels, assignees, createdAt in GraphQL query ([162c858](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/162c858ba15cda19b4864511133cc8706e76df2d)), closes [#311](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/311)

## [1.21.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.21.0...v1.21.1) (2026-02-09)


### Bug Fixes

* **core:** configure OIDC trusted publishing for npm releases ([c5d44b7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/c5d44b72b94ae47abdd70abf6651648853187a75))
* **core:** upgrade semantic-release to v25 for OIDC trusted publishing ([b0fcdc5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b0fcdc5dd4e29cf67ccb77ec7a589c6d1bd458c2))

## [1.16.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.16.2...v1.16.3) (2025-12-22)


### Bug Fixes

* **core:** use hasNextPage for pagination to prevent infinite loop ([9fc8907](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/9fc890774c66f9dd116f1f4ba23b885067d3777f))
* **lint:** remove type assertion to satisfy no-type-assertion rule ([4cef9df](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/4cef9df488c7b163c16e5e7e0b1ac5617e1d011f))
* **test:** make GitHubBetaFeatureViewData type more flexible ([b625775](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b625775fde4776f3175cb56fc3ec1c5e307a9fba))
* **test:** relax GitHubBetaFeatureViewData validation ([57b9049](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/57b904962810ec2c5115e16cac12f268f96c42b3))
* **test:** update integration tests for GitHub data structure changes ([adf808b](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/adf808b450c92156547d3f57fb92743d11af0174))

## [1.16.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.16.1...v1.16.2) (2025-10-18)


### Bug Fixes

* failed to get issue data ([042e9c7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/042e9c700fc39069766b3698106ee37f77b7e973))

## [1.16.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.16.0...v1.16.1) (2025-10-13)


### Bug Fixes

* removed last story when create new story by labe ([1a19173](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/1a19173adc42f6be5da5dc6181ebf9c4b7902ea6))

# [1.16.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.15.10...v1.16.0) (2025-10-11)


### Features

* assign manager to no assignee issues ([249db2f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/249db2f4a11a942689d035d5eb92b133e6142ca8))
* create CreateNewStoryByLabelUseCase ([ac93f5b](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/ac93f5b1bd367704b561f4a8cf168ea7d3132ee3))
* integrate CreateNewStoryByLabelUseCase ([bbf611a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/bbf611a978d34443254d0fc949c7e8b4ae822746))

## [1.15.10](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.15.9...v1.15.10) (2025-08-05)


### Bug Fixes

* make fields optional for internal api ([bd84bf1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/bd84bf16a29f4eeab6d5d61c6d88467a8e09fd52))
* wait 2sec for internal api ([ee84101](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/ee84101e59e45d8ae90607ce89dff869a37db100))

## [1.15.9](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.15.8...v1.15.9) (2025-07-31)


### Bug Fixes

* disable dotenv warning ([840f613](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/840f61384ce55d1841c04ddcc0d3474f5be70188))
* internal api type error ([25bd25c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/25bd25cb89f6ff70ac341f1ef6e14fd5ed858e78))

## [1.15.8](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.15.7...v1.15.8) (2025-07-15)


### Bug Fixes

* `npm i gh-cookie@1.3.9` / close [#178](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/178) ([528139f](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/528139f0b07005c114e0a95c8b0898413ad5f4c3))

## [1.15.7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.15.6...v1.15.7) (2025-05-18)


### Bug Fixes

* **deps:** update dependency commander to v14 ([7de04f6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/7de04f6c7c4741a4b8663d21415d8839591c926a))

## [1.15.6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.15.5...v1.15.6) (2025-05-17)


### Bug Fixes

* failed to correct timeline from internal api ([163285c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/163285ce184ff34c3897281f8cc52120445d24bd))

## [1.15.5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.15.4...v1.15.5) (2025-05-16)


### Bug Fixes

* follow internal api changes ([07d552e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/07d552eb2727de5a887500b77dbef17557ab55aa))

## [1.15.4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.15.3...v1.15.4) (2025-04-19)


### Bug Fixes

* **deps:** update dependency typia to v9 ([b2508ef](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b2508ef4cbe85604f4699f48570a96c5d31c63ac))

## [1.15.3](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.15.2...v1.15.3) (2025-04-06)


### Bug Fixes

* **deps:** update dependency axios to v1.8.2 [security] ([8aef3d5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/8aef3d5c51012adb2d0117931223e742727cdaa3))

## [1.15.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.15.1...v1.15.2) (2025-03-27)


### Bug Fixes

* missing orange of color ([00d149c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/00d149c13fd2beb183bec0e4d0584b711068337e))

## [1.15.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.15.0...v1.15.1) (2025-03-01)


### Bug Fixes

* **deps:** update dependency googleapis to v146 ([804f340](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/804f34036d6c98846972009e45ebd577f4071892))

# [1.15.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.14.2...v1.15.0) (2025-02-25)


### Features

* removed useless phase ([bbaae9e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/bbaae9ed55d6cb751002e08c2b35d3dc57bb3949))

## [1.14.2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.14.1...v1.14.2) (2025-02-25)


### Bug Fixes

* change order to update story / close [#148](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/148) ([2f951c0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2f951c077f8f46de04e253e05f062d7e8d8f5637))

## [1.14.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.14.0...v1.14.1) (2025-02-23)


### Bug Fixes

* use id for disable status ([1b852fb](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/1b852fbf25696c033e231ea484015a96ab80979d))

# [1.14.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.13.0...v1.14.0) (2025-02-23)


### Features

* change status by story color / close [#134](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/134) ([ff647b4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/ff647b4032d74c1bb7870ada94e1014be6a4bb03))
* set first story if issue has no story / close [#110](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/110) ([8cec4bb](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/8cec4bb606ba6b707b59e020923c7fd4a8cb8445))

# [1.13.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.12.0...v1.13.0) (2025-01-28)


### Features

* create an issue when failed to complete usecases / close / https://github.com/HiromiShikata/umino-corporait-operation/issues/13641 ([a81cf0d](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/a81cf0db6cb112feea8a3274d17094b58f4d6550))

# [1.12.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.11.0...v1.12.0) (2025-01-27)


### Features

* add methods to remove items from project ([#117](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/117)) ([fb96e67](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/fb96e673532e6b666201f50124aae9cb03573991))

# [1.11.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.10.0...v1.11.0) (2025-01-27)


### Features

* exclude 'story' label from estimation issues ([90f89d5](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/90f89d5ebccdaeae0b833bcf009c453727e433d1))

# [1.10.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.9.0...v1.10.0) (2025-01-26)


### Features

* add createdAt field to Issue entity ([cc2929e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/cc2929ef4ab96c20c306ac9faaeeb98868065f6e)), closes [#63](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/63)

# [1.9.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.8.0...v1.9.0) (2025-01-25)


### Features

* stop creating estimation issues on weekends ([71ca29b](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/71ca29b950932068709849d20dc4de2c07299cfd))

# [1.8.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.7.1...v1.8.0) (2025-01-25)


### Features

* check once in a week if completion date is 1 week after / close https://github.com/HiromiShikata/7sea.world/issues/1864 ([d8e1630](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d8e1630c0f89883c92e6a6e44dc4a8ad21a55605))

## [1.7.1](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.7.0...v1.7.1) (2025-01-19)


### Bug Fixes

* update version in package.json ([f413ba6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/f413ba6cf6ca8ea824280d1236e6809f70974ac1))

# [1.6.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.5.0...v1.6.0) (2025-01-08)


### Features

* add checkbox to story lines in story progress ([#41](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/41)) ([8ad67ba](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/8ad67ba34e283b53a4d867e61d8d978d2666f8c8))

# [1.5.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.4.0...v1.5.0) (2025-01-07)


### Bug Fixes

* correct constructor argument order for ChangeStatusLongInReviewIssueUseCase ([#21](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/21)) ([2a70ce0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2a70ce0f33f3f0ff40a7237a2231179694dcb086))


### Features

* integrate ChangeStatusLongInReviewIssueUseCase ([#21](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/21)) ([03d1527](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/03d15276e6a8247ffd15081abc921ff72ee5dff0))

# [1.4.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.3.0...v1.4.0) (2025-01-06)


### Bug Fixes

* bug of story issue conut in story progress issue ([57ffc8d](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/57ffc8d4632188d207561c93512f763fbc653988))
* change time to create story analysis issue ([8baf4ca](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/8baf4ca4ccd0f1b150e304735868baaa58654143))


### Features

* add interface to search issues by query ([81276ad](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/81276adcd10bcff75520201e7e8c5d967b2032cf))
* extend maximum targetDate to 300min ([da94661](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/da94661f2cd3e2a4c13f49b67f919ba9b3c55514))
* remove values for estimation fields to update ([d05eab7](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d05eab7e6e3ccad193be818e6eefb6334cbfc786))

# [1.3.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.2.0...v1.3.0) (2025-01-04)


### Bug Fixes

* avoid to create issues on checkbox only issue number ([02422e2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/02422e269b4c5e530acf931ba12278dcf65e40d4))
* calcuration of target next action hour ([5464b7a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/5464b7aaa40d39f72e1daee10121bd651bab876a))
* retry if internal graphql api returns error ([3015a52](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/3015a527b2c4b00f4ed1165c520ace75043629d9))
* run with cache to clear next action hour ([0253421](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/0253421a97cf26dc8e14302fc50df01c66f31f69))
* trim checkbox text before check issue should be created ([8cabea2](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/8cabea210bc4935a2f69b63325110ed35abe5669))
* update issue body after a issue created everytime ([87d8baf](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/87d8bafadd7bc73c7ec65dd73806d7d7665caef5))


### Features

* add verbose option ([0ac6b07](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/0ac6b071bbbc33fae62ecc9ae908f9a5ea86a5f7))
* remove next action date if it is past date ([a887274](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/a88727460e81c16774a322eb02c6a7c17a8038f3))
* show table for story summary ([703e573](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/703e57304da6593a97f4e92253254f6ef81fabb2))
* use ConvertCheckboxToIssueInStoryIssueUseCase ([7725461](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/7725461e7f043b5196a350975447cfbfd5af6ed6))

# [1.2.0](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/compare/v1.1.0...v1.2.0) (2025-01-02)


### Bug Fixes

* encodeURI for % and & ([d4f1a2e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/d4f1a2ea4e67b31b14a10ed866d6ea6aef5f133f))
* failed to get completion date and dependign issue field ([8314a7c](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/8314a7c61e5a549370fa96554be1e1be9d275890))
* failed to get id when get issue data only 1 ([2bacf46](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2bacf4677caca918dda7e654d9d944879848611f))
* failed to normalize field name ([9600dd9](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/9600dd9dd243a459bf123446898a4dee171e3fe1))
* use red if story color is pink ([64e2dd6](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/64e2dd6a95e00031fe6776456fbc4052128d600e))


### Features

* add formatDateWityDayOfWeek in SystemDatetimeRepository ([18e4d55](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/18e4d559e802be47e54005f6488d6f4f3747a6bc))
* add new field to issue of dependedIssueUrlSeparatedByComma, completationDate ([bd7c3cc](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/bd7c3cc368c71de7287823baa0c0d0006bd8256e))
* add remove to LocalStorageRepository ([cb6320e](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/cb6320eab34caeeafd6cf5a661d6784a8bb7a299))
* add unhandled story to summary ([fa5b622](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/fa5b622b2eafcc70e78a8755bfb909993c87e552))
* analyze stories at 7:00am ([b91dd0a](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b91dd0afbbcd782a5d19080c17da19d7f356b117))
* configure creds in yaml ([5d5dcd4](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/5d5dcd411f93758e8122f629d14c38215cdbf7da))
* ignore pr when check in progress ([9aececc](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/9aececc82dfadda71182fcc18e615ef78bf8a696))
* refreshCookie before collecting data ([85f8189](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/85f8189042b30b1f7393e852e81434a5fb50499b))
* remove mention from working timeline ([87b6958](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/87b69581811167c4966e9fe6892bc21aa81f8785))
* retry if project is not set ([12cf0be](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/12cf0bed4a2e394c048d6d6e63a4b900e020e59a))
* run clearDependedIssueURLUseCase ([b4505fc](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/b4505fcb81cdee4fd9283941e5f27a7425bf64f1))
* show flowchart ([44b2a02](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/44b2a0259ef72b650e19a894b8170346559c7722))
* skip issue creation if no vioration ([2267263](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/22672632609b4f06f0b516e98084674439431ac9))
* use createEstimationIssueUseCase ([2cbb9db](https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/commit/2cbb9db3c09a3ca37b4d273c55adb23d04fff40c))
