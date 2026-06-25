"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeInTmuxByHumanData = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const GenerateInTmuxByHumanDataUseCase_1 = require("../../../domain/usecases/intmux/GenerateInTmuxByHumanDataUseCase");
const writeJsonAtomic = (filePath, data) => {
    const dir = path_1.default.dirname(filePath);
    fs_1.default.mkdirSync(dir, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs_1.default.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`);
    fs_1.default.renameSync(tmpPath, filePath);
};
const writeInTmuxByHumanData = (params) => {
    const { inTmuxDataOutputDir, inTmuxConsoleBaseUrl, inTmuxConsoleToken, inTmuxProjectOrder, pjcode, assigneeLogin, org, repo, project, issues, now, } = params;
    if (!inTmuxDataOutputDir || !pjcode || !assigneeLogin) {
        return;
    }
    const data = new GenerateInTmuxByHumanDataUseCase_1.GenerateInTmuxByHumanDataUseCase().run({
        project,
        issues,
        pjcode,
        assigneeLogin,
        org,
        repo,
        consoleBaseUrl: inTmuxConsoleBaseUrl ?? null,
        consoleToken: inTmuxConsoleToken ?? null,
        now,
    });
    writeJsonAtomic(path_1.default.join(inTmuxDataOutputDir, `${pjcode}.json`), data.v1);
    writeJsonAtomic(path_1.default.join(inTmuxDataOutputDir, `${pjcode}.v2.json`), data.v2);
    if (data.v3) {
        writeJsonAtomic(path_1.default.join(inTmuxDataOutputDir, `${pjcode}.v3.json`), data.v3);
    }
    if (data.v4) {
        writeJsonAtomic(path_1.default.join(inTmuxDataOutputDir, `${pjcode}.v4.json`), data.v4);
    }
    if (!inTmuxProjectOrder || inTmuxProjectOrder.length === 0) {
        return;
    }
    const presentProjects = inTmuxProjectOrder.filter((name) => fs_1.default.existsSync(path_1.default.join(inTmuxDataOutputDir, `${name}.json`)));
    writeJsonAtomic(path_1.default.join(inTmuxDataOutputDir, 'index.json'), {
        projects: presentProjects,
    });
    writeJsonAtomic(path_1.default.join(inTmuxDataOutputDir, 'index.v2.json'), {
        version: 2,
        projects: presentProjects,
    });
    writeJsonAtomic(path_1.default.join(inTmuxDataOutputDir, 'index.v3.json'), {
        version: 3,
        projects: presentProjects,
    });
    if (inTmuxConsoleToken) {
        const outputDirBasename = path_1.default.basename(inTmuxDataOutputDir);
        writeJsonAtomic(path_1.default.join(inTmuxDataOutputDir, 'index.v4.json'), {
            version: 4,
            projects: presentProjects.map((name) => ({
                name,
                path: `/${outputDirBasename}/${name}.v4.json?k=${inTmuxConsoleToken}`,
            })),
        });
    }
};
exports.writeInTmuxByHumanData = writeInTmuxByHumanData;
//# sourceMappingURL=inTmuxByHumanDataWriter.js.map