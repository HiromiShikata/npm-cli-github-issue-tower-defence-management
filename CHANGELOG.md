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
