"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheerioProjectRepository = void 0;
const axios_1 = __importDefault(require("axios"));
const BaseGitHubRepository_1 = require("./BaseGitHubRepository");
class CheerioProjectRepository extends BaseGitHubRepository_1.BaseGitHubRepository {
    constructor(localStorageRepository, jsonFilePath = './tmp/github.com.cookies.json', ghToken = process.env.GH_TOKEN || 'dummy', ghUserName = process.env.GH_USER_NAME, ghUserPassword = process.env.GH_USER_PASSWORD, ghAuthenticatorKey = process.env
        .GH_AUTHENTICATOR_KEY) {
        super(localStorageRepository, jsonFilePath, ghToken, ghUserName, ghUserPassword, ghAuthenticatorKey);
        this.localStorageRepository = localStorageRepository;
        this.jsonFilePath = jsonFilePath;
        this.ghToken = ghToken;
        this.ghUserName = ghUserName;
        this.ghUserPassword = ghUserPassword;
        this.ghAuthenticatorKey = ghAuthenticatorKey;
        this.updateStoryList = async (project, newStoryList) => {
            const headers = await this.createHeader();
            const res = await axios_1.default.put(`https://github.com/memexes/${project.databaseId}/columns`, {
                memexProjectColumnId: project.story?.databaseId,
                settings: {
                    width: 200,
                    options: newStoryList,
                },
            }, {
                headers: {
                    'github-verified-fetch': 'true',
                    origin: 'https://github.com',
                    'x-requested-with': 'XMLHttpRequest',
                    ...headers,
                },
            });
            return res.data.memexProjectColumn.settings.options.map((v) => ({
                id: v.id,
                name: v.name,
                color: v.color,
                description: v.description,
            }));
        };
    }
}
exports.CheerioProjectRepository = CheerioProjectRepository;
//# sourceMappingURL=CheerioProjectRepository.js.map