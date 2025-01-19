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
