export const claudePrintModeFlagOf = (commandArguments: string[]): boolean =>
  commandArguments.some(
    (commandArgument) =>
      commandArgument === '-p' || commandArgument === '--print',
  );
