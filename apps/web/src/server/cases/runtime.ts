import type { Kysely } from "kysely";

import { CaseTypeId } from "~/domain/ids";
import type { FilesRuntime } from "~/server/files/runtime";
import type { FileOperationContext } from "~/server/files/service/contracts";
import type { WorkspaceDatabase } from "~/server/platform/database/types";
import { createExecutorUow } from "~/server/platform/database/uow";
import type { OperationContext } from "~/server/platform/operation/context";

import {
  issueCaseFileToken,
  uploadCaseFile,
  type CaseFileUpload,
} from "./application/case-files";
import { defineCaseType } from "./application/define-case-type";
import { exportCaseReport } from "./application/export-cases";
import {
  bindOpenCaseTx,
  openCase,
  type OpenCaseCommand,
} from "./application/open-case";
import {
  listCases,
  listCaseTypeDefinitions,
  listCaseTypes,
  listWaitingCases,
  readCase,
} from "./application/read-cases";
import {
  reassignCase,
  type ReassignCaseCommand,
} from "./application/reassign-case";
import { timeOutDueStages } from "./application/time-out-stages";
import { writeStage, type WriteStageCommand } from "./application/write-stage";
import type { CaseTypeDefinition } from "./domain/definition";
import { createCasesRepo } from "./infrastructure/cases-repo";

export function createCasesRuntime(deps: {
  executor: Kysely<WorkspaceDatabase>;
  files: Pick<FilesRuntime, "repo" | "storage">;
}) {
  const uow = createExecutorUow(deps.executor, createCasesRepo);
  const openUow = createExecutorUow(deps.executor, bindOpenCaseTx);
  const reads = createCasesRepo(deps.executor);

  return {
    types: (roleKey: string) => listCaseTypes(reads, roleKey),
    definition: (id: CaseTypeId) => reads.findCaseTypeById(id),
    definitions: () => listCaseTypeDefinitions(reads),
    stages: async (caseTypeId: string) => {
      const id = CaseTypeId.parse(caseTypeId);
      if (!id.ok) return [];
      const stored = await reads.findCaseTypeById(id.value);
      return (stored?.definition.stages ?? []).map(({ key, name }) => ({
        key,
        name,
      }));
    },
    list: (input: Parameters<typeof listCases>[1]) => listCases(reads, input),
    waiting: (input: Parameters<typeof listWaitingCases>[1]) =>
      listWaitingCases(reads, input),
    read: (input: Parameters<typeof readCase>[1]) => readCase(reads, input),
    branches: () => reads.listBranches(),
    roleNames: () => reads.listRoleNames(),
    report: (input: Parameters<typeof exportCaseReport>[1]) =>
      exportCaseReport(reads, input),
    defineCaseType: (
      definition: CaseTypeDefinition,
      operation: OperationContext,
    ) => defineCaseType(definition, uow, operation),
    open: (command: OpenCaseCommand, operation: OperationContext) =>
      openCase(command, openUow, operation),
    writeStage: (command: WriteStageCommand, operation: OperationContext) =>
      writeStage(command, uow, operation),
    reassign: (command: ReassignCaseCommand, operation: OperationContext) =>
      reassignCase(command, uow, operation),
    timeOutDue: (at: Date) =>
      timeOutDueStages({ executor: deps.executor, uow }, at),
    uploadFile: (ctx: FileOperationContext, file: CaseFileUpload) =>
      uploadCaseFile(deps.files, ctx, file),
    fileToken: (
      ctx: FileOperationContext,
      input: Parameters<typeof issueCaseFileToken>[2],
    ) => issueCaseFileToken({ reads, files: deps.files }, ctx, input),
  };
}

export type CasesRuntime = ReturnType<typeof createCasesRuntime>;
