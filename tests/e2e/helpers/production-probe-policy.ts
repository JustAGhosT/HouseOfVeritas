export function productionProbePolicy(isPostDeployProbe: boolean, isCI: boolean) {
  return {
    retries: isPostDeployProbe ? 0 : isCI ? 2 : 0,
    trace: isPostDeployProbe ? ("off" as const) : ("on-first-retry" as const),
  }
}
